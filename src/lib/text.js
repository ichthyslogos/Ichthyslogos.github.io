/**
 * text.js — 文本处理工具（src/lib/ 根目录下的共享模块）
 *
 * 马太亨利译注素材经 PDF 提取后，注释文本保留了原书排版的行尾换行
 * （每行约 40-47 字符即断行）。渲染前用 flowCommentary 做最简处理：
 * 除数据中已有的换行标记（空行分段）外，其余换行一律合并，不做任何
 * 额外排版（无上标、无脚注样式）。
 */

/**
 * 智能合并段落：按空行（\n\n）分块保留原文段落；块内所有换行合并，
 * 还原为连续文本。段落间以空行（\n\n）分隔。
 */
export function flowCommentary(text) {
  if (!text) return text
  return text
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s*\n\s*/g, '').trim())
    .filter(Boolean)
    .join('\n\n')
}
