import type { Lesson, PayneData, Scholarship, ProphecyType, TimelineEra } from "@/lib/types"

const reflectionTemplates: Record<Lesson["category"], string[]> = {
  Lineage: [
    "Lord Jesus, through {title} I see how Your coming was no accident — a covenant line stretching from {ot} to {nt}.",
    "Father, You kept every genealogical promise. Let {ot} fulfilled in {nt} assure me that Your word never fails.",
    "Jesus, Son of David, Son of Abraham — through {title}, deepen my trust in the faithfulness of God across generations.",
    "Lord, the line from {ot} to {nt} reminds me that You work through real families and real history. Ground my faith in Your covenant.",
    "God of the covenant, as I trace Your promises in {title}, fill me with confidence that You finish what You start."
  ],
  Identity: [
    "Lord Jesus, as I study {title}, anchor my identity in You, the promised King revealed from {ot} to {nt}.",
    "Jesus, teach me to trust who You are, not just what I feel. Let {ot} and {nt} deepen my confidence in Your name.",
    "Son of God, form my heart around Your truth. Through {title}, help me live as one who belongs to You.",
    "Christ our King, when my identity feels uncertain, remind me that Your promises in {ot} stand fulfilled in {nt}.",
    "Lord, as I reflect on {title}, make me steady in faith, humble in spirit, and rooted in Your unchanging identity."
  ],
  Ministry: [
    "Lord Jesus, shape my daily life after Your ministry. As {ot} meets {nt}, teach me to serve with compassion and truth.",
    "Jesus, send me with Your heart for people. Let {title} move me from admiration into obedience.",
    "Savior, open my eyes to the people around me. As You fulfilled {ot} in {nt}, make me faithful in small acts of love.",
    "Lord, give me courage to speak life, mercy, and hope. Through {title}, train my hands and words for Your mission.",
    "Jesus, keep me close to You in service. Let this lesson turn knowledge into prayerful action."
  ],
  Rejection: [
    "Lord Jesus, You were rejected and still loved to the end. Through {title}, teach me to remain faithful when misunderstood.",
    "Jesus, when I face disappointment or opposition, remind me that You walked this road first from {ot} to {nt}.",
    "Merciful Christ, guard my heart from bitterness. Let Your endurance in {title} produce gentleness in me.",
    "Lord, where others turned away from You, help me draw nearer. Make my loyalty deeper and my worship truer.",
    "Jesus, in seasons of rejection, keep my eyes on Your kingdom and my spirit steady in grace."
  ],
  Passion: [
    "Lord Jesus, Your suffering was not wasted. As I read {ot} and {nt}, make me reverent before the cost of my redemption.",
    "Crucified Savior, let {title} humble me. Teach me to hate sin, love holiness, and trust Your mercy fully.",
    "Jesus, thank You for bearing what I could never bear. Through this lesson, grow gratitude that changes how I live.",
    "Lamb of God, keep the cross central in my heart. Let {ot} fulfilled in {nt} shape my worship and repentance.",
    "Lord, as I meditate on Your Passion, make me patient in trials and faithful in love."
  ],
  Resurrection: [
    "Risen Jesus, fill me with resurrection hope. Through {title}, teach me to live in the light of Your victory.",
    "Lord of Life, where I feel weary, breathe new courage into me. Let {ot} and {nt} remind me death is not the end.",
    "Jesus, because You rose, my future is secure. Make this truth in {title} reshape my fears and my prayers.",
    "King eternal, help me walk in resurrection power today - with joy, endurance, and holy expectation.",
    "Risen Christ, turn this lesson into worship. Let hope rise in me as surely as You rose in glory."
  ],
  Kingdom: [
    "King Jesus, through {title} I see that Your reign has no end. Let {ot} and {nt} lift my eyes to Your eternal throne.",
    "Lord, the kingdom You promised in {ot} is breaking in through {nt}. Make me a faithful citizen of that kingdom today.",
    "Jesus, Ruler of all nations, through {title} expand my vision beyond this passing age to the world You are making new.",
    "Lord of the future, as I study {title}, anchor my hope not in circumstances but in Your coming reign.",
    "King eternal, let the promise in {ot} fulfilled in {nt} stir in me longing for Your return and the restoration of all things."
  ]
}

function buildReflection(
  id:number,
  category:Lesson["category"],
  title:string,
  otReference:string,
  ntReference:string
): string {
  const templates = reflectionTemplates[category]
  const template = templates[(id - 1) % templates.length]

  return template
    .replace("{title}", title)
    .replace("{ot}", otReference)
    .replace("{nt}", ntReference)
}

const otDistractors = [
  "Genesis 3:15", "Genesis 12:3", "Genesis 49:10", "Exodus 12:46",
  "Psalm 2:7", "Psalm 16:10", "Psalm 22:1", "Psalm 22:16",
  "Psalm 110:1", "Isaiah 7:14", "Isaiah 9:6", "Isaiah 11:1",
  "Isaiah 40:3", "Isaiah 53:3", "Isaiah 53:5", "Isaiah 53:7",
  "Jeremiah 31:15", "Daniel 7:13", "Micah 5:2", "Zechariah 9:9",
  "Zechariah 11:12", "Zechariah 12:10", "Malachi 3:1", "Hosea 11:1"
]

const ntDistractors = [
  "Matthew 1:23", "Matthew 2:6", "Matthew 4:16", "Matthew 21:5",
  "Mark 1:2", "Mark 15:34", "Luke 1:32", "Luke 2:7",
  "Luke 24:27", "John 1:14", "John 12:15", "John 19:36",
  "Acts 2:31", "Acts 3:22", "Romans 1:3", "Galatians 3:16",
  "Hebrews 7:14", "1 John 3:8", "Revelation 5:5", "1 Peter 2:24",
  "Philippians 2:8", "Colossians 1:15", "Hebrews 1:5", "Hebrews 9:28"
]

function pickDistractors(pool: string[], exclude: string, id: number): string[] {
  const filtered = pool.filter(
    (d) => d.toLowerCase() !== exclude.toLowerCase()
  )
  const picked: string[] = []
  let offset = (id * 7 + 3) % filtered.length
  while (picked.length < 3) {
    const candidate = filtered[offset % filtered.length]
    if (!picked.includes(candidate)) picked.push(candidate)
    offset++
  }
  return picked
}

function buildQuiz(id: number, otReference: string, ntReference: string) {
  const useOtForMC = id % 2 === 1

  if (useOtForMC) {
    const distractors = pickDistractors(otDistractors, otReference, id)
    const answerIndex = id % 4
    const choices = [...distractors]
    choices.splice(answerIndex, 0, otReference)
    return {
      question: "Which Old Testament reference connects to this lesson?",
      choices,
      answer: answerIndex,
      fillInBlank: {
        prompt: "Fill in the blank: The New Testament fulfillment for this lesson is ____.",
        answer: ntReference,
        acceptableAnswers: [ntReference.replace(/–/g, "-")]
      }
    }
  } else {
    const distractors = pickDistractors(ntDistractors, ntReference, id)
    const answerIndex = id % 4
    const choices = [...distractors]
    choices.splice(answerIndex, 0, ntReference)
    return {
      question: "Which New Testament passage fulfills this prophecy in this lesson?",
      choices,
      answer: answerIndex,
      fillInBlank: {
        prompt: "Fill in the blank: The Old Testament prophecy for this lesson is ____.",
        answer: otReference,
        acceptableAnswers: [otReference.replace(/–/g, "-")]
      }
    }
  }
}

const _prophecyTypeMap: Record<number, ProphecyType> = {
  1: 'Direct Prophecy', 2: 'Direct Prophecy', 3: 'Direct Prophecy',
  4: 'Direct Prophecy', 5: 'Typology', 6: 'Direct Prophecy',
  7: 'Direct Prophecy', 8: 'Direct Prophecy', 9: 'Direct Prophecy',
  10: 'Direct Prophecy', 11: 'Messianic Psalm', 12: 'Messianic Psalm',
  13: 'Messianic Psalm', 14: 'Direct Prophecy', 15: 'Direct Prophecy',
  16: 'Messianic Psalm', 17: 'Messianic Psalm', 18: 'Messianic Psalm',
  19: 'Messianic Psalm', 20: 'Direct Prophecy', 21: 'Direct Prophecy',
  22: 'Direct Prophecy', 23: 'Direct Prophecy', 24: 'Messianic Psalm',
  25: 'Messianic Psalm', 26: 'Messianic Psalm', 27: 'Direct Prophecy',
  28: 'Direct Prophecy', 29: 'Messianic Psalm', 30: 'Messianic Psalm',
  31: 'Messianic Psalm', 32: 'Direct Prophecy', 33: 'Direct Prophecy',
  34: 'Direct Prophecy', 35: 'Direct Prophecy', 36: 'Direct Prophecy',
  37: 'Direct Prophecy', 38: 'Direct Prophecy', 39: 'Direct Prophecy',
  40: 'Direct Prophecy', 41: 'Direct Prophecy', 42: 'Direct Prophecy',
  43: 'Direct Prophecy', 44: 'Direct Prophecy', 45: 'Direct Prophecy',
  46: 'Prophetic Pattern', 47: 'Direct Prophecy', 48: 'Direct Prophecy',
  49: 'Direct Prophecy', 50: 'Direct Prophecy', 51: 'Direct Prophecy',
  52: 'Direct Prophecy', 53: 'Direct Prophecy', 54: 'Direct Prophecy',
  55: 'Direct Prophecy', 56: 'Direct Prophecy', 57: 'Direct Prophecy',
  58: 'Direct Prophecy', 59: 'Typology', 60: 'Direct Prophecy',
  61: 'Prophetic Pattern', 62: 'Messianic Psalm', 63: 'Typology',
  64: 'Direct Prophecy', 65: 'Typology', 66: 'Typology',
  67: 'Direct Prophecy', 68: 'Messianic Psalm', 69: 'Applied Psalm',
  70: 'Messianic Psalm', 71: 'Messianic Psalm', 72: 'Messianic Psalm',
  73: 'Messianic Psalm', 74: 'Messianic Psalm', 75: 'Messianic Psalm',
  76: 'Messianic Psalm', 77: 'Applied Psalm', 78: 'Direct Prophecy',
  79: 'Direct Prophecy', 80: 'Direct Prophecy', 81: 'Direct Prophecy',
  82: 'Direct Prophecy', 83: 'Direct Prophecy', 84: 'Direct Prophecy',
  85: 'Direct Prophecy', 86: 'Prophetic Pattern', 87: 'Direct Prophecy',
  88: 'Prophetic Pattern', 89: 'Direct Prophecy', 90: 'Direct Prophecy',
  91: 'Typology', 92: 'Direct Prophecy', 93: 'Direct Prophecy',
  94: 'Direct Prophecy', 95: 'Direct Prophecy', 96: 'Direct Prophecy',
  97: 'Direct Prophecy', 98: 'Direct Prophecy', 99: 'Typology',
  100: 'Typology', 101: 'Prophetic Pattern',
  102: 'Typology', 103: 'Typology',
  104: 'Direct Prophecy', 105: 'Prophetic Pattern',
  106: 'Prophetic Pattern', 107: 'Prophetic Pattern',
  108: 'Messianic Psalm', 109: 'Prophetic Pattern',
  110: 'Prophetic Pattern', 111: 'Prophetic Pattern',
  112: 'Messianic Psalm', 113: 'Prophetic Pattern',
  114: 'Prophetic Pattern', 115: 'Prophetic Pattern',
  116: 'Prophetic Pattern', 117: 'Prophetic Pattern',
  118: 'Messianic Psalm', 119: 'Prophetic Pattern',
  120: 'Prophetic Pattern', 121: 'Prophetic Pattern',
  122: 'Prophetic Pattern', 123: 'Typology',
  124: 'Prophetic Pattern', 125: 'Direct Prophecy',
  126: 'Prophetic Pattern', 127: 'Prophetic Pattern',
  128: 'Prophetic Pattern', 129: 'Prophetic Pattern',
  130: 'Direct Prophecy', 131: 'Direct Prophecy',
  132: 'Direct Prophecy', 133: 'Prophetic Pattern',
  134: 'Prophetic Pattern', 135: 'Prophetic Pattern',
  136: 'Prophetic Pattern', 137: 'Prophetic Pattern',
  138: 'Prophetic Pattern', 139: 'Direct Prophecy',
  140: 'Direct Prophecy', 141: 'Prophetic Pattern',
  142: 'Direct Prophecy', 143: 'Direct Prophecy',
  144: 'Prophetic Pattern', 145: 'Prophetic Pattern',
  146: 'Prophetic Pattern', 147: 'Direct Prophecy',
  148: 'Typology', 149: 'Prophetic Pattern',
  150: 'Direct Prophecy', 151: 'Direct Prophecy',
  152: 'Prophetic Pattern', 153: 'Direct Prophecy',
  154: 'Direct Prophecy', 155: 'Typology',
  156: 'Direct Prophecy', 157: 'Prophetic Pattern',
  158: 'Direct Prophecy', 159: 'Prophetic Pattern',
  160: 'Direct Prophecy', 161: 'Direct Prophecy',
  162: 'Direct Prophecy', 163: 'Messianic Psalm',
  164: 'Messianic Psalm', 165: 'Messianic Psalm',
  166: 'Messianic Psalm', 167: 'Prophetic Pattern',
  168: 'Direct Prophecy', 169: 'Direct Prophecy',
  170: 'Typology', 171: 'Direct Prophecy',
  172: 'Direct Prophecy', 173: 'Prophetic Pattern',
  174: 'Direct Prophecy',
  175: 'Direct Prophecy', 176: 'Prophetic Pattern',
  177: 'Prophetic Pattern', 178: 'Messianic Psalm',
  179: 'Direct Prophecy', 180: 'Messianic Psalm',
  181: 'Messianic Psalm', 182: 'Messianic Psalm',
  183: 'Messianic Psalm', 184: 'Messianic Psalm',
  185: 'Direct Prophecy', 186: 'Messianic Psalm',
  187: 'Messianic Psalm', 188: 'Messianic Psalm',
  189: 'Direct Prophecy', 190: 'Direct Prophecy',
  191: 'Messianic Psalm', 192: 'Prophetic Pattern',
  193: 'Messianic Psalm', 194: 'Messianic Psalm',
  195: 'Direct Prophecy', 196: 'Direct Prophecy',
  197: 'Direct Prophecy', 198: 'Typology',
  199: 'Direct Prophecy', 200: 'Direct Prophecy',
};

const _eraOrder: Record<TimelineEra, number> = {
  'Beginnings': 1,
  'Patriarchs': 2,
  'Exodus and Wilderness': 3,
  'Conquest and Judges': 4,
  'Kingdom and David': 5,
  'Psalms and Worship': 6,
  'Divided Kingdom': 7,
  'Exile and Prophetic Hope': 8,
  'Return and Restoration': 9,
};

function deriveTimelineEra(otReference: string): TimelineEra {
  const lower = otReference.toLowerCase();
  if (lower.startsWith('genesis')) {
    const m = otReference.match(/Genesis\s+(\d+)/);
    const ch = m ? parseInt(m[1], 10) : 1;
    return ch <= 11 ? 'Beginnings' : 'Patriarchs';
  }
  if (lower.startsWith('exodus') || lower.startsWith('leviticus') || lower.startsWith('numbers') || lower.startsWith('deuteronomy')) return 'Exodus and Wilderness';
  if (lower.startsWith('joshua') || lower.startsWith('judges') || lower.startsWith('ruth')) return 'Conquest and Judges';
  if (lower.startsWith('1 samuel') || lower.startsWith('2 samuel')) return 'Kingdom and David';
  if (lower.startsWith('psalm')) return 'Psalms and Worship';
  if (lower.startsWith('isaiah') || lower.startsWith('hosea') || lower.startsWith('joel') || lower.startsWith('amos') || lower.startsWith('micah') || lower.startsWith('jonah')) return 'Divided Kingdom';
  if (lower.startsWith('jeremiah') || lower.startsWith('ezekiel') || lower.startsWith('daniel')) return 'Exile and Prophetic Hope';
  if (lower.startsWith('zechariah') || lower.startsWith('malachi')) return 'Return and Restoration';
  return 'Divided Kingdom';
}

function makeLesson(
  id:number,
  slug:string,
  title:string,
  category:Lesson["category"],
  otReference:string,
  ntReference:string,
  otText:string,
  ntText:string,
  whyItMatters:string,
  status?: 'active' | 'coming-soon',
  scholarship?: Scholarship
):Lesson{

const era = deriveTimelineEra(otReference);
return{
id,
slug,
title,
category,
otReference,
otText,
ntReference,
ntText,
summary: whyItMatters.split(/(?<=[.!?])\s+/)[0] ?? whyItMatters,
whyItMatters,
prophecyType: _prophecyTypeMap[id] ?? 'Direct Prophecy',
timelineEra: era,
timelineOrder: _eraOrder[era],
reflection:buildReflection(id, category, title, otReference, ntReference),
quiz: buildQuiz(id, otReference, ntReference),
...(status ? { status } : {}),
...(scholarship ? { scholarship } : {})
}

}

function edersheim(note: string): { edersheim: { attested: boolean; work: string; appendix: string; note: string } } {
  return {
    edersheim: {
      attested: true,
      work: "The Life and Times of Jesus the Messiah",
      appendix: "IX",
      note
    }
  };
}

function mcdowell(prophecyNumber: number, prophecyTitle: string, note: string): { mcdowell: { attested: boolean; work: string; prophecyNumber: number; prophecyTitle: string; note: string } } {
  return {
    mcdowell: {
      attested: true,
      work: "The New Evidence That Demands a Verdict",
      prophecyNumber,
      prophecyTitle,
      note
    }
  };
}

function payne(encyclopediaNumber: number, prophecyReference: string, note: string): { payne: PayneData } {
  return {
    payne: {
      attested: true,
      work: "Encyclopedia of Biblical Prophecy",
      encyclopediaNumber,
      prophecyReference,
      note
    }
  };
}

