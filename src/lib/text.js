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

/**
 * 智能合并段落：行尾为句末标点或行首为层级编号 → 新段落；
 * 其余行（句中截断）与上一行拼接。段落间以空行（\n\n）分隔。
 */
export function flowCommentary(text) {
  if (!text) return text
  const out = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const prev = out[out.length - 1]
    if (out.length === 0 || SECTION_START.test(line) || endsSentence(prev)) {
      out.push(line)
    } else {
      out[out.length - 1] += line
    }
  }
  return out.join('\n\n')
}
