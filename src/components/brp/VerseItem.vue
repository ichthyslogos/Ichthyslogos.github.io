<script setup>
/**
 * VerseItem — 单节经文（brp 子组件）
 * 串珠：refs（{ anchor, targets: [{ id, ch, vs, label }] }）非空时显示 🔗 按钮，
 * 点击展开锚短语与引用列表；点击引用目标跳转到对应书卷章节（emit goto）。
 * 注释词级高亮（文本级）：noteNames（本节专名词条，节级锚定）非空时，
 * 经文中含词条中文名（zh-names）或变体（name-variants）的文本着色高亮，
 * 悬停显示词条名。最长优先、无重叠分段渲染；单字变体（「主」「坑」）走词边界匹配，
 * 防止「财主」「为主」类误划。
 * （2026-08-15：移除 Strong 逐词标注/原文功能——words、码级高亮、词典入口全部删除，
 *   高亮改为纯文本子串匹配，不再依赖 strong 数据。）
 */
import { ref, computed } from 'vue'

const props = defineProps({
  verse: { type: Number, required: true },
  text: { type: String, required: true },
  refs: { type: Array, default: null }, // 串珠：null/[] 表示无
  noteNames: { type: Array, default: null }, // 本节专名词条（文本级高亮）
})
const emit = defineEmits(['goto', 'open-note']) // open-note：点击高亮文字 → 解经抽屉定位词条

const open = ref(false)

/** 单字变体词边界（2026-08-15：Jesus/LORD 的「主」不划「财主」「为主」；
 *   Sheol 的「坑」不划「陷坑」外词汇）——允许的后缀虚词/方位词表 + 词尾前缀表 */
const SINGLE_SUFFIX = {
  '主': ['啊', '呀', '哪', '的', '呢', '着', '罢', '么'],
  '坑': ['中', '里', '内', '下', '的'],
}
const SINGLE_PREFIX = {
  '主': ['的', '前'],
  '坑': ['的', '于', '下', '上', '入'],
}

