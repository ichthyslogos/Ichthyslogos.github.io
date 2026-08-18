<script setup>
/**
 * AppHeader — 全局导航栏
 * 风格：60px 白底极简导航——左品牌（logo 图标 + 名称）、中菜单（大间距）。
 * 「圣经」为可展开词条（单点只展开/收起，不跳转）：经文（原读经研究）/ 地图两个子页；
 * 子页任一激活时「圣经」高亮；点击外部或选择子项后收起。
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { RouterLink } from 'vue-router'
import logoUrl from '../assets/logo.png'

const route = useRoute()
const flat = computed(() => route.name === 'home')
const bibleOpen = ref(false)

/** 圣经子页激活（经文 /brp 或地图 /map） */
const bibleActive = computed(() => route.path.startsWith('/brp') || route.path.startsWith('/map'))

function toggleBible(e) {
  bibleOpen.value = !bibleOpen.value
}

/** 点击外部关闭下拉 */
function onDocClick(e) {
  if (bibleOpen.value && !e.target.closest('.bible-menu')) {
    bibleOpen.value = false
  }
}

/** Esc 关闭下拉（键盘可访问性） */
function onDocKeydown(e) {
  if (e.key === 'Escape' && bibleOpen.value) bibleOpen.value = false
}
onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onDocKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onDocKeydown)
})
</script>

<template>
  <header class="app-header" :class="{ flat }">
    <div class="header-inner">
      <RouterLink to="/" class="brand">
        <img :src="logoUrl" class="brand-logo" alt="FISH · 基督教研究平台" />
        <span class="brand-name">FISH</span>
      </RouterLink>

      <nav class="nav">
        <RouterLink to="/">首页</RouterLink>
        <div class="bible-menu">
          <button
            class="bible-btn"
            :class="{ active: bibleActive, open: bibleOpen }"
            :aria-expanded="bibleOpen"
            aria-haspopup="menu"
            @click="toggleBible"
          >
            <span>圣经</span>
          </button>
          <Transition name="menu">
            <div v-if="bibleOpen" class="bible-pop" role="menu">
              <RouterLink to="/brp" class="bible-item" role="menuitem" @click="bibleOpen = false">
                <span class="bible-ico" aria-hidden="true">📖</span>
                <span>经文</span>
              </RouterLink>
              <RouterLink to="/map" class="bible-item" role="menuitem" @click="bibleOpen = false">
                <span class="bible-ico" aria-hidden="true">🗺️</span>
                <span>地图</span>
              </RouterLink>
            </div>
          </Transition>
        </div>
        <RouterLink to="/apologetics">护教</RouterLink>
        <RouterLink to="/history">教会史</RouterLink>
        <RouterLink to="/library">图书馆</RouterLink>
        <RouterLink to="/sources">数据来源</RouterLink>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  background: #fff;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
  /* 展开下拉浮层不被正文遮挡：提升 header 层叠上下文 */
  position: relative;
  z-index: 100;
}
/* 首页极简风格：无底部分隔线 */
.app-header.flat {
  border-bottom: none;
}
.header-inner {
  height: 60px;
  padding: 0 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  position: relative;
}
.brand {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  text-decoration: none;
  min-width: 0;
}
.brand-logo {
  height: 1.6rem;
  width: auto;
  display: block;
}
.brand-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: #101010;
  white-space: nowrap;
}
.nav {
  display: flex;
  align-items: center;
  gap: 2.2rem;
  font-size: 0.92rem;
  /* 菜单水平居中 */
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}
.nav a {
  color: #4a4a4a;
  padding: 0.2rem 0.1rem;
  transition: color var(--dur) var(--ease);
}
.nav a:hover {
  color: #101010;
  text-decoration: none;
}
.nav a.router-link-active {
  color: #101010;
  font-weight: 600;
  /* active 指示：底部金棕短线（移动端更清晰） */
  position: relative;
}
.nav a.router-link-active::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -4px;
  transform: translateX(-50%);
  width: 18px;
  height: 2px;
  border-radius: 2px;
  background: var(--gold);
}
/* 圣经下拉词条：按钮单点展开，不跳转 */
.bible-menu {
  position: relative;
}
.bible-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: none;
  background: none;
  padding: 0.2rem 0.1rem;
  font-size: 0.92rem;
  font-family: inherit;
  color: #4a4a4a;
  cursor: pointer;
  transition: color var(--dur) var(--ease);
}
.bible-btn:hover,
.bible-btn.active {
  color: #101010;
  font-weight: 600;
}
.bible-btn.active {
  position: relative;
}
.bible-btn.active::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -4px;
  transform: translateX(-50%);
  width: 18px;
  height: 2px;
  border-radius: 2px;
  background: var(--gold);
}
.bible-pop {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  min-width: 8.5rem;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 10px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.09);
  padding: 0.35rem;
  /* 浮层最上层 */
  z-index: 1000;
}
.bible-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.7rem;
  border-radius: 7px;
  color: #3a3a3a;
  white-space: nowrap;
}
.bible-item:hover {
  background: rgba(139, 115, 85, 0.08);
  color: #101010;
  text-decoration: none;
}
.bible-item.router-link-active {
  color: var(--gold);
  font-weight: 600;
  background: rgba(139, 115, 85, 0.07);
}
.bible-item.router-link-active::after {
  display: none;
}
.bible-ico {
  font-size: 0.85rem;
}
/* 下拉动画 */
.menu-enter-active,
.menu-leave-active {
  transition: opacity 0.15s var(--ease), transform 0.15s var(--ease);
}
.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-4px);
}

/* 窄屏：紧凑品牌与导航（导航可横向滚动，防止溢出折行） */
@media (max-width: 600px) {
  .header-inner {
    height: 54px;
    padding: 0 0.9rem;
    gap: 0.6rem;
  }
  .brand-logo {
    height: 1.4rem;
  }
  .brand-name {
    display: none;
  }
  .nav {
    position: static;
    transform: none;
    gap: 1.1rem;
    font-size: 0.85rem;
    white-space: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .nav::-webkit-scrollbar {
    display: none;
  }
  .nav a.router-link-active::after,
  .bible-btn.active::after {
    width: 14px;
    bottom: -3px;
  }
  /* 移动端弹窗改用 fixed：脱离 .nav 的 overflow-x:auto 滚动容器——
     absolute 弹窗会被 nav 裁剪（只有几像素可见，展开项"不显示"） */
  .bible-pop {
    position: fixed;
    top: 54px;
    left: 0.9rem;
    right: 0.9rem;
    transform: none;
    min-width: 0;
  }
  .menu-enter-from,
  .menu-leave-to {
    transform: translateY(-4px);
  }
}
</style>