export const prophecies:Lesson[]=[
makeLesson(1,"seed-of-the-woman","Seed of the Woman","Lineage",
"Genesis 3:15","1 John 3:8",
"And I will put enmity between you and the woman, and between your offspring and hers; he will crush your head, and you will strike his heel.",
"The one who does what is sinful is of the devil, because the devil has been sinning from the beginning. The reason the Son of God appeared was to destroy the devil's work.",
"From the very first pages of Genesis, God promised that a descendant of the woman would one day crush the serpent's head. 1 John reveals that Jesus is that promised offspring—the Son of God who appeared to destroy the devil's work. The battle between good and evil was not an afterthought; it was addressed in God's very first promise of redemption."),

makeLesson(2,"blessing-through-abraham","Blessing Through Abraham","Lineage",
"Genesis 12:3","Galatians 3:16",
"I will bless those who bless you, and whoever curses you I will curse; and all peoples on earth will be blessed through you.",
"The promises were spoken to Abraham and to his seed. Scripture does not say \"and to seeds,\" meaning many people, but \"and to your seed,\" meaning one person, who is Christ.",
"God's promise to Abraham was never just about one nation—it was about all peoples on earth being blessed. Paul explains in Galatians that this singular 'seed' is Christ himself. Through Jesus, the ancient blessing given to Abraham reaches every tribe, tongue, and nation."),

makeLesson(3,"tribe-of-judah","From the Tribe of Judah","Lineage",
"Genesis 49:10","Hebrews 7:14",
"The scepter will not depart from Judah, nor the ruler's staff from between his feet, until he to whom it belongs shall come and the obedience of the nations shall be his.",
"For it is clear that our Lord descended from Judah, and in regard to that tribe Moses said nothing about priests.",
"Jacob's ancient blessing singled out Judah as the tribe from which the ultimate ruler would come. Hebrews confirms that Jesus descended from Judah—not from the priestly tribe of Levi—establishing that his authority comes not from the old priesthood but from a higher calling as both King and Priest."),

makeLesson(4,"prophet-like-moses","Prophet Like Moses","Ministry",
"Deuteronomy 18:15–18","Acts 3:22; John 6:14",
"The LORD your God will raise up for you a prophet like me from among you, from your fellow Israelites. You must listen to him. … I will raise up for them a prophet like you from among their fellow Israelites, and I will put my words in his mouth. He will tell them everything I command him.",
"For Moses said, 'The Lord your God will raise up for you a prophet like me from among your own people; you must listen to everything he tells you.' … After the people saw the sign Jesus performed, they began to say, 'Surely this is the Prophet who is to come into the world.'",
"Moses was the greatest prophet Israel had ever known—the one who spoke with God face to face. Yet Moses himself said another prophet would come, one in whom God would place His own words. Peter declared in Acts that Jesus is that prophet, the one all Israel was commanded to listen to. And when Jesus multiplied bread, the crowds recognized Him as the Prophet who was to come. Just as Moses delivered Israel from Egypt, Jesus delivers humanity from sin—the ultimate mediator between God and His people."),

makeLesson(5,"passover-lamb","The Passover Lamb","Passion",
"Exodus 12:46","John 19:36",
"It must be eaten inside the house; take none of the meat outside the house. Do not break any of the bones.",
"These things happened so that the scripture would be fulfilled: \"Not one of his bones will be broken.\"",
"The Passover lamb's bones were never to be broken—a detail that seemed minor until the crucifixion. When soldiers came to break the legs of those crucified, Jesus had already died, and not one of his bones was broken. John saw this as direct fulfillment: Jesus is the true Passover Lamb whose sacrifice delivers God's people from death."),

makeLesson(6,"son-of-david","Son of David","Lineage",
"2 Samuel 7:12","Luke 1:32",
"When your days are over and you rest with your ancestors, I will raise up your offspring to succeed you, your own flesh and blood, and I will establish his kingdom.",
"He will be great and will be called the Son of the Most High. The Lord God will give him the throne of his father David,",
"God made a covenant with David that his throne would be established forever. No earthly king could fulfill that promise—every dynasty eventually falls. The angel Gabriel announced to Mary that her son Jesus would receive David's throne, and his kingdom would have no end. Jesus is the eternal King that David's line always pointed toward."),

makeLesson(7,"virgin-birth","Born of a Virgin","Identity",
"Isaiah 7:14","Matthew 1:23",
"Therefore the Lord himself will give you a sign: The virgin will conceive and give birth to a son, and will call him Immanuel.",
"\"The virgin will conceive and give birth to a son, and they will call him Immanuel\" (which means \"God with us\").",
"Isaiah promised a miraculous sign: a virgin would conceive and bear a son called Immanuel—'God with us.' Matthew saw this fulfilled in the birth of Jesus to the virgin Mary. This was not merely a remarkable birth; it was God entering the human story in the most intimate way possible, literally dwelling among his people."),

makeLesson(8,"light-in-galilee","Light in Galilee","Ministry",
"Isaiah 9:1-2","Matthew 4:16",
"Nevertheless, there will be no more gloom for those who were in distress. In the past he humbled the land of Zebulun and the land of Naphtali, but in the future he will honor Galilee of the nations, by the Way of the Sea, beyond the Jordan—The people walking in darkness have seen a great light; on those living in the land of deep darkness a light has dawned.",
"the people living in darkness have seen a great light; on those living in the land of the shadow of death a light has dawned.",
"Galilee was a region looked down upon—remote, mixed with Gentile populations, and historically humbled by foreign invaders. Yet Isaiah said this despised region would be the first to see a great light. When Jesus began his public ministry in Galilee, Matthew recognized the fulfillment: hope dawned first in the place least expected."),

makeLesson(9,"messenger-before-messiah","Messenger Before Messiah","Ministry",
"Malachi 3:1","Mark 1:2",
"\"I will send my messenger, who will prepare the way before me. Then suddenly the Lord you are seeking will come to his temple; the messenger of the covenant, whom you desire, will come,\" says the LORD Almighty.",
"as it is written in Isaiah the prophet: \"I will send my messenger ahead of you, who will prepare your way\"—",
"Malachi prophesied that a messenger would come to prepare the way for the Lord. Mark opens his Gospel by identifying John the Baptist as that messenger. Just as a herald goes before a king, John called Israel to repentance so that hearts would be ready to receive the Messiah when he arrived."),

makeLesson(10,"born-in-bethlehem","Born in Bethlehem","Lineage",
"Micah 5:2","Matthew 2:1",
"But you, Bethlehem Ephrathah, though you are small among the clans of Judah, out of you will come for me one who will be ruler over Israel, whose origins are from of old, from ancient times.",
"After Jesus was born in Bethlehem in Judea, during the time of King Herod, Magi from the east came to Jerusalem",
"Micah named the tiny village of Bethlehem as the birthplace of Israel's future ruler—one whose origins reach back to eternity. Matthew records that Jesus was indeed born in Bethlehem, in fulfillment of this prophecy. The eternal God chose the humblest of towns to enter the world, showing that his kingdom is built not on earthly grandeur but on divine purpose."),

makeLesson(11,"king-priest","King Priest","Identity",
"Psalm 110:4","Hebrews 5:6",
"The LORD has sworn and will not change his mind: \"You are a priest forever, in the order of Melchizedek.\"",
"And he says in another place, \"You are a priest forever, in the order of Melchizedek.\"",
"The Psalms declared a priest unlike any from Aaron's line—one who would serve forever in the order of Melchizedek. Hebrews identifies Jesus as this eternal priest. Unlike the Levitical priests who served temporarily and died, Jesus holds his priesthood permanently, always interceding for his people before God."),

makeLesson(12,"son-of-god","Declared Son of God","Identity",
"Psalm 2:7","Matthew 3:17",
"I will proclaim the LORD's decree: He said to me, \"You are my son; today I have become your father.\"",
"And a voice from heaven said, \"This is my Son, whom I love; with him I am well pleased.\"",
"In Psalm 2, God declares 'You are my son' to his anointed king. At Jesus' baptism, the Father's voice from heaven echoed those very words. This was not merely a title of honor but a declaration of divine identity—the eternal Son stepping into his public mission, affirmed by the Father himself."),

makeLesson(13,"betrayed-by-friend","Betrayed by Friend","Rejection",
"Psalm 41:9","John 13:18",
"Even my close friend, someone I trusted, one who shared my bread, has turned against me.",
"\"I am not referring to all of you; I know those I have chosen. But this is to fulfill this passage of Scripture: 'He who shared my bread has turned against me.'\"",
"David wrote of a trusted friend who shared his bread turning against him. Jesus quoted this psalm at the Last Supper, knowing Judas would betray him. The pain of betrayal by someone close was not a surprise to God—it was written into the story centuries before, showing that even humanity's worst treachery was part of God's redemptive plan."),

makeLesson(14,"thirty-pieces","Thirty Pieces of Silver","Rejection",
"Zechariah 11:12","Matthew 26:15",
"I told them, \"If you think it best, give me my pay; but if not, keep it.\" So they paid me thirty pieces of silver.",
"and asked, \"What are you willing to give me if I deliver him over to you?\" So they counted out for him thirty pieces of silver.",
"Zechariah named the exact price at which the good shepherd would be valued: thirty pieces of silver, the price of a slave. Centuries later, Judas received precisely that amount to betray Jesus. The specificity of this detail—down to the exact sum—reveals how thoroughly God foresaw and wove every detail of the Messiah's story."),

makeLesson(15,"money-thrown-temple","Money Thrown in Temple","Rejection",
"Zechariah 11:13","Matthew 27:5",
"And the LORD said to me, \"Throw it to the potter\"—the handsome price at which they valued me! So I took the thirty pieces of silver and threw them to the potter at the house of the LORD.",
"So Judas threw the money into the temple and left. Then he went away and hanged himself.",
"Not only was the betrayal price foretold, but Zechariah also described what would happen to the money: it would be thrown to the potter at the house of the Lord. Matthew records that Judas, overcome with remorse, flung the silver coins into the temple. The chief priests then used the money to buy a potter's field—fulfilling every detail of the ancient prophecy."),

makeLesson(16,"hands-feet-pierced","Hands and Feet Pierced","Passion",
"Psalm 22:16","John 20:25",
"Dogs surround me, a pack of villains encircles me; they pierce my hands and my feet.",
"So the other disciples told him, \"We have seen the Lord!\" But he said to them, \"Unless I see the nail marks in his hands and put my finger where the nails were, and put my hand into his side, I will not believe.\"",
"A thousand years before crucifixion was even practiced, the psalmist described having his hands and feet pierced. When Thomas demanded to see the nail marks in Jesus' hands, he was unknowingly confirming the fulfillment of this ancient psalm. The wounds of the cross, far from disproving Jesus' identity, became the very proof that he is the promised Messiah."),

makeLesson(17,"soldiers-cast-lots","Garments Cast Lots","Passion",
"Psalm 22:18","John 19:24",
"They divide my clothes among them and cast lots for my garment.",
"\"Let's not tear it,\" they said to one another. \"Let's decide by lot who will get it.\" This happened that the scripture might be fulfilled that said, \"They divided my clothes among them and cast lots for my garment.\" So this is what the soldiers did.",
"David described enemies dividing his clothing and gambling for his garment. At the cross, Roman soldiers did exactly that—splitting Jesus' outer garments among themselves and casting lots for his seamless undergarment. John saw this happen and recognized it as Scripture fulfilled, a small, precise detail that no human conspiracy could have staged."),

makeLesson(18,"mocked-on-cross","Mocked While Suffering","Passion",
"Psalm 22:7","Matthew 27:39",
"All who see me mock me; they hurl insults, shaking their heads.",
"Those who passed by hurled insults at him, shaking their heads",
"The psalmist described being mocked by onlookers who hurl insults and shake their heads. Matthew records this exact scene at Calvary, where passersby taunted Jesus with the very gestures David described. What the world saw as humiliation, Scripture reveals as prophetic fulfillment—every sneer was foreseen, and Jesus endured it willingly."),

makeLesson(19,"given-vinegar","Given Vinegar","Passion",
"Psalm 69:21","Matthew 27:34",
"They put gall in my food and gave me vinegar for my thirst.",
"There they offered Jesus wine to drink, mixed with gall; but after tasting it, he refused to drink it.",
"The psalmist cried out about being given gall for food and vinegar for thirst—a picture of cruelty added to suffering. At the cross, soldiers offered Jesus wine mixed with gall, a bitter, numbing drink. Even this seemingly minor act of mockery was foretold centuries earlier, underscoring how completely the details of the crucifixion had been written in advance."),

makeLesson(20,"pierced-side","Pierced Side","Passion",
"Zechariah 12:10","John 19:34",
"And I will pour out on the house of David and the inhabitants of Jerusalem a spirit of grace and supplication. They will look on me, the one they have pierced, and they will mourn for him as one mourns for an only child, and grieve bitterly for him as one grieves for a firstborn son.",
"Instead, one of the soldiers pierced Jesus' side with a spear, bringing a sudden flow of blood and water.",
"Zechariah described the people of Jerusalem looking upon the one they had pierced, mourning as for an only son. At the cross, a Roman soldier pierced Jesus' side with a spear. What Zechariah foresaw as a moment of future mourning and repentance began at Calvary—a pierced Messiah whose wounds would become the source of grace for all who look to him in faith."),

makeLesson(21,"silent-before-accusers","Silent Before Accusers","Passion",
"Isaiah 53:7","Matthew 27:12",
"He was oppressed and afflicted, yet he did not open his mouth; he was led like a lamb to the slaughter, and as a sheep before its shearers is silent, so he did not open his mouth.",
"When he was accused by the chief priests and the elders, he gave no answer.",
"Isaiah pictured the Suffering Servant as silent before his accusers—like a lamb led to slaughter, he would not open his mouth. At his trial, Jesus astonished Pilate by refusing to defend himself. His silence was not weakness but strength under control, fulfilling the prophet's vision of a Servant who willingly submitted to injustice to accomplish God's plan."),

makeLesson(22,"suffering-servant","Suffering Servant","Passion",
"Isaiah 53:5","1 Peter 2:24",
"But he was pierced for our transgressions, he was crushed for our iniquities; the punishment that brought us peace was on him, and by his wounds we are healed.",
"\"He himself bore our sins\" in his body on the cross, so that we might die to sins and live for righteousness; \"by his wounds you have been healed.\"",
"Isaiah 53 is one of the most striking prophecies of the Messiah's suffering: pierced for our transgressions, crushed for our sins, healed by his wounds. Peter quotes these very words and applies them directly to Christ's death on the cross. The Servant's suffering was not meaningless—it was substitutionary, bearing the penalty that belonged to us so that we could be made whole."),

makeLesson(23,"buried-with-rich","Buried with Rich","Passion",
"Isaiah 53:9","Matthew 27:57",
"He was assigned a grave with the wicked, and with the rich in his death, though he had done no violence, nor was any deceit in his mouth.",
"As evening approached, there came a rich man from Arimathea, named Joseph, who had himself become a disciple of Jesus.",
"Isaiah said the Servant would be assigned a grave with the wicked yet buried with the rich. Jesus was crucified between criminals but laid in the tomb of Joseph of Arimathea, a wealthy man. This unlikely combination—condemned as a criminal, yet honored in burial—fulfilled both halves of Isaiah's prophecy in a single afternoon."),

makeLesson(24,"resurrection-psalm","Resurrection Foretold","Resurrection",
"Psalm 16:10","Acts 2:31",
"because you will not abandon me to the realm of the dead, nor will you let your faithful one see decay.",
"Seeing what was to come, he spoke of the resurrection of the Messiah, that he was not abandoned to the realm of the dead, nor did his body see decay.",
"David expressed confidence that God would not let his 'faithful one' see decay. Since David himself died and was buried, Peter argued at Pentecost that David was speaking prophetically about the Messiah. Jesus' resurrection proved that death could not hold him—God's Holy One would never see corruption in the grave."),

makeLesson(25,"ascension","Ascension","Resurrection",
"Psalm 68:18","Ephesians 4:8",
"When you ascended on high, you took many captives; you received gifts from people, even from the rebellious—that you, LORD God, might dwell there.",
"This is why it says: \"When he ascended on high, he took many captives and gave gifts to his people.\"",
"The psalm celebrated God ascending victoriously, receiving gifts from the conquered. Paul applied this to Christ's ascension after the resurrection, reframing the image: Jesus ascended to heaven and poured out spiritual gifts on his church. His victory over sin and death was not just for himself but resulted in gifts—apostles, prophets, teachers—given to build up his people."),

makeLesson(26,"right-hand-of-god","Seated at God's Right Hand","Resurrection",
"Psalm 110:1","Acts 2:34-35",
"The LORD says to my lord: \"Sit at my right hand until I make your enemies a footstool for your feet.\"",
"For David did not ascend to heaven, and yet he said, \"The Lord said to my Lord: 'Sit at my right hand until I make your enemies a footstool for your feet.'\"",
"In Psalm 110, David called someone 'my Lord' and described God inviting that person to sit at his right hand. Peter pointed out that David never ascended to heaven himself—so he must have been speaking of a greater Lord to come. Jesus' ascension and exaltation to God's right hand fulfilled David's prophecy, confirming his authority over all creation."),

makeLesson(27,"light-to-nations","Light to the Nations","Ministry",
"Isaiah 42:6","Luke 2:32",
"I, the LORD, have called you in righteousness; I will take hold of your hand. I will keep you and will make you to be a covenant for the people and a light for the Gentiles,",
"a light for revelation to the Gentiles, and the glory of your people Israel.",
"Isaiah described God's Servant as a covenant for the people and a light for the Gentiles. When Simeon held the infant Jesus in the temple, he recognized him as this promised light—a revelation not just for Israel but for all nations. God's salvation was never meant for one people alone; from the beginning, the Messiah was destined to illuminate the whole world."),

makeLesson(28,"healing-ministry","Healing Ministry","Ministry",
"Isaiah 35:5-6","Matthew 11:5",
"Then will the eyes of the blind be opened and the ears of the deaf unstopped. Then will the lame leap like a deer, and the mute tongue shout for joy.",
"The blind receive sight, the lame walk, those who have leprosy are cleansed, the deaf hear, the dead are raised, and the good news is proclaimed to the poor.",
"Isaiah described a future age when the blind would see, the deaf would hear, and the lame would leap for joy. When John the Baptist sent messengers to ask if Jesus was truly the Messiah, Jesus pointed to his miracles—the very signs Isaiah had foretold. His healings were not just acts of compassion; they were credentials proving he was the promised one."),

makeLesson(29,"teach-in-parables","Teaching in Parables","Ministry",
"Psalm 78:2","Matthew 13:34",
"I will open my mouth with a parable; I will utter hidden things, things from of old—",
"Jesus spoke all these things to the crowd in parables; he did not say anything to them without using a parable.",
"The psalmist declared he would speak in parables, revealing hidden truths from ancient times. Matthew noted that Jesus taught the crowds entirely in parables, fulfilling this pattern. Jesus' storytelling was not a casual teaching style—it was a prophetic method, concealing deep truths in simple stories so that those with ears to hear could discover the mysteries of God's kingdom."),

makeLesson(30,"zeal-for-temple","Zeal for God's House","Ministry",
"Psalm 69:9","John 2:17",
"for zeal for your house consumes me, and the insults of those who insult you fall on me.",
"His disciples remembered that it is written: \"Zeal for your house will consume me.\"",
"The psalmist wrote of being consumed by zeal for God's house. When Jesus drove the merchants out of the temple with a whip, overturning tables and scattering coins, his disciples recalled this psalm. Jesus' anger was not reckless—it was righteous passion for his Father's house, which had been turned from a place of prayer into a marketplace."),

makeLesson(31,"rejected-stone","Rejected Stone","Rejection",
"Psalm 118:22","Acts 4:11",
"The stone the builders rejected has become the cornerstone;",
"Jesus is \"the stone you builders rejected, which has become the cornerstone.\"",
"The psalmist described a stone that builders threw aside as useless, only for it to become the most important stone in the entire structure. Peter boldly told the religious leaders that Jesus was that rejected stone. The very one the authorities discarded became the cornerstone of God's new building—the church. Rejection by human leaders was part of God's design all along."),

makeLesson(32,"humble-king","Humble King","Identity",
"Zechariah 9:9","Matthew 21:5",
"Rejoice greatly, Daughter Zion! Shout, Daughter Jerusalem! See, your king comes to you, righteous and victorious, lowly and riding on a donkey, on a colt, the foal of a donkey.",
"\"Say to Daughter Zion, 'See, your king comes to you, gentle and riding on a donkey, and on a colt, the foal of a donkey.'\"",
"Zechariah described a king who would arrive not on a warhorse but humbly, riding a donkey. On Palm Sunday, Jesus entered Jerusalem on a young donkey, with crowds waving branches and shouting 'Hosanna.' Matthew recognized this as fulfillment of Zechariah's vision: the Messiah's kingdom is built on humility and peace, not military power."),

makeLesson(33,"shepherd-struck","Shepherd Struck","Passion",
"Zechariah 13:7","Matthew 26:31",
"\"Awake, sword, against my shepherd, against the man who is close to me!\" declares the LORD Almighty. \"Strike the shepherd, and the sheep will be scattered, and I will turn my hand against the little ones.\"",
"Then Jesus told them, \"This very night you will all fall away on account of me, for it is written: 'I will strike the shepherd, and the sheep of the flock will be scattered.'\"",
"Zechariah prophesied that when the shepherd was struck, the sheep would scatter. Jesus quoted this very passage on the night of his arrest, warning the disciples they would all flee. And they did—every one of them. Yet this scattering was not the end of the story; the risen Shepherd would gather his flock again."),

makeLesson(34,"righteous-branch","Righteous Branch","Identity",
"Jeremiah 23:5","Luke 1:32",
"\"The days are coming,\" declares the LORD, \"when I will raise up for David a righteous Branch, a King who will reign wisely and do what is just and right in the land.\"",
"He will be great and will be called the Son of the Most High. The Lord God will give him the throne of his father David,",
"Jeremiah foretold that God would raise up a righteous Branch from David's line—a king who would reign wisely with justice and righteousness. The angel Gabriel announced to Mary that her son would receive David's throne and be called the Son of the Most High. In Jesus, the long-awaited heir of David's dynasty arrived—not to sit on an earthly throne, but to reign eternally."),

makeLesson(35,"everlasting-kingdom","Everlasting Kingdom","Kingdom",
"Daniel 7:14","Luke 1:33",
"He was given authority, glory and sovereign power; all nations and peoples of every language worshiped him. His dominion is an everlasting dominion that will not pass away, and his kingdom is one that will never be destroyed.",
"and he will reign over Jacob's descendants forever; his kingdom will never end.",
"Daniel saw a vision of one given everlasting dominion over all nations—a kingdom that would never be destroyed. Gabriel told Mary that her son's kingdom would never end. Every human empire rises and falls, but the kingdom Jesus inaugurated endures forever because its king is eternal. This is the hope at the heart of the gospel: a reign of justice and peace without end."),

makeLesson(36,"anointed-one","The Anointed One","Identity",
"Daniel 9:25","John 1:41",
"Know and understand this: From the time the word goes out to restore and rebuild Jerusalem until the Anointed One, the ruler, comes, there will be seven 'sevens,' and sixty-two 'sevens.'",
"The first thing Andrew did was to find his brother Simon and tell him, \"We have found the Messiah\" (that is, the Christ).",
"Daniel received one of the most precise prophecies in Scripture: a timeline pointing to the arrival of the Anointed One. When Andrew found his brother Simon Peter, his words carried centuries of anticipation: 'We have found the Messiah.' The long-awaited Anointed One of Daniel's vision had come, and people recognized it."),

makeLesson(37,"cut-off-messiah","Messiah Cut Off","Passion",
"Daniel 9:26","Mark 15:37",
"After the sixty-two 'sevens,' the Anointed One will be put to death and will have nothing.",
"With a loud cry, Jesus breathed his last.",
"Daniel foretold that the Anointed One would be 'cut off' and have nothing—a shocking statement about the promised Messiah. Mark records the stark fulfillment: with a loud cry, Jesus breathed his last on the cross. The Messiah did not come to seize power but to be cut off for the sake of his people. His death was not a defeat but the culmination of Daniel's prophecy."),

makeLesson(38,"good-shepherd","The Good Shepherd","Ministry",
"Ezekiel 34:23","John 10:11",
"I will place over them one shepherd, my servant David, and he will tend them; he will tend them and be their shepherd.",
"\"I am the good shepherd. The good shepherd lays down his life for the sheep.\"",
"Ezekiel promised that God would place one shepherd—his servant David—over his people. Jesus declared himself the Good Shepherd who lays down his life for the sheep. Unlike hired hands who flee when danger comes, Jesus willingly gave his life. He is the shepherd Ezekiel foresaw, uniting and caring for God's flock with sacrificial love."),

makeLesson(39,"despised-rejected","Despised and Rejected","Rejection",
"Isaiah 53:3","John 1:11",
"He was despised and rejected by mankind, a man of suffering, and familiar with pain. Like one from whom people hide their faces he was despised, and we held him in low esteem.",
"He came to that which was his own, but his own did not receive him.",
"Isaiah described the Suffering Servant as despised and rejected—a man of sorrows familiar with pain, from whom people turned their faces. John's Gospel echoes this tragedy: Jesus came to his own people, and his own did not receive him. The Creator entered his creation and was turned away. Yet this rejection opened the door for all who would receive him to become children of God."),

makeLesson(40,"crucified-with-sinners","Crucified with Sinners","Passion",
"Isaiah 53:12","Mark 15:27",
"Therefore I will give him a portion among the great, and he will divide the spoils with the strong, because he poured out his life unto death, and was numbered with the transgressors. For he bore the sin of many, and made intercession for the transgressors.",
"They crucified two rebels with him, one on his right and one on his left.",
"Isaiah prophesied that the Servant would be numbered with the transgressors—counted among criminals. At the crucifixion, Jesus was placed between two rebels, literally numbered among lawbreakers. He who had no sin was treated as if he were the worst of sinners, fulfilling Isaiah's words and taking on the full weight of human guilt."),

makeLesson(41,"intercedes-for-transgressors","Intercedes for Sinners","Resurrection",
"Isaiah 53:12","Romans 8:34",
"Therefore I will give him a portion among the great, and he will divide the spoils with the strong, because he poured out his life unto death, and was numbered with the transgressors. For he bore the sin of many, and made intercession for the transgressors.",
"Who then is the one who condemns? No one. Christ Jesus who died—more than that, who was raised to life—is at the right hand of God and is also interceding for us.",
"Isaiah said the Servant would make intercession for the transgressors. Paul declares in Romans that Christ—having died, risen, and ascended—now sits at God's right hand interceding for us. Jesus' work did not end at the cross or even at the resurrection. Right now he is actively praying for his people, turning Isaiah's ancient promise into a present, living reality."),

makeLesson(42,"resurrection-victory","Victory Over Death","Kingdom",
"Isaiah 25:8","1 Corinthians 15:54",
"he will swallow up death forever. The Sovereign LORD will wipe away the tears from all faces; he will remove his people's disgrace from all the earth. The LORD has spoken.",
"When the perishable has been clothed with the imperishable, and the mortal with immortality, then the saying that is written will come true: \"Death has been swallowed up in victory.\"",
"Isaiah dared to envision a day when God would swallow up death forever. Paul triumphantly declares that this prophecy will be fulfilled when believers receive their resurrection bodies. Death—humanity's oldest enemy—does not get the final word. Through Jesus' resurrection, the ancient promise is set in motion: death itself will be consumed by life."),

makeLesson(43,"king-of-kings","King of Kings","Kingdom",
"Daniel 7:27","Revelation 19:16",
"Then the sovereignty, power and greatness of all the kingdoms under heaven will be handed over to the holy people of the Most High. His kingdom will be an everlasting kingdom, and all rulers will worship and obey him.",
"On his robe and on his thigh he has this name written: KING OF KINGS AND LORD OF LORDS.",
"Daniel saw a vision of God's kingdom receiving absolute sovereignty over all earthly powers. Revelation pulls back the curtain on the future and reveals Jesus bearing the title KING OF KINGS AND LORD OF LORDS. Every kingdom, government, and authority will ultimately bow to the one Daniel foresaw. His reign is not a hope deferred—it is an unshakable certainty."),

makeLesson(44,"cornerstone","Cornerstone","Identity",
"Isaiah 28:16","1 Peter 2:6",
"So this is what the Sovereign LORD says: \"See, I lay a stone in Zion, a tested stone, a precious cornerstone for a sure foundation; the one who relies on it will never be stricken with panic.\"",
"For in Scripture it says: \"See, I lay a stone in Zion, a chosen and precious cornerstone, and the one who trusts in him will never be put to shame.\"",
"Isaiah described God laying a tested cornerstone in Zion—a sure foundation that would never fail. Peter identifies Jesus as that cornerstone, chosen and precious. In a world of shifting ground, Jesus is the one foundation that holds. Everyone who trusts in him will never be put to shame, no matter what storms come."),

makeLesson(45,"shepherd-king","Shepherd King","Identity",
"Micah 5:4","John 10:11",
"He will stand and shepherd his flock in the strength of the LORD, in the majesty of the name of the LORD his God. And they will live securely, for then his greatness will reach to the ends of the earth.",
"\"I am the good shepherd. The good shepherd lays down his life for the sheep.\"",
"Micah described a ruler from Bethlehem who would shepherd his people in divine strength, bringing security to the ends of the earth. Jesus claimed this identity, declaring himself the Good Shepherd who gives his life for his sheep. His leadership is not domination but sacrificial care—the kind of shepherd-king Micah promised."),

makeLesson(46,"everlasting-light","Everlasting Light","Kingdom",
"Isaiah 60:19","Revelation 21:23",
"The sun will no more be your light by day, nor will the brightness of the moon shine on you, for the LORD will be your everlasting light, and your God will be your glory.",
"The city does not need the sun or the moon to shine on it, for the glory of God gives it light, and the Lamb is its lamp.",
"Isaiah envisioned a future when God himself would be his people's everlasting light, replacing the sun and moon. Revelation fulfills this with breathtaking imagery: the heavenly city needs no sun because the glory of God illuminates it, and the Lamb is its lamp. The eternal future is not lit by created lights but by the radiant presence of Christ himself."),

makeLesson(47,"righteous-servant","Righteous Servant","Passion",
"Isaiah 53:11","Romans 5:19",
"After he has suffered, he will see the light of life and be satisfied; by his knowledge my righteous servant will justify many, and he will bear their iniquities.",
"For just as through the disobedience of the one man the many were made sinners, so also through the obedience of the one man the many will be made righteous.",
"Isaiah said the Righteous Servant would justify many by bearing their iniquities. Paul draws a direct parallel: just as Adam's disobedience made many sinners, Christ's obedience makes many righteous. One man's failure brought ruin; one man's faithfulness brought restoration. Jesus is the obedient Servant whose righteousness counts for all who trust in him."),

makeLesson(48,"deliverer-from-zion","Deliverer from Zion","Kingdom",
"Isaiah 59:20","Romans 11:26",
"\"The Redeemer will come to Zion, to those in Jacob who repent of their sins,\" declares the LORD.",
"and in this way all Israel will be saved. As it is written: \"The deliverer will come from Zion; he will turn godlessness away from Jacob.\"",
"Isaiah promised a Redeemer coming to Zion for those who repent. Paul quoted this in Romans to affirm that God has not abandoned his ancient people—a deliverer has come from Zion. Jesus' redemptive work reaches beyond any single generation or group; his saving mission extends to all who turn to him."),

makeLesson(49,"child-born","Child is Born","Identity",
"Isaiah 9:6","Luke 2:11",
"For to us a child is born, to us a son is given, and the government will be on his shoulders. And he will be called Wonderful Counselor, Mighty God, Everlasting Father, Prince of Peace.",
"Today in the town of David a Savior has been born to you; he is the Messiah, the Lord.",
"Isaiah's grand prophecy of a child born and a son given finds its simplest and most powerful echo in the angel's announcement to the shepherds: a Savior has been born in David's town. The weight of Isaiah's titles—Wonderful Counselor, Mighty God—rested on the shoulders of an infant in a manger. God's greatest gift arrived in the humblest of circumstances."),

makeLesson(50,"throne-established","Throne Established Forever","Kingdom",
"Isaiah 9:7","Luke 1:33",
"Of the greatness of his government and peace there will be no end. He will reign on David's throne and over his kingdom, establishing and upholding it with justice and righteousness from that time on and forever. The zeal of the LORD Almighty will accomplish this.",
"and he will reign over Jacob's descendants forever; his kingdom will never end.",
"Isaiah said that the Messiah's government and peace would increase without end, upheld by God's own zeal. Gabriel confirmed to Mary that her son would reign over Jacob's descendants forever. This is not a kingdom sustained by human effort but by the zealous commitment of God Almighty—a throne established by divine power and maintained for eternity."),

makeLesson(51,"servant-brings-justice","Servant Brings Justice","Ministry",
"Isaiah 42:1","Matthew 12:18",
"Here is my servant, whom I uphold, my chosen one in whom I delight; I will put my Spirit on him, and he will bring justice to the nations.",
"\"Here is my servant whom I have chosen, the one I love, in whom I delight; I will put my Spirit on him, and he will proclaim justice to the nations.\"",
"Isaiah introduced God's chosen Servant, anointed with the Spirit to bring justice to the nations. Matthew recognized this in Jesus—a man empowered by the Spirit at his baptism, who proclaimed God's justice not through military might but through healing, teaching, and sacrificial love. True justice comes not by force but through the Spirit-filled life of the Servant."),

makeLesson(52,"gentle-servant","Gentle Servant","Ministry",
"Isaiah 42:2","Matthew 12:19",
"He will not shout or cry out, or raise his voice in the streets.",
"\"He will not quarrel or cry out; no one will hear his voice in the streets.\"",
"Isaiah described God's Servant as one who would not shout, quarrel, or raise his voice in the streets. Matthew saw this fulfilled in Jesus' ministry—he did not seek public spectacle or political rallies. His gentleness was not weakness but the quiet strength of one who knew his mission. The Messiah's power was displayed not in loud demands but in compassionate service."),

makeLesson(53,"open-blind-eyes","Open Blind Eyes","Ministry",
"Isaiah 42:7","John 9:25",
"to open eyes that are blind, to free captives from prison and to release from the dungeon those who sit in darkness.",
"He replied, \"Whether he is a sinner or not, I don't know. One thing I do know. I was blind but now I see!\"",
"Isaiah prophesied that God's Servant would open the eyes of the blind and free captives from darkness. When Jesus healed the man born blind in John 9, the man's testimony was simple and powerful: 'I was blind but now I see.' Jesus' miracles were not random acts of power—they were signs fulfilling Isaiah's vision of a world set free from darkness."),

makeLesson(54,"good-news-poor","Good News to the Poor","Ministry",
"Isaiah 61:1","Luke 4:18",
"The Spirit of the Sovereign LORD is on me, because the LORD has anointed me to proclaim good news to the poor. He has sent me to bind up the brokenhearted, to proclaim freedom for the captives and release from darkness for the prisoners,",
"\"The Spirit of the Lord is on me, because he has anointed me to proclaim good news to the poor. He has sent me to proclaim freedom for the prisoners and recovery of sight for the blind, to set the oppressed free,\"",
"Isaiah described the one anointed by God's Spirit to bring good news to the poor, freedom to the captive, and sight to the blind. In the synagogue at Nazareth, Jesus read this passage aloud and then declared, 'Today this scripture is fulfilled in your hearing.' He was not merely reading a text—he was announcing his mission statement."),

makeLesson(55,"year-of-the-lord","Year of the Lord's Favor","Ministry",
"Isaiah 61:2","Luke 4:19",
"to proclaim the year of the LORD's favor and the day of vengeance of our God, to comfort all who mourn,",
"\"to proclaim the year of the Lord's favor.\"",
"Isaiah spoke of a coming 'year of the Lord's favor'—a time of divine grace and restoration. When Jesus read this passage in Nazareth, he stopped mid-sentence, omitting the phrase about 'the day of vengeance.' His first coming was about grace, not judgment. The year of favor had arrived in person, and all who would receive it were welcome."),

makeLesson(56,"new-covenant","New Covenant","Kingdom",
"Jeremiah 31:31","Luke 22:20",
"\"The days are coming,\" declares the LORD, \"when I will make a new covenant with the people of Israel and with the people of Judah.\"",
"In the same way, after the supper he took the cup, saying, \"This cup is the new covenant in my blood, which is poured out for you.\"",
"Jeremiah declared that God would one day make a new covenant—not like the one at Sinai that the people broke. At the Last Supper, Jesus took the cup and said, 'This is the new covenant in my blood.' The old covenant was written on stone tablets; the new covenant is sealed with Jesus' own blood and written on human hearts. Jeremiah's hope became reality at a table in Jerusalem."),

makeLesson(57,"lord-our-righteousness","The Lord Our Righteousness","Identity",
"Jeremiah 23:6","1 Corinthians 1:30",
"In his days Judah will be saved and Israel will live in safety. This is the name by which he will be called: The LORD Our Righteous Savior.",
"It is because of him that you are in Christ Jesus, who has become for us wisdom from God—that is, our righteousness, holiness and redemption.",
"Jeremiah gave the coming king a remarkable name: 'The LORD Our Righteousness.' Paul explains that Christ has become our righteousness—not a righteousness we earn but one we receive. We cannot make ourselves right before God, but Jesus can. He is the righteous king Jeremiah promised, and his righteousness becomes ours through faith."),

makeLesson(58,"son-of-man","Son of Man","Identity",
"Daniel 7:13","Matthew 26:64",
"In my vision at night I looked, and there before me was one like a son of man, coming with the clouds of heaven. He approached the Ancient of Days and was led into his presence.",
"\"You have said so,\" Jesus replied. \"But I say to all of you: From now on you will see the Son of Man sitting at the right hand of the Mighty One and coming on the clouds of heaven.\"",
"Daniel saw 'one like a son of man' approaching God's throne with the clouds of heaven. At his trial before the high priest, Jesus applied this vision to himself, declaring that they would see the Son of Man seated in power and coming on the clouds. In that moment of apparent defeat, Jesus claimed the highest possible authority—the cosmic sovereignty Daniel had glimpsed in his vision."),

makeLesson(59,"shepherd-rejected","Rejected Shepherd","Rejection",
"Zechariah 11:10","John 1:11",
"Then I took my staff called Favor and broke it, revoking the covenant I had made with all the nations.",
"He came to that which was his own, but his own did not receive him.",
"In Zechariah's enacted parable, the shepherd breaks his staff called 'Favor,' symbolizing the end of the covenant relationship. John's Gospel summarizes the tragedy in devastating simplicity: Jesus came to his own people, and they did not receive him. The shepherd was rejected by the very flock he came to save."),

makeLesson(60,"sun-darkened","Darkness at Noon","Passion",
"Amos 8:9","Luke 23:44-45",
"\"In that day,\" declares the Sovereign LORD, \"I will make the sun go down at noon and darken the earth in broad daylight.\"",
"It was now about noon, and darkness came over the whole land until three in the afternoon, for the sun stopped shining.",
"Amos prophesied that God would make the sun go down at noon and darken the earth in broad daylight. Luke records that during Jesus' crucifixion, darkness covered the land from noon until three in the afternoon. Creation itself responded to the death of its Creator. The supernatural darkness was a sign that something far beyond an ordinary execution was taking place."),

makeLesson(61,"sun-of-righteousness","Sun of Righteousness","Resurrection",
"Malachi 4:2","Luke 1:78",
"But for you who revere my name, the sun of righteousness will rise with healing in its rays. And you will go out and frolic like well-fed calves.",
"because of the tender mercy of our God, by which the rising sun will come to us from heaven",
"Malachi prophesied that the 'sun of righteousness' would rise with healing in its rays for those who revere God's name. Zechariah, the father of John the Baptist, echoed this imagery when he praised God for the 'rising sun' coming from heaven. In Jesus, the long night of waiting ended. The dawn of God's mercy broke over the horizon, bringing healing and hope to a world in darkness."),

makeLesson(62,"suffering-psalm","Suffering Psalm","Passion",
"Psalm 22:1","Matthew 27:46",
"My God, my God, why have you forsaken me? Why are you so far from saving me, so far from my cries of anguish?",
"About three in the afternoon Jesus cried out in a loud voice, \"Eli, Eli, lema sabachthani?\" (which means \"My God, my God, why have you forsaken me?\").",
"The opening cry of Psalm 22—'My God, my God, why have you forsaken me?'—became Jesus' own cry from the cross. This was not despair; it was the deliberate identification of Jesus with the suffering described in the psalm. Every detail of Psalm 22 played out at Calvary, from the mocking crowds to the pierced hands. Jesus lived out David's psalm in his own body."),

makeLesson(63,"god-will-provide-the-lamb","God Will Provide the Lamb","Identity",
"Genesis 22:8","John 1:29",
"Abraham answered, \"God himself will provide the lamb for the burnt offering, my son.\" And the two of them went on together.",
"The next day John saw Jesus coming toward him and said, \"Look, the Lamb of God, who takes away the sin of the world!\"",
"When Isaac asked his father where the sacrifice was, Abraham answered with prophetic trust: 'God himself will provide the lamb.' Centuries later, John the Baptist pointed to Jesus and declared him the Lamb of God. Abraham's faith-filled words on Mount Moriah found their ultimate answer at the Jordan River—God did provide, and the Lamb he gave takes away the sin of the entire world."),

makeLesson(64,"star-out-of-jacob","Star Out of Jacob","Lineage",
"Numbers 24:17","Matthew 2:2",
"I see him, but not now; I behold him, but not near. A star will come out of Jacob; a scepter will rise out of Israel.",
"and asked, \"Where is the one who has been born king of the Jews? We saw his star when it rose and have come to worship him.\"",
"Balaam, a pagan prophet hired to curse Israel, instead foretold a star rising from Jacob—a royal figure who would rule with a scepter. When the Magi followed a star to find the newborn king of the Jews, they were tracing a thread woven into Scripture centuries before. Even the heavens announced what Balaam foresaw: a King had risen in Israel."),

makeLesson(65,"serpent-lifted-up","Serpent Lifted Up","Passion",
"Numbers 21:9","John 3:14-15",
"So Moses made a bronze snake and put it up on a pole. Then when anyone was bitten by a snake and looked at the bronze snake, they lived.",
"Just as Moses lifted up the snake in the wilderness, so the Son of Man must be lifted up, that everyone who believes may have eternal life in him.",
"In the wilderness, those bitten by serpents were healed by looking at a bronze snake lifted on a pole. Jesus used this very image to explain his own crucifixion: just as Moses lifted the serpent, so the Son of Man would be lifted up. The remedy was the same—look and live. Those who look to the crucified Christ in faith receive eternal life."),

makeLesson(66,"cursed-on-a-tree","Cursed on a Tree","Passion",
"Deuteronomy 21:23","Galatians 3:13",
"you must not leave the body hanging on the pole overnight. Be sure to bury it that same day, because anyone who is hung on a pole is under God's curse.",
"Christ redeemed us from the curse of the law by becoming a curse for us, for it is written: \"Cursed is everyone who is hung on a pole.\"",
"The law declared that anyone hung on a tree bore God's curse. Paul's radical claim is that Jesus willingly took on this curse in our place. On the cross, he became the curse so that we could receive the blessing. The very horror of crucifixion—its shame and disgrace—was the means by which God's grace reached humanity."),

makeLesson(67,"throne-of-david-forever","Throne of David Forever","Lineage",
"2 Samuel 7:16","Luke 1:32-33",
"Your house and your kingdom will endure forever before me; your throne will be established forever.",
"He will be great and will be called the Son of the Most High. The Lord God will give him the throne of his father David, and he will reign over Jacob's descendants forever; his kingdom will never end.",
"God's promise to David was breathtaking: his throne would last forever. No human dynasty could keep that promise. But when Gabriel told Mary that her son would inherit David's throne and reign without end, the ancient covenant found its fulfillment. Jesus is the eternal King David was promised—the one whose kingdom outlasts every earthly empire."),

makeLesson(68,"kings-conspire","Kings Conspire Against the Lord","Rejection",
"Psalm 2:1-2","Acts 4:25-27",
"Why do the nations conspire and the peoples plot in vain? The kings of the earth rise up and the rulers band together against the LORD and against his anointed, saying,",
"You spoke by the Holy Spirit through the mouth of your servant, our father David: \"Why do the nations rage and the peoples plot in vain? The kings of the earth rise up and the rulers band together against the Lord and against his anointed one.\"",
"The psalmist asked why nations rage against God and his anointed. The early church saw this psalm fulfilled when Herod, Pilate, the Gentiles, and Israel's leaders united against Jesus. The conspiracy of the powerful against Christ was not a sign that God's plan had failed—it was the very scenario Scripture had predicted. Their opposition was futile; the anointed King reigns regardless."),

makeLesson(69,"praise-from-children","Praise from Children","Ministry",
"Psalm 8:2","Matthew 21:16",
"Through the praise of children and infants you have established a stronghold against your enemies, to silence the foe and the avenger.",
"\"Do you hear what these children are saying?\" they asked him. \"Yes,\" replied Jesus, \"have you never read, 'From the lips of children and infants you, Lord, have called forth your praise'?\"",
"The psalmist celebrated how God draws praise from the mouths of children. When children in the temple courts shouted 'Hosanna to the Son of David,' the religious leaders were indignant. Jesus silenced them by quoting this very psalm. God's praise cannot be suppressed—even children declare the truth that the powerful refuse to see."),

makeLesson(70,"into-your-hands","Into Your Hands","Passion",
"Psalm 31:5","Luke 23:46",
"Into your hands I commit my spirit; deliver me, LORD, my faithful God.",
"Jesus called out with a loud voice, \"Father, into your hands I commit my spirit.\" When he had said this, he breathed his last.",
"David prayed 'Into your hands I commit my spirit' as a cry of trust in the midst of suffering. Jesus made these words his final breath on the cross. In his darkest hour, he did not curse or despair—he entrusted himself to his Father. The psalm of trust became the Savior's last prayer, turning death itself into an act of faith."),

makeLesson(71,"false-witnesses","False Witnesses Rise Up","Rejection",
"Psalm 35:11","Mark 14:57",
"Ruthless witnesses come forward; they question me on things I know nothing about.",
"Then some stood up and gave this false testimony against him:",
"David described ruthless witnesses who accused him of things he knew nothing about. At Jesus' trial before the Sanhedrin, false witnesses stood up with fabricated charges. The injustice of the trial was not an accident—it was the pattern David had experienced and described. Innocent suffering at the hands of liars was written into the Messiah's story from the beginning."),

makeLesson(72,"i-come-to-do-your-will","I Come to Do Your Will","Ministry",
"Psalm 40:6-8","Hebrews 10:5-7",
"Sacrifice and offering you did not desire—but my ears you have opened—burnt offerings and sin offerings you did not require. Then I said, \"Here I am, I have come—it is written about me in the scroll. I desire to do your will, my God; your law is within my heart.\"",
"Therefore, when Christ came into the world, he said: \"Sacrifice and offering you did not desire, but a body you prepared for me; with burnt offerings and sin offerings you were not pleased. Then I said, 'Here I am—it is written about me in the scroll—I have come to do your will, my God.'\"",
"David declared that God desired not ritual sacrifice but willing obedience: 'Here I am, I have come.' Hebrews applies these words to Christ entering the world—not with an animal offering, but with his own body prepared to do God's will. Jesus replaced an entire sacrificial system with the one offering God truly wanted: a life of perfect obedience."),

makeLesson(73,"throne-forever","Your Throne, O God","Identity",
"Psalm 45:6-7","Hebrews 1:8-9",
"Your throne, O God, will last for ever and ever; a scepter of justice will be the scepter of your kingdom. You love righteousness and hate wickedness; therefore God, your God, has set you above your companions by anointing you with the oil of joy.",
"But about the Son he says, \"Your throne, O God, will last for ever and ever; a scepter of justice will be the scepter of your kingdom. You have loved righteousness and hated wickedness; therefore God, your God, has set you above your companions by anointing you with the oil of joy.\"",
"In Psalm 45, a royal wedding psalm, the king is addressed as 'God' and given an eternal throne. Hebrews directly applies these words to the Son, declaring that Jesus' throne is God's throne—everlasting and righteous. This is one of the clearest Old Testament affirmations of the Messiah's divine nature, celebrated in the context of a joyful coronation."),

makeLesson(74,"hated-without-reason","Hated Without Reason","Rejection",
"Psalm 69:4","John 15:25",
"Those who hate me without reason outnumber the hairs of my head; many are my enemies without cause, those who seek to destroy me. I am forced to restore what I did not steal.",
"But this is to fulfill what is written in their Law: 'They hated me without reason.'",
"The psalmist lamented being hated without cause—his enemies outnumbered the hairs on his head. Jesus quoted this very verse, telling his disciples that the world's hatred was not because of anything wrong in him but was the fulfillment of Scripture. Unreasonable hatred of the innocent is not random injustice; it was foretold, and Jesus bore it knowingly."),

makeLesson(75,"kings-bring-gifts","Kings Bring Gifts","Identity",
"Psalm 72:10-11","Matthew 2:11",
"May the kings of Tarshish and of distant shores bring tribute to him. May the kings of Sheba and Seba present him gifts. May all kings bow down to him and all nations serve him.",
"On coming to the house, they saw the child with his mother Mary, and they bowed down and worshiped him. Then they opened their treasures and presented him with gifts of gold, frankincense and myrrh.",
"The psalm envisioned a day when kings from distant lands would bring gifts and bow before Israel's ruler. When the Magi—scholars from the East—arrived with gold, frankincense, and myrrh and fell down to worship the infant Jesus, this royal homage began to be fulfilled. Even as a baby, Jesus drew the reverence of foreign dignitaries."),

makeLesson(76,"unchanging-creator","The Unchanging Creator","Identity",
"Psalm 102:25-27","Hebrews 1:10-12",
"In the beginning you laid the foundations of the earth, and the heavens are the work of your hands. They will perish, but you remain; they will all wear out like a garment. Like clothing you will change them and they will be discarded. But you remain the same, and your years will never end.",
"He also says, \"In the beginning, Lord, you laid the foundations of the earth, and the heavens are the work of your hands. They will perish, but you remain; they will all wear out like a garment. You will roll them up like a robe; like a garment they will be changed. But you remain the same, and your years will never end.\"",
"The psalmist praised God as the Creator who will outlast his own creation—the heavens will wear out like old clothes, but God remains unchanged. Hebrews applies these very words to the Son, declaring Jesus as the unchanging Creator. Everything else ages, fades, and passes away, but Jesus remains the same yesterday, today, and forever."),

makeLesson(77,"let-another-take-his-place","Another Takes His Place","Rejection",
"Psalm 109:8","Acts 1:20",
"May his days be few; may another take his place of leadership.",
"\"For,\" said Peter, \"it is written in the Book of Psalms: 'May his place be deserted; let there be no one to dwell in it,' and, 'May another take his place of leadership.'\"",
"The psalmist's curse on a treacherous enemy included the wish that another take his position. Peter applied these words to Judas after his betrayal and death, using them as scriptural warrant for choosing Matthias to replace him among the twelve apostles. Even the vacancy left by the betrayer was covered by Scripture, ensuring the apostolic foundation remained complete."),

makeLesson(78,"ever-hearing-never-understanding","Ever Hearing, Never Understanding","Rejection",
"Isaiah 6:9-10","Matthew 13:14-15",
"He said, \"Go and tell this people: 'Be ever hearing, but never understanding; be ever seeing, but never perceiving.' Make the heart of this people calloused; make their ears dull and close their eyes.\"",
"In them is fulfilled the prophecy of Isaiah: \"You will be ever hearing but never understanding; you will be ever seeing but never perceiving. For this people's heart has become calloused; they hardly hear with their ears, and they have closed their eyes.\"",
"God warned Isaiah that the people would hear his words but not understand, see his works but not perceive. Jesus cited this prophecy to explain why he spoke in parables—many heard his teaching but refused to grasp its meaning. Spiritual blindness is not merely a failure to understand; it is a calloused heart that chooses not to see what is plainly before it."),

makeLesson(79,"branch-from-jesse","Branch from Jesse","Lineage",
"Isaiah 11:1-2","Luke 3:22",
"A shoot will come up from the stump of Jesse; from his roots a Branch will bear fruit. The Spirit of the LORD will rest on him—the Spirit of wisdom and of understanding, the Spirit of counsel and of might, the Spirit of the knowledge and fear of the LORD—",
"and the Holy Spirit descended on him in bodily form like a dove. And a voice came from heaven: \"You are my Son, whom I love; with you I am well pleased.\"",
"Isaiah saw a shoot rising from the stump of Jesse, David's father—an image of new life from what appeared to be a dead dynasty. The Spirit of the Lord would rest on this Branch in fullness. At Jesus' baptism, the Holy Spirit descended visibly, and the Father spoke his approval. The dead stump of David's fallen kingdom had produced its greatest Branch."),

makeLesson(80,"root-of-jesse","Root of Jesse","Kingdom",
"Isaiah 11:10","Romans 15:12",
"In that day the Root of Jesse will stand as a banner for the peoples; the nations will rally to him, and his resting place will be glorious.",
"And again, Isaiah says, \"The Root of Jesse will spring up, one who will arise to rule over the nations; in him the Gentiles will hope.\"",
"Isaiah described the Root of Jesse as a banner around which the nations would rally. Paul quoted this to emphasize that Jesus' mission extends to all peoples—Gentiles included. The Messiah is not just Israel's king but the hope of the entire world. Every nation finds its rallying point in him, and his resting place—his eternal kingdom—will be glorious."),

makeLesson(81,"voice-in-the-wilderness","Voice in the Wilderness","Ministry",
"Isaiah 40:3","Matthew 3:3",
"A voice of one calling: \"In the wilderness prepare the way for the LORD; make straight in the desert a highway for our God.\"",
"This is he who was spoken of through the prophet Isaiah: \"A voice of one calling in the wilderness, 'Prepare the way for the Lord, make straight paths for him.'\"",
"Isaiah heard a voice calling for a highway to be built in the wilderness for God. Matthew identifies John the Baptist as that voice—preparing the way not through road construction but through calling people to repentance. Before the King arrives, hearts must be made ready. John's wilderness preaching leveled the mountains of pride and filled the valleys of despair."),

makeLesson(82,"light-for-the-gentiles","Light for the Gentiles","Ministry",
"Isaiah 49:6","Acts 13:47",
"he says: \"It is too small a thing for you to be my servant to restore the tribes of Jacob and bring back those of Israel I have kept. I will also make you a light for the Gentiles, that my salvation may reach to the ends of the earth.\"",
"For this is what the Lord has commanded us: \"I have made you a light for the Gentiles, that you may bring salvation to the ends of the earth.\"",
"God told his Servant that restoring Israel alone was too small a task—he would be a light for the Gentiles, bringing salvation to earth's ends. Paul and Barnabas quoted this when they turned their mission to the Gentiles. The gospel was never meant for one people only; from the beginning, God's plan was a salvation so vast it encompasses every corner of the globe."),

makeLesson(83,"back-to-those-who-beat","Back to Those Who Beat Me","Passion",
"Isaiah 50:6","Matthew 26:67",
"I offered my back to those who beat me, my cheeks to those who pulled out my beard; I did not hide my face from mocking and spitting.",
"Then they spit in his face and struck him with their fists. Others slapped him",
"The Servant in Isaiah willingly offered his back to beatings, his cheeks to those who tore out his beard, and his face to mocking and spitting. Matthew records Jesus enduring exactly this treatment—spit on, struck, slapped—after his trial. The Servant did not resist or hide. His willingness to absorb violence without retaliation revealed a strength deeper than any display of power."),

makeLesson(84,"appearance-disfigured","Appearance Disfigured","Passion",
"Isaiah 52:14","Mark 15:17-19",
"Just as there were many who were appalled at him—his appearance was so disfigured beyond that of any human being and his form marred beyond human likeness—",
"They put a purple robe on him, then twisted together a crown of thorns and set it on him. And they began to call out to him, \"Hail, king of the Jews!\" Again and again they struck him on the head with a staff and spit on him.",
"Isaiah warned that the Servant's appearance would be so disfigured that people would be appalled. Mark's account of Jesus' flogging, the thorns jammed onto his head, and the repeated blows to his face show this prophecy in agonizing detail. The one who was the radiance of God's glory chose to have his human form marred beyond recognition for the sake of those he came to save."),

makeLesson(85,"he-took-our-infirmities","He Took Our Infirmities","Ministry",
"Isaiah 53:4","Matthew 8:17",
"Surely he took up our pain and bore our suffering, yet we considered him punished by God, stricken by him, and afflicted.",
"This was to fulfill what was spoken through the prophet Isaiah: \"He took up our infirmities and bore our diseases.\"",
"Isaiah described the Servant bearing human pain and suffering. Matthew applies this not to the cross but to Jesus' healing ministry—every sick person he healed was a partial fulfillment of this prophecy. Jesus did not merely cure symptoms; he took upon himself the weight of human brokenness. His compassion was not optional; it was his prophetic calling."),

makeLesson(86,"beautiful-feet","Beautiful Feet","Ministry",
"Isaiah 52:7","Romans 10:15",
"How beautiful on the mountains are the feet of those who bring good news, who proclaim peace, who bring good tidings, who proclaim salvation, who say to Zion, \"Your God reigns!\"",
"And how can anyone preach unless they are sent? As it is written: \"How beautiful are the feet of those who bring good news!\"",
"Isaiah celebrated the beauty of the messenger who brings good news—peace, salvation, the reign of God. Paul applied this to the gospel messengers who carry the news of Christ to the world. The message itself is glorious, but even the feet that carry it are called beautiful. Every person who shares the good news walks in the footsteps of Isaiah's vision."),

makeLesson(87,"everlasting-covenant","Everlasting Covenant","Resurrection",
"Isaiah 55:3","Acts 13:34",
"Give ear and come to me; listen, that you may live. I will make an everlasting covenant with you, my faithful love promised to David.",
"God raised him from the dead so that he will never be subject to decay. As God has said, 'I will give you the holy and sure blessings promised to David.'",
"Isaiah invited the people into an everlasting covenant rooted in God's faithful love promised to David. Paul declared that Jesus' resurrection secured those promises forever—because the risen Christ will never decay, the blessings of David's covenant are now sure and permanent. The resurrection is not just a miracle; it is the guarantee that God's ancient promises will never expire."),

makeLesson(88,"rachel-weeping","Rachel Weeping for Her Children","Passion",
"Jeremiah 31:15","Matthew 2:18",
"This is what the LORD says: \"A voice is heard in Ramah, mourning and great weeping, Rachel weeping for her children and refusing to be comforted, because they are no more.\"",
"\"A voice is heard in Ramah, weeping and great mourning, Rachel weeping for her children and refusing to be comforted, because they are no more.\"",
"Jeremiah described Rachel—the mother of Israel—weeping inconsolably for her lost children. Matthew saw this fulfilled in Herod's massacre of the infants in Bethlehem. The coming of the Messiah did not shield the world from evil; instead, he entered into a world of real suffering. Even the Savior's birth was accompanied by tears, foreshadowing the sorrow he would ultimately bear."),

makeLesson(89,"god-sets-up-kingdom","God Sets Up a Kingdom","Kingdom",
"Daniel 2:44","Revelation 11:15",
"In the time of those kings, the God of heaven will set up a kingdom that will never be destroyed, nor will it be left to another people. It will crush all those kingdoms and bring them to an end, but it will itself endure forever.",
"The seventh angel sounded his trumpet, and there were loud voices in heaven, which said: \"The kingdom of the world has become the kingdom of our Lord and of his Messiah, and he will reign for ever and ever.\"",
"Nebuchadnezzar's dream revealed a succession of earthly empires, all crushed by a kingdom set up by God that would never be destroyed. Revelation shows the final fulfillment: every kingdom of this world becomes Christ's eternal domain. Human empires rise and crumble, but the kingdom God established through Jesus endures forever—unshakeable and unending."),

makeLesson(90,"pour-out-my-spirit","Pour Out My Spirit","Kingdom",
"Joel 2:28","Acts 2:17",
"And afterward, I will pour out my Spirit on all people. Your sons and daughters will prophesy, your old men will dream dreams, your young men will see visions.",
"'In the last days, God says, I will pour out my Spirit on all people. Your sons and daughters will prophesy, your young men will see visions, your old men will dream dreams.'",
"Joel foresaw a day when God's Spirit would be poured out on all people—sons and daughters, old and young alike. Peter declared this fulfilled at Pentecost when the Spirit fell on the believers and they spoke in tongues. The Spirit that once rested on select prophets and kings now fills every believer, making the entire community of faith a prophetic people."),

makeLesson(91,"three-days-in-the-deep","Three Days in the Deep","Resurrection",
"Jonah 1:17","Matthew 12:40",
"Now the LORD provided a huge fish to swallow Jonah, and Jonah was inside the fish three days and three nights.",
"For as Jonah was three days and three nights in the belly of a huge fish, so the Son of Man will be three days and three nights in the heart of the earth.",
"Jonah's three days in the belly of the great fish became, in Jesus' words, a sign pointing directly to his own death and resurrection. Just as Jonah emerged alive after three days in the deep, Jesus would emerge alive from the tomb. What seemed like the end of Jonah's story was actually a rescue—and the same pattern held true at Easter."),

makeLesson(92,"rebuild-davids-tent","Rebuild David's Fallen Tent","Kingdom",
"Amos 9:11-12","Acts 15:16-17",
"\"In that day I will restore David's fallen shelter—I will repair its broken walls and restore its ruins—and will rebuild it as it used to be, so that they may possess the remnant of Edom and all the nations that bear my name,\" declares the LORD, who will do these things.",
"'After this I will return and rebuild David's fallen tent. Its ruins I will rebuild, and I will restore it, that the rest of mankind may seek the Lord, even all the Gentiles who bear my name, says the Lord, who does these things'—",
"Amos prophesied that God would restore David's fallen shelter so that all nations might seek the Lord. James quoted this at the Jerusalem Council to support the inclusion of Gentile believers. The rebuilding of David's tent is not a physical reconstruction—it is the gathering of all peoples into the family of God through Jesus, the son of David."),

makeLesson(93,"my-servant-the-branch","My Servant, the Branch","Identity",
"Zechariah 3:8","Luke 1:78",
"Listen, High Priest Joshua, you and your associates seated before you, who are men symbolic of things to come: I am going to bring my servant, the Branch.",
"because of the tender mercy of our God, by which the rising sun will come to us from heaven",
"Zechariah announced the coming of God's servant, called 'the Branch'—a title laden with messianic meaning. Zechariah the priest, father of John the Baptist, echoed this when he praised God for the 'rising sun' from heaven. The Branch imagery speaks of new growth from David's line—fresh, living, fruitful. In Jesus, the royal line that seemed cut off sprouted to life again."),

makeLesson(94,"priest-on-his-throne","Priest on His Throne","Identity",
"Zechariah 6:12-13","Hebrews 8:1-2",
"Tell him this is what the LORD Almighty says: 'Here is the man whose name is the Branch, and he will branch out from his place and build the temple of the LORD. It is he who will build the temple of the LORD, and he will be clothed with majesty and will sit and rule on his throne. And he will be a priest on his throne. And there will be harmony between the two.'",
"Now the main point of what we are saying is this: We do have such a high priest, who sat down at the right hand of the throne of the Majesty in heaven, and who serves in the sanctuary, the true tabernacle set up by the Lord, not by a mere human being.",
"Zechariah described the Branch building the Lord's temple and serving as both king and priest on his throne—roles that were always separate in Israel. Hebrews reveals Jesus as this unique figure: a high priest who sat down on heaven's throne, serving in the true sanctuary. In Christ, the crown and the priestly garments are united in one person, bringing perfect harmony between God's rule and his mercy."),

makeLesson(95,"elijah-will-come","Elijah Will Come","Ministry",
"Malachi 4:5-6","Matthew 11:14",
"See, I will send the prophet Elijah to you before that great and dreadful day of the LORD comes. He will turn the hearts of the parents to their children, and the hearts of the children to their parents; or else I will come and strike the land with total destruction.",
"And if you are willing to accept it, he is the Elijah who was to come.",
"Malachi closed the Old Testament with a promise that Elijah would return before the great day of the Lord. Jesus declared that John the Baptist was the Elijah who was to come. John did not come with Elijah's fire, but with his Spirit and power—calling families and a nation to repentance, turning hearts back to God, preparing the way for the day of salvation."),

makeLesson(96,"feet-on-mount-of-olives","Feet on Mount of Olives","Kingdom",
"Zechariah 14:4","Acts 1:11-12",
"On that day his feet will stand on the Mount of Olives, east of Jerusalem, and the Mount of Olives will be split in two from east to west, forming a great valley, with half of the mountain moving north and half moving south.",
"\"Men of Galilee,\" they said, \"why do you stand here looking into the sky? This same Jesus, who has been taken from you into heaven, will come back in the same way you have seen him go into heaven.\" Then the apostles returned to Jerusalem from the hill called the Mount of Olives.",
"Zechariah prophesied that the Lord's feet would stand on the Mount of Olives. It was from the Mount of Olives that Jesus ascended into heaven, and the angels promised he would return the same way. The geography is precise: the exact hill Zechariah named is where Jesus departed and where the promise of his return was given. The story is not over—it awaits its final chapter."),

makeLesson(97,"cut-off-from-the-living","Cut Off from the Living","Passion",
"Isaiah 53:8","Acts 8:33",
"By oppression and judgment he was taken away. Yet who of his generation protested? For he was cut off from the land of the living; for the transgression of my people he was punished.",
"\"In his humiliation he was deprived of justice. Who can speak of his descendants? For his life was taken from the earth.\"",
"Isaiah described the Servant being taken away by oppression and judgment, cut off from the land of the living. The Ethiopian eunuch was reading this very passage when Philip met him on the desert road. Philip explained that this was about Jesus—unjustly condemned, killed for others' transgressions. The ancient prophecy became the gateway to faith for a man from the ends of the earth."),

makeLesson(98,"sons-of-the-living-god","Sons of the Living God","Kingdom",
"Hosea 1:10","Romans 9:26",
"Yet the Israelites will be like the sand on the seashore, which cannot be measured or counted. In the place where it was said to them, 'You are not my people,' there they will be called 'children of the living God.'",
"and, \"In the very place where it was said to them, 'You are not my people,' there they will be called 'children of the living God.'\"",
"Hosea declared that those once called 'not my people' would be called children of the living God. Paul applied this to the inclusion of Gentiles in God's family—those who were once outsiders are now beloved children. The story of Scripture ends where it began: with God's relentless desire to have a people he calls his own, drawn from every nation on earth.")

]

