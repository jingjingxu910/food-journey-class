# 完整旅行游戏：本地试玩版

## 2026-11-02 当前实现（含食管蠕动 v10 修订，优先于下方历史记录）

- 五个器官辨认后的全身定位到器官放大由 `journey-anatomy-zoom.js/css` 统一处理。定位停留约 1250 毫秒，缩放 1000 毫秒；保持图片框高度、按器官位置设置缩放中心。定位按钮不触发答案放大。
- 口腔使用连续图像网格形变：下牙列整体上抬，牙冠上下端等量移动；下颌侧面、口底软组织采用更宽的柔和过渡，舌根保持稳定。
- 当前咽部使用 `assets/journey/pharynx-mouth-style-v5.webp`，以项目原口腔图作为黏膜画风参照生成。它是教学插画，并非临床内镜照片或经过医学认证的解剖图。此前正常喉镜照片仅作为研究对照，不再作为当前游戏背景。
- 侧视图食团中心由 x=922 左移到 880；前后方向标记与图像使用同一 SVG 坐标系，采用浅色胶囊标签，不再添加竖向引线。
- 连通动画由 `journey-passage-view.js` 使用出口位置的柔边开口与有限幅度的靠近，下一画面保持原宽高比，不再压缩到出口矩形或极端放大；进入下一管段的镜头运动与交接同步，不再先停住再二次启步。进入胃前预热渲染，交接时同步绘制食团，减少空白帧；食物中心不随过渡横移。
- 下方 2026-11-01 的验证记录对应历史版本，不作为本轮全部改动已验证的证明。最新要求见 `REGRESSION-REQUIREMENTS.md`，v7 检查见 `model-study/motion-v7-*.log`，v8 限定修订见 `model-study/edge-texture-entry-v8.log`，v9 检查见 `model-study/navigation-wall-v9-*.log`，本次食管检查见 `model-study/esophagus-swallow-v10.log`。
- 胃答案与五处总结统一使用 `assets/organs/stomach.png`，题目初始焦点落在标题，避免默认圈选食管。咳嗽、呕吐标题恢复；未咀嚼时后退不再询问食物前后变化。
- 食管 v10 单独采用后方收紧、前方舒展的移动收缩区，去掉全管周期性鼓动；按压时沿中心线平滑推进，松开缓停，食物屏幕位置不变。纵向褶皱、微凹凸及变形后的平滑法线共同体现湿润黏膜，局部照明避免收缩处过曝。细节和验证见 `model-study/ESOPHAGUS-V10.md`。v8 曾恢复旧版大范围食管取样；v9 发现重复腔口后，改为 `esophagus-wall-v9.webp` 纯黏膜表面，不再重复整体腔内照片。
- 大块、小块饼干改为生成图集 `assets/journey/biscuit-fractures-v4.webp`，来源及完整提示见 `model-study/BISCUIT-FRACTURES-V4.md`。

2026-11-01。沿原工程继续开发，重做旅行场景与交互层；复用胃样片、Three.js、学生小组记录、课堂全屏 shell、资源缓存和现有器官定位图。没有从零重建整个课件，没有发布。

### 食管与导航 v9

- 全部可环顾管道统一最短角与前方出口直接进入逻辑；胃离开时朝真实出口延伸方向，取消固定 Z 偏移方向。
- 食管加入适度推进；抬头/回看使用无腔口纹理，避免假洞。
- 修复胃进入小肠后“凑近观察”按钮没有恢复的问题。胃到小肠连接段约 1.8 秒，检查实际正常交接及中间帧。
- 素材来源、完整生成提示和验证见 `model-study/NAVIGATION-WALL-V9.md`。

### 补边与食管 v8（历史修订，以上方 v9 为准）

- 用户已认可当前咀嚼动作及胃、小肠、大肠；保持这些动作和素材。口腔下沿增加随下颌移动的反射延展条，补齐抬起后露出的画布边缘。
- 贲门在前方视野中时，食管直接保留当前观察偏角靠近，不强制回到累计零角；其他食管朝向也只沿最短角转动。
- 版本依据及检查见 `model-study/EDGE-TEXTURE-ENTRY-V8.md`。

### 运动与交接 v7

- 在开局预建三段管道、解码贴图、预编译着色器并完成首次 GPU 绘制，切换时复用模型；胃等待进入时停止重复渲染。
- 开口位置使用几何元数据，取消交接时的整帧像素读取与重复渲染；柔边遮罩预先绘制，不再每帧执行模糊滤镜。进出口镜头采用缓入缓出，体外进入口腔也有过渡。
- 小肠首次轻触或按住就发出绿色、紫色营养颗粒，从食物向内壁移动；移除先前的黄色碎屑阶段。短暂拖动观察不触发吸收。

