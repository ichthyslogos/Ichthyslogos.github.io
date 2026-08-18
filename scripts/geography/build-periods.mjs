/**
 * build-periods.mjs — 圣经时期索引（HISTORICAL-MAP.md §10 Time Engine）
 *
 * 十个圣经时期（HISTORICAL-MAP.md §6 优先支持列表），每个时期含 valid_time 与
 * 该时期的旅程 id 列表（按旅程名/故事名关键词 curated 规则归类，供时间轴过滤）。
 * 产出：public/data/geography/periods.json
 *
 * 用法：node scripts/geography/build-periods.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('../../data-src/geography/normalized/journeys.json', import.meta.url))
const OUT = fileURLToPath(new URL('../../public/data/geography/periods.json', import.meta.url))

/** 十个圣经时期（valid_time 与 build-brp-historical / 前端 PERIODS 一致；BCE 负）
 *  era：时代元数据（Temporal Engine 时间轴副标题；TEMPORAL-MAP-DB 时期分类） */
const PERIODS = [
  { id: 'abraham', name: '亚伯拉罕时期', era: '青铜时代中期', year: -2100, valid_time: { from: -2166, to: -1800 }, desc: '列祖时代：亚伯拉罕、以撒、雅各、约瑟', keywords: /abram|abraham|lot|sodom|melchizedek|hagar|ishmael|isaac|jacob|esau|joseph|beersheba|haran|gerar|moriah|gilead|mizpah|bethel|dothan|timnah|goshen|pharaoh|shechem|salem|negev|eden|noah|flood|babel|cain|adam|enoch/i },
  { id: 'exodus', name: '出埃及', era: '青铜时代晚期', year: -1400, valid_time: { from: -1446, to: -1200 }, desc: '摩西、旷野漂流、约书亚征服', keywords: /moses|exodus|wilderness|wandering|spies|joshua|jericho|tabernacle|red sea|mount sinai|sinai|horeb|jethro|aaron|balaam|transjordan|si[hn]on|midian|conquest|promised land/i },
  { id: 'david', name: '大卫王国', era: '铁器时代早期', year: -1000, valid_time: { from: -1050, to: -930 }, desc: '统一王国：扫罗、大卫、所罗门', keywords: /saul|david|solomon|samuel|temple|ark of the covenant|goliath|philistine|hebron|united kingdom|rehoboam|jeroboam|sheba|absalom|bathsheba|amalekite/i },
  { id: 'assyria', name: '亚述时期', era: '铁器时代晚期 · 亚述霸权', year: -722, valid_time: { from: -930, to: -609 }, desc: '南北分裂与亚述霸权', keywords: /assyria|assyrian|sennacherib|shalmaneser|hezekiah|hoshea|samaria|omri|ahab|elijah|elisha|jehu|jonah|nahum|josiah|manasseh|divided kingdom/i },
  { id: 'babylon', name: '巴比伦时期', era: '新巴比伦帝国', year: -586, valid_time: { from: -609, to: -539 }, desc: '巴比伦帝国与犹大被掳', keywords: /babylon|babylonian|nebuchadnezzar|exile|captivity|jeremiah|ezekiel|daniel|zedekiah|jehoiachin|lament|destruction of jerusalem/i },
  { id: 'persia', name: '波斯时期', era: '波斯阿契美尼德帝国', year: -539, valid_time: { from: -539, to: -331 }, desc: '波斯帝国与归回', keywords: /persia|persian|cyrus|darius|xerxes|esther|nehemiah|ezra|mordecai|artaxerxes|return from exile|rebuild|zephaniah|haggai|malachi|zerubbabel/i },
  { id: 'rome_entry', name: '罗马进入犹太', era: '罗马共和国晚期', year: -63, valid_time: { from: -63, to: 4 }, desc: '马加比、哈斯摩尼王朝与罗马进入', keywords: /maccabee|maccabean|hasmonean|antiochus|seleucid|ptolemaic|herod the great|herod'?s temple|intertestamental/i },
  { id: 'jesus', name: '耶稣时期', era: '罗马帝国早期', year: 30, valid_time: { from: 4, to: 33 }, desc: '耶稣生平与事工', keywords: /jesus|bethlehem|nazareth|galilee|capernaum|samaritan|transfiguration|emmaus|lazarus|bethany|cana|jerusalem.*(temple|feast|passion)|last journey|ascension|john the baptist|joseph and mary|wise men|magi|herod antipas|resurrection|trial|calvary|crucifix|golgotha|bethesda|jacob'?s well|jordan/i },
  { id: 'paul', name: '保罗宣教时期', era: '罗马帝国早期', year: 50, valid_time: { from: 33, to: 62 }, desc: '使徒行传与保罗宣教旅程', keywords: /paul|apostle|acts|pentecost|philip the evangelist|peter|corinth|ephesus|thessalonica|philippi|athens|seven churches|revelation|barnabas|silas|timothy|gentile|conversion/i },
  { id: 'temple_fall', name: '圣殿毁灭', era: '罗马帝国早期 · 犹太战争', year: 70, valid_time: { from: 62, to: 70 }, desc: '犹太战争与圣殿毁灭', keywords: /temple.*(destr|fall)|destruction of the temple|jewish war|titus|vespasian|masada|siege of jerusalem/i },
]

const { journeys } = JSON.parse(readFileSync(SRC, 'utf8'))
const matched = new Set()
const result = PERIODS.map((p) => {
  const ids = journeys
    .filter((j) => {
      const text = `${j.name} ${j.story?.name || ''}`
      if (p.keywords.test(text)) {
        matched.add(j.id)
        return true
      }
      return false
    })
    .map((j) => j.id)
  return { ...p, journey_ids: ids }
})
const unmatched = journeys.filter((j) => !matched.has(j.id)).map((j) => `${j.id}（${j.name} / ${j.story?.name || '无故事'}）`)
if (unmatched.length) {
  console.warn(`[periods] ${unmatched.length} 条旅程未归入任何时期（归入「全部」仍可查看）：`)
  for (const u of unmatched) console.warn('  ' + u)
}

mkdirSync(OUT.replace(/periods\.json$/, ''), { recursive: true })
writeFileSync(
  OUT,
  JSON.stringify(
    {
      source: { key: 'fish_periods', name: 'FISH 圣经时期索引', provider: 'FISH', built_from: 'ubs_marble', license: 'internal' },
      periods: result,
    },
    null,
    1,
  ),
)
console.log(`[periods] periods.json：${result.length} 个时期（${matched.size}/${journeys.length} 旅程已归类）`)