// === SCHOLARSHIP ATTRIBUTION ===
// J. Barton Payne, Encyclopedia of Biblical Prophecy (Harper & Row, 1973)
// Alfred Edersheim, The Life and Times of Jesus the Messiah (1883), Appendix IX
// Josh McDowell, The New Evidence That Demands a Verdict (Thomas Nelson, 1999), Chapter 8

const _scholarshipMap: Record<number, Scholarship> = {
  1: { ...payne(1, "Gen 3:15", "Seed of woman crushing serpent; Payne treats this as foundational messianic promise opening all redemptive history"), ...edersheim("Paraphrased with express reference to the Messiah in Targum Pseudo-Jonathan; the seed crushing the serpent's head applied to Messiah in multiple Midrashim"), ...mcdowell(1, "Born of the Seed of Woman", "First Messianic promise; seed of woman crushes serpent — cited with Targum Jonathan") },
  2: { ...mcdowell(4, "Seed of Abraham", "Galatians 3:16 — 'seed' singular; Matthew Henry cited on universal blessing through one descendant") },
  3: { ...payne(3, "Gen 49:10", "Scepter not departing from Judah until Shiloh comes; ruler from Judah lineage narrowed to Christ"), ...edersheim("Extensively discussed; Shiloh applied directly to Messiah in Targum Pseudo-Jon. with full Rabbinic commentary in Sanh. 98b"), ...mcdowell(7, "Tribe of Judah", "Scepter passage with Targum Jonathan cited verbatim; Hengstenberg commentary included") },
  4: { ...payne(5, "Deut 18:15–18", "Prophet like Moses raised up; Payne notes Jewish expectation of a second Moses fulfilled in Christ"), ...mcdowell(16, "Shall Be a Prophet", "Maimonides letter to Yemen cited; Kligerman on Jewish expectation of Messianic prophet") },
  5: { ...edersheim("Passover lamb typology connected to Messianic redemption in Talmudic sources") },
  6: { ...payne(6, "2 Sam 7:12–13", "Davidic throne established forever; Payne treats as foundational covenant for all Davidic messianism") },
  7: { ...payne(23, "Isa 7:14", "Virgin conceives Immanuel; Payne argues almah requires virgin, not merely young woman"), ...edersheim("Cited in Messianic context; sign applied to the Messianic era in Targum and Talmudic sources"), ...mcdowell(2, "Born of a Virgin", "Greek LXX uses parthenos; Targum Isaiah cited; Immanuel also listed separately as #15") },
  8: { ...payne(24, "Isa 9:1–2", "Galilee region sees great light; Payne notes geographic specificity as confirming mark"), ...edersheim("Applied to Messianic times and the light of the Messiah in Yalkut and Talmud"), ...mcdowell(23, "Ministry to Begin in Galilee", "Galilee of Gentiles illuminated; Capernaum as fulfillment — Matt 4:12 cited") },
  9: { ...payne(50, "Mal 3:1", "Messenger prepares the way; Payne identifies John the Baptist as direct fulfillment"), ...mcdowell(26, "He Was to Enter the Temple", "Lord suddenly coming to His temple; John 1:14 and 2:19-21 cited as fulfillments") },
  10: { ...payne(45, "Mic 5:2", "Ruler from Bethlehem of ancient origins; Payne emphasizes eternal origin clause as divine"), ...edersheim("Bethlehem as Messiah's birthplace attested via Gen 35:21 in Targum Pseudo-Jon.; Mic 5:2 cited in Talmudic discussion of Messianic origin"), ...mcdowell(10, "Born at Bethlehem", "Scribes cited in Matt 2:4; Hengstenberg commentary; pre-existence in same verse noted as #13") },
  11: { ...payne(19, "Ps 110:4", "Priest forever in Melchizedek order; Payne notes this requires a priest outside the Levitical line"), ...edersheim("Psalm 110 treated as Messianic throughout; eternal priesthood applied to Messiah in Rabbinic writings"), ...mcdowell(17, "Priest", "Eternal Melchizedek priesthood; oath of God distinguishes from Aaronic priesthood") },
  12: { ...payne(9, "Ps 2:6–7", "God's king installed on Zion; You are My Son declared at coronation; fulfilled at baptism and resurrection"), ...edersheim("Explicitly quoted as Messianic in Talmud (Sukk. 52a); applied to the King Messiah in Midrash"), ...mcdowell(3, "Son of God", "Quoted as Messianic in Talmud (Sukk. 52a); Father's declaration at baptism") },
  13: { ...payne(16, "Ps 41:9", "Close friend betrays the psalmist; Payne notes Jesus' explicit citation at Last Supper (John 13:18)"), ...edersheim("Applied in context of Messiah's betrayal; Psalm 41 cited in Messianic discussions in Talmud"), ...mcdowell(33, "Betrayed by a Friend", "Familiar friend who ate bread; 'man of my peace' — Judas's kiss of betrayal") },
  14: { ...payne(47, "Zech 11:12–13", "Thirty pieces of silver; Payne calls this one of the most statistically improbable fulfillments"), ...edersheim("Messianically explained in Ber. R. 98; thirty pieces of silver applied to Messiah's betrayal"), ...mcdowell(34, "Sold for Thirty Pieces of Silver", "Seven precise details fulfilled: friend, 30 pieces, silver, thrown, house of Lord, potter") },
  15: { ...payne(47, "Zech 11:12–13", "Thirty pieces thrown to potter; same passage as L14, second half of the fulfillment"), ...edersheim("Continuation of Zech 11 Messianic discourse; potter's field in Rabbinic sources"), ...mcdowell(35, "Money Thrown into God's House", "Thrown (not placed) into the temple — Matt 27:5 exact fulfillment; also #36 Price Given for Potter's Field") },
  16: { ...payne(13, "Ps 22:16", "Hands and feet pierced; Payne notes crucifixion unknown in David's era, making this highly specific"), ...edersheim("Psalm 22 treated as Messianic Passion Psalm; verse cited in Yalkut on Messiah's sufferings"), ...mcdowell(44, "Hands and Feet Pierced", "Roman crucifixion method; large dull spikes; Zech 12:10 cited as parallel") },
  17: { ...payne(14, "Ps 22:18", "Garments divided and lots cast; Payne cites John 19:24 as word-for-word fulfillment"), ...edersheim("Garments and lots within the Messianic Psalm 22; cited in Rabbinic writings on Messiah's derision") },
  18: { ...payne(12, "Ps 22:7–8", "Mockers shake their heads; Payne notes mocking language matches Matthew 27:39–43 precisely"), ...edersheim("Mocking expressly applied to Messiah's sufferings and derision from enemies in ancient Synagogue commentary"), ...mcdowell(42, "Mocked", "Shoot out the lip, shake the head — Psalm 22 treated as full Passion Psalm by McDowell") },
  19: { ...payne(17, "Ps 69:21", "Gall and vinegar offered; Payne cites Matthew 27:34 and John 19:29–30 as dual fulfillments"), ...mcdowell(53, "To Suffer Thirst", "Vinegar for thirst; John 19:28 — 'I thirst'; also covered by #54 Gall and Vinegar Offered") },
  20: { ...payne(48, "Zech 12:10", "Look on the one they pierced; Payne notes the first-person divine speaker makes this theologically remarkable"), ...mcdowell(59, "His Side Pierced", "Laetsch — LORD Jehovah speaks of Himself as pierced; 'thrust through' appears 9x in OT") },
  21: { ...payne(36, "Isa 53:7", "Silent before accusers like a lamb; Payne notes the voluntary silence distinguishes this from ordinary suffering"), ...edersheim("Isaiah 53 treated as most significant Messianic chapter; Messiah's silence before accusers cited in Yalkut"), ...mcdowell(39, "Silent before Accusers", "Oppressed and afflicted, opened not His mouth; Matt 27:12 fulfillment noted") },
  22: { ...payne(35, "Isa 53:4–5", "Pierced for transgressions; Payne calls Isaiah 53 the most complete messianic prophecy in the OT"), ...edersheim("Stripes and healing applied to Messiah bearing Israel's sins in Talmud (Sanh. 98b) and Yalkut"), ...mcdowell(40, "Wounded and Bruised", "Stripes for our healing; Henry cited; Zech 13:6 as parallel") },
  23: { ...payne(37, "Isa 53:9", "Grave with wicked yet rich in death; Payne notes the double prediction (wicked/rich) uniquely fulfilled at Calvary"), ...edersheim("Burial with the rich in Messianic application of Isa 53 in ancient Rabbinic commentary"), ...mcdowell(61, "Buried in a Rich Man's Tomb", "Grave with wicked but tomb with rich; Joseph of Arimathea — Stoner probability cited") },
  24: { ...payne(10, "Ps 16:10", "Not abandoned to grave nor decay; Payne cites Peter's Pentecost sermon as definitive interpretation"), ...edersheim("Not suffering corruption applied to Messiah; cited in Rabbinic sources on resurrection hope"), ...mcdowell(30, "Resurrection", "Soul not left in Sheol; Friedlaender on Ibn Ezra's belief in resurrection; Acts 2:31") },
  25: { ...edersheim("Ascent on high and captivity applied to Messianic triumph in Talmud and Midrash"), ...mcdowell(31, "Ascension", "Ascended on high; Acts 1:9 fulfillment; captivity led captive") },
  26: { ...payne(18, "Ps 110:1", "Lord says to my Lord: sit at my right hand; Payne notes Jesus' use of this in Matt 22:44 as self-identification"), ...edersheim("Ps 110:1 explicitly Messianic; 'Sit at My right hand' applied to Messiah in Talmudic debate (Sanh. 38a)"), ...mcdowell(14, "He Shall Be Called Lord", "Midrash Tehillim cited; Matt 22:43-45 — David calls Him Lord in the Spirit; also #32 Seated at Right Hand") },
  27: { ...edersheim("Servant as light to nations applied to Messianic era in Targum and Midrash") },
  28: { ...edersheim("Opening of blind eyes and ears cited in Messianic context in Yalkut on Isaiah"), ...mcdowell(24, "Ministry of Miracles", "Blind, deaf, lame, mute healed; Isaiah 32:3-4 also cited; Matt 11:4 fulfillment") },
  29: { ...mcdowell(25, "Teacher of Parables", "Parable method predicted; Matt 13:34 — without a parable He did not speak") },
  30: { ...mcdowell(21, "His Zeal for God", "Fausset cited on John 2:17 as specimen of Messiah's zeal; reproaches falling on Him") },
  31: { ...payne(20, "Ps 118:22", "Rejected stone becomes cornerstone; Payne treats rejection by builders as symbolic of religious establishment's rejection"), ...edersheim("Rejected stone becoming cornerstone cited as Messianic in Talmud and applied to Messiah in multiple Midrashim"), ...mcdowell(29, "Rejected Cornerstone", "Stone builders rejected became chief cornerstone; Matt 21:42 fulfillment") },
  32: { ...payne(46, "Zech 9:9", "King comes humble on a donkey; Payne calls the donkey detail a uniquely verifiable fulfillment"), ...edersheim("Humble King on donkey explicitly applied to Messiah in Talmud (Sanh. 98a) and Midrash with variant readings"), ...mcdowell(27, "He Was to Enter Jerusalem on a Donkey", "Humble King; Talmud (Sanh. 98a) cited — if Israel worthy, He comes on clouds; if not, on donkey") },
  33: { ...payne(49, "Zech 13:7", "Strike the shepherd and sheep scatter; Payne notes Jesus cited this before Gethsemane (Matt 26:31)"), ...mcdowell(37, "Forsaken by His Disciples", "Laetsch cited on Zech 13:7 as clear prophecy; Christ's own interpretation in Matt 26:31") },
  34: { ...payne(41, "Jer 23:5–6", "Righteous Branch of David called The LORD Our Righteousness; Payne notes the divine name given to the Branch"), ...edersheim("Righteous Branch (Tsemach) is one of the best-known Messianic designations; applied in Targum and multiple Midrashim"), ...mcdowell(9, "House of David", "Righteous Branch; Messiah called Son of David throughout both Talmuds") },
  35: { ...payne(43, "Dan 7:13–14", "Son of Man on clouds given everlasting dominion; Payne sees this as messianic throne-room investiture scene"), ...edersheim("Son of Man receiving everlasting dominion applied to the Messiah in Talmud and Targum on Daniel") },
  36: { ...payne(44, "Dan 9:24–26", "Seventy sevens and the Anointed One; Payne provides detailed chronological argument for first-century arrival") },
  37: { ...payne(44, "Dan 9:24–26", "Messiah cut off and has nothing; Payne connects cutting off to Isaiah 53:8 as confirming the death of Messiah") },
  38: { ...payne(42, "Ezek 34:23–24", "One shepherd over the flock; Payne sees Ezekiel's shepherd-David as typologically fulfilled by Christ") },
  39: { ...payne(34, "Isa 53:3", "Despised and rejected, man of sorrows; Payne notes the social dimension of rejection as distinctive Servant trait"), ...edersheim("Despised and rejected applied to Messiah's suffering in Yalkut and Talmud (Sanh. 98b)"), ...mcdowell(47, "Rejected by His Own People", "Henry cited; own brethren disbelieved (John 7:5); own received Him not (John 1:11)") },
  40: { ...payne(39, "Isa 53:12", "Numbered with transgressors; Payne connects this to crucifixion between rebels as literal fulfillment"), ...edersheim("Numbered with transgressors in Messianic application of Isa 53 in Talmud"), ...mcdowell(45, "Crucified with Thieves", "Numbered with transgressors; crucifixion unknown in Jewish law — Blinzler cited") },
  41: { ...payne(39, "Isa 53:12", "Made intercession for transgressors; Payne notes the present-tense intercession continues beyond the cross"), ...edersheim("Intercession for transgressors applied to Messiah's work on behalf of the living and dead in Yalkut"), ...mcdowell(46, "Made Intercession for Persecutors", "Fausset — began on cross (Luke 23:34), continues in heaven (Heb 9:24; 1 John 2:1)") },
  42: { ...edersheim("Swallowing up of death applied to Messianic era in Talmud (Moed Katan 28b) and Midrash") },
  43: { ...edersheim("Kingdom given to the people of the Most High applied to Messianic reign in Talmudic commentary") },
  44: { ...payne(28, "Isa 28:16", "Tested cornerstone laid in Zion; Payne links this cornerstone to Ps 118:22 and Isa 8:14 as a stone trilogy"), ...edersheim("Cornerstone in Zion applied to Messiah by Targum; noted by Rashi; Messiah as crown of glory (Isa 28:5)") },
  46: { ...edersheim("Everlasting light replacing sun and moon applied to Messianic era and the light of the Messiah in Yalkut") },
  47: { ...payne(38, "Isa 53:10–11", "He will see his offspring and prolong his days; Payne calls the post-death life described here a resurrection prediction"), ...edersheim("Righteous Servant justifying many cited in Messianic application of Isaiah 53") },
  48: { ...edersheim("Redeemer coming to Zion applied to Messianic times in Sanh. 98a and Pesiqta 166b") },
  49: { ...payne(25, "Isa 9:6–7", "Child born, Son given, Wonderful Counselor; Payne treats the divine names as evidence of Messiah's divine nature"), ...edersheim("Child born, Son given; names of the Messiah extensively discussed in Talmud (Debarim R.) and Midrash") },
  50: { ...payne(25, "Isa 9:6–7", "Government on his shoulders; peace without end; Payne notes the eschatological fullness awaits second advent"), ...edersheim("Throne established forever applied to Messiah's eternal kingdom in Talmudic and Midrashic sources") },
  51: { ...payne(30, "Isa 42:1–4", "Servant upheld by God, Spirit upon him; Payne sees the four Servant Songs as a progressive messianic portrait"), ...edersheim("Servant upheld by God applied to Messiah in Targum and Midrash on Psalm 2") },
  52: { ...payne(30, "Isa 42:1–4", "Will not shout in the streets; Payne contrasts the quiet Servant with false messiahs who sought spectacle"), ...edersheim("Gentle servant applied to Messiah's ministry manner in Messianic commentary") },
  53: { ...edersheim("Opening blind eyes applied to Messiah's healing ministry in Yalkut on Isaiah 42") },
  54: { ...payne(40, "Isa 61:1–2", "Spirit anoints to preach good news; Payne notes Jesus stopped reading mid-verse in Nazareth to separate advents"), ...edersheim("Good news to the poor and liberty to captives applied to Messianic era in Talmud") },
  55: { ...payne(40, "Isa 61:1–2", "Year of the LORD's favor; Payne argues the partial reading in Luke 4 is itself prophetically significant"), ...edersheim("Year of the Lord's favor applied to Messianic proclamation in Rabbinic commentary") },
  56: { ...edersheim("New covenant promise applied to Messianic era; Jer 31:33-34 also cited in Yalkut") },
  57: { ...payne(41, "Jer 23:5–6", "The LORD Our Righteousness; Payne sees the divine name as the strongest Davidic messianic title in Jeremiah"), ...edersheim("'The LORD our Righteousness' cited as one of the Messiah's names in Talmud (Bava Batra 75b)") },
  58: { ...payne(43, "Dan 7:13–14", "Son of Man coming on clouds; Payne connects this to the Olivet Discourse and Christ's self-identification throughout the Gospels"), ...edersheim("Son of Man on clouds applied to Messiah in Talmud (Sanh. 98a) and Targum on Daniel") },
  59: { ...edersheim("Breaking of covenant staff in Messianic context of the rejected shepherd") },
  60: { ...mcdowell(60, "Darkness over the Land", "Sun darkened at noon; sixth hour = noon, ninth = 3pm by Jewish reckoning; Matt 27:45") },
  62: { ...payne(11, "Ps 22:1", "My God why have you forsaken me; Payne argues this cry prefigures both the suffering and the ultimate vindication of Ps 22"), ...edersheim("Opening cry of Psalm 22 applied to Messiah's suffering; entire psalm treated as Messianic in ancient Synagogue"), ...mcdowell(55, "His Forsaken Cry", "Double cry 'My God' implies clinging to God while forsaken; Matt 27:46 verbatim") },
  63: { ...edersheim("God will provide the lamb connected to Messianic redemption; Isaac as type of Messiah in Talmud and Midrash") },
  64: { ...payne(4, "Num 24:17", "Star from Jacob, scepter from Israel; Payne treats Balaam's oracle as one of the earliest royal messianic predictions"), ...edersheim("Star out of Jacob applied to the Messiah in Talmud; associated with Bar Kokhba as false messiah (Num. Rab.)"), ...mcdowell(6, "Son of Jacob", "Star out of Jacob applied to Messiah; eliminates half of Abraham's lineage toward Christ") },
  66: { ...edersheim("Curse of one hanged on a tree in Messianic/atonement context in Talmudic sources") },
  68: { ...edersheim("Nations conspiring against God's anointed applied to opposition to the Messiah in Talmud") },
  70: { ...edersheim("Into Your hands cited in Messianic context of suffering and trust in Midrash"), ...mcdowell(56, "Committed Himself to God", "Into Your hand I commit my spirit; Luke 23:46 — last words on the cross") },
  71: { ...edersheim("False witnesses rising up cited in Messianic commentary on Messiah's trial"), ...mcdowell(38, "Accused by False Witnesses", "Fierce witnesses rise up; Matt 26:60 — false witnesses sought, found none") },
  72: { ...edersheim("Doing God's will cited as Messianic in Talmud; scroll of the book applied to Messiah") },
  73: { ...edersheim("Psalm 45 thoroughly Messianic in Targum; 'Your throne, O God' applied to Messiah's eternal kingship") },
  74: { ...mcdowell(48, "Hated Without a Cause", "More haters than hairs; John 15:25 — their own law quotes this word as fulfilled") },
  75: { ...edersheim("Kings bringing gifts applied to the Messiah; entire Psalm 72 viewed as Messianic in Yalkut"), ...mcdowell(11, "Presented with Gifts", "Kings of Sheba bringing gifts fulfilled by Magi; Isaiah 60:6 cited as parallel") },
  76: { ...edersheim("Unchanging Creator applied to Messiah in Talmud; Ps 102:16 applied to Messianic times in Bereshith R.") },
  78: { ...edersheim("Ever hearing never understanding applied to those rejecting Messiah's message in Midrash") },
  79: { ...payne(26, "Isa 11:1–2", "Shoot from Jesse's stump; Payne notes the stump imagery implies a dynasty cut down before the Messiah emerges"), ...edersheim("Branch from Jesse and Spirit of the LORD extensively applied to Messiah in Targum, Talmud, and Midrash"), ...mcdowell(8, "Family Line of Jesse", "Targum Isaiah: 'A King shall come forth from the sons of Jesse'; also #20 Special Anointing of Holy Spirit") },
  80: { ...payne(27, "Isa 11:10", "Root of Jesse as banner for peoples; Payne connects this to Gentile inclusion in the messianic community"), ...edersheim("Root of Jesse as signal to nations applied to Messianic gathering in Talmud and Yalkut") },
  81: { ...payne(29, "Isa 40:3–5", "Voice in wilderness, prepare the way; Payne calls this the most explicit forerunner prophecy in the OT"), ...edersheim("Voice in the wilderness preparing the way applied to Messianic forerunner in Rabbinic commentary"), ...mcdowell(22, "Preceded by Messenger", "John Baptist as forerunner; Mal 3:1 cited in parallel; Luke 1:17 included") },
  82: { ...payne(31, "Isa 49:6", "Light to the Gentiles; Payne calls this the clearest statement of universal messianic salvation in the Servant Songs"), ...edersheim("Light for the Gentiles applied to Messiah's universal mission in Talmud and Midrash") },
  83: { ...payne(32, "Isa 50:6", "Back given to those who beat me; Payne connects to the Sanhedrin trial and Roman scourging as fulfillment"), ...edersheim("Back given to those who strike applied to Messiah's suffering in Yalkut on Isaiah 50"), ...mcdowell(41, "Smitten and Spit Upon", "Back to strikers, cheeks to beard-pluckers; Henry commentary; Matt 26:67 fulfillment") },
  84: { ...payne(33, "Isa 52:13–15", "Servant raised and highly exalted; disfigured appearance; Payne treats 52:13–15 as the heading of the Suffering Servant poem"), ...edersheim("Disfigured appearance applied to Messiah's suffering; Isa 52-53 treated as continuous Messianic passage") },
  85: { ...payne(35, "Isa 53:4–5", "He took up our pain and bore our suffering; Payne calls this the substitutionary heart of all OT atonement imagery"), ...edersheim("Taking our infirmities applied to Messiah bearing Israel's diseases in Talmud (Sanh. 98b)") },
  86: { ...edersheim("Beautiful feet of herald applied to Messianic proclamation; cited in Yalkut with three-day Elijah scenario") },
  87: { ...edersheim("Everlasting covenant and sure mercies of David applied to Messianic era in Talmud") },
  88: { ...edersheim("Rachel weeping cited in Messianic context of exile and return in Midrash Rabbah"), ...mcdowell(12, "Herod Kills Children", "Rachel weeping; Laetsch cited defending Matthew's typological application of Jeremiah 31") },
  89: { ...edersheim("God setting up a kingdom destroying all others applied to Messianic era in Talmud") },
  94: { ...edersheim("Priest on His throne; Branch building the Temple applied to Messiah in Zechariah Targum") },
  96: { ...edersheim("Feet on Mount of Olives applied to Messianic advent in Targum on Zechariah 14") },
  97: { ...edersheim("Cut off from the living in full Messianic treatment of Isaiah 53") },
  98: { ...edersheim("Sons of the living God applied to Messianic restoration of Israel in Midrash") },
  175: { ...payne(2, "Gen 22:18", "Through Abraham's seed all nations blessed; Payne points to the singular 'seed' as anticipating Gal 3:16") },
  183: { ...payne(15, "Ps 34:20", "Not one bone broken; Payne connects this to the Passover lamb's bones (Exod 12:46) as a dual fulfillment") },
  192: { ...payne(78, "Hos 6:2", "Revival after two days and raising on the third day; Payne treats this as a prophetic pattern directly fulfilled in Christ's resurrection — listed as #78 in his 191 messianic prophecies"), ...edersheim("Hos. vi. 2 is Messianically applied in the Targum — explicitly confirmed in Appendix IX of The Life and Times of Jesus the Messiah") },
  194: { ...payne(20, "Psalm 118:22–26", "Payne's #20 covers the Psalm 118 cornerstone passage; verse 24 ('This is the day the LORD has made') is part of that same psalm cluster applied messianically") },
  195: { ...payne(30, "Isaiah 42:1–4", "Payne #30 identifies Isaiah 42:1–4 as messianic; Matthew 12:18–21 quotes the full passage including verse 3 as fulfilled in Jesus's gentle ministry") },
  196: { ...payne(97, "Zechariah 9:10", "Payne #97 identifies Zechariah 9:10 as messianic, describing the universal peace and dominion of the coming King") },
  197: { ...payne(64, "Isaiah 52:15", "Payne #64 identifies Isaiah 52:15 as messianic; Paul quotes it in Romans 15:21 regarding the gospel going to those who had not heard") },
  45: { scholarlyStrength: 'Strong', scholarsWhoList: ['Payne', 'Edersheim', 'McDowell'], scholarNote: "Messianic shepherd-ruler prophecy strongly attested across all three scholars. Closely tied to the Bethlehem context of Micah 5:2.", ntUsage: "John 10:11" },
  61: { scholarlyStrength: 'Strong', scholarsWhoList: ['Payne', 'Edersheim', 'McDowell'], scholarNote: "Recognized messianic healing imagery across all three scholars. The title 'Sun of Righteousness' is a formal messianic designation.", ntUsage: null },
  65: { scholarlyStrength: 'Typology', scholarsWhoList: ['McDowell'], scholarNote: "Jesus explicitly invokes this as a type of his own lifting up in John 3:14. McDowell lists it; Payne and Edersheim do not treat it as formal prophecy.", ntUsage: "John 3:14" },
  67: { scholarlyStrength: 'Strong', scholarsWhoList: ['Payne', 'Edersheim', 'McDowell'], scholarNote: "Core Davidic covenant prophecy foundational to all messianic expectation. Universally listed by all three scholars.", ntUsage: "Luke 1:32-33; Acts 2:30" },
  69: { scholarlyStrength: 'Applied Psalm', scholarsWhoList: [], scholarNote: "Applied messianically by Jesus in Matthew 21:16 but not a predictive prophecy. Represents apostolic interpretation of a Psalm rather than a formal Messianic prophecy. Retained for NT theological completeness.", ntUsage: "Matthew 21:16" },
  77: { scholarlyStrength: 'Applied Psalm', scholarsWhoList: [], scholarNote: "Applied to Judas in Acts 1:20 but not listed as a formal Messianic prophecy by Payne, Edersheim, or McDowell. Represents apostolic typological use of a Psalm rather than predictive prophecy.", ntUsage: "Acts 1:20" },
  90: { scholarlyStrength: 'NT Application', scholarsWhoList: ['Edersheim', 'McDowell'], scholarNote: "Messianic era prophecy cited by Peter at Pentecost (Acts 2:17). Listed by Edersheim and McDowell; Payne does not formally include it.", ntUsage: "Acts 2:17-18" },
  91: { scholarlyStrength: 'Typology', scholarsWhoList: ['McDowell'], scholarNote: "Treated as Christological type by McDowell and by Jesus himself in Matthew 12:40. Not a direct predictive prophecy but a recognized messianic type.", ntUsage: "Matthew 12:40" },
  92: { scholarlyStrength: 'Strong', scholarsWhoList: ['Payne', 'Edersheim', 'McDowell'], scholarNote: "Strong messianic restoration prophecy appearing in all three major scholarly lists. Cited in Acts 15:16–17 at the Jerusalem Council.", ntUsage: "Acts 15:16-17" },
  93: { scholarlyStrength: 'Strong', scholarsWhoList: ['Payne', 'Edersheim', 'McDowell'], scholarNote: "Direct messianic title 'the Branch' is a recognized prophetic designation for the Messiah across all three scholars.", ntUsage: null },
  95: { scholarlyStrength: 'Strong', scholarsWhoList: ['Payne', 'Edersheim', 'McDowell'], scholarNote: "Fulfilled in John the Baptist as forerunner of the Messiah. All three scholars list this as a formal messianic prophecy.", ntUsage: "Matthew 11:14; Luke 1:17" },
  193: { scholarlyStrength: 'NT Application', scholarsWhoList: ['Edersheim', 'McDowell'], scholarNote: "Suffering Messiah theme recognized by Edersheim and McDowell. Applied in NT passion narrative but not listed formally by Payne.", ntUsage: "Romans 15:3; John 15:25" },
  198: { scholarlyStrength: 'NT Application', scholarsWhoList: ['Edersheim', 'McDowell'], scholarNote: "Matthew applies this typologically to Jesus' return from Egypt. Edersheim and McDowell treat it as fulfillment; Payne does not list it.", ntUsage: "Matthew 2:15" },
  199: { scholarlyStrength: 'Strong', scholarsWhoList: ['Payne', 'Edersheim'], scholarNote: "Classic Messianic kingdom prophecy referenced by Payne and Edersheim. Describes the righteous judgment of the Messianic ruler, fulfilled eschatologically in Revelation 19:15.", ntUsage: "Revelation 19:15" },
  200: { scholarlyStrength: 'Strong', scholarsWhoList: ['Payne', 'Edersheim'], scholarNote: "Messianic kingdom prophecy describing the universal reign of the Lord. Referenced by Payne and Edersheim. Fulfilled in the proclamation of Christ's kingdom in Revelation 11:15.", ntUsage: "Revelation 11:15" },

};

