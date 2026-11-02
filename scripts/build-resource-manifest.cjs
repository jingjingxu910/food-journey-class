const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const fromIndex=process.argv.includes('--git-index'),cp=require('node:child_process');
const content=p=>fromIndex?cp.execFileSync('git',['show',':'+path.relative(root,p).split(path.sep).join('/')],{cwd:root,maxBuffer:64*1024*1024}):fs.readFileSync(p);
// Excluded from classroom prefetch only. Keep originals and all active teaching assets.
const excluded=new Set([
 'assets/models/journey/mouth-hra.glb','assets/models/journey/pharynx-bp3d.glb',
 'assets/models/stomach.glb','assets/models/intestines.glb',
 'assets/anatomy/body-outline-generated.png','assets/journey/digestive-system-niddk.jpg'
]);
const pages=['index.html','model-workbench.html','observation.html','assembly.html','journey.html','journey-game.html','stomach-sample.html','journey-sources.html','ar-sources.html','ar-prepare.html','lesson-shell.html'];
let files=pages.map(p=>path.join(root,p));
files.push(...fs.readdirSync(root).filter(p=>/\.(js|css)$/.test(p)&&!['ar-assets-sw.js','resource-manifest.js'].includes(p)).map(p=>path.join(root,p)));
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
files.push(...walk(path.join(root,'assets')).filter(p=>/\.(png|jpg|webp|svg|glb|json|md)$/.test(p)));
files.push(...['three.module.js','GLTFLoader.js','BufferGeometryUtils.js','pose_landmarker_lite.task','package/vision_bundle.mjs','package/wasm/vision_wasm_internal.js','package/wasm/vision_wasm_internal.wasm','package/wasm/vision_wasm_nosimd_internal.js','package/wasm/vision_wasm_nosimd_internal.wasm'].map(p=>path.join(root,'vendor',p)));
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const chunkSize=512*1024,chunkDir=path.join(root,'resource-chunks');fs.mkdirSync(chunkDir,{recursive:true});
const items=[...new Set(files)].sort().filter(p=>!excluded.has(path.relative(root,p).split(path.sep).join('/'))).map(p=>{
 const data=content(p),item={path:path.relative(root,p).split(path.sep).join('/'),bytes:data.length,hash:hash(data)};
 if(data.length>=1024*1024){item.chunks=[];for(let at=0;at<data.length;at+=chunkSize){const bytes=data.subarray(at,at+chunkSize),id=hash(bytes),relative=`resource-chunks/${id}.bin`;fs.writeFileSync(path.join(root,relative),bytes);item.chunks.push({path:relative,bytes:bytes.length,hash:id});}}
 return item;
});
const version='20261102-chunks-'+hash(JSON.stringify(items)).slice(0,16);items.push({path:'resource-manifest.js',bytes:0,hash:'manifest-'+version});
const data={version,bytes:items.reduce((n,p)=>n+p.bytes,0),files:items};fs.writeFileSync(path.join(root,'resource-manifest.js'),'self.LESSON_RESOURCES = '+JSON.stringify(data,null,2)+';\n');console.log(items.length,'files',Math.round(data.bytes/1048576*100)/100,'MB;',items.filter(i=>i.chunks).length,'resumable files');
