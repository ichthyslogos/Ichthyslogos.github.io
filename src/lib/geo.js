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