## 入口与范围

- `journey.html?group=8`：课堂入口，进入稳定的全屏 shell 后加载 `journey-game.html`，保留组别。
- `journey-game.html?group=8`：独立本地试玩入口。
- `stomach-sample.html`：独立胃样片保留；完整游戏通过同源 iframe 复用，同步本机进度。
- 旧入口页面留在 `journey-legacy.html`，旧 `journey.js/css` 保留。
- 完整路线：体外找入口、口腔磨碎和润湿、咽部通道选择、食管蠕动、胃混合、肠道消化和吸收、独立完成页。五站均先探索再辨认；查看定位不提前显示名称和功能答案。
- 食物固定在中央偏下。运动由周围空间、管壁和液滴表现，不以食物跳动代替推进。
- 小肠显微图单独弹窗，注明观察尺度，不把食团叠在显微切片上。
- 咳嗽与胃部第二次后退的呕吐分支返回体外。知识卡正文左对齐，按钮明确重新出发。
- 进度按组本机保存，并绑定已存在的本机课堂记录；提交时校验课堂记录是否已换轮次。只有明确提交才载入云端组件。未进行真实提交或更改云端数据。

## 实拍参照与真实性边界

参照：

1. [Kvasir-Capsule 原始论文](https://www.nature.com/articles/s41597-021-00920-z)，[论文 PDF](https://www.nature.com/articles/s41597-021-00920-z.pdf)，[官方数据页](https://datasets.simula.no/kvasir-capsule/)。包含真实胶囊内镜、正常黏膜、幽门和回盲瓣等类别。论文指出胶囊检查中的小肠没有像传统内镜那样充气；据此将游戏中的肠腔改为不规则、略扁的软组织轮廓，而不是规则硬圆管。
2. [HyperKvasir 原始论文](https://www.nature.com/articles/s41597-020-00622-y)，[官方数据页](https://datasets.simula.no/hyper-kvasir/)。用于区别正常食管胃连接、幽门、胃与结肠观察尺度。

本次实际读取论文，下载图示遇到超时，只取得了部分可解码区域，并检查了其中的正常结构例图。**没有完整观看或整合真实胶囊穿越全过程视频**。参考图仅保留在不发布的 `model-study/`，没有将包含病变的图版放入学生界面。

当前以用户最后确认的方案为准：口腔固定使用原正面情景图 mouth.webp；口腔与咽均取消环顾和 360 度拖动。食管、胃与肠道保留三维观察。此前的图像深度重建和 HRA / BodyParts3D 版本仅保留对照，开始旅行不再加载头部 GLB。

### 固定画面、咀嚼裁切与连续衔接（当前）

- journey-fixed-scenes.js 按原图轮廓分离上下部分，运动边界绕过后排下牙列与下牙龈，并将舌头完整纳入下部。下半部围绕画面底部连续压缩、回弹；上牙列、上腭与悬雍垂保持固定。不再把照片曲面当作可环顾的实体头部。
- 口腔到咽、咽到食管使用开口轮廓遮罩和连续靠近：下一段从开口后方出现，前景逐渐越过视野。两段固定画面保留对应的牙齿、舌与通道交互；咽部“从侧面看看”仍显示矢状剖面及食团位置。
- 咽部新图尚未完成：四次内置图像生成均被服务拦截，没有产出可用图片。当前仍暂用 Welleschik 正常喉镜图的去标号衍生版本，不能称为与口腔画风一致的新生成图。替换素材仍是待办。曾按 Lee 等 2015 年正常内镜参照尝试合成入口，但预览呈现为贴上的黑洞，用户明确否定，已经撤回。当前恢复无黑洞的原腔内画面，食管入口可见性仍未解决；不能将其记作完成。
- 食管、胃、小肠和大肠共用连接段材质、纹理相位与视场角。取消旧整屏截图淡出的交接；镜头经过狭窄段后继续进入下一段。胃在收到进入指令前先渲染入口、对齐初始朝向，减少首帧转向。
- 胃中食团保持中央偏下的位置。保留原来写实食物素材的画风，食物纹理附着于可弯曲的网格；撤掉试做的颗粒状球体食团。原食物纹理，混合时连续转动、挤压和形变；两张食物纹理随混合程度过渡。食物单独清除环境深度后渲染，保留自身层次，避免被贲门、幽门或胃壁裁掉。离胃时捕获当前食团形态，接续到小肠。
- 小肠保留已认可的弯曲中心线与横向皱襞；12,000 个绒毛实例改为随机错落、短而密的分布，与所在内壁共享收缩，不参与逐个射线拾取。主场景并非显微测量比例。
- 食管主收缩幅度上限约 46%、小肠 27%、大肠 25%；交接边界处收缩渐弱，避免不同材质交界张开缝隙。
- 第一次咀嚼沿不规则裂纹分成三大块，第二次变小块，第三次为碎屑。保留大块方案，删除圆形咬口。

临时咽部素材来源：Welleschik，Larynx normal.jpg，2007 年 7 月，https://commons.wikimedia.org/wiki/File:Larynx_normal.jpg ，CC BY-SA 3.0。去标号图经过 AI 辅助编辑，运行时还有旋转、裁切、遮罩和边缘过渡；原片仍保留，不称为未经修改的临床原片。素材及相应渲染继续遵循 CC BY-SA 3.0，详见 assets/models/journey/ATTRIBUTION.md。

完整路线检查已跑通五站并到达完成页（本地、无异常及外部请求）；固定视角、完整下颌运动、食团中心与形变、咽部通道和胃的交接另作专项复核。三段蠕动检查采样内壁侧面，避开远方入口、食物及 UI，并按动画时钟比较帧，避免软件 GPU 慢时只比较几乎同一帧。日志见 model-study/fixed-full-route.log、fixed-scene-review.log、final-peristalsis.log、final-connections.log。

### 本轮照片去标号编辑记录

使用内置 **image_gen** 编辑（非 CLI）。编辑输入是 Welleschik 原片；项目内最终文件 `assets/journey/pharynx-normal-unlabeled.webp`，1200×900，90,292 字节。原始输出 PNG 留在 Codex 的生成目录。最终提示词：

> Use case: text-localization / precise-object-edit. Edit target: the attached normal medical laryngoscopy photograph by Welleschik, licensed CC BY-SA 3.0. It is a non-graphic educational anatomy photograph of the inside of a healthy throat. Change only the white annotation numerals (1, 2, 3, 4, 5, 6, 6, 7): remove those overlaid white digits and fill their small footprints with the adjacent tissue texture. Preserve the actual anatomical structures, their shapes, original orientation, positions, natural colors, small highlights, soft tissue folds and airway exactly. Keep the original dark round image border and 4:3 framing. Do not invent new anatomy or improve the anatomy. No additional labels, no added organs, no tools, no new text. This image will be used as an attributed classroom reference.

### 前一轮开放模型、照片和连续衔接（2026-11-01，保留交接记录）

- 实际下载对比 HRA 女性和男性口腔，最终选择牙列更完整的 `mouth-male/v1.0`；源文件 53,487,620 字节，选取、减面后 `assets/models/journey/mouth-hra.glb` 为 4,104,548 字节、167,806 三角形。不是把原有球体牙齿重新上色。下颌牙列、牙龈与舌同组运动，剔除外部腺体与下颌骨，补齐颊部切面外围；不再摆放两侧悬浮液滴。
- BodyParts3D / OrganUI 咽部文件减至 3,234,520 字节、133,938 三角形。来源主要是肌肉与软骨，并非现成完整腔内模型。选用参考会厌，构建黏膜床、黏膜褶和内腔，在会厌基部设旋转支点。模型署名、原始和改编许可、哈希及逐网格误差见 `assets/models/journey/ATTRIBUTION.md` 与相邻 JSON；公开教师说明为 `journey-sources.html`。
- 实际查看了 [Hradec Králové 正常空肠内镜图](https://www.kcvl.cz/en/atlas.aspx?nID=40)，以及 [Augusta 医学院正常喉镜图与注释](https://www.augusta.edu/colleges/medicine/pediatrics/allergy/rhino/selnerslides4.php) 中 Selner 18、19 和正常喉近景。私人研究文件仅在 `model-study/`，不进入资源缓存。没有宣称观看完整临床视频。
- 侧面剖面图与食团、标记共用 SVG 坐标系，标出舌根后方的当前位置，不标示正确答案通道。
- 食管和肠道使用统一的弯曲内腔生成器 `journey-lumen.js`：颈部收窄直接属于管壁，不再叠加悬浮圆环、平面黑盘或独立门套。小肠增加错落皱襞与弯曲，降低主场景绒毛凸起的夸张尺寸；大肠用连续黏膜材质，去掉分区照片贴片造成的色块。定位连接口时检查遮挡，避免标记透过弯曲内壁。
- 过渡先沿当前通道接近出口，再进入下一段入口，辅以 320 毫秒组织画面叠化；取消切景白闪。胃在食管阶段预载，收到进入消息才开始运行；仅在完整旅程模式由父页面统一绘制食团，保持位置、尺寸一致。独立胃样片继续显示自身的三维食团。胃部弹窗打开时，父页面食物隐藏，避免压住弹窗。
- 这是以连续穿行观感为目标的分段场景衔接，并非声称已经把所有器官合成一张精确的全消化道网格。人物尺度、内腔及运动为教学适配，仍需实际平板与用户验收。

### 本轮生成材质

使用内置 **image_gen**（非 CLI）生成并保存到项目：`assets/journey/oral-mucosa-v1.webp`，1024×1024，227,780 字节；保留原生成 PNG 于 Codex 默认生成目录。该图片仅作为黏膜表面材质，不充当解剖证据或医学照片。

最终提示词：

> Use case: scientific-educational. Asset type: a single seamless square PBR base-color texture tile for healthy human oral and pharyngeal mucosa in a realistic first-person Three.js classroom game. Primary request: improve the plastic-looking smooth pink anatomy model with a realistic, delicate, naturally moist mucosal surface. Composition: completely flat, orthographic, edge-to-edge continuous surface, equal detail everywhere, no perspective, no holes, no organ silhouette, no tube, no folds with deep baked shadows. The surface is normal intact nonkeratinized mucosa: warm muted rose pink, very fine irregular superficial capillary branching under translucent epithelium, microscopic soft undulations and faint natural mottling at millimeter scale, thin saliva film implied by tiny restrained surface detail. Uniform diffuse illumination, no directional bright spot, no large white specular highlight, no vignette, no deep creases or black areas. Photorealistic material reference, not smooth rubber or painted clay. Low overall color contrast and consistent average pink across all four edges for tiling. No intestinal villi, no large bumps, no tooth, no tongue papillae, no wound, inflammation, pathology, instruments, liquids droplets floating over it, blood, text, labels, logos, or border. Square 1:1, high texture detail. The result will be used only as a material on separately modeled anatomy; it must not depict an endoscopic scene.

## 本地验证

本轮修改（2026-11-01）：牙齿与牙龈归入同一下颌组；重建腭与咽口、向下且前后相邻的咽部通道；侧视复用头颈矢状剖面图。解除水平环顾角度限制，食管、小肠、大肠增加可回头观察的入口及前方连接口。修正口腔和大肠定位，移除定位解释文字与无关的后退知识弹窗。润湿、继续消化、营养吸收及水分吸收使用不同特效；小肠不再重复液体汇入。显微弹窗图片采用同尺寸显示框。结束页以五个完整器官外形图和作用为主，胃改用同组透明底外形素材；小组分析独立展开，根据实际记录展示观察、判断修正、定位/侧视和错误分支。正常旅行中食物保持原位置，入口点错时单独恢复饼干回弹。

此前的完整路线复查与 `model-study/journey-revision-check.cjs` 已通过；后者覆盖回弹、下颌运动、定位坐标、入口回看、超过一整圈旋转、咽部剖面、小肠特效区分、等尺寸图片、器官总结和行为分析。

本轮实际运行并通过：

- `model-study/journey-game-check.cjs`：从寻找入口、咀嚼、润湿、咽部安全选择，经食管和胃到大小肠，再到完整器官总结与小组分析。五处辨认完成，脚本错误和外部资源请求均为空；未提交云端数据。
- `model-study/anatomy-connection-check.cjs`：咽部误入气管后的咳嗽重开、安全通道、侧视食团位置；多帧采样检查咽部—食管—胃过渡时食物位置和尺寸一致；检查胃部弹窗遮盖父页面食物，以及独立胃样片仍显示食物。最终检查 29 帧，食团框为 246×246 像素，各阶段位置、尺寸差异小于 0.5 像素。
- `model-study/journey-visual-check.cjs`：各器官和竖屏截图、错误分支、进度恢复、胃部第二次后退呕吐重开、课堂 shell 保留组号，错误列表为空。
- 开放模型、纹理和署名纳入资源清单；研究目录中的大体积源模型、医疗照片和本地测试截图不进入缓存。

这些是在桌面软件 WebGL 环境完成的功能与画面检查，不代表旧平板的帧率验收。视觉真实感仍由用户审阅，Lenovo TB-X605FC 尚未实机测试。

最新图像深度重建及饼干分块版本的检查：

- `model-study/biscuit-fracture-check.cjs` 通过：第一次分为三块主要连通区域（52,524、38,363、35,630 像素），原饼干主体未被圆形擦除；第二次为更小块，第三次为碎屑；刷新并继续旅行后恢复对应状态。
- `model-study/peristalsis-photo-check.cjs` 通过：三处按住时收缩强度超过 0.9，固定镜头下连续两帧的内壁区域有明显像素变化，食物框保持一致；小肠管壁和绒毛共享两套同步的收缩参数。食管、大肠各 61,440 三角形，小肠合计约 301,440 三角形、12,000 个绒毛实例。另检查了整体下颌运动和超过一整圈的环顾。
- `model-study/anatomy-connection-check.cjs` 在照片版重新通过：咽部误入气管后的咳嗽重开、安全进入食管、侧视食团位置，以及咽部—食管—胃转换的食物位置尺寸，胃弹窗遮挡处理和独立胃样片。
- `model-study/journey-game-check.cjs` 在最新版本通过完整五站流程，最终 `where=done`、五处辨认齐全，`errors=[]`、`external=[]`；没有提交云端数据。胃部拾取检查选择实际未被信息面板遮挡的画布位置。
- 资源缓存清单重新生成：113 项，约 56.88 MiB，含公开照片原片、改编素材、署名说明；排除研究目录。

最终尝试刷新用户预览时，浏览器控制工具返回“Local browser use is disabled in Work settings”。未改动用户的浏览器权限设置。文件与资源缓存版本已更新；用户可刷新课堂首页（触发资源版本更新）后进入旅行。没有把“文件已更新”冒称“已代用户刷新浏览器”。

`model-study/journey-game-check.cjs`：实际鼠标操作从体外到完成页，覆盖口腔处理、正常吞咽、食管、嵌入胃的处理/辨认/离开、小肠、大肠、显微弹窗、五站识别及横竖屏结束页；运行结果五站完成、无脚本错误、无外部请求。

`model-study/journey-visual-check.cjs`：场景恢复与横竖屏画面、侧视、咳嗽重启、胃状态恢复/第二次后退重启、全屏 shell 入口与组别保留。测试不点击云端提交。

PC Chrome 软件 WebGL 验证不代表 Lenovo TB-X605FC 的实际帧率、12 台并发或云端跨设备验收。需要继续平板实测。

## 本次生成素材

均使用内置 image_gen，保留原图在 Codex generated_images；项目中用 WebP 优化体积与透明度。

- `assets/journey/food-stages-v3.webp`：透明底饼干、碎块、食物残渣图集，299,228 字节。原 PNG 备份 `model-study/generated-food-stages-v3.png`。
- `assets/journey/small-mucosa-v3.webp`：生成式小肠黏膜材质，333,296 字节。

最终提示词 1：

> Use case: scientific-educational. Asset type: one horizontal game sprite atlas for a primary-school digestion game. A genuinely transparent background. Exactly THREE equally sized isolated food objects, each centered within its own equal-width square cell, arranged LEFT TO RIGHT in one row, no overlap, at least 15% transparent margin per cell. LEFT: a complete golden rectangular plain biscuit, scalloped edge, small baked holes, slight three-quarter angle, realistic crisp porous texture. CENTER: dry broken fragments and crumbs of the exact same golden biscuit, compact mound, visibly angular pieces. RIGHT: a compact moist tan-brown fibrous food residue mound with a few pale fibers, unabsorbed food matter, educational and non-grotesque, no stool or excretion. These are food objects for showing food changes; no organs. Realistic high-detail product-photography lighting, soft directional highlights, alpha cutout including between crumbs. No backdrop, no glow, no floor, no plate, no letters, no labels, no borders. Full object silhouettes, sharp clean alpha edges. Wide 3:1 composition with three evenly spaced equal cells. Final asset for a game.

最终提示词 2：

> Use case: scientific-educational. Asset type: seamless flat albedo texture tile for the INNER normal small-intestinal mucosal surface in a Three.js educational game, not a scene and not a diagram. Square edge-to-edge orthographic close surface texture, no hole or tunnel, no perspective, no organs, no labels. Natural muted salmon pink with subtle tan warmth, soft irregular dense velvety mucosal microrelief. Thousands of extremely tiny tightly packed rounded microvilli give a delicate granular velvet finish at the endoscopic observation scale; no large upright finger projections, no enlarged anatomical villi or exposed blood vessels. Subtle moist transparent sheen with restrained fine highlights under diffuse warm light; no big baked white specular bands, no shadows, no glow. Healthy intact mucosa only, no pathology, blood, ulcer, inflammation, instruments or yellow floating particles. High fidelity natural endoscopic material appearance; avoid shiny plastic or smooth rubber. A uniform continuous material photographed perpendicular to the surface, evenly lit, seamlessly tileable, 1:1 square.

上述词语是图像生成要求，不构成生成物已符合医学标准的声明。
