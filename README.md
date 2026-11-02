# 食物在身体里的旅行

四年级科学课堂网页，按“初始模型 → AR 观察 → 修正模型 → 实体拼装 → 第一人称食物旅程”组织。学生按 1–12 组访问，教师在横屏工作台查看已提交记录。用户已确认学生平板 Chrome、Edge 可开启网页相机；新版定位性能仍需实机试教。

## 当前阶段

- V1/V2 共用的二维模型工作台：器官自由摆放、直接画路线、过程日志、本机保存与教师看板。
- AR 观察页：后置相机、后台人体识别、滤波跟随、独立器官模型及按需局部 3D。器官来源与性能验证边界见 `AR-STATUS.md`。
- 实体拼装照片记录及完整食物互动旅程：固定写实口腔、咽部场景，食管和胃肠三维观察、蠕动与吸收交互。当前游戏入口为 `journey.html?group=1`，实现及验证范围见 [JOURNEY-GAME.md](JOURNEY-GAME.md)。
- 新版 AR 的持续跟随性能、远程同步和十二台课堂负载尚需实机验证。

## 课堂网址

- 第 1 组：`https://jingjingxu910.github.io/food-journey-class/?group=1`
- 其余小组把最后的数字依次改成 `2` 到 `12`。
- 教师看板：`https://jingjingxu910.github.io/food-journey-class/model-workbench.html?mode=teacher`

学生从带有 `group` 参数的首页进入后，编号会自动带到各活动，不需要输入姓名或编号。

## 本地预览与数据

在项目目录运行 `node preview-server.cjs`，打开 `http://127.0.0.1:4173/?group=1`。不要直接双击 HTML 文件。

课前下载：在每台平板上用上课浏览器打开 ar-prepare.html?group=1，下载完整课件资源（约 59 MB）。包括图片、3D 模型、游戏与两种 MediaPipe 运行文件；支持断点续下。本机缓存不占用 CloudBase 数据库额度，清理浏览器数据后需重下。资源更新后运行 `node scripts/build-resource-manifest.cjs`。推送 GitHub 时先暂存运行文件和素材，再运行 `node scripts/build-resource-manifest.cjs --git-index` 并暂存清单，确保文件哈希与 Git 中发布的换行格式一致；worker、manifest 和资源一起提交。网页不能保证绕过设备旋转限制，全屏后可尝试竖屏，失败则按当前方向自适应。缓存不包含学生记录、相机画面或云端请求；提交仍需联网。

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
- `journey.html`：游戏入口；`journey-game.html/js/css`：当前完整游戏；`stomach-sample.html/js/css`：独立胃样片与游戏共用。旧版入口保留为 `journey-legacy.html`。

旅程从体外找准口腔入口开始，依次经历口腔、咽、食管、胃、小肠与大肠。五站先探索线索、再辨认器官，随后查看全身定位与器官放大；定位按钮本身不揭示答案。口腔与咽使用固定写实画面；食管与胃肠支持环顾。食物保持中央偏下，场景运动与管壁形变表现推进。咽部误入气管触发咳嗽，胃部第二次后退触发呕吐并重新出发。小肠先展示向外移动的绿色、紫色营养颗粒，大肠展示水分变化。游戏为科学教学模拟，写实生成素材不是临床影像；具体来源见游戏素材页与模型署名文件。本机进度按组保存，只有明确点击提交才尝试同步。

- `student-data.js`：新活动的本机与云端记录。

## 素材来源

- Three.js r160：MIT，[源代码与许可证](https://github.com/mrdoob/three.js/tree/r160)。
- MediaPipe Tasks Vision 0.10.21：Apache-2.0，[项目](https://github.com/google-ai-edge/mediapipe)。Lite 姿态模型来自[官方示例](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/web/vision/README.md)引用的下载地址；模型文件的单独再分发条款还需在正式公开发布前核实。
- AR 的五个独立模型使用 [BodyParts3D 官方数据](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html)，按照[官方 CC BY 4.0 许可](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html)署名并做轻量化。口腔为舌与上下颌牙龈的局部模型；素材范围与改动见 `ar-sources.html`。旧胃与肠道 GLB 为 Innerscene CC0，保留供旧模块参考，AR 不再使用共用的肠道文件。
- `assets/journey/` 中八幅场景图是为本项目生成的教学插画，不是真实解剖照片。小肠放大后显示的 `villi-micrograph.jpg` 是真实的回肠绒毛组织切片显微照片，作者 Mikael Häggström, M.D.，CC0，[原图与说明](https://commons.wikimedia.org/wiki/File:Cross-section_histology_of_small_intestinal_villi_of_the_terminal_ileum.jpg)。
- 旅程中的全身器官定位图 `digestive-system-clean.png` 依据 National Institute of Diabetes and Digestive and Kidney Diseases, National Institutes of Health 的[原图](https://www.niddk.nih.gov/news/media-library/23136)清除英文标注和引线制作；为派生教学图，原图 `digestive-system-niddk.jpg` 留在项目中供核对。
- 消化过程及贲门防止胃内容物倒流的表述参考 [NIDDK 消化系统说明](https://www.niddk.nih.gov/health-information/digestive-diseases/digestive-system-how-it-works)。呕吐分支作为异常情境，不代表正常消化途径。

课堂器官图沿用本项目原有素材。素材放在项目内，AR 与 3D 不依赖运行时外部素材地址；CloudBase 同步仍需网络。
