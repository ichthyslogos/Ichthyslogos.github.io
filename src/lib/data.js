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

const BASE = 'data/brp/'
const cache = new Map()

/** 书卷分组展示名（与构建端 bible-books.mjs 的 group 取值对应） */
export const GROUPS = {
  ot: '旧约',
  nt: '新约',
  ext: '次经 / 第二正典',
}

async function fetchJson(url) {
  if (cache.has(url)) return cache.get(url)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`数据加载失败：${url} (${res.status})`)
  const data = await res.json()
  cache.set(url, data)
  return data
}

/** 加载译本清单 manifest.json */
export async function fetchManifest() {
  return fetchJson(BASE + 'manifest.json')
}

/** 加载某译本某卷的切片数据（含全部章节经文），自动缓存 */
export async function fetchBook(key, bookId) {
  return fetchJson(`${BASE}translations/${key}/books/${bookId}.json`)
}

/** 默认译本偏好顺序（URL 未指定译本时的回退链；新放入的译本不影响此偏好） */
const PREFERRED_TRANS = ['chiuns', 'chiun', 'chisb']

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
const COMMENT_BASE = 'data/brp/commentary/'

/** 加载注释源清单 */
export async function fetchCommentaryManifest() {
  return fetchJson(COMMENT_BASE + 'manifest.json')
}

/* ============ 注释书卷开关 ============
 * 临时关闭某卷注释：不在白名单内的书卷，前端一律视为"无注释"（数据文件保留，不删除）。
 * 恢复显示：把 bookId（01-66 / ext-N）加回本集合即可，无需重跑数据构建。
 */
const ENABLED_COMMENTARY_BOOKS = new Set(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'])

/** 某卷注释当前是否开放显示 */
export function isCommentaryEnabled(bookId) {
  return ENABLED_COMMENTARY_BOOKS.has(bookId)
}

/** 加载某注释源某卷的注释数据（含全部章节），自动缓存；卷注释被暂时关闭时返回 null */
export async function fetchCommentary(sourceKey, bookId) {
  if (!isCommentaryEnabled(bookId)) return null
  return fetchJson(`${COMMENT_BASE}${sourceKey}/${bookId}.json`)
}

/** 解析注释源（找不到则回退第一个） */
export function resolveCommentarySource(manifest, key) {
  if (!manifest || !manifest.sources.length) return null
  if (key) {
    const s = manifest.sources.find((x) => x.key === key)
    if (s) return s
  }
  return manifest.sources[0]
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

/* ============ 护教问答数据（子数据库） ============
 * 运行时数据位于 public/data/apologetics/（与路由同名目录约定）：
 *   content.json            索引（主题元数据 + 子问题轻量搜索文本，探索/搜索用，不含正文）
 *   topics/<topicId>.json   主题切片（完整数据，按需加载 + 缓存）
 * 由 scripts/build-data.mjs 从 data-src/apologetics/topics/（每回答一个文件）组装生成
 */
const APOLOG_BASE = 'data/apologetics/'

/** 加载护教索引（{ topics: [{ id, title, description, tags, sqCount, responseCount, questions: [...] }] }），自动缓存 */
export async function fetchApologetics() {
  return fetchJson(APOLOG_BASE + 'content.json')
}

/** 加载单个主题的完整数据（{ id, title, description, tags, sub_questions: [...] }），按需加载 + 缓存 */
export async function fetchApologeticsTopic(topicId) {
  return fetchJson(`${APOLOG_BASE}topics/${topicId}.json`)
}

/* ============ Strong 逐词数据（和合本简体标注层） ============
 * 运行时数据位于 public/data/brp/strong/books/<bookId>.json（按卷切片 + 缓存）
 * 结构：{ key:'chiuns', book:{ id, chapters:[{chapter, verses:[{verse, words:[{t,s,m}]}]}] } }
 * 由 scripts/import-strong.mjs（素材 OSIS）+ build-data.mjs 生成
 */
const STRONG_BASE = 'data/brp/strong/books/'

/** 加载某卷的 Strong 逐词标注（仅和合本简体 chiuns 有），按需加载 + 缓存 */
export async function fetchStrong(bookId) {
  return fetchJson(`${STRONG_BASE}${bookId}.json`)
}

/* ============ 串珠（交叉引用）数据 ============
 * 运行时数据位于 public/data/brp/crossrefs/<bookId>.json（按卷切片 + 缓存）
 * 由 scripts/build-crossrefs.mjs 从素材 TSV 构建（素材只读）
 */
const CROSSREF_BASE = 'data/brp/crossrefs/'

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
