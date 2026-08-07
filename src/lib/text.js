/**
 * text.js — 文本处理工具（src/lib/ 根目录下的共享模块）
 *
 * 马太亨利译注素材经 PDF 提取后，注释文本保留了原书排版的行尾换行
 * （每行约 40-47 字符即断行）。直接渲染会呈现"句中截断"的原始文本，
 * 因此渲染前用 flowCommentary 合并软换行、保留段落结构。
 */

const SENTENCE_END = /[。！？；」』…——]$/

/** 行尾是否可断段：句末标点；冒号仅当后无数字（排除"17："类经文引用） */
function endsSentence(line) {
  if (SENTENCE_END.test(line)) return true
  return /[:：]$/.test(line) && !/\d[:：]$/.test(line)
}

/** 行首为层级编号（I./1./（1）/[1.]/注意：等）时强制另起一段 */
const SECTION_START =
  /^(（\d+）|\[?\d+\]?[.、．]|[一二三四五六七八九十]+[、.．]|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+[.、．]|注意[:：])/

/** 脚注行：行首"数字+脚注词"（钦定本/和合本/约翰/莱福特/原文/译本/译注等），数字后可带空格 */
const FOOTNOTE_START = /^\d+\s*(钦定本|和合本|约翰|莱福特|原文|译本|译注)/

/** 脚注内容特征：含引号（译文引用），或承接上一脚注引号句的收尾行 */
function isNoteTail(line, prevNote) {
  if (/[“”"'「」『』]/.test(line)) return true
  return /[。；]/.test(line) && /[“”"'「」『』]$/.test(prevNote)
}

/** 上标脚注标记：汉字/括号后紧跟数字再跟中文标点（或冒号后非数字），如"他们1：""混乱虚空1。" */
const SUP_MARK = /([\u4e00-\u9fa5）】])(\d{1,2})([，。；、）」』]|：[^\d])/g

/**
 * 智能合并段落：行尾为句末标点或行首为层级编号 → 新段落；
 * 其余行（句中截断）与上一行拼接。脚注行从正文流中抽取，统一移到文末。
 * 段落间以空行（\n\n）分隔。
 */
export function flowCommentary(text) {
  if (!text) return text
  const out = []
  const notes = []
  let inNote = false
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (FOOTNOTE_START.test(line)) {
      notes.push(line) // 新脚注行
      inNote = true
      continue
    }
    if (inNote) {
      const prevNote = notes[notes.length - 1]
      if (!SECTION_START.test(line) && isNoteTail(line, prevNote)) {
        notes[notes.length - 1] += line // 脚注续行（跨行脚注）
        continue
      }
      inNote = false // 回到正文流
    }
    const prev = out[out.length - 1]
    if (out.length === 0 || SECTION_START.test(line) || endsSentence(prev)) {
      out.push(line)
    } else {
      out[out.length - 1] += line
    }
  }
  return out.concat(notes).join('\n\n')
}

/**
 * 注释文本 → 安全 HTML：转义特殊字符、上标数字包 <sup>、段落包 <p>（脚注段加 footnote 类）。
 * 数据为本站自产内容（无外部输入），转义仍保留以防万一。
 */
export function commentaryToHtml(text) {
  if (!text) return ''
  const esc = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  const withSup = esc.replace(SUP_MARK, '$1<sup>$2</sup>$3')
  return withSup
    .split('\n\n')
    .map((p) => `<p${FOOTNOTE_START.test(p) ? ' class="footnote"' : ''}>${p}</p>`)
    .join('')
}
