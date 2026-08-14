/**
 * books-i18n.mjs — 译本书卷名表（章节目录随译本显示）
 *
 * build-data.mjs 生成 manifest 时，用本表覆盖 books 的 zh 显示名——
 * 使书卷目录列表（BookSidebar）、串珠跳转名等与当前选择的译本一致。
 * 未登记译本的卷名沿用 bible-books.mjs 的标准和合本译名。
 *
 * 表结构：{ <译本 key>: { <bookId>: '本地译名', ... } }（bookId：01-66 正典 + ext-1~7 次经）
 */
export const TRANSLATION_BOOK_NAMES = {
  // 思高本（ChiSB，天主教通行译名，繁体）
  chisb: {
    '01': '創世紀', '02': '出谷紀', '03': '肋未紀', '04': '戶籍紀', '05': '申命紀',
    '06': '若蘇厄書', '07': '民長紀', '08': '盧德傳', '09': '撒慕爾紀上', '10': '撒慕爾紀下',
    '11': '列王紀上', '12': '列王紀下', '13': '編年紀上', '14': '編年紀下', '15': '厄斯德拉上',
    '16': '厄斯德拉下', '17': '艾斯德爾傳', '18': '約伯傳', '19': '聖詠集', '20': '箴言',
    '21': '訓道篇', '22': '雅歌', '23': '依撒意亞', '24': '耶肋米亞', '25': '哀歌',
    '26': '厄則克耳', '27': '達尼爾', '28': '歐瑟亞', '29': '岳厄爾', '30': '亞毛斯',
    '31': '亞北底亞', '32': '約納', '33': '米該亞', '34': '納鴻', '35': '哈巴谷',
    '36': '索福尼亞', '37': '哈蓋', '38': '匝加利亞', '39': '瑪拉基亞', '40': '瑪竇福音',
    '41': '馬爾谷福音', '42': '路加福音', '43': '若望福音', '44': '宗徒大事錄', '45': '羅馬書',
    '46': '格林多前書', '47': '格林多後書', '48': '迦拉達書', '49': '厄弗所書', '50': '斐理伯書',
    '51': '哥羅森書', '52': '得撒洛尼前書', '53': '得撒洛尼後書', '54': '弟茂德前書', '55': '弟茂德後書',
    '56': '弟鐸書', '57': '費肋孟書', '58': '希伯來書', '59': '雅各伯書', '60': '伯多祿前書',
    '61': '伯多祿後書', '62': '若望一書', '63': '若望二書', '64': '若望三書', '65': '猶達書',
    '66': '默示錄',
    'ext-1': '多俾亞傳', 'ext-2': '友弟德傳', 'ext-3': '智慧篇', 'ext-4': '德訓篇',
    'ext-5': '巴路克書', 'ext-6': '瑪加伯上', 'ext-7': '瑪加伯下',
  },

  // KJV（英文名）
  kjv: {
    '01': 'Genesis', '02': 'Exodus', '03': 'Leviticus', '04': 'Numbers', '05': 'Deuteronomy',
    '06': 'Joshua', '07': 'Judges', '08': 'Ruth', '09': '1 Samuel', '10': '2 Samuel',
    '11': '1 Kings', '12': '2 Kings', '13': '1 Chronicles', '14': '2 Chronicles', '15': 'Ezra',
    '16': 'Nehemiah', '17': 'Esther', '18': 'Job', '19': 'Psalms', '20': 'Proverbs',
    '21': 'Ecclesiastes', '22': 'Song of Solomon', '23': 'Isaiah', '24': 'Jeremiah', '25': 'Lamentations',
    '26': 'Ezekiel', '27': 'Daniel', '28': 'Hosea', '29': 'Joel', '30': 'Amos',
    '31': 'Obadiah', '32': 'Jonah', '33': 'Micah', '34': 'Nahum', '35': 'Habakkuk',
    '36': 'Zephaniah', '37': 'Haggai', '38': 'Zechariah', '39': 'Malachi', '40': 'Matthew',
    '41': 'Mark', '42': 'Luke', '43': 'John', '44': 'Acts', '45': 'Romans',
    '46': '1 Corinthians', '47': '2 Corinthians', '48': 'Galatians', '49': 'Ephesians', '50': 'Philippians',
    '51': 'Colossians', '52': '1 Thessalonians', '53': '2 Thessalonians', '54': '1 Timothy', '55': '2 Timothy',
    '56': 'Titus', '57': 'Philemon', '58': 'Hebrews', '59': 'James', '60': '1 Peter',
    '61': '2 Peter', '62': '1 John', '63': '2 John', '64': '3 John', '65': 'Jude',
    '66': 'Revelation',
  },

  // 法语 Martin 1744 版（FreBDM1744，法文名）
  frebdm1744: {
    '01': 'Genèse', '02': 'Exode', '03': 'Lévitique', '04': 'Nombres', '05': 'Deutéronome',
    '06': 'Josué', '07': 'Juges', '08': 'Ruth', '09': '1 Samuel', '10': '2 Samuel',
    '11': '1 Rois', '12': '2 Rois', '13': '1 Chroniques', '14': '2 Chroniques', '15': 'Esdras',
    '16': 'Néhémie', '17': 'Esther', '18': 'Job', '19': 'Psaumes', '20': 'Proverbes',
    '21': 'Ecclésiaste', '22': 'Cantique des cantiques', '23': 'Ésaïe', '24': 'Jérémie', '25': 'Lamentations',
    '26': 'Ézéchiel', '27': 'Daniel', '28': 'Osée', '29': 'Joël', '30': 'Amos',
    '31': 'Abdias', '32': 'Jonas', '33': 'Michée', '34': 'Nahum', '35': 'Habaquq',
    '36': 'Sophonie', '37': 'Aggée', '38': 'Zacharie', '39': 'Malachie', '40': 'Matthieu',
    '41': 'Marc', '42': 'Luc', '43': 'Jean', '44': 'Actes', '45': 'Romains',
    '46': '1 Corinthiens', '47': '2 Corinthiens', '48': 'Galates', '49': 'Éphésiens', '50': 'Philippiens',
    '51': 'Colossiens', '52': '1 Thessaloniciens', '53': '2 Thessaloniciens', '54': '1 Timothée', '55': '2 Timothée',
    '56': 'Tite', '57': 'Philémon', '58': 'Hébreux', '59': 'Jacques', '60': '1 Pierre',
    '61': '2 Pierre', '62': '1 Jean', '63': '2 Jean', '64': '3 Jean', '65': 'Jude',
    '66': 'Apocalypse',
  },

  // 美国标准译本（ASV，英文名；66 卷正典，与 KJV 同名）
  asv: {
    '01': 'Genesis', '02': 'Exodus', '03': 'Leviticus', '04': 'Numbers', '05': 'Deuteronomy',
    '06': 'Joshua', '07': 'Judges', '08': 'Ruth', '09': '1 Samuel', '10': '2 Samuel',
    '11': '1 Kings', '12': '2 Kings', '13': '1 Chronicles', '14': '2 Chronicles', '15': 'Ezra',
    '16': 'Nehemiah', '17': 'Esther', '18': 'Job', '19': 'Psalms', '20': 'Proverbs',
    '21': 'Ecclesiastes', '22': 'Song of Solomon', '23': 'Isaiah', '24': 'Jeremiah', '25': 'Lamentations',
    '26': 'Ezekiel', '27': 'Daniel', '28': 'Hosea', '29': 'Joel', '30': 'Amos',
    '31': 'Obadiah', '32': 'Jonah', '33': 'Micah', '34': 'Nahum', '35': 'Habakkuk',
    '36': 'Zephaniah', '37': 'Haggai', '38': 'Zechariah', '39': 'Malachi', '40': 'Matthew',
    '41': 'Mark', '42': 'Luke', '43': 'John', '44': 'Acts', '45': 'Romans',
    '46': '1 Corinthians', '47': '2 Corinthians', '48': 'Galatians', '49': 'Ephesians', '50': 'Philippians',
    '51': 'Colossians', '52': '1 Thessalonians', '53': '2 Thessalonians', '54': '1 Timothy', '55': '2 Timothy',
    '56': 'Titus', '57': 'Philemon', '58': 'Hebrews', '59': 'James', '60': '1 Peter',
    '61': '2 Peter', '62': '1 John', '63': '2 John', '64': '3 John', '65': 'Jude',
    '66': 'Revelation',
  },

  // 杜埃-兰斯译本（DRC，英文名；66 卷正典 + 7 卷次经，与现代英文名一致，次经用 Douay 拼写）
  drc: {
    '01': 'Genesis', '02': 'Exodus', '03': 'Leviticus', '04': 'Numbers', '05': 'Deuteronomy',
    '06': 'Joshua', '07': 'Judges', '08': 'Ruth', '09': '1 Samuel', '10': '2 Samuel',
    '11': '1 Kings', '12': '2 Kings', '13': '1 Chronicles', '14': '2 Chronicles', '15': 'Ezra',
    '16': 'Nehemiah', '17': 'Esther', '18': 'Job', '19': 'Psalms', '20': 'Proverbs',
    '21': 'Ecclesiastes', '22': 'Song of Solomon', '23': 'Isaiah', '24': 'Jeremiah', '25': 'Lamentations',
    '26': 'Ezekiel', '27': 'Daniel', '28': 'Hosea', '29': 'Joel', '30': 'Amos',
    '31': 'Obadiah', '32': 'Jonah', '33': 'Micah', '34': 'Nahum', '35': 'Habakkuk',
    '36': 'Zephaniah', '37': 'Haggai', '38': 'Zechariah', '39': 'Malachi', '40': 'Matthew',
    '41': 'Mark', '42': 'Luke', '43': 'John', '44': 'Acts', '45': 'Romans',
    '46': '1 Corinthians', '47': '2 Corinthians', '48': 'Galatians', '49': 'Ephesians', '50': 'Philippians',
    '51': 'Colossians', '52': '1 Thessalonians', '53': '2 Thessalonians', '54': '1 Timothy', '55': '2 Timothy',
    '56': 'Titus', '57': 'Philemon', '58': 'Hebrews', '59': 'James', '60': '1 Peter',
    '61': '2 Peter', '62': '1 John', '63': '2 John', '64': '3 John', '65': 'Jude',
    '66': 'Revelation',
    'ext-1': 'Tobias', 'ext-2': 'Judith', 'ext-3': 'Wisdom', 'ext-4': 'Ecclesiasticus',
    'ext-5': 'Baruch', 'ext-6': '1 Machabees', 'ext-7': '2 Machabees',
  },
}