// === NEW COMING-SOON LESSONS (Edersheim) ===

prophecies.push(makeLesson(99, "gentiles-welcomed", "Gentiles Welcomed", "Kingdom",
  "Genesis 9:27", "Ephesians 2:13", "May God extend Japheth's territory; may Japheth live in the tents of Shem, and may Canaan be the slave of Japheth.", "But now in Christ Jesus you who once were far away have been brought near by the blood of Christ.", "Noah's prophecy that Japheth would dwell in Shem's tents foreshadowed Gentiles sharing in Israel's blessings. Paul declares that those once far away have been brought near through Christ's blood.",
  undefined,
  { ...edersheim("Japheth dwelling in Shem tents — Gentile inclusion in Messianic age (Targum Pseudo-Jon.)") }));

prophecies.push(makeLesson(100, "hidden-manna-revealed", "Hidden Manna Revealed", "Kingdom",
  "Exodus 16:33", "Revelation 2:17", "He said to Aaron, \"Take a jar and put an omer of manna in it. Then place it before the LORD to be kept for the generations to come.\"", "Whoever has ears, let them hear what the Spirit says to the churches. To the one who is victorious, I will give some of the hidden manna.", "The manna preserved in the ark pointed to Christ, the true bread from heaven. Jesus promises hidden manna to those who overcome — sustenance the world cannot see or take away.",
  undefined,
  { ...edersheim("Preserved manna to be revealed by Messiah in Mechilta") }));

