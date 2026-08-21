<script setup>
/**
 * VerseItem — 单节经文（brp 子组件）
 * 串珠：refs（{ anchor, targets: [{ id, ch, vs, label }] }）非空时显示 🔗 按钮，
 * 点击展开锚短语与引用列表；点击引用目标跳转到对应书卷章节（emit goto）。
 * （2026-08-21：移除注释词级高亮——noteNames 分段渲染、open-note 点击全部删除，
 *   经文统一以 .verse-text 渲染，格式一致。）
 */
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { fetchStrongDict } from '../../lib/data.js'

const props = defineProps({
  verse: { type: Number, required: true },
  text: { type: String, required: true },
  refs: { type: Array, default: null }, // 串珠：null/[] 表示无
  words: { type: Array, default: null }, // 逐字原文（和合本简体）：[{t,s}]，null=无
  strong: { type: Boolean, default: false }, // 是否开启逐字 Strong 显示
})
const emit = defineEmits(['goto'])

const router = useRouter()
const open = ref(false)

/* ---- 词典弹层：悬停（桌面）/ 点击（移动端）原文单词 → 浮现词典小卡；点击卡片跳详情页 ---- */
const hideTimer = ref(null)
/** 弹层 DOM（用于测量实际高度，避免底部被遮挡） */
const dlgEl = ref(null)
/** 当前弹层：{ code, entry, loaded, left, top }；null=关闭 */
const dlg = ref(null)
/** 触摸设备（pointer: coarse）：点击显示弹层而非直接跳转 */
const isCoarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

/** 强码归一到 4 位数字键（H430→H0430），与词典数据 key 对齐 */
function normStrong(c) {
  const m = /^(G|H)\s*(\d+)$/i.exec((c || '').trim())
  if (!m) return (c || '').trim().toUpperCase()
  return `${m[1].toUpperCase()}${m[2].padStart(4, '0')}`
}

/** 依据锚点矩形与卡片实际高度定位（钳制在视口内；下方放不下则翻到上方） */
function positionDlg(anchor) {
  if (!dlg.value || !dlgEl.value) return
  const W = 320
  const el = dlgEl.value
  const h = el.offsetHeight
  let left = Math.max(8, Math.min(anchor.left, innerWidth - W - 8))
  let top = anchor.bottom + 8
  if (top + h > innerHeight - 8) top = Math.max(8, anchor.top - h - 8)
  dlg.value = { ...dlg.value, left, top }
}

/** 显示弹层：先占位，渲染后按实际高度定位；词条异步加载后再重定位 */
function showDict(ev, code) {
  const r = ev.currentTarget.getBoundingClientRect()
  clearTimeout(hideTimer.value)
  dlg.value = { code, entry: null, loaded: false, left: 0, top: 0 }
  nextTick(() => positionDlg(r))
  fetchStrongDict()
    .then((d) => {
      const entry = (d.items && d.items[normStrong(code)]) || null
      if (dlg.value && dlg.value.code === code) {
        dlg.value = { ...dlg.value, entry, loaded: true }
        nextTick(() => positionDlg(r))
      }
    })
    .catch(() => {
      if (dlg.value && dlg.value.code === code) dlg.value = { ...dlg.value, entry: null, loaded: true }
    })
}

function hideDict() {
  clearTimeout(hideTimer.value)
  hideTimer.value = setTimeout(() => { dlg.value = null }, 160)
}
/** 鼠标进入弹层：取消延迟隐藏，允许点击操作 */
function keepDict() {
  clearTimeout(hideTimer.value)
}

/** 点击强码：触摸设备显示弹层（可再点弹层跳详情）；桌面直接跳详情页 */
function onCodeClick(ev, code) {
  if (isCoarse) {
    showDict(ev, code)
  } else {
    router.push('/strongs/' + code)
  }
}

/** 点击弹层外任意位置关闭（移动端无 hover，需手动关闭）；
 *  忽略强码按钮自身的点击（该点击由 onCodeClick 负责开弹层，避免刚开即关） */
function onDocClick(ev) {
  if (!dlg.value) return
  if (dlgEl.value && dlgEl.value.contains(ev.target)) return
  if (ev.target.closest && ev.target.closest('.strong-w-code')) return
  dlg.value = null
}
onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))

const langOf = (e) => (e?.g ? '希腊文' : e?.h ? '希伯来文' : '')

/** 词性编辑：去掉 "H:/G:" 前缀后原样显示（如 H:N-M → N-M） */
function posLabel(pos) {
  const s = String(pos || '').replace(/^[GH]:/, '')
  return s || '—'
}
</script>

