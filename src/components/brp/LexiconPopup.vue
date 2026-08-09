<script setup>
/**
 * LexiconPopup — Strong 词义弹层（brp 子组件）
 * 点击经文中 Strong 码时弹出：原形（希伯来/希腊）/ 音译 / 发音 / 词性 / 释义 / 用法 / 交叉引用。
 * 数据来自 src/lib/data.js 的 fetchStrongLexicon（G/H 词典按 1000 编号段懒加载 + 缓存）。
 * 定位：fixed 视口坐标（Teleport 到 body），弹层中心对齐点击词，上下左右均在视口内钳制
 * （底部词条向上收缩，避免超出视口被遮挡）；滚动正文即关闭。
 */
import { computed } from 'vue'

const props = defineProps({
  code: { type: String, default: '' },
  entry: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  /** { left, top }：点击词中心 x 与底部 y（fixed 视口坐标） */
  pos: { type: Object, default: null },
})
const emit = defineEmits(['close', 'goto'])

const POP_W = 340

/** 弹层最大高度：与 CSS max-height 保持一致（视口内完整可见的前提） */
const MAX_H = () => Math.min(window.innerHeight * 0.6, 420)

/** 弹层定位：中心对齐点击词；左右钳制在视口内，底部不足时向上收缩（移动端同样生效） */
const popStyle = computed(() => {
  if (!props.pos) return {}
  let top = props.pos.top + 8
  const maxTop = window.innerHeight - MAX_H() - 8
  if (top > maxTop) top = Math.max(8, maxTop)
  return {
    left: `max(8px, min(${props.pos.left - POP_W / 2}px, calc(100vw - ${POP_W + 16}px)))`,
    top: `${top}px`,
  }
})
</script>

<template>
  <Teleport to="body">
    <div v-if="pos" class="lex-overlay" @click="emit('close')">
      <div class="lex-pop" :style="popStyle" role="dialog" aria-label="Strong 词义" @click.stop>
        <button class="lex-close" aria-label="关闭词义弹层" @click="emit('close')">✕</button>
        <div v-if="loading" class="lex-state">词义加载中…</div>
        <template v-else-if="entry">
          <div class="lex-head">
            <span class="lex-code">{{ code }}</span>
            <span v-if="entry.pos" class="lex-pos">{{ entry.pos }}</span>
            <span v-if="entry.orth" class="lex-orth">{{ entry.orth }}</span>
            <span v-if="entry.translit" class="lex-trans">{{ entry.translit }}</span>
          </div>
          <div v-if="entry.pron" class="lex-pron">{{ entry.pron }}</div>
          <div class="lex-def">{{ entry.def }}</div>
          <div v-if="entry.usage" class="lex-usage">{{ entry.usage }}</div>
          <div v-if="entry.see && entry.see.length" class="lex-see">
            <span class="lex-see-label">引用</span>
            <button
              v-for="s in entry.see"
              :key="s"
              class="lex-see-btn"
              :title="'查看 ' + s"
              @click="emit('goto', s)"
            >{{ s }}</button>
          </div>
        </template>
        <div v-else class="lex-state">暂无词义数据</div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* 全屏透明遮罩：点击空白处关闭弹层 */
.lex-overlay {
  position: fixed;
  inset: 0;
  z-index: 120;
  background: transparent;
}
.lex-pop {
  position: fixed;
  width: min(340px, calc(100vw - 2rem));
  max-height: min(60vh, 420px);
  overflow-y: auto;
  scrollbar-gutter: stable;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 10px;
  box-shadow: 0 10px 32px rgba(31, 41, 55, 0.18);
  padding: 0.8rem 0.9rem 0.9rem;
  font-family: var(--sans);
  z-index: 121;
}
.lex-close {
  position: absolute;
  top: 0.35rem;
  right: 0.45rem;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 0.85rem;
  line-height: 1;
  padding: 0.25rem;
  cursor: pointer;
}
.lex-close:hover {
  color: var(--text);
}
.lex-state {
  color: var(--muted);
  text-align: center;
  padding: 1.2rem 0.5rem;
  font-size: 0.9rem;
  line-height: 1.8;
}
.lex-head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.3rem;
  padding-right: 1.4rem;
}
.lex-code {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--accent);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 0.08rem 0.35rem;
  user-select: none;
}
.lex-pos {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--muted);
  background: var(--accent-soft);
  border-radius: 4px;
  padding: 0.08rem 0.35rem;
  user-select: none;
}
.lex-orth {
  font-family: var(--serif);
  font-size: 1.25rem;
  font-weight: 600;
}
.lex-trans {
  font-style: italic;
  color: var(--muted);
  font-size: 0.95rem;
}
.lex-pron {
  color: var(--muted);
  font-size: 0.82rem;
  margin-bottom: 0.45rem;
}
.lex-def {
  font-size: 0.88rem;
  line-height: 1.75;
  color: var(--text);
  white-space: pre-line;
}
/* 希伯来词条用法（usage）：与释义区分开 */
.lex-usage {
  margin-top: 0.5rem;
  font-size: 0.82rem;
  line-height: 1.7;
  color: var(--muted);
  white-space: pre-line;
}
.lex-see {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.6rem;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--line);
}
.lex-see-label {
  font-size: 0.75rem;
  color: var(--muted);
}
.lex-see-btn {
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #fff;
  color: var(--accent);
  font-size: 0.75rem;
  padding: 0.1rem 0.5rem;
  cursor: pointer;
}
.lex-see-btn:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}
</style>
