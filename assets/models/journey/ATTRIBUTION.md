# Journey anatomy models and derivatives

## Current photo-based mouth and pharynx scenes (2026-11-01 revision)

The current game uses fixed frontal scenes in `journey-fixed-scenes.js` for the mouth and pharynx; neither scene supports free look. The earlier `journey-photo-anatomy.js` depth reconstruction is no longer active. The earlier HRA / BodyParts3D versions below remain as comparison assets and are not loaded to start the current game.

### Temporary normal larynx photograph and fixed teaching scene

**Welleschik, “Larynx normal.jpg”, July 2007**, own work, available at https://commons.wikimedia.org/wiki/File:Larynx_normal.jpg . We use the **Creative Commons Attribution–ShareAlike 3.0 Unported** option: https://creativecommons.org/licenses/by-sa/3.0/ . The original is retained as `assets/journey/pharynx-normal-original.jpg` (800×600).

Our derivative `assets/journey/pharynx-normal-unlabeled.webp` removes annotation numerals using the built-in image_gen editor and is resized/re-encoded. This is an AI-assisted edited teaching derivative, not an unmodified clinical original; compare against the preserved original when assessing anatomy. The current runtime crops and rotates the image, composites the edge, defines interaction regions, and uses aperture masks and camera approach for transitions. No measured depth or free-look anatomy is claimed. Four attempts to generate a new pharynx illustration matching the mouth were blocked by the image service; no replacement illustration was produced, so this remains a temporary reference asset. An experimental posterior entrance composite was rejected as visually implausible and has been removed. The current fixed view has no added black aperture. A scientifically and visually adequate replacement, including visible esophageal entry, remains outstanding. Its placement was checked against Lee et al. (2015), DOI 10.3748/wjg.v21.i3.759, figures 13–14; those reference panels remain in the research directory, outside student assets.

The edited photo, the photograph-derived fixed scene and aperture settings, and renderings derived from that photo are distributed under **CC BY-SA 3.0**. Preserve the author, original source link, license and this modification notice when redistributing. Neither the author nor Wikimedia endorses this application. Other independently created game assets keep their respective terms.

The mouth scene derives from the project's previously generated `assets/journey/mouth.webp`, used as a fixed frontal picture with separate upper and lower motion layers. It is a generated teaching illustration, not a clinical scan. The lower teeth, gums and full tongue move together; the upper teeth and palate remain fixed.

Another publicly available photograph, Samir's “Larynx endo 2.jpg”, was examined during research (https://commons.wikimedia.org/wiki/File:Larynx_endo_2.jpg) but is not used in the shipped scene; the research copy stays outside the public assets directory.

## Mouth: Human Reference Atlas

`mouth-hra.glb` is adapted from **Human Reference Atlas, mouth-male v1.0**, created by **Heidi Schlehlein**, from the Visible Human reference anatomy. Source: https://lod.humanatlas.io/ref-organ/mouth-male/v1.0/ . DOI: https://doi.org/10.48539/HBM568.RFGM.978 . License: **Creative Commons Attribution 4.0 International**, https://creativecommons.org/licenses/by/4.0/ .

Changes for this classroom application (2026-11-01): selected oral soft tissues and dental meshes; omitted external salivary glands, buccal cut surfaces and mandible; translated coordinates by (0, −0.025, −0.070) metres; welded coincident positions, simplified within an error bound and recomputed smooth normals; changed illustrative materials; posed the lower jaw and tongue together; reconstructed a continuous mucosal envelope over the atlas cut boundaries. The runtime envelope is a teaching reconstruction, not part of the original scanned segmentation.

The adapted mouth model remains available under CC BY 4.0. Full source/output SHA-256 hashes, sizes and per-mesh simplification errors are in `mouth-hra.glb.json`. The downloadable source is linked above; the local preparation script is `model-study/prepare-journey-anatomy.mjs`.

## Pharynx: BodyParts3D / Anatomography, adapted by OrganUI

**BodyParts3D / Anatomography, © The Database Center for Life Science (DBCLS).** https://lifesciencedb.jp/bp3d/ . Version 4.3, ontology tree FMA3.0. Original publication: Mitsuhashi et al., “BodyParts3D: 3D structure database for anatomical concepts”, Nucleic Acids Research 37 (2009), D782–D785, https://doi.org/10.1093/nar/gkn613 .

Model/data license: **Creative Commons Attribution–ShareAlike 2.1 Japan**, https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en (legal code: https://creativecommons.org/licenses/by-sa/2.1/jp/legalcode), as stated at https://lifesciencedb.jp/bp3d/info/index.html#License .

Immediate source: **OrganUI, pharynx-3d** (2026), https://github.com/organui/pharynx-3d . OrganUI selected 31 meshes, grouped them into 20 structures, triangulated, recentered, uniformly scaled, converted Z-up to Y-up, recomputed normals, assigned illustrative colors and converted OBJ to GLB. OrganUI's source meshes came through the public `olivercase/body_parts_3d_api` mirror at commit `fd527e6f4daf732fd814314d9257df5877b844bc`, checked against source LFS hashes and the official 4.3 table. Its model and renderings are under CC BY-SA 2.1 Japan; its software's MIT license does not relicense the anatomical model.

Changes here (2026-11-01): position welding, error-bounded mesh simplification and smooth normals; illustrative mucosal materials; selected internal-facing structures, used the reference epiglottis with a hinged swallowing pose, and hid external muscles/cartilages. Reconstructed the pharyngeal lining, laryngeal mucosal folds and connected airway/esophageal sleeves. The source does not contain a complete internal mucosal surface: these added surfaces are a teaching adaptation, not clinical imaging.

**`pharynx-bp3d.glb` and our anatomical adaptations/renderings based on it are distributed under the same CC BY-SA 2.1 Japan license.** Retain these credits, source links, modification notices and license links when redistributing. Full source/output hashes and per-mesh simplification errors are in `pharynx-bp3d.glb.json`.

Neither the original institutions nor the source authors endorse this application. The source database notes that anatomical representations may be incomplete or incorrect. Independently created game UI, food assets and unrelated models retain their respective terms.
# Current runtime update — 2026-11-02

The fixed pharynx background is now `assets/journey/pharynx-mouth-style-v5.webp`, generated with the project's existing mouth illustration as its visual style reference and a previous generated pharynx illustration as its edit target. The generated PNG is preserved in `model-study/pharynx-mouth-style-v5.png`. It is an illustrative teaching asset, not a clinical photograph or certified anatomical reconstruction. Earlier clinical-photo assets below remain research/comparison material; their licenses and attribution are retained. Mouth chewing now uses a continuous deformable image mesh; lower dental crowns lift while the central tongue remains stable. Descriptions below of a temporary clinical runtime and whole-tongue motion are historical.
