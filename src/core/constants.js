/** @typedef {'center'|'left'|'pip'|'none'} LayoutMode */

export const API_BASE_KEY = "apiBase";
export const DRAFT_KEY = "directorDraft_v1";
export const CLONE_VOICE_KEY = "cloneVoice_v1";

export const CATEGORY_RULES = [
  { cat: "笔记本", kw: ["笔记本", "笔电", "macbook", "matebook", "redmibook", "magicbook", "thinkpad", "thinkbook", "拯救者", "游戏本", "轻薄本", "灵越", "幻", "暗影精灵", "星"] },
  { cat: "平板", kw: ["平板", "ipad", "matepad", "小米平板", "tablet"] },
  { cat: "显卡", kw: ["显卡", "rtx", "gtx", "geforce", "radeon", "4090", "4080", "4070", "4060", "5090", "5080", "5070", "9070", "7900", "7800"] },
  { cat: "显示器", kw: ["显示器", "显示屏", "monitor", "带鱼屏", "电竞屏"] },
  { cat: "智能穿戴", kw: ["手表", "watch", "手环", "穿戴", "smart band"] },
  { cat: "耳机", kw: ["耳机", "airpods", "earbuds", "freebuds", "freebud", "声阔", "soundcore", "漫步者", "edifier", "森海", "sennheiser", "降噪豆", "开放式", "入耳", "buds"] },
  { cat: "手机", kw: ["手机", "nova", "mate", "iphone", "苹果", "小米", "redmi", "红米", "oppo", "vivo", "荣耀", "honor", "三星", "galaxy", "pixel", "realme", "真我", "一加", "oneplus", "魅族", "reno", "find x"] }
];

export const PHASES = [
  { id: "generate", label: "起片", hint: "输入产品名，一键生成" },
  { id: "editor", label: "编导", hint: "时间线编辑与预览" },
  { id: "quality", label: "质控", hint: "留人体检与质检闸门" },
  { id: "deliver", label: "出片", hint: "导出与渲染交付" }
];
