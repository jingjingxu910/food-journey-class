const checkButton = document.querySelector("#webgl-check-button");
const result = document.querySelector("#webgl-result");
const canvas = document.querySelector("#webgl-canvas");
const cameraButton = document.querySelector("#camera-check-button");
const cameraResult = document.querySelector("#camera-result");
const cameraPreview = document.querySelector("#camera-preview");

function setResult(message, state) {
  result.textContent = message;
  result.dataset.state = state;
}

function runWebGlCheck() {
  const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

  if (!gl) {
    setResult("未检测到 WebGL。请记录此结果，我们会判断是否受到浏览器限制。", "failed");
    return;
  }

  gl.clearColor(0.09, 0.42, 0.55, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  setResult("检测通过：这台设备可运行 WebGL 3D 图形。", "passed");
}

checkButton.addEventListener("click", runWebGlCheck);

function setCameraResult(message, state) {
  cameraResult.textContent = message;
  cameraResult.dataset.state = state;
}

async function runCameraCheck() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setCameraResult("此浏览器不支持网页摄像头访问。", "failed");
    return;
  }

  cameraButton.disabled = true;
  cameraButton.textContent = "正在请求摄像头权限…";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
    });

    cameraPreview.srcObject = stream;
    setCameraResult("检测通过：前置摄像头已开启。", "passed");
    cameraButton.textContent = "摄像头已开启";
  } catch (error) {
    const permissionDenied = error.name === "NotAllowedError";
    setCameraResult(
      permissionDenied ? "未获得摄像头权限。请在浏览器提示中选择“允许”。" : "摄像头未能开启，请记录此提示。",
      "failed",
    );
    cameraButton.disabled = false;
    cameraButton.textContent = "重新检测前置摄像头";
  }
}

cameraButton.addEventListener("click", runCameraCheck);
