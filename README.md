# 食物在身体里的旅行

四年级科学课堂网页，按“初始模型 → AR 观察 → 修正模型 → 实体拼装 → 第一人称食物旅程”组织。学生按 1–12 组访问，教师在横屏工作台查看已提交记录。适合先用浏览器试教；学生平板相机权限仍需实机确认。

## 当前阶段

- V1/V2 共用的二维模型工作台：器官自由摆放、直接画路线、过程日志、本机保存与教师看板。
- AR 观察页：相机人体姿态识别、器官叠加与局部 3D 观察。
- 实体拼装照片记录及第一人称食物互动旅程。旅程采用离线场景图、动画与操作关卡；尚不是可自由行走的 3D 环境。
- 学生平板的网页相机权限、远程同步和课堂负载尚需实机验证。

## 课堂网址

- 第 1 组：`https://jingjingxu910.github.io/food-journey-class/?group=1`
- 其余小组把最后的数字依次改成 `2` 到 `12`。
- 教师看板：`https://jingjingxu910.github.io/food-journey-class/model-workbench.html?mode=teacher`

学生从带有 `group` 参数的首页进入后，编号会自动带到各活动，不需要输入姓名或编号。

## 本地预览与数据

在项目目录运行 `node preview-server.cjs`，打开 `http://127.0.0.1:4173/?group=1`。不要直接双击 HTML 文件。

草稿与拼装原照片留在当前设备的 IndexedDB。V1、观察、V2、拼装、旅程各自在明确提交时才尝试同步 CloudBase；拼装仅上传缩小的预览图。教师端手动刷新读取云端。点击“清除全部数据”会开启新一轮并隐藏旧轮记录；旧云端文档保留。若网络不通，页面会提示“保存在本机”，不能据此认为教师端已经收到。不同设备的本机数据不会自动互通。

## 文件说明

- `index.html`：课堂首页。
- `device-check.html`：平板能力检测页。
- `model-workbench.html`：学生二维模型与教师看板。
- `model-workbench.js`：自由拖动、路线绘制、V1/V2 记录与 CloudBase 同步。
- `styles.css`：全站样式。
- `app.js`：应用公共脚本入口。
- `observation.html/js`：相机姿态识别、AR 器官叠加、局部 3D 观察。
- `assembly.html/js`：实体拼装照片与记录。
- `journey.html/js` 与 `journey.css`：第一人称食物互动旅程。

旅程从体外找准口腔入口开始，饼干持续显示在画面中。学生在口腔体验咀嚼与唾液混合，在咽部选择通道，观察食管蠕动、胃液与胃壁搅动、小肠绒毛和营养吸收、大肠吸收剩余水分。各站先探索线索，再辨认器官，之后才看到人体位置与完整器官图。咽部误入气管会咳嗽并重新开始；胃里后退会先发现贲门关闭，再尝试会进入呕吐情境。前进和后退按钮竖向排列。食管默认以 Three.js 网格呈现可拖动的 360° 内部视角，轻触管壁时镜头沿通道前移；胃、小肠和大肠可切换三维环顾与细节图片。三维网格是低面数教学模拟，细节图片用于观察形态，两者均不代表临床影像。过程只保存本机，完成旅程时才尝试向 CloudBase 上传一次。
- `student-data.js`：新活动的本机与云端记录。

## 素材来源

- Three.js r160：MIT，[源代码与许可证](https://github.com/mrdoob/three.js/tree/r160)。
- MediaPipe Tasks Vision 0.10.21：Apache-2.0，[项目](https://github.com/google-ai-edge/mediapipe)。Lite 姿态模型来自[官方示例](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/web/vision/README.md)引用的下载地址；模型文件的单独再分发条款还需在正式公开发布前核实。
- 胃与肠道 GLB：Innerscene CC0，[胃](https://www.innerscene.com/tools/library/3d-parts/stomach-e1e1d2ab)、[肠道](https://www.innerscene.com/tools/library/3d-parts/intestines-26224e6a)。
- `assets/journey/` 中八幅场景图是为本项目生成的教学插画，不是真实解剖照片。小肠放大后显示的 `villi-micrograph.jpg` 是真实的回肠绒毛组织切片显微照片，作者 Mikael Häggström, M.D.，CC0，[原图与说明](https://commons.wikimedia.org/wiki/File:Cross-section_histology_of_small_intestinal_villi_of_the_terminal_ileum.jpg)。
- 旅程中的全身器官定位图 `digestive-system-clean.png` 依据 National Institute of Diabetes and Digestive and Kidney Diseases, National Institutes of Health 的[原图](https://www.niddk.nih.gov/news/media-library/23136)清除英文标注和引线制作；为派生教学图，原图 `digestive-system-niddk.jpg` 留在项目中供核对。
- 消化过程及贲门防止胃内容物倒流的表述参考 [NIDDK 消化系统说明](https://www.niddk.nih.gov/health-information/digestive-diseases/digestive-system-how-it-works)。呕吐分支作为异常情境，不代表正常消化途径。

课堂器官图沿用本项目原有素材。素材放在项目内，AR 与 3D 不依赖运行时外部素材地址；CloudBase 同步仍需网络。
