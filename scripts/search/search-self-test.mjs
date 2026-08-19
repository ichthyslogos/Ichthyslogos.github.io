/**
 * search-self-test.mjs — 检索引擎回归自测（构建后运行）
 * 校验地址解析、实体检索、经文全文（多译本 + 简体 query 命中繁体原文）、
 * 注释段落、主题 / 教会史的关键路径。
 * 用法：node scripts/search/search-self-test.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  norm,
  buildBookLookup,
  parseReference,
  searchEntities,
  searchScripture,
  countScripture,
  prepareScripture,
  prepareCommentary,
  searchCommentary,
} from '../../src/lib/searchEngine.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'))

let pass = 0
let fail = 0
function eq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else {
    fail++
    console.error(`✗ ${label}\n   期望 ${JSON.stringify(expected)}\n   实际 ${JSON.stringify(actual)}`)
  }
}

/* ---------- 归一化（繁→简 匹配域） ---------- */
eq(norm('神愛世人'), '神爱世人', 'norm 繁→简')
eq(norm('約翰福音'), '约翰福音', 'norm 书名：約翰福音')
eq(norm('以賽亞書'), '以赛亚书', 'norm 书名：以賽亞書')
eq(norm('歷代志'), '历代志', 'norm 书名：歷代志')
eq(norm('詩篇'), '诗篇', 'norm 书名：詩篇')
eq(norm('啟示錄'), '启示录', 'norm 书名：啟示錄')
eq(norm('傳道書'), '传道书', 'norm 书名：傳道書')
eq(norm('馬太福音'), '马太福音', 'norm 书名：馬太福音')
eq(norm('耶穌'), '耶稣', 'norm 人名：耶穌')
eq(norm('大衛'), '大卫', 'norm 人名：大衛')
eq(norm('掃羅'), '扫罗', 'norm 人名：掃羅')
eq(norm('亞伯拉罕'), '亚伯拉罕', 'norm 人名：亞伯拉罕')
eq(norm('耶利米亞倫'), '耶利米亚伦', 'norm 混合')
eq(norm('Jerusalem'), 'jerusalem', 'norm 小写')
eq(norm('‘Locidae Regi’'), "'locidae regi'", 'norm 引号折叠')

/* ---------- 地址解析 ---------- */
const index = readJson('public/data/search/index.json')
const lookup = buildBookLookup(index.books)

const t = (q) => {
  const r = parseReference(q, lookup)
  return r ? `${r.bookId}/${r.chapter}${r.verse ? ':' + r.verse : ''}` : null
}
eq(t('约3:16'), '43/3:16', '地址：约3:16')
eq(t('約3:16'), '43/3:16', '地址：約3:16（繁体输入）')
eq(t('约翰福音 3 章 16 节'), '43/3:16', '地址：约翰福音 3 章 16 节')
eq(t('John 3:16'), '43/3:16', '地址：John 3:16')
eq(t('gen 3:16'), '01/3:16', '地址：gen 3:16（创世记）')
eq(t('诗23'), '19/23', '地址：诗23')
eq(t('創1:1'), '01/1:1', '地址：創1:1（繁）')
eq(t('43:3:16'), '43/3:16', '地址：43:3:16')
eq(t('约'), '43/1', '地址：约（单字→约翰福音）')
eq(t('申命记 6:4'), '05/6:4', '地址：申命记 6:4')
eq(t('启21:1'), '66/21:1', '地址：启21:1')
eq(t('random text'), null, '地址：普通文本不误报')