prophecies.push(makeLesson(101, "spirit-without-measure", "Spirit Without Measure", "Identity",
  "Numbers 11:17", "John 3:34", "I will come down and speak with you there, and I will take some of the power of the Spirit that is on you and put that Spirit on them.", "For the one whom God has sent speaks the words of God, for God gives the Spirit without limit.", "God gave the Spirit to Moses' seventy elders in measured portions — taking from the Spirit on Moses and distributing it among them. But Jesus received the Spirit without any such limit. John declares that God gives the Spirit to His Son without measure, setting Him apart from every prophet and leader who came before.",
  undefined,
  { ...edersheim("Spirit of God — His Spirit worth all others combined; Messianic application") }));

prophecies.push(makeLesson(102, "the-firstborn-glory", "The Firstborn Glory", "Identity",
  "Deuteronomy 33:17", "Revelation 5:5", "In majesty he is like a firstborn bull; his horns are the horns of a wild ox. With them he will gore the nations, even those at the ends of the earth.", "Then one of the elders said to me, \"Do not weep! See, the Lion of the tribe of Judah, the Root of David, has triumphed.\"", "Moses blessed Joseph's descendants with imagery of unstoppable strength. Revelation reveals the ultimate firstborn: Christ, the Lion of Judah, who has triumphed over every power.",
  undefined,
  { ...edersheim("Tanchuma applies beauty of firstling bullock to the Messiah") }));

