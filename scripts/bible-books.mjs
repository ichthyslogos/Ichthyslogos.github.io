/**
 * bible-books.mjs — 标准书卷元数据
 *
 * 本表是 FISH 平台书卷编号的唯一权威来源：
 * - id  : 01-66 为新教正典标准顺序（与和合本一致），扩展卷（次经/第二正典）用 ext-N
 * - srcName : 素材库 bible_databases JSON 中的原始英文名（按此名匹配，不能按数组位置对齐，
 *             因为思高本等天主教译本的正典排序与新教不同，例如 Esther 位置不同）
 * - group : ot（旧约）| nt（新约）| ext（次经/第二正典）
 */
export const GROUPS = {
  ot: { zh: '旧约', en: 'Old Testament' },
  nt: { zh: '新约', en: 'New Testament' },
  ext: { zh: '次经 / 第二正典', en: 'Deuterocanonical' },
}

export const BOOKS = [
  { id: '01', srcName: 'Genesis', zh: '创世记', en: 'Genesis', group: 'ot' },
  { id: '02', srcName: 'Exodus', zh: '出埃及记', en: 'Exodus', group: 'ot' },
  { id: '03', srcName: 'Leviticus', zh: '利未记', en: 'Leviticus', group: 'ot' },
  { id: '04', srcName: 'Numbers', zh: '民数记', en: 'Numbers', group: 'ot' },
  { id: '05', srcName: 'Deuteronomy', zh: '申命记', en: 'Deuteronomy', group: 'ot' },
  { id: '06', srcName: 'Joshua', zh: '约书亚记', en: 'Joshua', group: 'ot' },
  { id: '07', srcName: 'Judges', zh: '士师记', en: 'Judges', group: 'ot' },
  { id: '08', srcName: 'Ruth', zh: '路得记', en: 'Ruth', group: 'ot' },
  { id: '09', srcName: 'I Samuel', zh: '撒母耳记上', en: '1 Samuel', group: 'ot' },
  { id: '10', srcName: 'II Samuel', zh: '撒母耳记下', en: '2 Samuel', group: 'ot' },
  { id: '11', srcName: 'I Kings', zh: '列王纪上', en: '1 Kings', group: 'ot' },
  { id: '12', srcName: 'II Kings', zh: '列王纪下', en: '2 Kings', group: 'ot' },
  { id: '13', srcName: 'I Chronicles', zh: '历代志上', en: '1 Chronicles', group: 'ot' },
  { id: '14', srcName: 'II Chronicles', zh: '历代志下', en: '2 Chronicles', group: 'ot' },
  { id: '15', srcName: 'Ezra', zh: '以斯拉记', en: 'Ezra', group: 'ot' },
  { id: '16', srcName: 'Nehemiah', zh: '尼希米记', en: 'Nehemiah', group: 'ot' },
  { id: '17', srcName: 'Esther', zh: '以斯帖记', en: 'Esther', group: 'ot' },
  { id: '18', srcName: 'Job', zh: '约伯记', en: 'Job', group: 'ot' },
  { id: '19', srcName: 'Psalms', zh: '诗篇', en: 'Psalms', group: 'ot' },
  { id: '20', srcName: 'Proverbs', zh: '箴言', en: 'Proverbs', group: 'ot' },
  { id: '21', srcName: 'Ecclesiastes', zh: '传道书', en: 'Ecclesiastes', group: 'ot' },
  { id: '22', srcName: 'Song of Solomon', zh: '雅歌', en: 'Song of Solomon', group: 'ot' },
  { id: '23', srcName: 'Isaiah', zh: '以赛亚书', en: 'Isaiah', group: 'ot' },
  { id: '24', srcName: 'Jeremiah', zh: '耶利米书', en: 'Jeremiah', group: 'ot' },
  { id: '25', srcName: 'Lamentations', zh: '耶利米哀歌', en: 'Lamentations', group: 'ot' },
  { id: '26', srcName: 'Ezekiel', zh: '以西结书', en: 'Ezekiel', group: 'ot' },
  { id: '27', srcName: 'Daniel', zh: '但以理书', en: 'Daniel', group: 'ot' },
  { id: '28', srcName: 'Hosea', zh: '何西阿书', en: 'Hosea', group: 'ot' },
  { id: '29', srcName: 'Joel', zh: '约珥书', en: 'Joel', group: 'ot' },
  { id: '30', srcName: 'Amos', zh: '阿摩司书', en: 'Amos', group: 'ot' },
  { id: '31', srcName: 'Obadiah', zh: '俄巴底亚书', en: 'Obadiah', group: 'ot' },
  { id: '32', srcName: 'Jonah', zh: '约拿书', en: 'Jonah', group: 'ot' },
  { id: '33', srcName: 'Micah', zh: '弥迦书', en: 'Micah', group: 'ot' },
  { id: '34', srcName: 'Nahum', zh: '那鸿书', en: 'Nahum', group: 'ot' },
  { id: '35', srcName: 'Habakkuk', zh: '哈巴谷书', en: 'Habakkuk', group: 'ot' },
  { id: '36', srcName: 'Zephaniah', zh: '西番雅书', en: 'Zephaniah', group: 'ot' },
  { id: '37', srcName: 'Haggai', zh: '哈该书', en: 'Haggai', group: 'ot' },
  { id: '38', srcName: 'Zechariah', zh: '撒迦利亚书', en: 'Zechariah', group: 'ot' },
  { id: '39', srcName: 'Malachi', zh: '玛拉基书', en: 'Malachi', group: 'ot' },
  { id: '40', srcName: 'Matthew', zh: '马太福音', en: 'Matthew', group: 'nt' },
  { id: '41', srcName: 'Mark', zh: '马可福音', en: 'Mark', group: 'nt' },
  { id: '42', srcName: 'Luke', zh: '路加福音', en: 'Luke', group: 'nt' },
  { id: '43', srcName: 'John', zh: '约翰福音', en: 'John', group: 'nt' },
  { id: '44', srcName: 'Acts', zh: '使徒行传', en: 'Acts', group: 'nt' },
  { id: '45', srcName: 'Romans', zh: '罗马书', en: 'Romans', group: 'nt' },
  { id: '46', srcName: 'I Corinthians', zh: '哥林多前书', en: '1 Corinthians', group: 'nt' },
  { id: '47', srcName: 'II Corinthians', zh: '哥林多后书', en: '2 Corinthians', group: 'nt' },
  { id: '48', srcName: 'Galatians', zh: '加拉太书', en: 'Galatians', group: 'nt' },
  { id: '49', srcName: 'Ephesians', zh: '以弗所书', en: 'Ephesians', group: 'nt' },
  { id: '50', srcName: 'Philippians', zh: '腓立比书', en: 'Philippians', group: 'nt' },
  { id: '51', srcName: 'Colossians', zh: '歌罗西书', en: 'Colossians', group: 'nt' },
  { id: '52', srcName: 'I Thessalonians', zh: '帖撒罗尼迦前书', en: '1 Thessalonians', group: 'nt' },
  { id: '53', srcName: 'II Thessalonians', zh: '帖撒罗尼迦后书', en: '2 Thessalonians', group: 'nt' },
  { id: '54', srcName: 'I Timothy', zh: '提摩太前书', en: '1 Timothy', group: 'nt' },
  { id: '55', srcName: 'II Timothy', zh: '提摩太后书', en: '2 Timothy', group: 'nt' },
  { id: '56', srcName: 'Titus', zh: '提多书', en: 'Titus', group: 'nt' },
  { id: '57', srcName: 'Philemon', zh: '腓利门书', en: 'Philemon', group: 'nt' },
  { id: '58', srcName: 'Hebrews', zh: '希伯来书', en: 'Hebrews', group: 'nt' },
  { id: '59', srcName: 'James', zh: '雅各书', en: 'James', group: 'nt' },
  { id: '60', srcName: 'I Peter', zh: '彼得前书', en: '1 Peter', group: 'nt' },
  { id: '61', srcName: 'II Peter', zh: '彼得后书', en: '2 Peter', group: 'nt' },
  { id: '62', srcName: 'I John', zh: '约翰一书', en: '1 John', group: 'nt' },
  { id: '63', srcName: 'II John', zh: '约翰二书', en: '2 John', group: 'nt' },
  { id: '64', srcName: 'III John', zh: '约翰三书', en: '3 John', group: 'nt' },
  { id: '65', srcName: 'Jude', zh: '犹大书', en: 'Jude', group: 'nt' },
  { id: '66', srcName: 'Revelation of John', zh: '启示录', en: 'Revelation', group: 'nt' },
]