/** 文本边界字符（标点/空白/引号等）：单字变体命中时检查前后边界 */
const isBoundary = (c) => !c || /[，。、；：？！「」『』（）"'“”‘’·…—\s]/.test(c)

/** 判断 text[idx] 处是否命中单字变体 nm（词首+虚词后缀 / 允许前缀+词尾） */
const matchAt = (text, idx, nm) => {
  if ([...nm].length > 1) return true // 多字：调用处已确认子串
  const pre = text[idx - 1] || ''
  const suf = text.slice(idx + 1, idx + 3) || ''
  // 词首：前边界（标点/开头）或允许前缀结尾
  const headOk = isBoundary(pre) || (SINGLE_PREFIX[nm] || []).some((p) => pre.endsWith(p))
  if (!headOk) return false
  // 词尾：后边界（标点/结尾）或虚词后缀开头
  if (!suf || isBoundary(suf[0])) return true
  const sufList = SINGLE_SUFFIX[nm] || []
  return sufList.some((s) => suf.startsWith(s))
}

/** 分段视图：[{ t, hl, note }]——扫描本节文本中所有词条名/变体命中，
 * 最长优先、互不重叠（重叠区间取较长者），按位置排序输出 */
const segments = computed(() => {
  const text = props.text || ''
  const names = props.noteNames || []
  if (!names.length) return null
  // 收集所有命中区间
  const raw = []
  for (const n of names) {
    const list = n.nameZh ? [n.nameZh, ...(n.variants || [])] : [...(n.variants || [])]
    for (const nm of list) {
      if (!nm) continue
      if ([...nm].length > 1) {
        // 多字名/变体：全串子串扫描
        let from = 0
        let idx = text.indexOf(nm, from)
        while (idx >= 0) {
          raw.push({ start: idx, end: idx + nm.length, note: { ...n, nameZh: nm } })
          from = idx + 1
          idx = text.indexOf(nm, from)
        }
      } else {
        // 单字变体：逐位置边界匹配
        for (let i = 0; i < text.length; i++) {
          if (text[i] === nm && matchAt(text, i, nm)) {
            raw.push({ start: i, end: i + 1, note: { ...n, nameZh: nm } })
          }
        }
      }
    }
  }
  if (!raw.length) return null
  // 最长优先排序 → 贪心去重叠
  raw.sort((a, b) => b.end - b.start - (a.end - a.start))
  const picked = []
  for (const r of raw) {
    if (picked.some((p) => r.start < p.end && r.end > p.start)) continue
    picked.push(r)
  }
  picked.sort((a, b) => a.start - b.start)
  // 分段
  const segs = []
  let pos = 0
  for (const p of picked) {
    if (p.start > pos) segs.push({ t: text.slice(pos, p.start), hl: false, note: null })
    segs.push({ t: text.slice(p.start, p.end), hl: true, note: p.note })
    pos = p.end
  }
  if (pos < text.length) segs.push({ t: text.slice(pos), hl: false, note: null })
  return segs
})

/** 命中提示：中文名（命中名优先） + 英文词条名 */
const hlTitle = (note) => [note.nameZh, note.name].filter(Boolean).join(' · ')
</script>

<template>
  <p class="verse-item" :data-verse="verse">
    <span class="verse-num">{{ verse }}</span>
    <template v-if="segments">
      <template v-for="(s, i) in segments" :key="i">
        <button
          v-if="s.hl"
          type="button"
          class="note-hl"
          :class="'note-' + s.note.type"
          :title="hlTitle(s.note)"
          @click="emit('open-note', s.note)"
        >{{ s.t }}</button>
        <span v-else>{{ s.t }}</span>
      </template>
    </template>
    <span v-else class="verse-text">{{ text }}</span>
    <button
      v-if="refs && refs.length"
      class="ref-btn"
      :aria-expanded="open"
      :title="open ? '收起串珠引用' : '串珠引用'"
      @click="open = !open"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    </button>
    <span v-if="open" class="ref-pop">
      <span v-for="(r, i) in refs" :key="i" class="ref-group">
        <span v-if="r.anchor" class="ref-anchor">「{{ r.anchor }}」</span>
        <span class="ref-targets">
          <button
            v-for="(t, j) in r.targets"
            :key="j"
            class="ref-target"
            @click="emit('goto', { ...t, from: verse })"
          >{{ t.label }}</button>
        </span>
      </span>
    </span>
  </p>
</template>

<style scoped>
.verse-item {
  position: relative;
  margin: 0;
  padding: 0.28rem 0;
  line-height: 2;
}
.verse-item:hover {
  background: rgba(139, 115, 85, 0.045);
}
/* 注释词级高亮：取消常驻着色显示（2026-08-18）——经文阅读零干扰；
   词条仍可点击跳转解经面板，仅 hover 时给极轻背景提示可点击 */
.note-hl {
  border: none;
  border-radius: 3px;
  padding: 0 0.18em;
  cursor: pointer;
  font: inherit;
  line-height: inherit;
  letter-spacing: inherit;
  color: inherit;
  background: none;
}
.note-hl:hover {
  background: rgba(139, 115, 85, 0.1);
}
/* 分类着色全部停用（保留选择器占位，恢复高亮时启用） */
.note-Place,
.note-Male,
.note-Female,
.note-Group,
.note-Supernatural,
.note-Time,
.note-Musical,
.note-Title,
.note-Star,
.note-Language,
.note-Other {
  background: none;
  color: inherit;
}
/* 节号：金棕衬线小号 */
.verse-num {
  display: inline-block;
  min-width: 1.6rem;
  font-family: var(--serif);
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--gold);
  text-align: right;
  margin-right: 0.6rem;
  user-select: none;
  font-variant-numeric: tabular-nums;
}
.verse-text {
  font-family: var(--serif);
  font-size: 1.08rem;
  letter-spacing: 0.02em;
}
/* 串珠按钮：跟随经文行内显示 */
.ref-btn {
  display: inline-flex;
  align-items: center;
  margin-left: 0.45rem;
  border: none;
  background: transparent;
  color: var(--gold);
  padding: 0.12rem;
  cursor: pointer;
  opacity: 0.5;
  vertical-align: middle;
  border-radius: 6px;
  transition: opacity var(--dur) var(--ease), background var(--dur) var(--ease);
}
.ref-btn svg {
  width: 0.82rem;
  height: 0.82rem;
}
.ref-btn:hover,
.ref-btn[aria-expanded='true'] {
  opacity: 1;
  background: var(--gold-soft);
}
/* 串珠面板：独立成行，米金底 + 金棕左边线（与护教质疑卡呼应） */
.ref-pop {
  display: block;
  margin: 0.15rem 0 0.35rem 2.3rem;
  padding: 0.4rem 0.65rem;
  background: var(--gold-soft);
  border-left: 3px solid var(--gold);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  font-size: 0.82rem;
  line-height: 1.8;
}
.ref-group {
  display: inline;
}
.ref-anchor {
  color: var(--muted);
  margin-right: 0.4rem;
}
.ref-targets {
  display: inline;
}
.ref-target {
  margin: 0.1rem 0.25rem 0.1rem 0;
  padding: 0.05rem 0.5rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  background: var(--panel);
  color: var(--accent);
  font-size: 0.78rem;
  cursor: pointer;
  transition: border-color var(--dur) var(--ease), background var(--dur) var(--ease);
}
.ref-target:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}
</style>
