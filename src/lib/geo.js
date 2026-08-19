/**
 * geo.js — 地图图例共享常量（MapPage 与 brp 地图抽屉 MapPanel 共用，保证图例一致）
 * 分类/颜色/符号与瓦片构建端 build-tiles.mjs 的 CAT_COLOR 一致。
 */

/** 地点分类（图例顺序与地图标记一致；site = 遗迹/考古地点，协议 §10 LOD 3） */
export const CATS = [
  ['city', '城市'], ['village', '村庄'], ['capital', '首都'], ['region', '地区'],
  ['nation', '国家'], ['mountain', '山'], ['range', '山脉'], ['river', '河流'],
  ['water', '湖/海'], ['desert', '沙漠'], ['coast', '海岸'], ['island', '岛屿'],
  ['site', '考古遗址'],
]

/** 图例色点（与瓦片 CAT_COLOR 一致） */
export const CAT_DOT_COLOR = {
  capital: '#8b7355', city: '#3c4652', village: '#8a94a3',
  region: '#7a6a4a', nation: '#7a6a4a', mountain: '#a98d5f', range: '#a98d5f',
  river: '#4a90c4', water: '#4a90c4', desert: '#c9a86a', coast: '#4a90c4', island: '#4a90c4',
  site: '#9aa3ad',
}

/** 图例分类符号（几何形状区分 13 类；颜色仍取 CAT_DOT_COLOR 与地图标记一致） */
export const CAT_ICON = {
  city: '●', village: '○', capital: '★', region: '◆', nation: '▲',
  mountain: '△', range: '▴▴', river: '▬', water: '◍', desert: '◒',
  coast: '◐', island: '◌', site: '✕',
}

/** 旅程类型中文名（GEOGRAPHY.md §13 Journey Type） */
export const TYPE_LABELS = {
  migration: '迁徙', travel: '旅程', missionary_journey: '宣教旅程', military_campaign: '军事行动',
  exile: '流放', flight: '逃亡', pilgrimage: '朝圣', ministry: '事奉巡行',
  sea_voyage: '海上航行', return_journey: '归程', mixed: '混合', unknown: '其他',
}

/**
 * 旅程名英→中关键词桥（和合本标准译名）：路线搜索的中文查询命中英文路线名。
 * UBS MARBLE 旅程名/故事名为英文（"Paul's Voyage to Rome"），中文查询（"保罗"）
 * 需经关键词替换后才能命中——按词边界替换，避免 lot 误伤其他词。
 */
export const JOURNEY_ZH_BRIDGE = {
  // 人物（含故事组名中出现的）
  aaron: '亚伦', abimelech: '亚比米勒', abraham: '亚伯拉罕', abram: '亚伯兰', amaziah: '亚玛谢',
  baasha: '巴沙', balaam: '巴兰', benhadad: '便哈达', david: '大卫', deborah: '底波拉',
  ehud: '以笏', elijah: '以利亚', elisha: '以利沙', gedaliah: '基大利', gideon: '基甸',
  goliath: '歌利亚', hagar: '夏甲', hazael: '哈薛', herod: '希律', hezekiah: '希西家',
  isaac: '以撒', jacob: '雅各', jehoash: '约阿施', jehoiakim: '约雅敬', jehu: '耶户',
  jephthah: '耶弗他', jeroboam: '耶罗波安', jesus: '耶稣', john: '约翰', jonah: '约拿',
  joseph: '约瑟', joshua: '约书亚', josiah: '约西亚', judah: '犹大', lazarus: '拉撒路',
  lot: '罗得', melchizedek: '麦基洗德', moses: '摩西', naaman: '乃缦', naboth: '拿伯',
  nebuchadnezzar: '尼布甲尼撒', neco: '尼哥', paul: '保罗', pekah: '比加', peter: '彼得',
  philip: '腓利', rehoboam: '罗波安', rebecca: '利百加', rezin: '利汛', ruth: '路得',
  samuel: '撒母耳', samson: '参孙', sargon: '撒珥根', saul: '扫罗', sennacherib: '西拿基立',
  sheba: '示巴', shishak: '示撒', solomon: '所罗门', tiglath: '提革拉毗列色', uzziah: '乌西雅',
  zerah: '谢拉', gibeonites: '基遍人', israelites: '以色列人', eunuch: '太监',
  // 地点
  antioch: '安提阿', arabia: '亚拉伯', assyria: '亚述', babylon: '巴比伦', beersheba: '别是巴',
  bethany: '伯大尼', bethel: '伯特利', bethlehem: '伯利恒', caesarea: '凯撒利亚', cana: '迦拿',
  capernaum: '迦百农', carmel: '迦密山', damascus: '大马士革', dothan: '多坍', egypt: '埃及',
  emmaus: '以马忤斯', galilee: '加利利', gerar: '基拉耳', gibeon: '基遍', gilead: '基列',
  goshen: '歌珊', haran: '哈兰', hazor: '夏琐', hebron: '希伯仑', horeb: '何烈山',
  jericho: '耶利哥', jerusalem: '耶路撒冷', joppa: '约帕', jordan: '约旦河', mizpah: '米斯巴',
  michmash: '密抹', midian: '米甸', moriah: '摩利亚', nazareth: '拿撒勒', negev: '南地',
  ophir: '俄斐', rome: '罗马', salem: '撒冷', samaria: '撒玛利亚', shechem: '示剑',
  sinai: '西奈山', sidon: '西顿', timnah: '亭拿', tyre: '推罗', tarsus: '大数',
  // 常用词
  exodus: '出埃及', exile: '被掳', conquest: '征服', battle: '争战', wars: '战争',
  kingdom: '王国', ministry: '事奉', missionary: '宣教', temple: '圣殿', tabernacle: '会幕',
  ark: '约柜', wandering: '漂流', wanderings: '漂流', ascension: '升天', burial: '埋葬',
  migration: '迁徙', invasion: '入侵', rebellion: '叛乱', revolt: '反叛', siege: '围困',
  capture: '攻取', sack: '掳掠', deportation: '掳去', campaign: '战役', miracle: '神迹',
  spies: '探子', storm: '风暴', transfiguration: '登山变像', preaching: '传道',
  synagogues: '会堂', vineyard: '葡萄园', angels: '天使', disciples: '门徒',
  journey: '旅程', route: '路线', road: '道路', voyage: '航行', flight: '逃亡',
}

/** 旅程搜索文本：英文名 + 关键词桥接中文版（缓存于 MapPage；q 为小写查询） */
const BRIDGE_RES = Object.entries(JOURNEY_ZH_BRIDGE).map(([e, z]) => [new RegExp(`\\b${e}\\b`, 'g'), z])
export function journeyZhBridged(text) {
  let s = ' ' + String(text || '').toLowerCase()
  for (const [re, z] of BRIDGE_RES) s = s.replace(re, z)
  return s
}