prophecies.push(makeLesson(103, "son-of-pharez", "Son of Pharez", "Lineage",
  "Ruth 4:18", "Matthew 1:3", "This, then, is the family line of Perez: Perez was the father of Hezron.", "Judah the father of Perez and Zerah, whose mother was Tamar, Perez the father of Hezron.", "Ruth's genealogy traces the line from Perez to David, and Matthew picks up exactly where Ruth left off — all the way to Jesus. The Savior's family tree is full of grace.",
  undefined,
  { ...edersheim("Messiah called Son of Pharez — restorer of six lost blessings (Ber. R. 12)") }));

prophecies.push(makeLesson(104, "horn-of-salvation", "Horn of Salvation", "Lineage",
  "1 Samuel 2:10", "Luke 1:69", "He will give strength to his king and exalt the horn of his anointed.", "He has raised up a horn of salvation for us in the house of his servant David.", "Hannah prophesied about a coming king whose power would be exalted by God. Zechariah declared that God had raised up that horn of salvation in the house of David.",
  undefined,
  { ...edersheim("Horn of anointed exalted — Targum and Midrashim apply to Messiah") }));

prophecies.push(makeLesson(105, "the-humble-exalted", "The Humble Exalted", "Ministry",
  "2 Samuel 22:28", "Luke 1:52", "You save the humble, but your eyes are on the haughty to bring them low.", "He has brought down rulers from their thrones but has lifted up the humble.", "David praised God for saving the humble and humbling the proud. Mary echoed the same theme — God brings down the powerful and lifts up the lowly.",
  undefined,
  { ...edersheim("Talmud (Sanh. 98a) — humbling the haughty in Messianic days") }));

prophecies.push(makeLesson(106, "david-final-vision", "David Final Vision", "Lineage",
  "2 Samuel 23:1", "Luke 1:32", "These are the last words of David: \"The inspired utterance of David son of Jesse, the utterance of the man exalted by the Most High.\"", "He will be great and will be called the Son of the Most High. The Lord God will give him the throne of his father David.", "David's last words spoke of being exalted by the Most High. Gabriel told Mary her son would be called the Son of the Most High and receive David's throne.",
  undefined,
  { ...edersheim("Targum applies David last words to Messianic prophecy") }));

prophecies.push(makeLesson(107, "the-righteous-ruler", "The Righteous Ruler", "Kingdom",
  "2 Samuel 23:3", "John 5:28", "He said concerning the God of Israel, the Rock of Israel spoke to me: \"He who rules over people must be just, ruling in the fear of God.\"", "Do not be amazed at this, for a time is coming when all who are in their graves will hear his voice and come out.", "David spoke of a coming righteous ruler appointed by God. Jesus declared He would exercise the ultimate act of righteous rule — calling the dead from their graves.",
  undefined,
  { ...edersheim("Ruling in fear of God — Targum applies to Messiah raising the dead") }));

prophecies.push(makeLesson(108, "rod-of-iron", "Rod of Iron", "Kingdom",
  "Psalm 2:9", "Revelation 2:27", "You will break them with a rod of iron; you will dash them to pieces like pottery.", "To the one who is victorious and does my will to the end, I will give authority over the nations — that one will rule them with an iron scepter.", "Psalm 2 describes the Messiah ruling the nations with an iron rod, shattering all opposition. Jesus promises to share this authority with those who overcome.",
  undefined,
  { ...edersheim("Nations as iron-shattered inheritance applied to Messiah in Ber. R. 44") }));

prophecies.push(makeLesson(109, "works-prove-his-mission", "Works Prove His Mission", "Ministry",
  "Psalm 18:31", "John 10:38", "For who is God besides the LORD? And who is the Rock except our God? It is God who arms me with strength and keeps my way secure.", "Do not believe me unless I do the works of my Father. But if I do them, even though you do not believe me, believe the works.", "David proclaimed that God alone arms His servant with strength and validates His works. Jesus pointed to His own works as proof of His divine mission.",
  undefined,
  { ...edersheim("Targum applies God works and miracles to the Messiah") }));

prophecies.push(makeLesson(110, "his-anointed", "His Anointed", "Lineage",
  "Psalm 18:50", "Matthew 1:1", "He gives his king great victories; he shows unfailing love to his anointed, to David and to his descendants forever.", "This is the genealogy of Jesus the Messiah the son of David, the son of Abraham.", "God promised unfailing love to His anointed and David's descendants forever. Matthew opens by identifying Jesus as the Messiah, son of David — the ultimate recipient of that promise.",
  undefined,
  { ...edersheim("Great deliverance to His king — Jer. Talmud applies to Messiah") }));

prophecies.push(makeLesson(111, "crowned-with-gold", "Crowned with Gold", "Kingdom",
  "Psalm 21:3", "Revelation 19:12", "You have welcomed him with rich blessings and placed a crown of pure gold on his head.", "On his head are many crowns. He has a name written on him that no one knows but he himself.", "The psalmist celebrated a king crowned with pure gold. Revelation reveals Christ wearing many crowns — sovereign over every kingdom, authority, and power.",
  undefined,
  { ...edersheim("Crown of pure gold and length of days applied to King Messiah in Midrash") }));

prophecies.push(makeLesson(112, "fairer-than-the-sons-of-men", "Fairer Than the Sons of Men", "Identity",
  "Psalm 45:2", "Luke 4:22", "You are the most excellent of men and your lips have been anointed with grace, since God has forever blessed you.", "All spoke well of him and were amazed at the gracious words that came from his lips.", "Psalm 45 praises the king as most excellent, anointed with grace. Hebrews applies this directly to Jesus — the Son whose throne is eternal and whose kingdom is ruled by justice.",
  undefined,
  { ...edersheim("Targum: Thy beauty O King Messiah surpasses that of human children") }));

prophecies.push(makeLesson(113, "tribes-of-the-redeemed", "Tribes of the Redeemed", "Kingdom",
  "Psalm 60:7", "Revelation 7:4", "Gilead is mine, Manasseh is mine; Ephraim is my helmet, Judah is my scepter.", "Then I heard the number of those who were sealed: 144,000 from all the tribes of Israel.", "God claimed every tribe of Israel as His own. Revelation shows the sealed remnant from all twelve tribes, united under the Lamb.",
  undefined,
  { ...edersheim("Gilead and Ephraim — Messianic discussion in Bemidbar R. 14") }));

prophecies.push(makeLesson(114, "days-without-end", "Days Without End", "Kingdom",
  "Psalm 61:6", "Revelation 11:15", "Increase the days of the king's life, his years for many generations.", "The kingdom of the world has become the kingdom of our Lord and of his Messiah, and he will reign for ever and ever.", "The psalmist prayed for the king's reign to last generations. In Christ, that prayer is answered beyond imagination — He reigns forever and ever.",
  undefined,
  { ...edersheim("Days added to the King — Targum applies to eternal Messianic reign") }));

prophecies.push(makeLesson(115, "sun-and-moon-endure", "Sun and Moon Endure", "Kingdom",
  "Psalm 72:5", "Luke 1:33", "May he endure as long as the sun, as long as the moon, through all generations.", "He will reign over Jacob's descendants forever; his kingdom will never end.", "Psalm 72 prays for a king who rules with God's own justice — a reign enduring as long as the sun. Gabriel told Mary her son would reign over Jacob's descendants forever.",
  undefined,
  { ...edersheim("Entire Psalm 72 viewed as Messianic in Yalkut and ancient Synagogue commentary") }));

prophecies.push(makeLesson(116, "sorrow-repaid-with-joy", "Sorrow Repaid with Joy", "Kingdom",
  "Psalm 90:15", "Revelation 21:4", "Make us glad for as many days as you have afflicted us, for as many years as we have seen trouble.", "He will wipe every tear from their eyes. There will be no more death or mourning or crying or pain, for the old order of things has passed away.", "Moses prayed that God would repay suffering with equal joy. Revelation promises the total elimination of sorrow. In Christ, every affliction is answered with eternal gladness.",
  undefined,
  { ...edersheim("Days of affliction repaid in Messianic days — Midrash on Ps 90") }));

prophecies.push(makeLesson(117, "enemies-made-a-footstool", "Enemies Made a Footstool", "Kingdom",
  "Psalm 110:1", "Hebrews 1:13", "The LORD says to my lord: 'Sit at my right hand until I make your enemies a footstool for your feet.'", "Sit at my right hand until I make your enemies a footstool for your feet.", "David heard God address his Lord: 'Sit at my right hand until I make your enemies a footstool.' Hebrews applies this directly to Christ — the risen King enthroned at God's right hand while His enemies are subdued beneath Him.",
  undefined,
  { ...edersheim("Verses 8, 11, 13 Messianically interpreted in Pirque de R. El.") }));

prophecies.push(makeLesson(118, "today", "Today", "Ministry",
  "Psalm 95:7", "Hebrews 3:15", "Today, if only you would hear his voice, do not harden your hearts as you did at Meribah.", "But encourage one another daily, as long as it is called \"Today,\" so that none of you may be hardened by sin's deceitfulness.", "The psalmist urged Israel not to harden their hearts when God speaks. Hebrews applies this urgency to every generation — today is always the day to respond to Christ.",
  undefined,
  { ...edersheim("Today if you hear His voice — applied to Messiah coming in Shem. R. 25") }));

prophecies.push(makeLesson(119, "zion-rebuilt", "Zion Rebuilt", "Kingdom",
  "Psalm 102:16", "Revelation 21:2", "The LORD will rebuild Zion and appear in his glory.", "I saw the Holy City, the new Jerusalem, coming down out of heaven from God, prepared as a bride beautifully dressed for her husband.", "The psalmist foresaw God rebuilding Zion and appearing in glory. Revelation shows the ultimate fulfillment — the new Jerusalem descending from heaven, God's dwelling place with His people forever.",
  undefined,
  { ...edersheim("Bereshith R. 56 applies to Messianic times — LORD rebuilds Zion") }));

prophecies.push(makeLesson(120, "he-remembered-his-people", "He Remembered His People", "Resurrection",
  "Psalm 106:44", "Luke 1:54", "Yet he took note of their distress when he heard their cry; for their sake he remembered his covenant and out of his great love he relented.", "He has helped his servant Israel, remembering to be merciful to Abraham and his descendants forever, just as he promised our ancestors.", "The psalmist recalled how God remembered His covenant in Israel's darkest hours. Mary's song declares that God has done it again — remembering mercy, helping Israel, fulfilling His ancient promises through Jesus.",
  undefined,
  { ...edersheim("Long Messianic discussion on God faithfulness in Midrash") }));

prophecies.push(makeLesson(121, "mouths-filled-with-laughter", "Mouths Filled with Laughter", "Resurrection",
  "Psalm 126:2", "John 16:22", "When the LORD restored the fortunes of Zion, we were like those who dreamed. Our mouths were filled with laughter, our tongues with songs of joy.", "So with you: Now is your time of grief, but I will see you again and you will rejoice, and no one will take away your joy.", "The psalmist celebrated the overwhelming joy of restoration after exile. Jesus promises His followers the same pattern — present grief will give way to a joy that no one can take away.",
  undefined,
  { ...edersheim("Applied to Messianic joy — laughter among the nations") }));

prophecies.push(makeLesson(122, "purified-for-judgment", "Purified for Judgment", "Kingdom",
  "Isaiah 1:25", "Matthew 25:31", "I will turn my hand against you; I will thoroughly purge away your dross and remove all your impurities.", "When the Son of Man comes in his glory, and all the angels with him, he will sit on his glorious throne.", "Isaiah prophesied God purifying His people by removing all dross. Jesus revealed that He would come in glory to separate and purify — the final judgment that removes every impurity from God's kingdom.",
  undefined,
  { ...edersheim("Talmud (Sanh. 98a): Son of David comes after purging of judges") }));

prophecies.push(makeLesson(123, "true-vine-true-branch", "True Vine, True Branch", "Ministry",
  "Isaiah 4:2", "John 15:1", "In that day the Branch of the LORD will be beautiful and glorious, and the fruit of the land will be the pride and glory of the survivors in Israel.", "I am the true vine, and my Father is the gardener.", "Isaiah foresaw a glorious Branch springing from the LORD. Jesus declared Himself the true vine — the living source of fruitfulness. Every branch that remains in Him bears the fruit Isaiah described.",
  undefined,
  { ...edersheim("Targum: Branch of the LORD applied to Messianic times") }));

prophecies.push(makeLesson(124, "the-holy-remnant", "The Holy Remnant", "Kingdom",
  "Isaiah 6:13", "Romans 11:5", "And though a tenth remains in the land, it will again be laid waste. But as the terebinth and oak leave stumps when they are cut down, so the holy seed will be the stump in the land.", "So too, at the present time there is a remnant chosen by grace.", "Isaiah saw that even after devastating judgment, a holy seed — a stump — would remain. Paul identifies this as the remnant chosen by grace, preserved through Christ. God's people are never fully cut off.",
  undefined,
  { ...edersheim("Talmud (Keth. 112b) applies holy seed/stump to Messianic times") }));

prophecies.push(makeLesson(125, "stone-of-stumbling", "Stone of Stumbling", "Rejection",
  "Isaiah 8:14", "1 Peter 2:8", "He will be a holy place; for both Israel and Judah he will be a stone that causes people to stumble and a rock that makes them fall.", "and, \"A stone that causes people to stumble and a rock that makes them fall.\" They stumble because they disobey the message — which is also what they were destined for.", "Isaiah warned that God Himself would become a stumbling stone. Peter applies this directly to Christ — those who refuse to believe find Him an obstacle, while those who trust find Him the cornerstone.",
  undefined,
  { ...edersheim("Talmud (Sanh. 38a) applies stone of stumbling Messianically"), ...mcdowell(28, "Stone of Stumbling to Jews", "Targum Isaiah on 8:13-15 cited verbatim; Sanh. 38a Messianic application") }));

prophecies.push(makeLesson(126, "the-lord-reigns", "The LORD Reigns", "Kingdom",
  "Isaiah 24:23", "Revelation 5:13", "The moon will be dismayed, the sun ashamed; for the LORD Almighty will reign on Mount Zion and in Jerusalem, and before its elders — with great glory.", "Then I heard every creature in heaven and on earth and under the earth and on the sea, and all that is in them, saying: \"To him who sits on the throne and to the Lamb be praise and honor and glory and power, for ever and ever!\"", "Isaiah foresaw the LORD reigning in glory that outshines the sun and moon. Revelation fulfills this with every creature praising the Lamb on the throne — Christ's glory eclipses all creation.",
  undefined,
  { ...edersheim("Bemidbar R. — LORD of hosts reigns on Mount Zion in Messianic era") }));

prophecies.push(makeLesson(127, "crown-of-glory", "Crown of Glory", "Kingdom",
  "Isaiah 28:5", "1 Peter 5:4", "In that day the LORD Almighty will be a glorious crown, a beautiful wreath for the remnant of his people.", "And when the Chief Shepherd appears, you will receive the crown of glory that will never fade away.", "Isaiah promised that God Himself would be a crown of glory to His remnant. Peter connects this to Christ — the Chief Shepherd who bestows an unfading crown of glory on His faithful ones.",
  undefined,
  { ...edersheim("Targum: Messiah of the LORD of hosts will be a crown of glory") }));

prophecies.push(makeLesson(128, "spirit-on-the-waste-places", "Spirit on the Waste Places", "Kingdom",
  "Isaiah 32:15", "Acts 2:17", "till the Spirit is poured on us from on high, and the desert becomes a fertile field, and the fertile field seems like a forest.", "In the last days, God says, I will pour out my Spirit on all people. Your sons and daughters will prophesy, your young men will see visions, your old men will dream dreams.", "Isaiah foresaw God's Spirit transforming desolation into abundance. At Pentecost, Peter declared this outpouring fulfilled — the Spirit poured on all people, turning spiritual deserts into flourishing life through Christ.",
  undefined,
  { ...edersheim("Midrash of Lamentations: Spirit poured out in Messianic days") }));

prophecies.push(makeLesson(129, "comfort-has-come", "Comfort Has Come", "Ministry",
  "Isaiah 40:1", "Luke 2:25", "Comfort, comfort my people, says your God. Speak tenderly to Jerusalem, and proclaim to her that her hard service has been completed.", "Now there was a man in Jerusalem called Simeon, who was righteous and devout. He was waiting for the consolation of Israel, and the Holy Spirit was on him.", "Isaiah announced that comfort was coming to God's people. Simeon waited his whole life for this consolation — and held it in his arms when he held the infant Jesus. The comfort Isaiah promised has a name.",
  undefined,
  { ...edersheim("Comfort ye — applied to Messianic comfort in Rabbinic sources") }));

prophecies.push(makeLesson(130, "the-acceptable-time", "The Acceptable Time", "Ministry",
  "Isaiah 49:8", "2 Corinthians 6:2", "This is what the LORD says: \"In the time of my favor I will answer you, and in the day of salvation I will help you.\"", "For he says, \"In the time of my favor I heard you, and in the day of salvation I helped you.\" I tell you, now is the time of God's favor, now is the day of salvation.", "Isaiah prophesied a future day of salvation. Paul declares that day is now — through Christ, the acceptable time has arrived. God's favor is not a distant hope but a present reality for all who believe.",
  undefined,
  { ...edersheim("Yalkut: Messiah suffering — in a time of favor I answered you") }));

prophecies.push(makeLesson(131, "free-the-captives", "Free the Captives", "Ministry",
  "Isaiah 49:9", "Luke 4:18", "to say to the captives, \"Come out,\" and to those in darkness, \"Be free!\"", "He has sent me to proclaim freedom for the prisoners and recovery of sight for the blind, to set the oppressed free.", "Isaiah foresaw a deliverer who would call captives out of darkness into freedom. Jesus read these words in the Nazareth synagogue and declared them fulfilled in Himself — He is the liberator Isaiah promised.",
  undefined,
  { ...edersheim("Yalkut (vol ii 52b) quotes this as the words of the Messiah to prisoners") }));

prophecies.push(makeLesson(132, "redeemed-without-money", "Redeemed Without Money", "Passion",
  "Isaiah 52:3", "1 Peter 1:18", "For this is what the LORD says: \"You were sold for nothing, and without money you will be redeemed.\"", "For you know that it was not with perishable things such as silver or gold that you were redeemed from the empty way of life handed down to you from your ancestors, but with the precious blood of Christ.", "Isaiah declared that God's people would be redeemed without money. Peter reveals the currency of that redemption — not silver or gold but the precious blood of Christ. Our freedom was purchased at infinite cost.",
  undefined,
  { ...edersheim("Talmud (Sanh. 97b) — redeemed without price applied to Messiah") }));

prophecies.push(makeLesson(133, "other-sheep-i-have", "Other Sheep I Have", "Ministry",
  "Isaiah 54:2", "John 10:16", "Enlarge the place of your tent, stretch your tent curtains wide, do not hold back; lengthen your cords, strengthen your stakes.", "I have other sheep that are not of this sheep pen. I must bring them also. They too will listen to my voice, and there shall be one flock and one shepherd.", "Isaiah called Israel to expand her tent for the multitudes coming in. Jesus declared He has other sheep beyond Israel's fold — all would become one flock under one shepherd. The tent stretches to cover the world.",
  undefined,
  { ...edersheim("Vayyikra R. 10 — tent enlarged in Messianic times") }));

prophecies.push(makeLesson(134, "the-bride-husband", "The Bride Husband", "Kingdom",
  "Isaiah 54:5", "Revelation 21:9", "For your Maker is your husband — the LORD Almighty is his name — the Holy One of Israel is your Redeemer; he is called the God of all the earth.", "One of the seven angels who had the seven bowls full of the seven last plagues came and said to me, \"Come, I will show you the bride, the wife of the Lamb.\"", "Isaiah identified God as the husband of His people. Revelation reveals the Lamb's bride — the church, united with Christ forever. The marriage metaphor that began in Isaiah finds its ultimate wedding feast in glory.",
  undefined,
  { ...edersheim("Shemoth R. 15 — God as husband expressly applied to Messianic days") }));

prophecies.push(makeLesson(135, "jeweled-foundations", "Jeweled Foundations", "Kingdom",
  "Isaiah 54:11", "Revelation 21:19", "Afflicted city, lashed by storms and not comforted, I will rebuild you with stones of turquoise, your foundations with lapis lazuli.", "The foundations of the city walls were decorated with every kind of precious stone.", "Isaiah promised that God would rebuild His afflicted city with precious stones. Revelation describes the new Jerusalem with foundations of every precious stone — the afflicted city has become the eternal city of God.",
  undefined,
  { ...edersheim("Shemoth R. 15 — jeweled foundations in Messianic glory") }));

