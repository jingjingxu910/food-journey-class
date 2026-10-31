let detector,settings,slowFrames=0,activeDelegate='CPU';
self.onmessage=async({data})=>{
  try{
    if(data.type==='init'){
      const {FilesetResolver,PoseLandmarker}=await import('./vendor/package/vision_bundle.mjs');
      const wasm=await FilesetResolver.forVisionTasks(new URL('./vendor/package/wasm',self.location.href).href);
      const probe=new OffscreenCanvas(1,1),gl=probe.getContext('webgl2'),debug=gl?.getExtension('WEBGL_debug_renderer_info');
      const renderer=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'';
      let delegate=gl&&!/SwiftShader|llvmpipe|software|Microsoft Basic/i.test(renderer)?'GPU':'CPU';gl?.getExtension('WEBGL_lose_context')?.loseContext();
      const options={baseOptions:{modelAssetPath:new URL('./vendor/pose_landmarker_lite.task',self.location.href).href,delegate},canvas:new OffscreenCanvas(384,288),runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.6,minPosePresenceConfidence:.6,minTrackingConfidence:.65};
      try{detector=await PoseLandmarker.createFromOptions(wasm,options);}catch(error){delegate='CPU';options.baseOptions.delegate='CPU';options.canvas=new OffscreenCanvas(384,288);detector=await PoseLandmarker.createFromOptions(wasm,options);}
      settings={wasm,options,PoseLandmarker};activeDelegate=delegate;
      self.postMessage({type:'ready',delegate});
    }else if(data.type==='frame'){
      const start=performance.now();let result;
      try{result=detector.detectForVideo(data.bitmap,data.timestamp);}finally{data.bitmap.close();}
      const costMs=performance.now()-start;
      slowFrames=costMs>220?slowFrames+1:0;
      if(activeDelegate==='GPU'&&slowFrames>=3){detector.close();settings.options.baseOptions.delegate='CPU';settings.options.canvas=new OffscreenCanvas(384,288);detector=await settings.PoseLandmarker.createFromOptions(settings.wasm,settings.options);activeDelegate='CPU';}
      self.postMessage({type:'pose',points:result.landmarks?.[0]||null,timestamp:data.timestamp,costMs,delegate:activeDelegate});
    }else if(data.type==='close'){detector?.close();self.close();}
  }catch(error){data.bitmap?.close();self.postMessage({type:'error',message:error.message});}
};
