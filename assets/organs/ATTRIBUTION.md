# V2新增器官与剖面参考

## 2026-11-11 教学插图

`lungs-soft.webp`、`liver-soft.webp`、`pancreas-soft.webp` 使用内置 imagegen 生成，参照本项目 `stomach.png` 的柔和立体绘画风格，供 V2 拖放与作品预览使用；不是人体测量或临床图像。原 atlas 素材保留。

提示词：以胃为画风参考，分别绘制正面肺、肝和胰脏；柔和立体明暗、自然组织质感、完整器官轮廓、透明背景、无文字、无其他器官。肺保留分叶与支气管；肝为暖红棕色，右叶在画面左侧较大，左叶向右收窄；胰脏头部在画面左侧，尾部向右收窄。最终缩小为最长边 512 像素的透明 WebP，以降低平板解码负担。

## 原始参考素材

- `lungs-atlas.png`: Human Reference Atlas, lung-female v1.4, Kristen Browne and Heidi Schlehlein. Visible Human Dataset / National Library of Medicine. CC BY 4.0. https://humanatlas.io/3d-reference-library . Selected pulmonary segment surfaces; rendered together in anatomical anterior orientation, with instructional pink material and lighting. No invented organ contour.
- `trachea-atlas.png`: BodyParts3D, © Database Center for Life Science, CC BY 4.0. https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html . FMA7394 trachea, FMA7395 and FMA7396 main bronchi; original shared coordinates, smooth rendering and instructional material.
- `liver-atlas.png`, `pancreas-atlas.png`: Human Reference Atlas / HuBMAP, VH_Female/v1.2/VH_F_Liver.glb and VH_F_Pancreas.glb from https://github.com/hubmapconsortium/ccf-3d-reference-object-library , CC BY 4.0. Original reference geometry, frontal orthographic rendering, instructional materials and lighting.
- `upper-airway-openstax.jpg`: OpenStax College, Anatomy & Physiology, 2303 Anatomy of Nose-Pharynx-Mouth-Larynx, CC BY 3.0. Original unedited textbook illustration: https://commons.wikimedia.org/wiki/File:2303_Anatomy_of_Nose-Pharynx-Mouth-Larynx.jpg . Shown separately as a sagittal reference, not used as an isolated frontal nasal organ.

These assets are anatomical reference illustrations, not measurements of a student. Original creators do not endorse this lesson. Remaining earlier organ illustrations retain their prior attributions.
