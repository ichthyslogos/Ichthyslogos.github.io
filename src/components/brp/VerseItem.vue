<script setup>
/**
 * VerseItem — 单节经文（brp 子组件）
 * 串珠：refs（{ anchor, targets: [{ id, ch, vs, label }] }）非空时显示 🔗 按钮，
 * 点击展开锚短语与引用列表；点击引用目标跳转到对应书卷章节（emit goto）。
 * 预留 Future Strong 插槽：原文 Strong 编号高亮、词义注解将通过具名插槽
 * `annotations` 注入本组件的 slot（当前版本不渲染任何内容）。
 */
import { ref } from 'vue'

const props = defineProps({
  verse: { type: Number, required: true },
  text: { type: String, required: true },
  lang: { type: String, default: '' },
  refs: { type: Array, default: null }, // 串珠：null/[] 表示无
})
const emit = defineEmits(['goto'])

const open = ref(false)
</script>

<template>
  <p class="verse-item" :data-verse="verse">
    <span class="verse-num">{{ verse }}</span>
    <span class="verse-text">{{ text }}</span>
    <button
      v-if="refs && refs.length"
      class="ref-btn"
      :aria-expanded="open"
      :title="open ? '收起串珠引用' : '串珠引用'"
      @click="open = !open"
    >🔗</button>
    <!-- Future Strong：<slot name="annotations" :verse="verse" /> -->
    <span v-if="open" class="ref-pop">
      <span v-for="(r, i) in refs" :key="i" class="ref-group">
        <span v-if="r.anchor" class="ref-anchor">「{{ r.anchor }}」</span>
        <span class="ref-targets">
          <button
            v-for="(t, j) in r.targets"
            :key="j"
            class="ref-target"
            @click="emit('goto', t)"
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
  background: #fafafb;
}
.verse-num {
  display: inline-block;
  min-width: 1.6rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--accent);
  text-align: right;
  margin-right: 0.6rem;
  user-select: none;
}
.verse-text {
  font-family: var(--serif);
  font-size: 1.08rem;
  letter-spacing: 0.02em;
}
/* 串珠按钮：跟随经文行内显示 */
.ref-btn {
  margin-left: 0.5rem;
  border: none;
  background: transparent;
  font-size: 0.85rem;
  line-height: 1;
  padding: 0.1rem 0.25rem;
  cursor: pointer;
  opacity: 0.55;
  vertical-align: middle;
}
.ref-btn:hover,
.ref-btn[aria-expanded='true'] {
  opacity: 1;
}
/* 串珠面板：独立成行，跟随节后 */
.ref-pop {
  display: block;
  margin: 0.15rem 0 0.35rem 2.3rem;
  padding: 0.35rem 0.6rem;
  background: #f4f7fb;
  border-left: 3px solid var(--accent);
  border-radius: 0 6px 6px 0;
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
  border-radius: 999px;
  background: #fff;
  color: var(--accent);
  font-size: 0.78rem;
  cursor: pointer;
}
.ref-target:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}
</style>
