# 第三方素材来源

- Three.js r160：MIT，[源代码与许可证](https://github.com/mrdoob/three.js/tree/r160)。
- MediaPipe Tasks Vision 0.10.21：Apache-2.0，[项目](https://github.com/google-ai-edge/mediapipe)。Lite 姿态模型来自[官方示例](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/web/vision/README.md)引用的下载地址；模型文件的单独再分发条款还需在正式公开发布前核实。
- AR 的五个独立模型使用 [BodyParts3D 官方数据](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html)，按照[官方 CC BY 4.0 许可](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html)署名并做轻量化。口腔为舌与上下颌牙龈的局部模型；素材范围与改动见 `ar-sources.html`。旧胃与肠道 GLB 为 Innerscene CC0，保留供旧模块参考，AR 不再使用共用的肠道文件。
- `assets/journey/` 中八幅场景图是为本项目生成的教学插画，不是真实解剖照片。小肠放大后显示的 `villi-micrograph.jpg` 是真实的回肠绒毛组织切片显微照片，作者 Mikael Häggström, M.D.，CC0，[原图与说明](https://commons.wikimedia.org/wiki/File:Cross-section_histology_of_small_intestinal_villi_of_the_terminal_ileum.jpg)。
- 旅程中的全身器官定位图 `digestive-system-clean.png` 依据 National Institute of Diabetes and Digestive and Kidney Diseases, National Institutes of Health 的[原图](https://www.niddk.nih.gov/news/media-library/23136)清除英文标注和引线制作；为派生教学图，原图 `digestive-system-niddk.jpg` 留在项目中供核对。
- 消化过程及贲门防止胃内容物倒流的表述参考 [NIDDK 消化系统说明](https://www.niddk.nih.gov/health-information/digestive-diseases/digestive-system-how-it-works)。呕吐分支作为异常情境，不代表正常消化途径。

课堂器官图沿用本项目原有素材。素材放在项目内，AR 与 3D 不依赖运行时外部素材地址；CloudBase 同步仍需网络。
