export function cloudErrorText(error) {
  const code = error?.code || error?.name;
  const message = error?.message || String(error || '原因未知');
  return (code && code !== 'Error' ? code + '：' : '') + message;
}
export let lastSubmissionError = null;
// A missing document is normal before the first submission. Other failures must propagate.
export async function readOptionalDocument(ref) {
  try {
    const result = await ref.get();
    if (result?.code === 'DOCUMENT_NOT_FOUND') return {data: []};
    if (result?.code) throw Object.assign(new Error(result.message || '课堂数据读取失败'), {code: result.code});
    return result;
  } catch (error) {
    if (error?.code === 'DOCUMENT_NOT_FOUND') return {data: []};
    throw error;
  }
}

// The same record is used by the model, observation, assembly and journey pages.
// Drafts stay on this device; one small upload is attempted on each explicit submission.
export const groupId = Math.max(1, Math.min(12, Number(new URLSearchParams(location.search).get('group')) || 1));
const environment = 'motionless-harrier-d7cuz0659ef1a';
const collectionName = 'food-journey-groups';
export const maxPhotoPreviewLength = 65536;

export function isPhotoPreview(value) {
  return typeof value === 'string' && value.length <= maxPhotoPreviewLength &&
    /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('foodJourneyClass', 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('learningRecords')) {
        request.result.createObjectStore('learningRecords', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function allRecords() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction('learningRecords').objectStore('learningRecords').getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function saveRecord(record) {
  record.updatedAt = Date.now();
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction('learningRecords', 'readwrite');
    transaction.objectStore('learningRecords').put(record);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  return record;
}

export async function currentRecord() {
  const records = await allRecords();
  let resetId = null;
  try {
    let resetTimer;
    const result = await Promise.race([
      (async () => { const db = await cloudDb(); return readOptionalDocument(db.collection(collectionName).doc('class-reset')); })(),
      new Promise((_, reject) => { resetTimer=setTimeout(() => reject(new Error('课堂轮次读取超时')),2500); })
    ]).finally(()=>clearTimeout(resetTimer));
    if (result?.code) throw new Error(result.message || '课堂轮次读取失败');
    const data = Array.isArray(result.data) ? result.data[0] : result.data;
    resetId = typeof data?.resetId === 'string' ? data.resetId : null;
    if (localStorage.getItem('lesson-known-round') !== JSON.stringify(resetId)) {
      for (let id=1; id<=12; id++) localStorage.removeItem('food-journey-game-v3-group-'+id);
    }
    localStorage.setItem('lesson-known-round', JSON.stringify(resetId));
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('learningRecords', 'readwrite');
      for (const item of records) {
        if (item.lesson === 'food-journey' && (item.resetId || null) !== resetId) tx.objectStore('learningRecords').delete(item.id);
      }
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch { try { resetId = JSON.parse(localStorage.getItem('lesson-known-round')); } catch {} }
  const latest = records.filter((item) => item.lesson === 'food-journey' && Number(item.groupId) === groupId && ((item.resetId || null) === resetId))
    .sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt))[0];
  if (latest) return latest;
  const now = Date.now();
  return { id: `group-${groupId}-${now}-${Math.random().toString(36).slice(2, 7)}`,
    groupId, lesson: 'food-journey', resetId, createdAt: now, updatedAt: now,
    v1: null, v2: null, observation: null, assembly: null, journey: null };
}

let cloudReady;
export async function cloudDb() {
  if (!cloudReady) cloudReady = (async () => {
    if (window.loadClassCloud) await window.loadClassCloud();
    if (!window.cloudbase) throw new Error('CloudBase SDK unavailable');
    const app = window.cloudbase.init({ env: environment, region: 'ap-shanghai' });
    const auth = app.auth();
    if (!await auth.getLoginState()) await auth.signInAnonymously();
    return app.database();
  })().catch((error) => {
    cloudReady = null;
    throw error;
  });
  return cloudReady;
}

export async function submitRecord(record, {saveLocal=true, submitEvaluation=false}={}) {
  lastSubmissionError = null;
  if(saveLocal) await saveRecord(record);
  try {
    const db = await cloudDb();
    const collection = db.collection(collectionName);
    const reset = await readOptionalDocument(collection.doc('class-reset'));
    if (reset?.code) throw new Error(reset.message || '课堂轮次读取失败');
    const active = Array.isArray(reset.data) ? reset.data[0] : reset.data;
    if ((active?.resetId || null) !== (record.resetId || null)) {
      throw new Error('课堂已开始新一轮');
    }
    const ref = collection.doc(`group-${groupId}`);
    const result = await readOptionalDocument(ref);
    if (result?.code) throw new Error(result.message || '无法读取小组记录');
    const prior = Array.isArray(result.data) ? result.data[0] : result.data;
    const records = Array.isArray(prior?.records) ? prior.records : [];
    const previous = records.find((item) => item.id === record.id);
    const submitted = JSON.parse(JSON.stringify(record));
    delete submitted.evaluationDraft;
    if (!submitEvaluation) submitted.evaluation = previous?.evaluation || null;
    if (submitEvaluation && (!submitted.evaluation?.completedAt ||
      submitted.evaluation.levels?.length !== 3 ||
      !submitted.evaluation.levels.every(n => Number.isInteger(n) && n >= 1 && n <= 3))) {
      throw new Error('请完成三项自评后再提交');
    }
    if (!submitted.v1?.completedAt) submitted.v1 = null;
    if (!submitted.v2?.completedAt) submitted.v2 = null;
    if (!submitted.assembly?.completedAt) submitted.assembly = previous?.assembly || null;
    if (submitted.assembly) delete submitted.assembly.photoLocal;
    if (submitted.assembly && !isPhotoPreview(submitted.assembly.photoPreview)) {
      delete submitted.assembly.photoPreview;
    }
    submitted.pendingSync = false;
    if(submitted.observation)submitted.observation.pendingSync=false;
    if(submitted.assembly)submitted.assembly.pendingSync=false;
    const next = records.filter((item) => item.id !== record.id);
    next.push(submitted);
    const payload = { id: groupId, records: next.slice(-12), updatedAt: Date.now() };
    const written = await ref.set(payload);
    if (written?.code || !(written?.updated > 0 || written?.upsertedId || written?.id)) {
      throw new Error(written?.message || '云端未确认保存');
    }
    return true;
  } catch (error) {
    lastSubmissionError = error;
    console.warn('课堂记录暂未同步', error);
    return false;
  }
}

export function homeUrl() { return `index.html?group=${groupId}`; }