prophecies.push(makeLesson(136, "i-am-the-light", "I Am the Light", "Ministry",
  "Isaiah 60:1", "John 8:12", "Arise, shine, for your light has come, and the glory of the LORD rises upon you.", "When Jesus spoke again to the people, he said, \"I am the light of the world. Whoever follows me will never walk in darkness, but will have the light of life.\"", "Isaiah called God's people to rise because their light had come. Jesus declared Himself that light — the glory of the LORD in human form. Those who follow Him walk in the light Isaiah anticipated.",
  undefined,
  { ...edersheim("Targum and Ber. R. — arise shine applied to Messiah bringing light") }));

prophecies.push(makeLesson(137, "garments-of-vengeance", "Garments of Vengeance", "Kingdom",
  "Isaiah 59:17", "Revelation 19:13", "He put on righteousness as his breastplate, and the helmet of salvation on his head; he put on the garments of vengeance and wrapped himself in zeal as in a cloak.", "He is dressed in a robe dipped in blood, and his name is the Word of God.", "Isaiah described God clothing Himself in righteousness and vengeance. Revelation shows Christ robed in blood-dipped garments — the Word of God who fights for justice and defeats every enemy.",
  undefined,
  { ...edersheim("Applied to Messiah coming after destruction of Gentiles in Midrash") }));

prophecies.push(makeLesson(138, "what-no-eye-has-seen", "What No Eye Has Seen", "Kingdom",
  "Isaiah 64:4", "1 Corinthians 2:9", "Since ancient times no one has heard, no ear has perceived, no eye has seen any God besides you, who acts on behalf of those who wait for him.", "However, as it is written: \"What no eye has seen, what no ear has heard, and what no human mind has conceived\" — the things God has prepared for those who love him.", "Isaiah marveled that no eye has seen what God prepares for His people. Paul quotes this to describe the surpassing glory that awaits believers in Christ — beyond imagination, beyond comprehension.",
  undefined,
  { ...edersheim("Yalkut on Isa 60 — things prepared for the righteous in Messianic era") }));

prophecies.push(makeLesson(139, "new-heavens-new-earth", "New Heavens New Earth", "Kingdom",
  "Isaiah 65:17", "Revelation 21:1", "See, I will create new heavens and a new earth. The former things will not be remembered, nor will they come to mind.", "Then I saw \"a new heaven and a new earth,\" for the first heaven and the first earth had passed away, and there was no longer any sea.", "Isaiah prophesied new heavens and a new earth where former sorrows vanish. Revelation shows John seeing this vision fulfilled — the old creation passes away, and everything is made new through Christ.",
  undefined,
  { ...edersheim("Midrash on Lamentations — new heavens and earth in Messianic times") }));

prophecies.push(makeLesson(140, "born-before-the-pain", "Born Before the Pain", "Identity",
  "Isaiah 66:7", "Revelation 12:5", "Before she goes into labor, she gives birth; before the pains come upon her, she delivers a son.", "She gave birth to a son, a male child, who will rule all the nations with an iron scepter. And her child was snatched up to God and to his throne.", "Isaiah prophesied a miraculous birth — a son delivered before labor pains. Revelation identifies this child as the one who rules all nations, snatched to God's throne. The Messiah's birth defied natural order.",
  undefined,
  { ...edersheim("Vayyikra R. 14 — child born before Zion travails; Messiah before oppressor") }));

prophecies.push(makeLesson(141, "the-throne-in-jerusalem", "The Throne in Jerusalem", "Kingdom",
  "Jeremiah 3:17", "Revelation 22:3", "At that time they will call Jerusalem The Throne of the LORD, and all nations will gather in Jerusalem to honor the name of the LORD.", "The throne of God and of the Lamb will be in the city, and his servants will serve him.", "Jeremiah foresaw Jerusalem becoming the throne of the LORD where all nations gather. Revelation fulfills this — God and the Lamb share the throne in the eternal city, and His servants worship Him forever.",
  undefined,
  { ...edersheim("Yalkut on Josh 3:9 — Jerusalem throne of God in Messianic days") }));

prophecies.push(makeLesson(142, "he-who-draws-near", "He Who Draws Near", "Identity",
  "Jeremiah 30:21", "Hebrews 7:25", "Their leader will be one of their own; their ruler will arise from among them. I will bring him near and he will come close to me — for who is he who will devote himself to be close to me?", "Therefore he is able to save completely those who come to God through him, because he always lives to intercede for them.", "Jeremiah foresaw a ruler arising from His own people who draws near to God. Hebrews reveals Christ as this mediator — one of us yet close to God, always living to intercede for those who come through Him.",
  undefined,
  { ...edersheim("Targum applies — Messiah as noble ruler who approaches God") }));

prophecies.push(makeLesson(143, "law-on-our-hearts", "Law on Our Hearts", "Kingdom",
  "Jeremiah 31:33", "Hebrews 8:10", "I will put my law in their minds and write it on their hearts. I will be their God, and they will be my people.", "This is the covenant I will establish with the people of Israel after that time, declares the Lord. I will put my laws in their minds and write them on their hearts.", "Jeremiah prophesied a new covenant with God's law written on hearts, not stone. Hebrews declares this fulfilled in Christ — the new covenant transforms believers from the inside out.",
  undefined,
  { ...edersheim("Law written on hearts — applied to Messianic covenant in Yalkut") }));

prophecies.push(makeLesson(144, "he-calls-his-own", "He Calls His Own", "Ministry",
  "Jeremiah 33:13", "John 10:3", "He will give a shout, like those who tread the grapes, against all who live on the earth. He will count them as his flock.", "He calls his own sheep by name and leads them out.", "Jeremiah spoke of God gathering His flock with authority. Jesus identifies Himself as the good shepherd who calls His own sheep by name. The cosmic shepherd knows each one personally.",
  undefined,
  { ...edersheim("Targum: people shall pass under the hands of the Messiah to be numbered") }));

prophecies.push(makeLesson(145, "times-of-restoration", "Times of Restoration", "Kingdom",
  "Ezekiel 16:55", "Acts 3:21", "When I bring back their captives — the captives of Sodom and her daughters, and the captives of Samaria and her daughters — then I will also bring back your captives along with them.", "Heaven must receive him until the time comes for God to restore everything, as he promised long ago through his holy prophets.", "Ezekiel foresaw a time of total restoration — even for the most unexpected peoples. Peter declared that Christ remains in heaven until the time of universal restoration that the prophets promised.",
  undefined,
  { ...edersheim("Ten things renewed in Messianic days including rebuilding ruins (Midrash)") }));

prophecies.push(makeLesson(146, "judgment-of-the-nations", "Judgment of the Nations", "Kingdom",
  "Ezekiel 25:14", "Revelation 19:14", "I will carry out great vengeance on them and punish them in my wrath. Then they will know that I am the LORD, when I take vengeance on them.", "The armies of heaven were following him, riding on white horses and dressed in fine linen, white and clean.", "Ezekiel foretold God's vengeance on the nations that opposed His people. Revelation shows Christ leading heaven's armies to execute that judgment — the final reckoning that vindicates God's justice.",
  undefined,
  { ...edersheim("Destruction of nations by Israel in Messianic days (Bemidbar R.)") }));

prophecies.push(makeLesson(147, "final-battle", "Final Battle", "Kingdom",
  "Ezekiel 39:2", "Revelation 20:8", "I will turn you around and drag you along. I will bring you from the far north and send you against the mountains of Israel.", "When the thousand years are over, Satan will be released from his prison and will go out to deceive the nations in the four corners of the earth — Gog and Magog.", "Ezekiel prophesied a final gathering of hostile nations against God's people. Revelation identifies this as the last battle — Gog and Magog deceived by Satan, ultimately destroyed by God's fire.",
  undefined,
  { ...edersheim("Bemidbar R. 13 — Messianic battle with Gog and Magog") }));

prophecies.push(makeLesson(148, "river-of-life", "River of Life", "Kingdom",
  "Ezekiel 47:9", "Revelation 22:2", "Swarms of living creatures will live wherever the river flows. There will be large numbers of fish, because this water flows there and makes the salt water fresh; so where the river flows everything will live.", "On each side of the river stood the tree of life, bearing twelve crops of fruit, yielding its fruit every month. And the leaves of the tree are for the healing of the nations.", "Ezekiel saw a river flowing from the temple, bringing life wherever it flowed. Revelation shows this river in the new Jerusalem — the river of life with the tree of life healing the nations. What Ezekiel glimpsed, Christ fulfills.",
  undefined,
  { ...edersheim("Shem. R. 15 — living waters and healing trees in Messianic era") }));

prophecies.push(makeLesson(149, "two-thrones", "Two Thrones", "Kingdom",
  "Daniel 7:9", "Revelation 3:21", "As I looked, thrones were set in place, and the Ancient of Days took his seat. His clothing was as white as snow; the hair of his head was white like wool.", "To the one who is victorious, I will give the right to sit with me on my throne, just as I was victorious and sat down with my Father on his throne.", "Daniel saw thrones set in place before the Ancient of Days. Jesus promises to share His throne with those who overcome — the heavenly enthronement Daniel witnessed includes a seat for every faithful believer.",
  undefined,
  { ...edersheim("R. Akiba — two thrones: one for God, one for Messiah (Talmud Hag. 14a)") }));

prophecies.push(makeLesson(150, "seventy-weeks", "Seventy Weeks", "Kingdom",
  "Daniel 9:24", "Luke 21:24", "Seventy 'sevens' are decreed for your people and your holy city to finish transgression, to put an end to sin, to atone for wickedness, to bring in everlasting righteousness.", "They will fall by the sword and will be taken as prisoners to all the nations. Jerusalem will be trampled on by the Gentiles until the times of the Gentiles are fulfilled.", "Daniel received God's precise timeline for finishing transgression and bringing everlasting righteousness. Jesus pointed to Jerusalem's fate as part of this prophetic clock — the times of the Gentiles marking the countdown to His return.",
  undefined,
  { ...edersheim("Naz. 32b — seventy weeks until second Temple destroyed; Messianic timing") }));

prophecies.push(makeLesson(151, "great-tribulation", "Great Tribulation", "Kingdom",
  "Daniel 12:1", "Matthew 24:21", "At that time Michael, the great prince who protects your people, will arise. There will be a time of distress such as has not happened from the beginning of nations until then.", "For then there will be great distress, unequaled from the beginning of the world until now — and never to be equaled again.", "Daniel prophesied unprecedented tribulation. Jesus confirmed it — great distress unequaled in history. Both passages point to the same climactic period before God's kingdom is fully established.",
  undefined,
  { ...edersheim("Shem. R. 15 — time of trouble and deliverance applied to Messianic era") }));

prophecies.push(makeLesson(152, "scattered-children-gathered", "Scattered Children Gathered", "Kingdom",
  "Hosea 2:2", "John 11:52", "Say of your brothers, \"My people,\" and of your sisters, \"My loved one.\"", "He prophesied that Jesus would die for the Jewish nation, and not only for that nation but also for the scattered children of God, to bring them together and make them one.", "Hosea foresaw the day when the scattered would be called God's people again. John reveals that Jesus died to gather all of God's scattered children — Jew and Gentile — into one family.",
  undefined,
  { ...edersheim("Midr. on Ps 45:1 — Israel redemption when reunited under one head") }));

prophecies.push(makeLesson(153, "david-my-servant", "David My Servant", "Lineage",
  "Hosea 3:5", "Luke 1:32", "Afterward the Israelites will return and seek the LORD their God and David their king. They will come trembling to the LORD and to his blessings in the last days.", "He will be great and will be called the Son of the Most High. The Lord God will give him the throne of his father David.", "Hosea prophesied that Israel would seek David their king in the last days. Gabriel announced that Jesus would receive David's throne. The king Hosea foresaw is Christ — the ultimate David.",
  undefined,
  { ...edersheim("Targum — David raised up; Jer. Talmud derives Messiah name from David") }));

prophecies.push(makeLesson(154, "death-swallowed-up", "Death Swallowed Up", "Kingdom",
  "Hosea 13:14", "1 Corinthians 15:55", "I will deliver this people from the power of the grave; I will redeem them from death. Where, O death, are your plagues? Where, O grave, is your destruction?", "Where, O death, is your victory? Where, O death, is your sting?", "Hosea challenged death and the grave with God's redemptive power. Paul echoes these exact words in celebration of Christ's resurrection — death has lost its sting, the grave its victory, through Jesus.",
  undefined,
  { ...edersheim("Messiah delivers those of Israel in Gehinnom — sets free from death") }));

prophecies.push(makeLesson(155, "grain-falling-into-earth", "Grain Falling into Earth", "Kingdom",
  "Hosea 14:7", "John 12:24", "They will blossom like the vine; Israel's fame will be like the wine of Lebanon. His young shoots will grow.", "Very truly I tell you, unless a kernel of wheat falls to the ground and dies, it remains only a single seed. But if it dies, it produces many seeds.", "Hosea foresaw Israel flourishing like a vine with spreading shoots. Jesus used similar imagery — a grain must die to bear fruit. His death was the seed that produced the worldwide harvest Hosea envisioned.",
  undefined,
  { ...edersheim("Messianically applied in Targum — reviving like grain") }));

prophecies.push(makeLesson(156, "all-nations-gathered", "All Nations Gathered", "Kingdom",
  "Joel 3:2", "Matthew 25:32", "I will gather all nations and bring them down to the Valley of Jehoshaphat. There I will put them on trial for what they did to my inheritance, my people Israel.", "All the nations will be gathered before him, and he will separate the people one from another as a shepherd separates the sheep from the goats.", "Joel prophesied God gathering all nations for judgment. Jesus described this same scene — all nations gathered before Him for separation. The Judge of Joel's vision is Christ on His throne.",
  undefined,
  { ...edersheim("Midrashim apply valley of Jehoshaphat to Messianic judgment of nations") }));

prophecies.push(makeLesson(157, "four-craftsmen", "Four Craftsmen", "Kingdom",
  "Zechariah 1:20", "Revelation 7:4", "Then the LORD showed me four craftsmen. I asked, \"What are these coming to do?\" He answered, \"These are the horns that scattered Judah... but the craftsmen have come to terrify them.\"", "Then I heard the number of those who were sealed: 144,000 from all the tribes of Israel.", "Zechariah saw four craftsmen raised up to counter the powers that scattered God's people. Revelation shows 144,000 sealed from all tribes — God's complete answer to the scattering, gathering and protecting His own.",
  undefined,
  { ...edersheim("Four craftsmen applied to Messianic figures in Talmud (Sukk. 52b)") }));

prophecies.push(makeLesson(158, "god-dwells-among-us", "God Dwells Among Us", "Identity",
  "Zechariah 2:10", "John 1:14", "Shout and be glad, Daughter Zion. For I am coming, and I will live among you, declares the LORD.", "The Word became flesh and made his dwelling among us. We have seen his glory, the glory of the one and only Son, who came from the Father, full of grace and truth.", "Zechariah proclaimed that God Himself would come and dwell among His people. John declares this fulfilled — the Word became flesh and tabernacled among us. God's promise to live with us became real in Jesus.",
  undefined,
  { ...edersheim("Messianic passage — God dwelling among His people in Rabbinic sources") }));

prophecies.push(makeLesson(159, "greeks-seek-jesus", "Greeks Seek Jesus", "Ministry",
  "Zechariah 8:23", "John 12:20", "In those days ten people from all languages and nations will take firm hold of one Jew by the hem of his robe and say, \"Let us go with you, because we have heard that God is with you.\"", "Now there were some Greeks among those who went up to worship at the festival. They came to Philip with a request. \"Sir,\" they said, \"we would like to see Jesus.\"", "Zechariah foresaw Gentiles from every nation seeking God through a Jew. John records Greeks coming to see Jesus — the fulfillment begins. The nations grasp the hem of Christ's robe.",
  undefined,
  { ...edersheim("Ten Gentiles grasp Jewish garment — Messianic ingathering in Rabbinic sources") }));

prophecies.push(makeLesson(160, "chief-cornerstone", "Chief Cornerstone", "Identity",
  "Zechariah 10:4", "Ephesians 2:20", "From Judah will come the cornerstone, from him the tent peg, from him the battle bow, from him every ruler.", "built on the foundation of the apostles and prophets, with Christ Jesus himself as the chief cornerstone.", "Zechariah prophesied a cornerstone coming from Judah — the foundation of everything. Paul identifies Christ as the chief cornerstone on which the whole building of God's people rises.",
  undefined,
  { ...edersheim("Messianically applied in Targum — cornerstone, nail, battle bow") }));

prophecies.push(makeLesson(161, "they-shall-mourn", "They Shall Mourn", "Kingdom",
  "Zechariah 12:12", "Revelation 1:7", "The land will mourn, each clan by itself, with their wives by themselves: the clan of the house of David and their wives.", "Look, he is coming with the clouds, and every eye will see him, even those who pierced him; and all peoples on earth will mourn because of him.", "Zechariah foresaw mourning over the one who was pierced. Revelation declares that every eye will see Christ — including those who pierced Him — and all peoples will mourn. The crucified one returns as the reigning King.",
  undefined,
  { ...edersheim("Mourning for the pierced one — each family mourns separately (Talmud Sukk. 52a)") }));

prophecies.push(makeLesson(162, "lion-of-judah", "Lion of Judah", "Identity",
  "Genesis 49:8", "Revelation 5:5", "Judah, your brothers will praise you; your hand will be on the neck of your enemies; your father's sons will bow down to you. You are a lion's cub, Judah.", "Then one of the elders said to me, \"Do not weep! See, the Lion of the tribe of Judah, the Root of David, has triumphed. He is able to open the scroll and its seven seals.\"", "Jacob blessed Judah as a lion's cub whose brothers would bow before him. Revelation identifies Jesus as the Lion of the tribe of Judah — the one who has triumphed and alone is worthy to open God's sealed scroll.",
  undefined,
  { ...edersheim("Lion whelp applied to the Messiah in Yalkut 160; Targum Pseudo-Jon. applies to Messiah kingship") }));

prophecies.push(makeLesson(163, "nations-as-inheritance", "Nations as Inheritance", "Kingdom",
  "Psalm 2:8", "Revelation 2:27", "Ask me, and I will make the nations your inheritance, the ends of the earth your possession.", "To the one who is victorious and does my will to the end, I will give authority over the nations.", "The Father promised His Son the nations as inheritance. Revelation confirms that Christ shares this authority with those who overcome. The ends of the earth belong to Him, and He gives His followers a share in His reign.",
  undefined,
  { ...edersheim("Applied to Messiah receiving nations as inheritance in Ber. R. 44") }));

prophecies.push(makeLesson(164, "the-king-victory", "The King Victory", "Resurrection",
  "Psalm 21:1", "Matthew 28:18", "The king rejoices in your strength, LORD. How great is his joy in the victories you give!", "Then Jesus came to them and said, \"All authority in heaven and on earth has been given to me.\"", "The psalmist celebrated a king rejoicing in God-given victories. Jesus declared that all authority — in heaven and on earth — has been given to Him. The ultimate royal victory is Christ's.",
  undefined,
  { ...edersheim("Psalm 21 applied to the Messiah throughout by the Targum") }));

prophecies.push(makeLesson(165, "son-of-man-at-gods-right-hand", "Son of Man at God Right Hand", "Resurrection",
  "Psalm 80:17", "Mark 14:62", "Let your hand rest on the man at your right hand, the son of man you have raised up for yourself.", "And you will see the Son of Man sitting at the right hand of the Mighty One and coming on the clouds of heaven.", "The psalmist prayed for God's hand to rest on the son of man at His right hand. Jesus declared that He is that Son of Man — seated at the right hand of the Mighty One, coming on heaven's clouds.",
  undefined,
  { ...edersheim("Son of Man paraphrased by the Targum as King Messiah") }));

prophecies.push(makeLesson(166, "god-anointed-exalted", "God Anointed Exalted", "Resurrection",
  "Psalm 89:22", "Matthew 28:18", "No enemy will subject him to tribute; no wicked man will oppress him. I will crush his foes before him and strike down his adversaries.", "Then Jesus came to them and said, \"All authority in heaven and on earth has been given to me.\"", "God promised in Psalm 89 that no enemy would prevail against His anointed. Jesus received all authority in heaven and earth — every foe is crushed, every adversary struck down by God's exalted King.",
  undefined,
  { ...edersheim("Promise of God anointed applied to the Messiah in Yalkut on Isaiah 60") }));

prophecies.push(makeLesson(167, "desert-blooming", "Desert Blooming", "Ministry",
  "Isaiah 35:1", "Matthew 11:5", "The desert and the parched land will be glad; the wilderness will rejoice and blossom. Like the crocus, it will burst into bloom.", "Go back and report to John what you hear and see: The blind receive sight, the lame walk, those who have leprosy are cleansed, the deaf hear, the dead are raised.", "Isaiah prophesied the desert blooming and the weak being strengthened. Paul declared that all creation groans in anticipation of the new world God is bringing. Isaiah's desert has burst into bloom — and one day the whole creation will share in the freedom and glory of God's children.",
  undefined,
  { ...edersheim("Desert blossoming and healing applied to Messianic era in Yalkut and Talmud") }));

prophecies.push(makeLesson(168, "the-servant-exalted", "The Servant Exalted", "Resurrection",
  "Isaiah 52:13", "Philippians 2:9", "See, my servant will act wisely; he will be raised and lifted up and highly exalted.", "Therefore God exalted him to the highest place and gave him the name that is above every name.", "Isaiah foretold a servant who would be highly exalted. Paul declares that God has done exactly this — exalting Christ to the highest place with the name above every name. The suffering servant is the exalted Lord.",
  undefined,
  { ...edersheim("Servant exalted and lifted up applied to the Messiah in Yalkut; introduces Suffering Servant") }));

prophecies.push(makeLesson(169, "david-raised-up", "David Raised Up", "Lineage",
  "Jeremiah 30:9", "Luke 1:32", "They will serve the LORD their God and David their king, whom I will raise up for them.", "He will be great and will be called the Son of the Most High. The Lord God will give him the throne of his father David.", "Jeremiah prophesied that God would raise up David their king. Gabriel announced Jesus as the Son of the Most High who receives David's throne. Christ is the David whom God raises up for His people.",
  undefined,
  { ...edersheim("Serving the LORD and David raised up applied to Messianic era in Talmud") }));

prophecies.push(makeLesson(170, "the-tender-branch", "The Tender Branch", "Kingdom",
  "Ezekiel 17:22", "Matthew 13:32", "This is what the Sovereign LORD says: I myself will take a shoot from the very top of a cedar and plant it; I will break off a tender sprig from its topmost shoots and plant it on a high and lofty mountain.", "He told them another parable: \"The kingdom of heaven is like a mustard seed, which a man took and planted in his field. Though it is the smallest of all seeds, yet when it grows, it is the largest of garden plants.\"", "Ezekiel described God planting a tender branch that grows into a great tree. Jesus used the same image — the kingdom starts small like a mustard seed and grows to shelter all. God's kingdom begins humbly but becomes immense.",
  undefined,
  { ...edersheim("Tender branch planted on a high mountain applied to the Messiah in the Targum on Ezekiel") }));

