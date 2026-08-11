<script setup>
/**
 * VerseItem — 单节经文（brp 子组件）
 * 串珠：refs（{ anchor, targets: [{ id, ch, vs, label }] }）非空时显示 🔗 按钮，
 * 点击展开锚短语与引用列表；点击引用目标跳转到对应书卷章节（emit goto）。
 * Strong 逐词标注：words（[{ t, s, m }]）非空时按词渲染——每词右上角显示
 * Strong 码（过滤 H9xxx 词缀码取主码），悬停显示全部码与形态码；无标注保持纯文本。
 */
import { ref } from 'vue'

const props = defineProps({
  verse: { type: Number, required: true },
  text: { type: String, required: true },
  lang: { type: String, default: '' },
  refs: { type: Array, default: null }, // 串珠：null/[] 表示无
  words: { type: Array, default: null }, // Strong 逐词：null 表示无标注
})
const emit = defineEmits(['goto', 'lexicon'])

const open = ref(false)

/** 主 Strong 码：过滤希伯来词缀码（H08xxx/H09xxx 段：介词/连词/冠词/直接宾语标记），无则取第一个 */
const primaryCode = (s) => {
  if (!s) return null
  const codes = s.split(' ')
  return codes.find((c) => !/^H0[89]\d{3,4}$/.test(c)) || codes[0]
}

/** 悬停提示：全部码 + 形态码 */
const wordTitle = (w) => {
  const parts = []
  if (w.s) parts.push(w.s)
  if (w.m) parts.push('形态：' + w.m)
  return parts.join(' · ')
}
</script>

<template>
  <p class="verse-item" :data-verse="verse">
    <span class="verse-num">{{ verse }}</span>
    <template v-if="words && words.length">
      <template v-for="(w, i) in words" :key="i">
        <span v-if="w.s" class="w-word" :title="wordTitle(w)">
          {{ w.t }}<sup
            class="w-strong"
            :title="wordTitle(w)"
            @click.stop="emit('lexicon', { code: primaryCode(w.s), el: $event.currentTarget })"
          >{{ primaryCode(w.s) }}</sup>
        </span>
        <span v-else class="w-word">{{ w.t }}</span>
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
/* Strong 逐词：词与码 */
.w-word {
  font-family: var(--serif);
  font-size: 1.08rem;
  letter-spacing: 0.02em;
  white-space: pre-wrap;
}
.w-strong {
  font-family: var(--sans);
  font-size: 0.52em;
  font-weight: 600;
  color: #a8b0ba;
  margin-left: 0.1em;
  margin-right: 0.14em;
  user-select: none;
  cursor: pointer;
}
.w-word:hover .w-strong {
  color: var(--accent);
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