/**
 * 扩展卷（次经/第二正典）——只存在于部分译本（如思高本 ChiSB）
 * srcName 为素材库原名，zh 采用思高本通行译名
 */
export const EXTRA_BOOKS = [
  { srcName: 'Tobit', zh: '多俾亚传', en: 'Tobit', group: 'ext' },
  { srcName: 'Judith', zh: '友弟德传', en: 'Judith', group: 'ext' },
  { srcName: 'Wisdom', zh: '智慧篇', en: 'Wisdom', group: 'ext' },
  { srcName: 'Sirach', zh: '德训篇', en: 'Sirach', group: 'ext' },
  { srcName: 'Baruch', zh: '巴路克书', en: 'Baruch', group: 'ext' },
  { srcName: 'I Maccabees', zh: '玛加伯上', en: '1 Maccabees', group: 'ext' },
  { srcName: 'II Maccabees', zh: '玛加伯下', en: '2 Maccabees', group: 'ext' },
]

/** 按 srcName 建索引：标准卷 → id */
const bySrc = new Map(BOOKS.map((b) => [b.srcName, b]))
const extraBySrc = new Map(EXTRA_BOOKS.map((b) => [b.srcName, b]))

/**
 * 根据素材库原始书名解析标准书卷记录。
 * 返回 { id, zh, en, group }；扩展卷 id 为 ext-1..ext-N；未知卷返回 null。
 */
export function resolveBook(srcName) {
  const b = bySrc.get(srcName)
  if (b) return { id: b.id, zh: b.zh, en: b.en, group: b.group }
  const ex = extraBySrc.get(srcName)
  if (ex) {
    const idx = EXTRA_BOOKS.findIndex((e) => e.srcName === srcName) + 1
    return { id: `ext-${idx}`, zh: ex.zh, en: ex.en, group: ex.group }
  }
  return null
}

/** 标准正典卷数（用于校验） */
export const CANON_BOOK_COUNT = BOOKS.length
