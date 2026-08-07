<script setup>
/**
 * CommentaryPanel — 解经面板（brp 子组件）
 *
 * 设计说明：解经常驻于经文右侧的空白区域（不做独立页面，也不是临时抽屉），
 * 由 brp 页的"解经"按钮控制显隐。
 * 未来接入马太亨利译注的方案（写入 docs/DATA.md）：
 *   注释数据按 { bookId, chapter } 对齐（与经文切片同一编号体系），
 *   在 getCommentary() 中按 bookId+chapter 查询并渲染即可，本组件结构不变。
 */
import EmptyState from '../EmptyState.vue'

defineProps({
  open: { type: Boolean, default: true },
  book: { type: Object, default: null },
  chapter: { type: Number, default: 0 },
})
const emit = defineEmits(['toggle'])

/** 未来注释查询接口（v1 恒返回 null，显示空状态） */
function getCommentary() {
  return null
}
</script>

<template>
  <aside v-show="open" class="commentary-panel" aria-label="解经">
    <header class="panel-head">
      <h2 class="panel-title">
        解经<template v-if="book"> · {{ book.zh }} 第 {{ chapter }} 章</template>
      </h2>
      <button class="panel-close" @click="emit('toggle')" aria-label="收起解经面板">✕</button>
    </header>
    <div class="panel-body">
      <EmptyState
        v-if="!getCommentary()"
        title="马太亨利译注接入中"
        message="此面板预留显示当前章节的马太亨利圣经注释（按书卷+章节对齐）。数据流水线准备就绪后，注释将直接出现在这里。"
      />
      <div v-else>{{ getCommentary() }}</div>
    </div>
  </aside>
</template>

<style scoped>
.commentary-panel {
  width: min(24rem, 34vw);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--line);
  background: #fbfcfd;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.7rem 1rem;
  border-bottom: 1px solid var(--line);
  background: #fff;
}
.panel-title {
  margin: 0;
  font-size: 1rem;
  color: var(--accent);
}
.panel-close {
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 0.95rem;
  padding: 0.1rem 0.45rem;
}
.panel-close:hover {
  color: var(--text);
}
.panel-body {
  flex: 1;
  overflow-y: auto;
}
</style>