/* ---------- 实体检索 ---------- */
const ent = searchEntities('亚伯拉罕', index, 5)
eq(ent.persons[0]?.raw.en, 'Abraham', '实体：亚伯拉罕 → Abraham')
eq(ent.persons[0]?.score >= 900, true, '实体：完全命中高分')
const jer = searchEntities('耶路撒冷', index, 5)
eq(jer.places[0]?.raw.en, 'Jerusalem', '实体：耶路撒冷 → Jerusalem')
eq(jer.places[0]?.raw.lat != null, true, '实体：耶路撒冷带坐标')
const ab2 = searchEntities('亚伯兰', index, 5)
eq(ab2.persons.some((p) => p.raw.en === 'Abraham'), true, '实体：别名「亚伯兰」命中 Abraham')
const enSearch = searchEntities('moses', index, 5)
eq(enSearch.persons[0]?.raw.zh, '摩西', '实体：moses → 摩西')
const judah = searchEntities('judea', index, 10)
eq(judah.polities.length > 0, true, '实体：judea 命中政权')
const per = searchEntities('耶稣时期', index, 5)
eq(per.periods[0]?.raw.id, 'jesus', '实体：耶稣时期命中时期')
const ref2 = searchEntities('罗马书', index, 5)
eq(ref2.persons.length, 0, '实体：书名不误报为人物')

/* ---------- 经文全文（简体 query 命中繁体原文） ---------- */
const chiun = prepareScripture(readJson('public/data/search/scripture-chiun.json'), index.books)
const hit = searchScripture('神爱世人', chiun, { limit: 3 })
eq(hit.length > 0, true, '全文：简体「神爱世人」命中')
const j316 = hit.find((v) => v.bookIndex === 42 && v.chapter === 3 && v.verse === 16)
eq(!!j316, true, '全文：命中约翰福音 3:16')
eq(j316?.text.includes('神愛世人'), true, '全文：显示繁体原文（未被转换污染）')
eq(searchScripture('a', chiun).length, 0, '全文：拉丁单字符不检索')

const niv = prepareScripture(readJson('public/data/search/scripture-niv.json'))
const enHit = searchScripture('for god so loved', niv, { limit: 3 })
eq(enHit.some((v) => v.bookIndex === 42 && v.chapter === 3 && v.verse === 16), true, '全文：英文短语命中 John 3:16')
eq(countScripture('love', niv) > 100, true, '全文：love 大量命中（计数正常）')

/* ---------- 译本清单（扩充后 ≥5 个译本） ---------- */
eq(index.translations.length >= 5, true, '译本：索引含多译本')
eq(index.translations.some((t) => t.key === 'chisb' && t.lang === 'zh'), true, '译本：思高本为中文')
eq(index.translations.some((t) => t.key === 'kjv' && t.lang === 'latin'), true, '译本：KJV 为拉丁系')
const chisb = prepareScripture(readJson('public/data/search/scripture-chisb.json'))
eq(searchScripture('太初', chisb, { limit: 5 }).length > 0, true, '全文：思高本命中「太初」')

/* ---------- 注释段落（heading + 摘录） ---------- */
const mh = prepareCommentary(readJson('public/data/search/commentary-matthew-henry-en.json'))
const divHit = searchCommentary('divinity of christ', mh, { limit: 3 })
eq(divHit.length > 0, true, '注释：divinity of christ 命中 MH')
eq(divHit[0]?.heading.includes('Divinity of Christ'), true, '注释：heading 原文保留')
eq(divHit[0]?.bookIndex === 42 && divHit[0]?.chapter === 1, true, '注释：命中约翰福音 1 章')
eq(searchCommentary('a', mh).length, 0, '注释：拉丁单字符不检索')
const mhSum = prepareCommentary(readJson('public/data/search/commentary-mhcc-summary.json'))
eq(mhSum.secs.length > 1000, true, '注释：MH 简明总结段落规模')

/* ---------- 主题 / 教会史 ---------- */
const top = searchEntities('复活', index, 8)
eq(top.topics.length > 0, true, '主题：「复活」命中护教学专题')
const topEn = searchEntities('evolution', index, 8)
eq(topEn.topics.some((t) => /evolution/i.test(t.en || '')), true, '主题：evolution 命中英文专题')
const hist = searchEntities('改教', index, 8)
eq(hist.history.length > 0, true, '教会史：「改教」命中章节（源数据用词）')
eq(hist.history.every((h) => h.raw.part >= 1 && h.raw.part <= 5), true, '教会史：部号合法')
eq(searchEntities('圣经', index, 8).topics.length > 0, true, '主题：标签「圣经」命中')

console.log(`\n自测完成：${pass} 通过，${fail} 失败`)
process.exit(fail ? 1 : 0)
