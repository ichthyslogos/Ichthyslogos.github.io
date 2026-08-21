/**
 * data.js — brp 子页面的数据访问层（src/lib/ 根目录下的共享模块）
 *
 * 运行时数据位于 public/data/brp/：
 *   manifest.json                      译本清单（放入即自动显示的机制核心）
 *   translations/<key>/books/<id>.json 按卷切片（按需加载，带缓存）
 *
 * 新增译本流程：译本 JSON 放入 data-src/brp/translations/ → npm run data → 前端自动显示。
 * 原文与译本隔离：manifest 中 original=true 的条目为原文（future Strong 功能挂载点）。
 */

/** 站点根路径（尊重 vite base；base='./' 时归一为 '/'，保证深层路由下相对 fetch 不解析错目录） */
const ROOT = import.meta.env.BASE_URL === './' ? '/' : import.meta.env.BASE_URL

const BASE = `${ROOT}data/brp/`
const cache = new Map()

/** 书卷分组展示名（与构建端 bible-books.mjs 的 group 取值对应） */
export const GROUPS = {
  ot: '旧约',
  nt: '新约',
  ext: '次经 / 第二正典',
}

/**
 * 统一取数：并发去重（同 URL 共享同一 Promise）+ 成功缓存。
 * 失败不缓存（下次重试）；catch 由调用方处理。
 */
function fetchJson(url, options) {
  let p = cache.get(url)
  if (!p) {
    p = fetch(url, options)
      .then((res) => {
        if (!res.ok) {
          const err = new Error(`数据加载失败：${url} (${res.status})`)
          err.status = res.status // 调用方区分 404（真不存在）与瞬时网络错误
          throw err
        }
        return res.json()
      })
      .then((data) => {
        cache.set(url, data)
        return data
      })
      .catch((e) => {
        cache.delete(url) // 失败不缓存，允许下次重试
        throw e
      })
    cache.set(url, p) // 先缓存 Promise 实现 in-flight 去重
  }
  return p
}

/** 加载译本清单 manifest.json（no-store：开发期数据重建频繁，避免 304 命中陈旧响应） */
export async function fetchManifest() {
  return fetchJson(BASE + 'manifest.json', { cache: 'no-store' })
}

/** 加载某译本某卷的切片数据（含全部章节经文），自动缓存 */
export async function fetchBook(key, bookId) {
  return fetchJson(`${BASE}translations/${key}/books/${bookId}.json`)
}

/** 加载某卷的逐字 Strong 数据（和合本简体；每章每节 words[{t,s}]），按卷缓存 */
export async function fetchStrong(bookId) {
  return fetchJson(`${BASE}strongs/${bookId}.json`)
}

/** 加载 Strong 词典全量（悬停/详情用；词条键为补零强码如 H0430），fetchJson 内置缓存 */
export async function fetchStrongDict() {
  return fetchJson(BASE + 'strongs-dict.json')
}

/** 默认译本偏好顺序（URL 未指定译本时的回退链；和合本简体为默认，新放入的译本不影响此偏好） */
const PREFERRED_TRANS = ['chisim', 'niv', 'chiun', 'chisb']

/** 当前选中译本在 manifest 中的条目（按偏好顺序回退） */
export function resolveTranslation(manifest, key) {
  if (key) {
    const t = manifest.translations.find((x) => x.key === key)
    if (t) return t
  }
  for (const k of PREFERRED_TRANS) {
    const t = manifest.translations.find((x) => x.key === k)
    if (t) return t
  }
  return manifest.translations[0]
}

/* ============ 注释数据（多注释源） ============
 * 运行时数据位于 public/data/brp/commentary/：
 *   manifest.json  注释源清单（多源架构：新注释源自动出现）
 *   <sourceKey>/<bookId>.json  按卷注释（整卷一个文件，按需加载 + 缓存）
 * 新注释源接入：把 JSON 放入 data-src/brp/commentary/<key>/ → npm run data
 */
const COMMENT_BASE = `${ROOT}data/brp/commentary/`