<template>
  <p class="verse-item" :data-verse="verse">
    <span class="verse-num">{{ verse }}</span>
    <!-- 逐字原文：逐词渲染，强码作上标 -->
    <template v-if="strong && words && words.length">
      <span
        v-for="(w, i) in words"
        :key="i"
        class="strong-word"
      >
        <span class="strong-w-text">{{ w.t }}</span>
        <button
          v-if="w.s"
          type="button"
          class="strong-w-code"
          :aria-label="'查看 Strong 词条 ' + w.s"
          @mouseenter="!isCoarse && showDict($event, w.s)"
          @mouseleave="!isCoarse && hideDict"
          @click="onCodeClick($event, w.s)"
        >{{ w.s }}</button>
      </span>
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

  <!-- 悬停原文单词 → 词典弹层（Teleport 到 body 避免被滚动容器裁剪） -->
  <Teleport to="body">
    <div
      v-if="dlg"
      ref="dlgEl"
      class="strong-dlg"
      role="tooltip"
      :style="{ left: dlg.left + 'px', top: dlg.top + 'px' }"
      @mouseenter="keepDict"
      @mouseleave="hideDict"
      @click="router.push('/strongs/' + dlg.code)"
    >
      <template v-if="dlg.entry">
        <div class="dlg-head">
          <span class="dlg-lemma" :style="{ direction: dlg.entry.g ? 'ltr' : 'rtl', textAlign: dlg.entry.g ? 'left' : 'right' }">{{ dlg.entry.lemma }}</span>
          <span class="dlg-actions">
            <span class="dlg-lang">{{ langOf(dlg.entry) }}</span>
            <span class="dlg-code">{{ dlg.entry.code }}</span>
          </span>
        </div>
        <div class="dlg-meta">
          <span class="dlg-trans">{{ dlg.entry.translit }}</span>
          <span v-if="dlg.entry.pos" class="dlg-pos">{{ posLabel(dlg.entry.pos) }}</span>
        </div>
        <div class="dlg-gloss">{{ dlg.entry.gloss }}</div>
        <p v-if="dlg.entry.def" class="dlg-def">{{ dlg.entry.def }}</p>
        <template v-if="dlg.entry.strong_def">
          <div class="dlg-src">司特朗原版释义</div>
          <p class="dlg-def">{{ dlg.entry.strong_def }}</p>
        </template>
        <span class="dlg-more">查看完整词条 →</span>
      </template>
      <span v-else class="dlg-state">{{ dlg.loaded ? '未收录该词条' : '加载词典…' }}</span>
    </div>
  </Teleport>
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
/* 逐字原文（和合本简体 Strong）：词 + 上标强码 */
.strong-word {
  white-space: nowrap;
}
.strong-w-text {
  font-family: var(--serif);
}
.strong-w-code {
  margin-left: 1px;
  margin-right: 2px;
  padding: 0;
  border: none;
  background: none;
  font-family: inherit;
  font-size: 0.6em;
  font-weight: 600;
  color: var(--gold);
  vertical-align: super;
  line-height: 0;
  text-decoration: none;
  cursor: pointer;
}
.strong-w-code:hover {
  text-decoration: underline;
  opacity: 0.8;
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
/* 悬停词典弹层：fixed 定位 + 米金底卡片（与主站学术点缀一致） */
.strong-dlg {
  position: fixed;
  width: 320px;
  max-width: calc(100vw - 16px);
  max-height: min(70vh, 640px);
  overflow-y: auto;
  padding: 0.9rem 1rem;
  background: #fffdf8;
  border: 1px solid rgba(139, 115, 85, 0.35);
  border-left: 3px solid var(--gold);
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(29, 36, 48, 0.18);
  z-index: 1200;
  font-size: 0.85rem;
  line-height: 1.6;
  cursor: pointer;
}
.dlg-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.6rem;
}
.dlg-lemma {
  font-family: 'Times New Roman', 'Noto Serif', serif;
  font-size: 1.25rem;
  font-weight: 700;
  color: #1d2430;
  direction: rtl;
  text-align: right;
}
.dlg-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}
.dlg-lang {
  padding: 0.08rem 0.5rem;
  border: 1px solid rgba(139, 115, 85, 0.4);
  border-radius: 999px;
  font-size: 0.68rem;
  color: var(--gold, #8b7355);
  letter-spacing: 0.05em;
}
.dlg-code {
  font-size: 0.78rem;
  font-weight: 800;
  color: var(--gold, #8b7355);
  letter-spacing: 0.04em;
}
.dlg-meta {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin-top: 0.25rem;
}
.dlg-trans {
  font-size: 0.8rem;
  color: #6a7486;
}
.dlg-pos {
  font-size: 0.72rem;
  color: #98a2b3;
}
.dlg-gloss {
  margin-top: 0.45rem;
  font-weight: 600;
  color: #2a3446;
}
.dlg-def {
  margin: 0.35rem 0 0;
  font-family: 'Times New Roman', 'Noto Serif', serif;
  font-size: 0.88rem;
  line-height: 1.75;
  color: #4a556a;
  white-space: pre-line;
}
.dlg-src {
  margin-top: 0.5rem;
  padding-top: 0.45rem;
  border-top: 1px dashed rgba(139, 115, 85, 0.3);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: var(--gold, #8b7355);
  text-transform: uppercase;
}
.dlg-more {
  display: inline-block;
  margin-top: 0.5rem;
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--gold, #8b7355);
}
.dlg-state {
  color: #8a94a6;
}
</style>
