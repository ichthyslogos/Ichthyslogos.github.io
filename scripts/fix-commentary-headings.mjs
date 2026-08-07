// 修复翻译卷注释的 heading 问题（一次性脚本，可重复执行）
// 1) 诗篇 119 的 94-176 段内小节：从 text 开头「」引文提取标题（原书每节标题=经文首句，翻译时丢失）
// 2) 全部翻译卷：相邻重复 heading 置空（与中文素材"栏目标题连续重复置空"体例一致）
import { readFileSync, writeFileSync } from 'node:fs'

const DIR = 'data-src/brp/commentary/matthew-henry/'
const TARGETS = ['19', '48', '49', '50', '51', '52', '53', '62', '63', '64', '65']

for (const id of TARGETS) {
  const path = DIR + id + '.json'
  const data = JSON.parse(readFileSync(path, 'utf8'))
  let filled = 0
  let blanked = 0

  for (const c of data.chapters) {
    // 诗篇只处理 101-150（翻译范围）
    if (id === '19' && c.chapter <= 100) continue

    // 1) 119 章：从 text 开头「」引文补标题（取首句；过长标题重新提取）
    if (id === '19' && c.chapter === 119) {
      for (const s of c.sections || []) {
        const tooLong = s.heading && s.heading.length > 40 && s.text.startsWith('「')
        if ((!s.heading || tooLong) && s.text.startsWith('「')) {
          const m = s.text.match(/^「([^」]+)」/)
          if (m) {
            s.heading = m[1].split(/[。！？；]/)[0]
            filled++
          }
        }
      }
    }

    // 2) 相邻重复标题置空
    const secs = c.sections || []
    for (let i = 1; i < secs.length; i++) {
      if (secs[i].heading && secs[i].heading === secs[i - 1].heading) {
        secs[i].heading = ''
        blanked++
      }
    }
  }

  writeFileSync(path, JSON.stringify(data))
  if (filled || blanked) console.log(`${id}: 补标题 ${filled} 处 / 重复置空 ${blanked} 处`)
}
console.log('完成')
