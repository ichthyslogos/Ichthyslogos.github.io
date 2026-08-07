// 翻译卷注释 heading 全量修复（可重复执行，幂等）
// 1) 诗篇 119：94-176 从 text「」引文提取标题（取首句），并移除 text 开头的「」引文
//    （标题已承载在 heading，避免正文重复）；1-93 原书无标题，保持为空
// 2) 其他翻译卷：空 heading 恢复为原书重复标题（复制前一非空小节标题）
// 3) 诗篇 101-150：text 行首残留的诗题行（上行之歌/大卫的诗等）移除
import { readFileSync, writeFileSync } from 'node:fs'

const DIR = 'data-src/brp/commentary/matthew-henry/'
const TARGETS = ['19', '48', '49', '50', '51', '52', '53', '62', '63', '64', '65']
const POEM_TITLE =
  /^(上行之[诗歌]|大卫的?上行之[诗歌]|所罗门的?上行之[诗歌]|大卫的诗|亚萨的诗|可拉后裔的诗|（交与伶长）|交与伶长)[。.]?$/

for (const id of TARGETS) {
  const path = DIR + id + '.json'
  const data = JSON.parse(readFileSync(path, 'utf8'))
  let filled = 0
  let cleaned = 0

  for (const c of data.chapters) {
    if (id === '19' && c.chapter <= 100) continue
    const secs = c.sections || []

    for (let i = 0; i < secs.length; i++) {
      const s = secs[i]

      // 119：94-176 从 text 开头「」引文补标题（取首句）
      if (id === '19' && c.chapter === 119 && !s.heading) {
        const m = s.text.match(/^「([^」]+)」/)
        if (m) {
          s.heading = m[1].split(/[。！？；]/)[0]
          filled++
        }
      }
      // 119：text 开头的「」引文移除（标题已承载在 heading）
      if (id === '19' && c.chapter === 119) {
        const q = s.text.match(/^「[^」]+」\s*/)
        if (q) {
          s.text = s.text.slice(q[0].length)
          cleaned++
        }
      }
      // 诗篇：text 行首诗题行移除（原书诗题不并入正文）
      if (id === '19') {
        const lines = s.text.split('\n')
        if (lines.length && POEM_TITLE.test(lines[0].trim())) {
          s.text = lines.slice(1).join('\n').trim()
          cleaned++
        }
      }
      // 其他翻译卷：空 heading 恢复为原书重复标题（复制前一非空小节标题）
      if (id !== '19' && !s.heading) {
        for (let j = i - 1; j >= 0; j--) {
          if (secs[j].heading) {
            s.heading = secs[j].heading
            filled++
            break
          }
        }
      }
    }
  }

  writeFileSync(path, JSON.stringify(data))
  if (filled || cleaned) console.log(`${id}: 填充 ${filled} 处 / 清理 ${cleaned} 处`)
}
console.log('完成')
