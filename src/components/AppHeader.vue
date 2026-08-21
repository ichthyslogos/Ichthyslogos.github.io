<script setup>
/**
 * AppHeader — 全局导航栏
 * 风格：60px 白底极简导航——左品牌（logo 图标 + 名称）、中菜单（大间距）。
 * 「圣经」「图书馆」为可展开词条（单点只展开/收起，不跳转；两词条互斥）：
 *   圣经：经文 / 地图 / 人物 / 事件；图书馆：文库 / 教会历史 / 数据来源。
 * 护教为顶级词条；子页任一激活时对应词条高亮；点击外部、Esc 或选择子项后收起。
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { RouterLink } from 'vue-router'
import logoUrl from '../assets/logo.png'

const route = useRoute()
const flat = computed(() => route.name === 'home')
const bibleOpen = ref(false)
const libraryOpen = ref(false)

/** 圣经子页激活（经文 /brp、地图 /map、人物 /persons、事件 /events、预言 /prophecies、原文词典 /strongs） */
const bibleActive = computed(
  () =>
    route.path.startsWith('/brp') ||
    route.path.startsWith('/map') ||
    route.path.startsWith('/persons') ||
    route.path.startsWith('/events') ||
    route.path.startsWith('/prophecies') ||
    route.path.startsWith('/strongs'),
)

/** 图书馆子页激活（书籍 /library、教会历史 /history、数据来源 /sources） */
const libraryActive = computed(
  () =>
    route.path.startsWith('/library') ||
    route.path.startsWith('/history') ||
    route.path.startsWith('/sources'),
)

/** 下拉互斥：展开一个收起另一个 */
function toggleBible() {
  bibleOpen.value = !bibleOpen.value
  if (bibleOpen.value) libraryOpen.value = false
}
function toggleLibrary() {
  libraryOpen.value = !libraryOpen.value
  if (libraryOpen.value) bibleOpen.value = false
}

/** 点击外部关闭下拉 */
function onDocClick(e) {
  if ((bibleOpen.value || libraryOpen.value) && !e.target.closest('.nav-menu')) {
    bibleOpen.value = false
    libraryOpen.value = false
  }
}

/** Esc 关闭下拉（键盘可访问性） */
function onDocKeydown(e) {
  if (e.key === 'Escape' && (bibleOpen.value || libraryOpen.value)) {
    bibleOpen.value = false
    libraryOpen.value = false
  }
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
        <RouterLink to="/" exact-active-class="router-link-active" active-class="">首页</RouterLink>
        <div class="nav-menu">
          <button
            class="nav-btn"
            :class="{ active: bibleActive, open: bibleOpen }"
            :aria-expanded="bibleOpen"
            aria-haspopup="menu"
            @click="toggleBible"
          >
            <span>圣经</span>
          </button>
          <Transition name="menu">
            <div v-if="bibleOpen" class="nav-pop" role="menu">
              <RouterLink to="/brp" class="nav-item" role="menuitem" @click="bibleOpen = false">
                <span class="nav-ico" aria-hidden="true">📖</span>
                <span>经文</span>
              </RouterLink>
              <RouterLink to="/map" class="nav-item" role="menuitem" @click="bibleOpen = false">
                <span class="nav-ico" aria-hidden="true">🗺️</span>
                <span>地图</span>
              </RouterLink>
              <RouterLink to="/persons" class="nav-item" role="menuitem" @click="bibleOpen = false">
                <span class="nav-ico" aria-hidden="true">👤</span>
                <span>人物</span>
              </RouterLink>
              <RouterLink to="/events" class="nav-item" role="menuitem" @click="bibleOpen = false">
                <span class="nav-ico" aria-hidden="true">⏳</span>
                <span>事件</span>
              </RouterLink>
              <RouterLink to="/prophecies" class="nav-item" role="menuitem" @click="bibleOpen = false">
                <span class="nav-ico" aria-hidden="true">🔯</span>
                <span>预言</span>
              </RouterLink>
              <RouterLink to="/strongs" class="nav-item" role="menuitem" @click="bibleOpen = false">
                <span class="nav-ico" aria-hidden="true">📜</span>
                <span>原文词典</span>
              </RouterLink>
            </div>
          </Transition>
        </div>
        <RouterLink to="/apologetics">护教</RouterLink>
        <div class="nav-menu">
          <button
            class="nav-btn"
            :class="{ active: libraryActive, open: libraryOpen }"
            :aria-expanded="libraryOpen"
            aria-haspopup="menu"
            @click="toggleLibrary"
          >
            <span>图书馆</span>
          </button>
          <Transition name="menu">
            <div v-if="libraryOpen" class="nav-pop" role="menu">
              <RouterLink to="/library" class="nav-item" role="menuitem" @click="libraryOpen = false">
                <span class="nav-ico" aria-hidden="true">📚</span>
                <span>文库</span>
              </RouterLink>
              <RouterLink to="/history" class="nav-item" role="menuitem" @click="libraryOpen = false">
                <span class="nav-ico" aria-hidden="true">⛪</span>
                <span>教会历史</span>
              </RouterLink>
              <RouterLink to="/sources" class="nav-item" role="menuitem" @click="libraryOpen = false">
                <span class="nav-ico" aria-hidden="true">📑</span>
                <span>数据来源</span>
              </RouterLink>
            </div>
          </Transition>
        </div>
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
/* 可展开下拉词条（圣经 / 图书馆）：按钮单点展开，不跳转 */
.nav-menu {
  position: relative;
}
.nav-btn {
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
.nav-btn:hover,
.nav-btn.active {
  color: #101010;
  font-weight: 600;
}
.nav-btn.active {
  position: relative;
}
.nav-btn.active::after {
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
.nav-pop {
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
.nav-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.7rem;
  border-radius: 7px;
  color: #3a3a3a;
  white-space: nowrap;
}
.nav-item:hover {
  background: rgba(139, 115, 85, 0.08);
  color: #101010;
  text-decoration: none;
}
.nav-item.router-link-active {
  color: var(--gold);
  font-weight: 600;
  background: rgba(139, 115, 85, 0.07);
}
.nav-item.router-link-active::after {
  display: none;
}
.nav-ico {
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
  /* 移动端：导航紧凑排列 */
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
  .nav-btn.active::after {
    width: 14px;
    bottom: -3px;
  }
  /* 移动端弹窗改用 fixed：脱离 .nav 的 overflow-x:auto 滚动容器——
     absolute 弹窗会被 nav 裁剪（只有几像素可见，展开项"不显示"） */
  .nav-pop {
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
