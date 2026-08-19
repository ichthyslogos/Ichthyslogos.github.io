/**
 * backfill-apologetics-src.mjs — 护教专题源回填（一次性治理工具）
 *
 * 背景：6 个专题（bible-reliability 等）曾直接放入 public/data/apologetics/topics/，
 * 未登记 content.meta.json，data-src 无分层源——护教页索引不含它们（用户不可见），
 * 违反「data-src 为源、public 为产物」纪律。
 *
 * 做法（幂等，可重复运行）：
 *   1. 扫 public/data/apologetics/topics/*.json 中未登记的主题
 *   2. 反向拆分为分层源：topic.json（元数据+分类定义）+ <catId>/<sqId>/question.json
 *   3. 追加登记到 data-src/apologetics/content.meta.json 的 topics 列表
 *   4. 之后运行 npm run data 重建索引，前端即可见
 *
 * 拆分无损：产物 slice = { id,title,description,tags,categories[{id,title,sub_questions:[id]}],
 * sub_questions[完整对象] }，反向映射回源即 buildApologetics 的输入（见 build-data.mjs §护教）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SITE = fileURLToPath(new URL('../', import.meta.url))
const SRC_DIR = path.join(SITE, 'data-src/apologetics')
const PUB_TOPICS = path.join(SITE, 'public/data/apologetics/topics')

const metaPath = path.join(SRC_DIR, 'content.meta.json')
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
const registered = new Set(meta.topics || [])

let added = 0
for (const f of fs.readdirSync(PUB_TOPICS).filter((x) => x.endsWith('.json')).sort()) {
  const id = f.replace(/\.json$/, '')
  if (registered.has(id)) continue
  const slice = JSON.parse(fs.readFileSync(path.join(PUB_TOPICS, f), 'utf8'))
  if (slice.id !== id) throw new Error(`主题 id 与文件名不符：${slice.id} != ${id}`)

  const tDir = path.join(SRC_DIR, 'topics', id)
  fs.mkdirSync(tDir, { recursive: true })

  // topic.json：元数据 + 分类定义（sub_questions 为 id 列表，与源端格式一致）
  const topic = {
    id: slice.id,
    title: slice.title,
    description: slice.description,
    tags: slice.tags,
    categories: slice.categories.map((c) => ({ id: c.id, title: c.title, sub_questions: [...c.sub_questions] })),
  }
  fs.writeFileSync(path.join(tDir, 'topic.json'), JSON.stringify(topic, null, 2) + '\n')

  // question.json：顶层完整对象按分类分组拆出（对象自带 id，校验归属）
  const byId = new Map(slice.sub_questions.map((sq) => [sq.id, sq]))
  let written = 0
  for (const cat of slice.categories) {
    for (const sqId of cat.sub_questions) {
      const sq = byId.get(sqId)
      if (!sq) throw new Error(`主题 ${id} 缺子命题：${cat.id}/${sqId}`)
      const qDir = path.join(tDir, cat.id, sqId)
      fs.mkdirSync(qDir, { recursive: true })
      fs.writeFileSync(path.join(qDir, 'question.json'), JSON.stringify(sq, null, 2) + '\n')
      written++
    }
  }
  if (written !== slice.sub_questions.length) throw new Error(`主题 ${id} 拆分数不符`)

  meta.topics.push(id)
  registered.add(id)
  added++
  console.log(`回填主题 ${id}：${slice.categories.length} 分类 / ${written} 子命题`)
}

if (added) fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n')
console.log(`完成：回填 ${added} 个主题；meta 登记共 ${meta.topics.length} 个。请运行 npm run data 重建索引。`)