/** 加载注释源清单（no-store：开发期数据重建频繁，避免 304 命中陈旧响应） */
export async function fetchCommentaryManifest() {
  return fetchJson(COMMENT_BASE + 'manifest.json', { cache: 'no-store' })
}

/* ============ 注释书卷开关 ============
 * 临时关闭某卷注释：不在白名单内的书卷，前端一律视为"无注释"（数据文件保留，不删除）。
 * 恢复显示：把 bookId（01-66 / ext-N）加回本集合即可，无需重跑数据构建。
 */
const ENABLED_COMMENTARY_BOOKS = new Set(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50', '51', '52', '53', '54', '55', '56', '57', '58', '59', '60', '61', '62', '63', '64', '65', '66'])

/** 某卷注释当前是否开放显示 */
export function isCommentaryEnabled(bookId) {
  return ENABLED_COMMENTARY_BOOKS.has(bookId)
}

/** 加载某注释源某卷的注释数据（含全部章节），自动缓存；卷注释被暂时关闭时返回 null
 * category：解经抽屉栏目（summary 总结 / interpretation 经文解释 / fullCommentary 完整解经），
 * 与数据目录 data-src/brp/commentary/<category>/<key>/ 对应；背景注释走 fetchNotes */
export async function fetchCommentary(sourceKey, bookId, category = 'fullCommentary') {
  if (!isCommentaryEnabled(bookId)) return null
  return fetchJson(`${COMMENT_BASE}${category}/${sourceKey}/${bookId}.json`, { cache: 'no-store' })
}

/** 默认注释源偏好（URL/存储未指定时优先：马太亨利主源；新源不影响此偏好） */
const PREFERRED_COMMENTARY_SOURCE = ['matthew-henry']

/**
 * 注释源语言组：同一部注释的多语言版本在源选择器中合并为一项，
 * 选定后通过语言标签（LanguageTag）在组内源之间切换。
 * 组定义：{ baseKey, label, langs: [{ lang, key, label }] }（langs[0] 为组默认语言）
 */
export const COMMENTARY_LANG_GROUPS = [
  {
    baseKey: 'matthew-henry',
    label: '马太亨利圣经注释',
    langs: [
      { lang: 'zh', key: 'matthew-henry', label: '中文' },
      { lang: 'en', key: 'matthew-henry-en', label: 'English' },
    ],
  },
]

/** 某源是否属于某个语言组（按 baseKey） */
export function groupOfSource(sourceKey) {
  return COMMENTARY_LANG_GROUPS.find((g) => g.langs.some((l) => l.key === sourceKey)) || null
}

/**
 * 源选择器展示列表：语言组成员只保留主条目（langs[0]），其余由语言标签切换；
 * 组主条目不存在（如中文源被关闭）时组失效，组内语言独立展示，避免整组消失。
 */
export function displaySources(sources) {
  const hidden = new Set()
  for (const g of COMMENTARY_LANG_GROUPS) {
    const mainKey = g.langs[0].key
    if (!sources.some((s) => s.key === mainKey)) continue // 主源缺失 → 不合并组
    for (const l of g.langs.slice(1)) hidden.add(l.key)
  }
  return sources.filter((s) => !hidden.has(s.key))
}

/** 解析注释源（优先指定 key → 偏好链 → 第一个源；可按当前书卷过滤可用性） */
export function resolveCommentarySource(manifest, key, bookId) {
  if (!manifest || !manifest.sources.length) return null
  const usable = (s) => !bookId || !Array.isArray(s.books) || s.books.includes(bookId)
  if (key) {
    const s = manifest.sources.find((x) => x.key === key)
    if (s && usable(s)) return s
  }
  for (const k of PREFERRED_COMMENTARY_SOURCE) {
    const s = manifest.sources.find((x) => x.key === k)
    if (s && usable(s)) return s
  }
  return manifest.sources.find(usable) || null
}

/** 从注释卷数据中取某章（无则返回 null） */
export function findCommentaryChapter(book, chapter) {
  if (!book) return null
  return book.chapters.find((c) => c.chapter === chapter) || null
}

/** 当前选中书卷信息（找不到则回退到该译本第一卷） */
export function resolveBook(translation, bookId) {
  return translation.books.find((b) => b.id === bookId) || translation.books[0]
}

/* ============ 背景注释数据（notes，并入 commentary 数据体系） ============
 * 作者/地点/背景的简要介绍（术语「注释」，与「解经」区分），来自 STEP Bible TIPNR（CC BY 4.0）：
 *   public/data/brp/commentary/notes/tipnr/entries.json   全量词条索引（供将来词条高亮匹配）
 *   public/data/brp/commentary/notes/tipnr/books/<bookId>.json  按卷分片：每章 entries（词条 + 四级描述 + 出现节）
 *   public/data/brp/commentary/notes/tipnr/place-coords.json  地点经纬度表（地图系统用）
 */
const NOTES_SOURCE_KEY = 'tipnr'

/** 加载某卷背景注释（含全部章节），自动缓存；no-store 绕过 HTTP 缓存（数据重建频繁）。
 * 背景注释不走完整解经的书卷开关（数据面与解经并列，独立管控） */
export async function fetchNotes(bookId) {
  return fetchJson(`${COMMENT_BASE}notes/${NOTES_SOURCE_KEY}/books/${bookId}.json`, { cache: 'no-store' })
}

/** 取某章的背景注释（无则返回 null） */
export function findNotesChapter(book, chapter) {
  if (!book) return null
  return book.chapters.find((c) => c.chapter === chapter) || null
}

/** 加载地点经纬度表（地图系统用；{ count, coords: { 词条名: {lat, lng} } }），自动缓存 */
export async function fetchPlaceCoords() {
  return fetchJson(`${COMMENT_BASE}notes/${NOTES_SOURCE_KEY}/place-coords.json`, { cache: 'no-store' })
}

/** 加载词条简体中文名表（归一化 Strong 码 → 中文名；注释高亮显示用），自动缓存 */
export async function fetchZhNames() {
  return fetchJson(`${COMMENT_BASE}notes/${NOTES_SOURCE_KEY}/zh-names.json`, { cache: 'no-store' })
}

/* ============ 圣经地理数据（地图页 /map） ============
 * 运行时数据位于 public/data/geography/：
 *   journeys.json   旅程索引（UBS MARBLE：stops/segments，几何与业务分离）
 *   geometries.json 几何库（geometry_id → LineString [lng, lat]）
 *   periods.json    圣经时期索引（时间轴）
 *   tiles/          Vector Tile（疆域/城市/城区，按时期预切——由 MapLibre 直接加载）
 *   base/           底图（Gray Earth 栅格 + NE 自然层 GeoJSON）
 */
const GEO_BASE = `${ROOT}data/geography/`

/** 加载旅程索引（含全部 journey 元数据与 stops/segments 引用），自动缓存 */
export async function fetchJourneys() {
  return fetchJson(GEO_BASE + 'journeys.json', { cache: 'no-store' })
}

/** 加载几何库（geometry_id → LineString 坐标），自动缓存 */
export async function fetchGeometries() {
  return fetchJson(GEO_BASE + 'geometries.json', { cache: 'no-store' })
}

/** 加载圣经时期索引（HISTORICAL-MAP.md §10；periods[].journey_ids 供时间轴过滤），自动缓存 */
export async function fetchPeriods() {
  return fetchJson(GEO_BASE + 'periods.json', { cache: 'no-store' })
}

/**
 * 书卷 → 圣经时期映射（brp 地图时代对应；period id 见 periods.json）
 * 按各卷主体叙事年代编排（学术共识近似值）：地图抽屉据此切换疆域/城市瓦片集。
 * 未收录的卷（未知 id）返回 null → 地图显示「全部」时期。
 */
export const BOOK_PERIODS = {
  // 律法书与历史书
  '01': 'abraham', // 创世记：族长时代
  '02': 'exodus', // 出埃及记
  '03': 'exodus', // 利未记
  '04': 'exodus', // 民数记
  '05': 'exodus', // 申命记
  '06': 'exodus', // 约书亚记
  '07': 'exodus', // 士师记（主体在前王国时期）
  '08': 'exodus', // 路得记（士师时代）
  '09': 'david', // 撒母耳记上（扫罗/大卫）
  '10': 'david', // 撒母耳记下
  '11': 'david', // 列王纪上（所罗门至王国分裂初期）
  '12': 'assyria', // 列王纪下（分裂王国至犹大亡国）
  '13': 'david', // 历代志上
  '14': 'assyria', // 历代志下（主体为分裂王国时期）
  '15': 'persia', // 以斯拉记
  '16': 'persia', // 尼希米记
  '17': 'persia', // 以斯帖记
  // 智慧书
  '18': 'abraham', // 约伯记（族长时代背景）
  '19': 'david', // 诗篇
  '20': 'david', // 箴言
  '21': 'david', // 传道书
  '22': 'david', // 雅歌
  // 大先知
  '23': 'assyria', // 以赛亚
  '24': 'babylon', // 耶利米
  '25': 'babylon', // 耶利米哀歌
  '26': 'babylon', // 以西结
  '27': 'babylon', // 但以理
  // 小先知
  '28': 'assyria', // 何西阿
  '29': 'assyria', // 约珥
  '30': 'assyria', // 阿摩司
  '31': 'babylon', // 俄巴底亚
  '32': 'assyria', // 约拿
  '33': 'assyria', // 弥迦
  '34': 'assyria', // 那鸿
  '35': 'babylon', // 哈巴谷
  '36': 'assyria', // 西番雅
  '37': 'persia', // 哈该
  '38': 'persia', // 撒迦利亚
  '39': 'persia', // 玛拉基
  // 新约
  '40': 'jesus', // 马太福音
  '41': 'jesus', // 马可福音
  '42': 'jesus', // 路加福音
  '43': 'jesus', // 约翰福音
  '44': 'paul', // 使徒行传
  '45': 'paul', // 罗马书
  '46': 'paul', // 哥林多前书
  '47': 'paul', // 哥林多后书
  '48': 'paul', // 加拉太书
  '49': 'paul', // 以弗所书
  '50': 'paul', // 腓立比书
  '51': 'paul', // 歌罗西书
  '52': 'paul', // 帖撒罗尼迦前书
  '53': 'paul', // 帖撒罗尼迦后书
  '54': 'paul', // 提摩太前书
  '55': 'paul', // 提摩太后书
  '56': 'paul', // 提多书
  '57': 'paul', // 腓利门书
  '58': 'paul', // 希伯来书
  '59': 'paul', // 雅各书
  '60': 'temple_fall', // 彼得前书（约 64 AD）
  '61': 'temple_fall', // 彼得后书
  '62': 'temple_fall', // 约翰一书（圣殿毁灭前后）
  '63': 'temple_fall', // 约翰二书
  '64': 'temple_fall', // 约翰三书
  '65': 'temple_fall', // 犹大书
  '66': 'temple_fall', // 启示录
  // 次经（思高本/DRC）
  'ext-1': 'assyria', // 多俾亚传（亚述流放背景）
  'ext-2': 'babylon', // 友弟德传
  'ext-3': 'rome_entry', // 智慧篇（希腊化时代）
  'ext-4': 'rome_entry', // 德训篇
  'ext-5': 'babylon', // 巴路克书
  'ext-6': 'rome_entry', // 玛加伯上（哈斯摩尼时代）
  'ext-7': 'rome_entry', // 玛加伯下
}

/** 书卷对应的圣经时期（未知卷返回 null = 全部时期） */
export function periodOfBook(bookId) {
  return BOOK_PERIODS[bookId] || null
}

/** 加载历史底图要素（land/ocean/rivers/lakes），自动缓存 */
export async function fetchBaseLayer(name) {
  return fetchJson(`${GEO_BASE}base/ne_${name}.geojson`)
}

/** 按栏目（解经抽屉层）过滤注释源清单：summary / interpretation / notes / fullCommentary */
export function sourcesOfCategory(manifest, category) {
  return (manifest?.sources || []).filter((s) => s.category === category)
}

/* ============ 护教问答数据（子数据库） ============
 * 运行时数据位于 public/data/apologetics/（与路由同名目录约定）：
 *   content.json            索引（主题元数据 + 子问题轻量搜索文本，探索/搜索用，不含正文）
 *   topics/<topicId>.json   主题切片（完整数据，按需加载 + 缓存）
 * 由 scripts/build-data.mjs 从 data-src/apologetics/topics/（每回答一个文件）组装生成
 */
const APOLOG_BASE = `${ROOT}data/apologetics/`

/** 加载护教索引（{ topics: [{ id, title, description, tags, sqCount, responseCount, questions: [...] }] }），自动缓存 */
export async function fetchApologetics() {
  return fetchJson(APOLOG_BASE + 'content.json')
}

/** 加载单个主题的完整数据（{ id, title, description, tags, sub_questions: [...] }），按需加载 + 缓存 */
export async function fetchApologeticsTopic(topicId) {
  return fetchJson(`${APOLOG_BASE}topics/${topicId}.json`)
}

/* ============ 图书馆书目数据 ============
 * 运行时数据位于 public/data/library/：
 *   content.json        索引（分类定义 + 书目轻量条目，书架/搜索用）
 *   books/<bookId>.json 书目详情（元数据 + 文件直链清单，按需加载 + 缓存）
 * 书籍文件本体存放于独立 GitHub 仓库（library-books-*，Pages 直链），不在本站。
 */
const LIB_BASE = `${ROOT}data/library/`

/** 加载图书馆索引（{ source, categories: [...], books: [...] }），自动缓存 */
export async function fetchLibraryIndex() {
  return fetchJson(LIB_BASE + 'content.json')
}

/** 加载单本书目详情（{ id, title, author, description, files: [{url, format, size, title}] }），按需加载 + 缓存 */
export async function fetchLibraryBook(bookId) {
  return fetchJson(`${LIB_BASE}books/${bookId}.json`)
}

/* ============ 教会史数据（《历史的轨迹——二千年教会史》） ============
 * 运行时数据位于 public/data/church-history/：
 *   content.json  书目索引（书名/作者/译者 + 5 部元数据）
 *   partN.json    按部切片（intro 部导论 + chapters 章，含小节/段落/插图块）
 *   图片           data/church-history/images/（转换脚本已复制）
 * 由工作区 scripts 生成数据 → build-data.mjs 复制到 public/data
 */
const HISTORY_BASE = `${ROOT}data/church-history/`

/** 加载教会史书目索引，自动缓存 */
export async function fetchChurchHistory() {
  return fetchJson(HISTORY_BASE + 'content.json')
}

/** 加载第 n 部（1-5）的完整数据（intro + chapters），按需加载 + 缓存 */
export async function fetchChurchHistoryPart(n) {
  return fetchJson(`${HISTORY_BASE}part${n}.json`)
}

/** 教会史插图 URL：数据内 src 为相对路径（images/xxx.jpg），拼上运行时前缀 */
export function churchHistoryImg(src) {
  return HISTORY_BASE + src
}

/* ============ 串珠（交叉引用）数据 ============
 * 运行时数据位于 public/data/brp/crossrefs/<bookId>.json（按卷切片 + 缓存）
 * 由 scripts/build-crossrefs.mjs 从素材 TSV 构建（素材只读）
 */
const CROSSREF_BASE = `${ROOT}data/brp/crossrefs/`

/** 加载某卷串珠数据（chapters[].verses[].refs[]：anchor + targets），自动缓存 */
export async function fetchCrossrefs(bookId) {
  return fetchJson(`${CROSSREF_BASE}${bookId}.json`)
}

/** 从串珠卷数据中取某章的 verse → refs 映射（无则空对象） */
export function findCrossrefChapter(book, chapter) {
  if (!book) return {}
  const ch = book.chapters.find((c) => c.chapter === chapter)
  if (!ch) return {}
  const map = {}
  for (const v of ch.verses) map[v.verse] = v.refs
  return map
}

/** 章号越界时钳制到有效范围 */
export function clampChapter(book, chapter) {
  const n = Number(chapter)
  if (!Number.isInteger(n) || n < 1) return 1
  return Math.min(n, book.chapterCount)
}
