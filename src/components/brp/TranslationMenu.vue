<script setup>
/**
 * TranslationMenu — 展开式译本选择器（brp 子组件）
 * 译本列表由 manifest 数据驱动；展开面板分组展示：译本 / 原文（original=true 隔离展示）。
 * 译本数量可能很多（素材库 140 种），采用展开形式而非平铺全部。
 */
import { ref, computed } from 'vue'

const props = defineProps({
  translations: { type: Array, required: true },
  activeKey: { type: String, required: true },
})
const emit = defineEmits(['select'])

const open = ref(false)

const versions = computed(() => props.translations.filter((t) => !t.original))
const originals = computed(() => props.translations.filter((t) => t.original))
const active = computed(() => props.translations.find((t) => t.key === props.activeKey))

function pick(key) {
  open.value = false
  emit('select', key)
}
</script>

<template>
  <div class="trans-menu">
    <button class="trans-trigger" :class="{ open }" @click="open = !open" aria-haspopup="listbox">
      <span class="trans-trigger-name">{{ active ? active.name : '译本' }}</span>
      <span class="caret" aria-hidden="true">▾</span>
    </button>

    <Transition name="menu">
      <div v-if="open" class="menu-pop" role="listbox">
        <div v-if="versions.length" class="menu-group">
          <div class="menu-group-title">译本</div>
          <button
            v-for="t in versions"
            :key="t.key"
            class="menu-item"
            :class="{ active: t.key === activeKey }"
            role="option"
            :aria-selected="t.key === activeKey"
            @click="pick(t.key)"
          >
            {{ t.name }}
          </button>
        </div>
        <div v-if="originals.length" class="menu-group">
          <div class="menu-group-title">原文</div>
          <button
            v-for="t in originals"
            :key="t.key"
            class="menu-item"
            :class="{ active: t.key === activeKey }"
            role="option"
            :aria-selected="t.key === activeKey"
            @click="pick(t.key)"
          >
            {{ t.name }}
          </button>
        </div>
      </div>
    </Transition>

    <div v-if="open" class="menu-backdrop" @click="open = false"></div>
  </div>
</template>

<style scoped>
.trans-menu {
  position: relative;
}
.trans-trigger {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.3rem 0.9rem;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
  color: var(--text);
  font-size: 0.9rem;
  white-space: nowrap;
  max-width: 14rem;
}
.trans-trigger:hover,
.trans-trigger.open {
  border-color: var(--accent);
  color: var(--accent);
}
.trans-trigger-name {
  overflow: hidden;
  text-overflow: ellipsis;
}
.caret {
  font-size: 0.75rem;
  transition: transform 0.15s ease;
}
.trans-trigger.open .caret {
  transform: rotate(180deg);
}
.menu-pop {
  position: absolute;
  top: calc(100% + 0.35rem);
  right: 0;
  min-width: 15rem;
  max-height: min(24rem, 60vh);
  overflow-y: auto;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 10px 28px rgba(20, 28, 38, 0.14);
  padding: 0.35rem;
  z-index: 51;
}
.menu-group + .menu-group {
  border-top: 1px solid var(--line);
  margin-top: 0.3rem;
  padding-top: 0.3rem;
}
.menu-group-title {
  padding: 0.2rem 0.6rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--muted);
  letter-spacing: 0.08em;
}
.menu-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.32rem 0.6rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.menu-item:hover {
  background: var(--accent-soft);
}
.menu-item.active {
  background: var(--accent);
  color: #fff;
  font-weight: 600;
}
.menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
}
.menu-enter-active,
.menu-leave-active {
  transition: opacity 0.14s ease, transform 0.14s ease;
}
.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
