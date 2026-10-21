const checkButton = document.querySelector("#webgl-check-button");
const result = document.querySelector("#webgl-result");
const canvas = document.querySelector("#webgl-canvas");

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
