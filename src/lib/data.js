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
const PREFERRED_TRANS = ['chiun', 'chisb']

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

/** 当前选中书卷信息（找不到则回退到该译本第一卷） */
export function resolveBook(translation, bookId) {
  return translation.books.find((b) => b.id === bookId) || translation.books[0]
}

/** 章号越界时钳制到有效范围 */
export function clampChapter(book, chapter) {
  const n = Number(chapter)
  if (!Number.isInteger(n) || n < 1) return 1
  return Math.min(n, book.chapterCount)
}
