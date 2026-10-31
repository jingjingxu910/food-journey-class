// The same record is used by the model, observation, assembly and journey pages.
// Drafts stay on this device; one small upload is attempted on each explicit submission.
export const groupId = Math.max(1, Math.min(12, Number(new URLSearchParams(location.search).get('group')) || 1));
const environment = 'motionless-harrier-d7cuz0659ef1a';
const collectionName = 'food-journey-groups';

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
      (async () => { const db = await cloudDb(); return db.collection(collectionName).doc('class-reset').get(); })(),
      new Promise((_, reject) => { resetTimer=setTimeout(() => reject(new Error('课堂轮次读取超时')),2500); })
    ]).finally(()=>clearTimeout(resetTimer));
    const data = Array.isArray(result.data) ? result.data[0] : result.data;
    resetId = typeof data?.resetId === 'string' ? data.resetId : null;
  } catch { /* Keep the local draft available while offline. */ }
  const latest = records.filter((item) => item.lesson === 'food-journey' && Number(item.groupId) === groupId && (!resetId || item.resetId === resetId))
    .sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt))[0];
  if (latest) return latest;
  const now = Date.now();
  return { id: `group-${groupId}-${now}-${Math.random().toString(36).slice(2, 7)}`,
    groupId, lesson: 'food-journey', resetId, createdAt: now, updatedAt: now,
    v1: null, v2: null, observation: null, assembly: null, journey: null };
}

let cloudReady;
async function cloudDb() {
  if (!cloudReady) cloudReady = (async () => {
    if (window.loadClassCloud) await window.loadClassCloud();
    if (!window.cloudbase) throw new Error('CloudBase SDK unavailable');
    const app = window.cloudbase.init({ env: environment, region: 'ap-shanghai' });
    const auth = app.auth();
    if (!await auth.getLoginState()) await auth.signInAnonymously();
    return app.database();
  })();
  return cloudReady;
}

export async function submitRecord(record, {saveLocal=true}={}) {
  if(saveLocal) await saveRecord(record);
  try {
    const db = await cloudDb();
    const ref = db.collection(collectionName).doc(`group-${groupId}`);
    let prior = {};
    try {
      const result = await ref.get();
      prior = Array.isArray(result.data) ? result.data[0] || {} : result.data || {};
    } catch {}
    const records = Array.isArray(prior.records) ? prior.records.filter((item) => item.id !== record.id) : [];
    // Photos are stored locally until a dedicated, size-limited upload is enabled.
    const submitted = JSON.parse(JSON.stringify(record));
    if (submitted.assembly) delete submitted.assembly.photoLocal;
    records.push(submitted);
    const payload = { id: groupId, records: records.slice(-12), updatedAt: Date.now() };
    const written = await ref.set(payload);
    if (written?.code || !(written?.updated > 0 || written?.upsertedId || written?.id)) {
      throw new Error(written?.message || '云端未确认保存');
    }
    return true;
  } catch (error) {
    console.warn('课堂记录暂未同步', error);
    return false;
  }
}

export function homeUrl() { return `index.html?group=${groupId}`; }
