// Local organ clips; provenance and adaptation records are kept separately from the camera UI.
export const organSegments={
  "mouth": {
    "start": 104,
    "end": 123,
    "label": "咀嚼、唾液和淀粉",
    "duration": 19,
    "path": "assets/ar-media/local-review/mouth.mp4",
    "poster": "assets/ar-media/local-review/mouth.jpg"
  },
  "esophagus": {
    "start": 123,
    "end": 144,
    "label": "食管蠕动推送食物",
    "duration": 21,
    "path": "assets/ar-media/local-review/esophagus.mp4",
    "poster": "assets/ar-media/local-review/esophagus.jpg"
  },
  "stomach": {
    "start": 144,
    "end": 164,
    "label": "胃的搅拌与胃液",
    "duration": 20,
    "path": "assets/ar-media/local-review/stomach.mp4",
    "poster": "assets/ar-media/local-review/stomach.jpg"
  },
  "liver": {
    "start": 164,
    "end": 174,
    "label": "肝脏与胆汁",
    "duration": 10,
    "path": "assets/ar-media/local-review/liver.mp4",
    "poster": "assets/ar-media/local-review/liver.jpg"
  },
  "gallbladder": {
    "start": 184,
    "end": 198,
    "label": "胆囊储存和释放胆汁",
    "duration": 14,
    "path": "assets/ar-media/local-review/gallbladder.mp4",
    "poster": "assets/ar-media/local-review/gallbladder.jpg"
  },
  "pancreas": {
    "start": 203,
    "end": 220,
    "label": "胰液帮助分解食物",
    "duration": 17,
    "path": "assets/ar-media/local-review/pancreas.mp4",
    "poster": "assets/ar-media/local-review/pancreas.jpg"
  },
  "small-intestine": {
    "start": 195,
    "end": 220,
    "label": "消化液在小肠内继续分解食物",
    "duration": 25,
    "path": "assets/ar-media/local-review/small-intestine.mp4",
    "poster": "assets/ar-media/local-review/small-intestine.jpg"
  },
  "large-intestine": {
    "start": 248,
    "end": 264,
    "label": "大肠吸收剩余水分",
    "duration": 16,
    "path": "assets/ar-media/local-review/large-intestine.mp4",
    "poster": "assets/ar-media/local-review/large-intestine.jpg"
  },
  "nasal-cavity": {
    "label": "鼻咽部的空气流动",
    "duration": 12,
    "path": "assets/ar-media/respiratory/upper-airway.mp4",
    "poster": "assets/ar-media/respiratory/upper-airway.jpg"
  },
  "pharynx": {
    "label": "鼻咽部的空气流动",
    "duration": 12,
    "path": "assets/ar-media/respiratory/upper-airway.mp4",
    "poster": "assets/ar-media/respiratory/upper-airway.jpg"
  },
  "trachea": {
    "label": "气管和呼吸道纤毛",
    "duration": 14,
    "path": "assets/ar-media/respiratory/trachea.mp4",
    "poster": "assets/ar-media/respiratory/trachea.jpg"
  },
  "right-lung": {
    "label": "呼吸运动",
    "duration": 12.48,
    "path": "assets/ar-media/respiratory/breathing.mp4",
    "poster": "assets/ar-media/respiratory/breathing.jpg",
    "variants": [
      {
        "label": "呼吸运动",
        "duration": 12.48,
        "path": "assets/ar-media/respiratory/breathing.mp4",
        "poster": "assets/ar-media/respiratory/breathing.jpg"
      },
      {
        "label": "气体交换",
        "duration": 20.08,
        "path": "assets/ar-media/respiratory/gas-exchange.mp4",
        "poster": "assets/ar-media/respiratory/gas-exchange.jpg"
      }
    ]
  },
  "left-lung": {
    "label": "呼吸运动",
    "duration": 12.48,
    "path": "assets/ar-media/respiratory/breathing.mp4",
    "poster": "assets/ar-media/respiratory/breathing.jpg",
    "variants": [
      {
        "label": "呼吸运动",
        "duration": 12.48,
        "path": "assets/ar-media/respiratory/breathing.mp4",
        "poster": "assets/ar-media/respiratory/breathing.jpg"
      },
      {
        "label": "气体交换",
        "duration": 20.08,
        "path": "assets/ar-media/respiratory/gas-exchange.mp4",
        "poster": "assets/ar-media/respiratory/gas-exchange.jpg"
      }
    ]
  }
};
export function segmentUrl(id){return organSegments[id]?.path||null;}