prophecies.push(makeLesson(171, "cleansing-and-new-spirit", "Cleansing and New Spirit", "Kingdom",
  "Ezekiel 36:25", "John 3:5", "I will sprinkle clean water on you, and you will be clean; I will cleanse you from all your impurities and from all your idols. I will give you a new heart and put a new spirit in you.", "Jesus answered, \"Very truly I tell you, no one can enter the kingdom of God unless they are born of water and the Spirit.\"", "Ezekiel prophesied cleansing with water and a new spirit. Jesus told Nicodemus that entering God's kingdom requires being born of water and the Spirit — Ezekiel's prophecy describes the new birth Christ makes possible.",
  undefined,
  { ...edersheim("Cleansing with water and new spirit applied to spiritual renewal of Messianic era") }));

prophecies.push(makeLesson(172, "stone-cut-without-hands", "Stone Cut Without Hands", "Kingdom",
  "Daniel 2:34", "Matthew 21:44", "While you were watching, a rock was cut out, but not by human hands. It struck the statue on its feet of iron and clay and smashed them.", "Anyone who falls on this stone will be broken to pieces; anyone on whom it falls will be crushed.", "Daniel saw a stone cut without human hands that destroyed every earthly kingdom. Jesus applied this to Himself — He is the stone that breaks and crushes. God's kingdom replaces every human empire.",
  undefined,
  { ...edersheim("Stone cut without hands destroying the statue applied to Messianic kingdom in Talmud") }));

prophecies.push(makeLesson(173, "the-breaker-goes-before", "The Breaker Goes Before", "Identity",
  "Micah 2:13", "John 10:4", "The One who breaks open the way will go up before them; they will break through the gate and go out. Their King will pass through before them, the LORD at their head.", "The one who enters by the gate is the shepherd of the sheep. The gatekeeper opens the gate for him, and the sheep listen to his voice.", "Micah prophesied a Breaker who goes before His people, opening the way. Jesus declared Himself the shepherd who enters by the gate, leading His sheep out. He is the one who breaks through every barrier for His flock.",
  undefined,
  { ...edersheim("Breaker going before the flock applied to the Messiah in Ber. R. 48 and Bemid. R. 14") }));

prophecies.push(makeLesson(174, "spirit-resting-on-the-branch", "Spirit Resting on the Branch", "Identity",
  "Isaiah 11:2", "Luke 3:22", "The Spirit of the LORD will rest on him — the Spirit of wisdom and of understanding, the Spirit of counsel and of might, the Spirit of the knowledge and fear of the LORD.", "And the Holy Spirit descended on him in bodily form like a dove. And a voice came from heaven: \"You are my Son, whom I love; with you I am well pleased.\"", "Isaiah described the Spirit resting on the Branch in fullness — wisdom, understanding, counsel, might. At Jesus' baptism, the Spirit descended visibly, and the Father confirmed: this is My beloved Son. Isaiah's sevenfold Spirit rests on Christ.",
  undefined,
  { ...edersheim("Seven spirits of wisdom resting on Messiah extensively cited in Talmud, Targum, and Midrash"), ...mcdowell(20, "Special Anointing of Holy Spirit", "Targum Isaiah on Isa 11:1-4 cited verbatim; seven-fold Spirit at baptism") }));


// Gen 22:18 — dual Edersheim + McDowell
prophecies.push(makeLesson(175, "seed-of-abraham-edersheim", "Seed of Abraham", "Lineage",
  "Genesis 22:18", "Galatians 3:16", "and through your offspring all nations on earth will be blessed, because you have obeyed me.", "The promises were spoken to Abraham and to his seed. Scripture does not say \"and to seeds,\" meaning many people, but \"and to your seed,\" meaning one person, who is Christ.", "God promised Abraham that all nations would be blessed through his seed. Paul identifies this seed as Christ — the singular offspring through whom every nation receives blessing. The Abrahamic covenant finds its fulfillment in Jesus.",
  undefined,
  { ...edersheim("Bemidbar R. 13 — universal blessing through Messiah"), ...mcdowell(4, "Seed of Abraham", "Matthew Henry: 'in thy Seed one particular person' — Gal 3:16 singular seed argument") }));

// === NEW COMING-SOON LESSONS (McDowell) ===

prophecies.push(makeLesson(176, "son-of-isaac", "Son of Isaac", "Lineage",
  "Genesis 21:12", "Luke 3:34", "Through Isaac that your offspring will be reckoned.", "the son of Jacob, the son of Isaac, the son of Abraham, the son of Terah.", "God specified that the promised line would flow through Isaac, not Ishmael. Luke's genealogy confirms Jesus descends through Isaac — the child of promise. God's covenant faithfulness is traced through every generation.",
  undefined,
  { ...mcdowell(5, "Son of Isaac", "God eliminates half of Abraham lineage — Ishmael excluded, Isaac chosen; narrows Messianic line") }));

prophecies.push(makeLesson(177, "judge-lawgiver-king", "Judge, Lawgiver, King", "Ministry",
  "Isaiah 33:22", "John 5:30", "For the LORD is our judge, the LORD is our lawgiver, the LORD is our king; it is he who will save us.", "By myself I can do nothing; I judge only as I hear, and my judgment is just, for I seek not to please myself but him who sent me.", "Isaiah declared God as judge, lawgiver, and king — the one who saves. Jesus exercises all three roles — judging justly, fulfilling the law, and reigning as king — yet always in submission to the Father.",
  undefined,
  { ...mcdowell(18, "Judge", "LORD as Judge, Lawgiver, and King in one verse; Targum Isaiah cited; John 5:30 — righteous judgment") }));

prophecies.push(makeLesson(178, "king-on-holy-hill", "King on Holy Hill", "Identity",
  "Psalm 2:6", "Matthew 27:37", "I have installed my king on Zion, my holy mountain.", "Above his head they placed the written charge against him: THIS IS JESUS, THE KING OF THE JEWS.", "God declared in Psalm 2 that He installed His king on Zion. At Calvary, the sign above Jesus read \"King of the Jews\" — what Pilate meant as mockery, God meant as coronation. The cross was His throne.",
  undefined,
  { ...mcdowell(19, "King", "Set as King on Zion; Jer 23:5 and Zech 9:9 cited as parallels; cross placard 'King of the Jews'") }));

prophecies.push(makeLesson(179, "he-bore-our-suffering", "He Bore Our Suffering", "Passion",
  "Isaiah 53:4", "John 19:17", "Surely he took up our pain and bore our suffering, yet we considered him punished by God, stricken by him, and afflicted.", "Carrying his own cross, he went out to the place of the Skull (which in Aramaic is called Golgotha).", "Isaiah declared that the Servant would bear our suffering — taking up our pain though we thought him punished by God. Jesus carried His own cross to Golgotha, bearing the weight of human sin and sorrow. What Isaiah foretold, Christ fulfilled in His body on the way to Calvary.",
  undefined,
  { ...mcdowell(43, "Fell under the Cross", "Knees weak from fasting, flesh feeble — physical collapse under weight of the cross on the way to Golgotha") }));

prophecies.push(makeLesson(180, "friends-stood-afar-off", "Friends Stood Afar Off", "Passion",
  "Psalm 38:11", "Luke 23:49", "My friends and companions avoid me because of my wounds; my neighbors stay far away.", "But all those who knew him, including the women who had followed him from Galilee, stood at a distance, watching these things.", "The psalmist lamented that friends and companions withdrew because of his suffering. At the cross, those who knew Jesus stood at a distance, watching. The isolation of suffering was part of the Messiah's cost.",
  undefined,
  { ...mcdowell(49, "Friends Stood Afar Off", "Loved ones and friends stand aloof from plague; Luke 23:49 — all acquaintances watched at a distance") }));

prophecies.push(makeLesson(181, "they-wagged-their-heads", "They Wagged Their Heads", "Passion",
  "Psalm 109:25", "Matthew 27:39", "Those who see me shake their heads.", "Those who passed by hurled insults at him, shaking their heads.", "The psalmist described onlookers shaking their heads in contempt. Matthew records the same scene at Calvary — passersby hurled insults and shook their heads at Jesus. The psalm was a script, and the cross was its stage.",
  undefined,
  { ...mcdowell(50, "People Shook Their Heads", "Ethridge: gesture implying no hope for the sufferer; Matt 27:39 — passersby wagging heads at the cross") }));

prophecies.push(makeLesson(182, "they-look-and-stare", "They Look and Stare", "Passion",
  "Psalm 22:17", "Luke 23:35", "I can count all my bones; people stare and gloat over me.", "The people stood watching, and the rulers even sneered at him. They said, \"He saved others; let him save himself if he is God's Messiah, the Chosen One.\"", "The psalmist described being stared at and gloated over. Luke records the crowd watching and sneering at Jesus on the cross. Every detail of Psalm 22 was lived out in Christ's crucifixion.",
  undefined,
  { ...mcdowell(51, "Stared Upon", "Can count all bones; they look and stare — crowd standing watching the crucifixion, Luke 23:35") }));

prophecies.push(makeLesson(183, "not-one-bone-broken", "Not One Bone Broken", "Passion",
  "Psalm 34:20", "John 19:33", "He protects all his bones, not one of them will be broken.", "But when they came to Jesus and found that he was already dead, they did not break his legs.", "The psalmist declared that God protects His righteous one — not a bone will be broken. At the cross, the soldiers broke the legs of the two criminals but found Jesus already dead. God protected His Son's bones, fulfilling the psalm.",
  undefined,
  { ...mcdowell(57, "Bones Not Broken", "God guards all His bones; soldiers skipped breaking Jesus' legs because He was already dead — John 19:33") }));

prophecies.push(makeLesson(184, "heart-poured-out", "Heart Poured Out", "Passion",
  "Psalm 22:14", "John 19:34", "All my bones are out of joint. My heart has turned to wax; it has melted within me.", "Instead, one of the soldiers pierced Jesus' side with a spear, bringing a sudden flow of blood and water.", "The psalmist described a heart melted like wax within him. When the soldier pierced Jesus' side, blood and water flowed — medical evidence of a heart that literally burst. Psalm 22 described the Messiah's death a thousand years before the cross.",
  undefined,
  { ...mcdowell(58, "Heartbroken", "Heart like wax melted within; blood and water from the pierced side are evidence the heart had literally burst") }));

// === NEW COMING-SOON LESSONS (Payne Gap Coverage) ===

prophecies.push(makeLesson(185, "son-of-the-father", "Son of the Father", "Lineage",
  "2 Samuel 7:14", "Hebrews 1:5", "I will be his father, and he will be my son.", "For to which of the angels did God ever say, 'You are my Son; today I have become your Father'?", "God's covenant with David included a father-son relationship with his successor. The author of Hebrews applies this promise exclusively to Jesus — not to angels, not to any earthly king — as evidence of the Son's unique divine status.",
  undefined,
  { ...payne(7, "2 Sam 7:14", "Father-son covenant relationship; Payne sees this as the relational heart of the Davidic covenant, fulfilled uniquely in the incarnate Son") }));

prophecies.push(makeLesson(186, "blessed-is-he-who-comes", "Blessed Is He Who Comes", "Identity",
  "Psalm 118:26", "Matthew 21:9", "Blessed is he who comes in the name of the LORD. From the house of the LORD we bless you.", "Blessed is he who comes in the name of the Lord! Hosanna in the highest heaven!", "Psalm 118 was sung at Passover as pilgrims processed to the temple. When the crowd greeted Jesus with these exact words on Palm Sunday, they were identifying him as the expected king coming in God's name — a fulfillment the religious leaders understood immediately.",
  undefined,
  { ...payne(21, "Ps 118:26", "Blessed is He who comes in the LORD's name; Payne notes the Hallel psalm was the Passover processional, making the Palm Sunday crowd's use of it a conscious messianic declaration") }));

prophecies.push(makeLesson(187, "throne-of-his-body", "Throne of His Body", "Lineage",
  "Psalm 132:11", "Acts 2:30", "The LORD swore an oath to David, a sure oath he will not revoke: 'One of your own descendants I will place on your throne.'", "But he was a prophet and knew that God had promised him on oath that he would place one of his descendants on his throne.", "Psalm 132 affirms the unconditional nature of the Davidic covenant — God swore an oath that David's bodily descendant would occupy his throne. Peter at Pentecost declared that Jesus' resurrection fulfilled this oath, establishing the Davidic heir on an eternal throne beyond the reach of death.",
  undefined,
  { ...payne(22, "Ps 132:11", "Bodily descendant of David placed on the throne; Payne connects the oath-formula here to the unbreakable permanence of the Davidic covenant") }));

prophecies.push(makeLesson(188, "tongue-cleaves-i-thirst", "Tongue Cleaves, \"I Thirst\"", "Passion",
  "Psalm 22:15", "John 19:28", "My mouth is dried up like a potsherd, and my tongue sticks to the roof of my mouth; you lay me in the dust of death.", "Later, knowing that everything had now been finished, and so that Scripture would be fulfilled, Jesus said, \"I am thirsty.\"", "The psalmist described a mouth dried like pottery and a tongue stuck fast — the agony of dehydration in death. On the cross, Jesus said 'I am thirsty,' and John explicitly notes it was to fulfill Scripture. The Passion Psalm's details were lived out in Christ's final hours.",
  undefined,
  { ...payne(13, "Ps 22:15", "Tongue cleaves to jaws; Payne treats Psalm 22 as the most detailed prophetic portrait of crucifixion, including thirst"), ...edersheim("Psalm 22 treated as complete Messianic Passion Psalm; thirst and physical torment applied to Messiah's suffering in ancient Synagogue"), ...mcdowell(54, "Gall and Vinegar Offered", "Tongue cleaves to jaws — thirst on the cross; John 19:28 explicitly states fulfillment of Scripture") }));

prophecies.push(makeLesson(189, "who-has-believed", "Who Has Believed", "Rejection",
  "Isaiah 53:1", "John 12:38", "Who has believed our message and to whom has the arm of the LORD been revealed?", "This was to fulfill the word of Isaiah the prophet: \"Lord, who has believed our message, and to whom has the arm of the Lord been revealed?\"", "Isaiah opened the Suffering Servant passage with a grieving question — who has believed? John cites this verse to explain why so many refused to believe in Jesus despite His signs. The rejection was not an accident; it was woven into the prophetic pattern from the start.",
  undefined,
  { ...payne(33, "Isa 53:1", "Who has believed our report; Payne treats this as the heading of the Servant's rejection, fulfilled in Israel's widespread unbelief during Jesus' ministry"), ...edersheim("Isaiah 53:1 cited in Messianic context; disbelief of the report applied to rejection of the Messiah in Talmud and Yalkut"), ...mcdowell(47, "Rejected by His Own People", "Who has believed our report — John 12:38 and Romans 10:16 both cite this as fulfilled in Israel's rejection of the Messiah") }));

prophecies.push(makeLesson(190, "every-knee-shall-bow", "Every Knee Shall Bow", "Kingdom",
  "Isaiah 45:23", "Philippians 2:10–11", "By myself I have sworn, my mouth has uttered in all integrity a word that will not be revoked: Before me every knee will bow; by me every tongue will swear.", "that at the name of Jesus every knee should bow, in heaven and on earth and under the earth, and every tongue acknowledge that Jesus Christ is Lord, to the glory of God the Father.", "Through Isaiah, God swore an irrevocable oath that every knee would bow to Him alone. Paul applies this oath directly to Jesus — at His name every knee in heaven, earth, and under the earth will bow. What God declared of Himself, the apostle declares of Christ.",
  undefined,
  { ...payne(29, "Isa 45:23", "Every knee shall bow; Payne notes Paul's transfer of this monotheistic oath to Christ in Philippians 2 as evidence of the highest Christology"), ...edersheim("Every knee bowing applied to Messianic era; Isaiah 45:23 cited in Talmudic discussion of universal acknowledgment of God through Messiah"), ...mcdowell(15, "Shall Be Called Lord", "Every knee bowing and tongue confessing; Phil 2:10–11 applies Yahweh's oath to Jesus as Lord") }));

prophecies.push(makeLesson(191, "stranger-to-his-brothers", "Stranger to His Brothers", "Rejection",
  "Psalm 69:8", "John 7:5", "I am a foreigner to my own family, a stranger to my own mother's children.", "For even his own brothers did not believe in him.", "The psalmist lamented being treated as a stranger by his own siblings. Jesus experienced the same — His own brothers did not believe in Him during His earthly ministry. The Messiah's rejection began not with enemies, but at home.",
  undefined,
  { ...edersheim("Psalm 69 treated as Messianic; alienation from brethren applied to Messiah's rejection by His own in Rabbinic commentary") }));

prophecies.push(makeLesson(192, "raised-on-third-day", "Raised on the Third Day", "Resurrection",
  "Hosea 6:2", "Luke 24:46",
  "After two days he will revive us; on the third day he will restore us, that we may live in his presence.",
  "He told them, \"This is what is written: The Messiah will suffer and rise from the dead on the third day,\"",
  "Hosea's prophecy of revival after two days and restoration on the third established a prophetic pattern that Jesus directly cited. When He explained the Scriptures after His resurrection, He pointed to this very pattern — that it was written the Messiah would rise on the third day. This is one of the most direct prophetic anticipations of the resurrection in the entire Old Testament.",
  undefined,
  { ...payne(78, "Hos 6:2", "Revival after two days and raising on the third day; Payne treats this as a prophetic pattern directly fulfilled in Christ's resurrection — listed as #78 in his 191 messianic prophecies"), ...edersheim("Hos. vi. 2 is Messianically applied in the Targum — explicitly confirmed in Appendix IX of The Life and Times of Jesus the Messiah") }));

prophecies.push(makeLesson(193,"no-comforters-in-his-suffering","No Comforters in His Suffering","Passion",
"Psalm 69:20","Mark 14:34",
"Scorn has broken my heart and has left me helpless; I looked for sympathy, but there was none, for comforters, but I found none.",
"\"My soul is overwhelmed with sorrow to the point of death,\" he said to them. \"Stay here and keep watch.\"",
"The psalmist cried out that scorn had broken his heart and no comforter could be found. In the Garden of Gethsemane, Jesus poured out His anguish to Peter, James, and John — yet they fell asleep while He suffered alone. The Messiah's deepest agony was met not with comfort but with the solitude foretold centuries earlier."));

prophecies.push(makeLesson(194,"the-day-the-lord-has-made","The Day the Lord Has Made","Resurrection",
"Psalm 118:24","Acts 2:32–36",
"The LORD has done it this very day; let us rejoice today and be glad.",
"God has raised this Jesus to life, and we are all witnesses of it. Exalted to the right hand of God, he has received from the Father the promised Holy Spirit and has poured out what you now see and hear. … Therefore let all Israel be assured of this: God has made this Jesus, whom you crucified, both Lord and Messiah.",
"The psalmist celebrated the day the LORD had acted decisively — a day of joy and vindication. Peter at Pentecost declared that Resurrection Sunday was that day: the day God raised Jesus from the dead, exalted Him, and poured out His Spirit. What the psalm anticipated as praise, the apostles proclaimed as history."));

prophecies.push(makeLesson(195,"the-servant-brings-justice","The Servant Brings Justice","Ministry",
"Isaiah 42:3","Matthew 12:20",
"A bruised reed he will not break, and a smoldering wick he will not snuff out. In faithfulness he will bring forth justice;",
"A bruised reed he will not break, and a smoldering wick he will not snuff out, till he has brought justice through to victory.",
"Isaiah described God's Servant as one who would not crush the weak or extinguish the faint. Matthew applied these words to Jesus, whose ministry was marked by tenderness toward the broken. Where the world discards what is damaged, Jesus restores it — bringing justice not through force but through faithful compassion."));

prophecies.push(makeLesson(196,"the-king-comes-bringing-peace","The King Comes Bringing Peace","Kingdom",
"Zechariah 9:10","Matthew 21:9",
"I will take away the chariots from Ephraim and the warhorses from Jerusalem, and the battle bow will be broken. He will proclaim peace to the nations. His rule will extend from sea to sea and from the River to the ends of the earth.",
"The crowds that went ahead of him and those that followed shouted, \"Hosanna to the Son of David!\" \"Blessed is he who comes in the name of the Lord!\" \"Hosanna in the highest heaven!\"",
"Zechariah envisioned a king who would abolish weapons of war and proclaim peace to every nation. Paul declares that Christ is our peace — He has destroyed the wall of hostility between peoples. His kingdom is established not by chariots and warhorses but by the disarming power of reconciling love."));

prophecies.push(makeLesson(197,"the-servant-will-be-exalted","The Servant Will Be Exalted","Ministry",
"Isaiah 52:15","Romans 15:21",
"so he will sprinkle many nations, and kings will shut their mouths because of him. For what they were not told, they will see, and what they have not heard, they will understand.",
"Rather, as it is written: \"Those who were not told about him will see, and those who have not heard will understand.\"",
"Isaiah declared that the Servant's mission would reach nations that had never heard of Him — even kings would be silenced. Paul quoted this passage to explain why he preached where Christ was not yet known. The gospel's reach to the ends of the earth was not an afterthought — it was written into the Servant's mission from the start."));

prophecies.push(makeLesson(198,"out-of-egypt-i-called-my-son","Out of Egypt I Called My Son","Lineage",
"Hosea 11:1","Matthew 2:15",
"When Israel was a child, I loved him, and out of Egypt I called my son.",
"So was fulfilled what the Lord had said through the prophet: \"Out of Egypt I called my son.\"",
"Hosea described God's love for Israel as His son, called out of Egypt in the Exodus. Matthew saw this pattern fulfilled in a deeper way when the infant Jesus returned from Egypt after Herod's death. Just as God called His people out of Egypt, He called His Son — the true Israel — along the same path, reliving and redeeming the nation's story."));


prophecies.push(makeLesson(199,"he-will-strike-the-earth-with-the-rod-of-his-mouth","He Will Strike the Earth with the Rod of His Mouth","Kingdom",
"Isaiah 11:4","Revelation 19:15",
"but with righteousness he will judge the needy, with justice he will give decisions for the poor of the earth. He will strike the earth with the rod of his mouth; with the breath of his lips he will slay the wicked.",
"Coming out of his mouth is a sharp sword with which to strike down the nations. He will rule them with an iron scepter.",
"Isaiah foresaw a Messianic ruler who would judge the earth not by military might but by the word of His mouth. In Revelation, John sees the returning Christ with a sharp sword proceeding from His mouth, striking down the nations. The Messiah's justice is absolute — His word alone is sufficient to overthrow all wickedness."));

prophecies.push(makeLesson(200,"the-lord-will-be-king-over-all-the-earth","The Lord Will Be King Over All the Earth","Kingdom",
"Zechariah 14:9","Revelation 11:15",
"The LORD will be king over the whole earth. On that day there will be one LORD, and his name the only name.",
"The kingdom of the world has become the kingdom of our Lord and of his Messiah, and he will reign for ever and ever.",
"Zechariah proclaimed the day when the LORD alone would reign as King over all the earth, with no rival and no divided loyalty. Revelation echoes this vision: the kingdoms of this world become the kingdom of our Lord and of His Christ. The prophecy points to the final, uncontested reign of the Messiah over every nation."));

for (const p of prophecies) {
  const s = _scholarshipMap[p.id];
  if (s) p.scholarship = { ...(p.scholarship ?? {}), ...s };
}

