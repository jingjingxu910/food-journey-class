# 食物在身体里的旅行

四年级科学课堂互动网页。最终通过 GitHub Pages 发布，学生平板直接用浏览器访问。

## 当前阶段

- 已创建首页与设备检测入口。
- 已完成 V1/V2 共用的二维模型工作台：器官自由摆放、直接画路线、过程日志、本机保存与教师看板。
- 摄像头与 AR 因学生平板权限暂缓，后续继续接入，不降低最终方案。

## 课堂网址

- 第 1 组：`https://jingjingxu910.github.io/food-journey-class/?group=1`
- 其余小组把最后的数字依次改成 `2` 到 `12`。
- 教师看板：`https://jingjingxu910.github.io/food-journey-class/model-workbench.html?mode=teacher`

学生从带有 `group` 参数的首页进入后，编号会自动带到二维模型，不需要输入姓名或编号。

## 文件说明

- `index.html`：课堂首页。
- `device-check.html`：平板能力检测页。
- `model-workbench.html`：学生二维模型与教师看板。
- `model-workbench.js`：自由拖动、路线绘制、V1/V2 记录与 CloudBase 同步。
- `styles.css`：全站样式。
- `app.js`：应用公共脚本入口。
