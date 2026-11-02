export async function selectedResources(kind='all') {
  const {FilesetResolver}=await import('./vendor/package/vision_bundle.mjs');
  const variant=await FilesetResolver.isSimdSupported()?'vision_wasm_internal':'vision_wasm_nosimd_internal';
  return self.LESSON_RESOURCES.files.filter(item=>{
    if(item.path.includes('/wasm/'))return item.path.includes(variant+'.');
    return kind!=='ar'||item.path.startsWith('vendor/package/')||item.path==='vendor/pose_landmarker_lite.task'||item.path.startsWith('assets/models/ar/')||['observation.js','pose-resources.js','ar-entry.js','ar-pose-worker.js','ar-tracking.js','ar-organ-viewer.js','vendor/three.module.js','vendor/GLTFLoader.js','vendor/BufferGeometryUtils.js'].includes(item.path);
  });
}
