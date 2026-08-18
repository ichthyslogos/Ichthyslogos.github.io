<script setup>
/**
 * ReaderPanel — 资料预览（图书馆，按格式分发）
 * - pdf   ：iframe 内嵌浏览器原生 PDF 查看器（零依赖；GitHub Pages 支持 range 请求）
 * - epub  ：epub.js 渲染（动态 import，避免主包体积增加）
 * - audio ：原生 <audio> 播放器
 * - image ：大图灯箱式展示
 * 所有格式下方均提供下载链接（直链 <a download>）。
 */
import { ref, watch, onBeforeUnmount } from 'vue'

const props = defineProps({
  file: { type: Object, required: true }, // { url, format, size, title }
  bookTitle: { type: String, default: '' },
})
const emit = defineEmits(['close'])

const epubHolder = ref(null)
const epubErr = ref('')
let book = null // epub.js 实例（卸载时销毁）
let rendition = null // renderTo 返回的渲染实例（持有 iframe 与事件监听，需一并销毁）
let epubSeq = 0 // 切换守卫：文件/格式切换后丢弃过期的异步渲染

/** 销毁当前 epub.js 实例（切换文件/格式或卸载时调用） */
function destroyBook() {
  if (rendition) {
    try {
      rendition.destroy()
    } catch {
      /* ignore */
    }
    rendition = null
  }
  if (book) {
    try {
      book.destroy()
    } catch {
      /* ignore */
    }
    book = null
  }
}

/** EPUB：动态加载 epubjs 并渲染（懒加载，不进主包） */
watch(
  () => props.file,
  async (f) => {
    // 守卫序号先于一切 return 递增：离开 epub 格式也要让在途旧渲染全部失效
    const seq = ++epubSeq
    epubErr.value = ''
    destroyBook() // 切换前销毁旧实例：避免残留渲染覆盖新内容或造成资源泄漏
    if (!f || f.format !== 'epub') return
    try {
      const { default: ePub } = await import('epubjs')
      await nextTickSafe()
      if (seq !== epubSeq || !epubHolder.value) return
      book = ePub(f.url)
      rendition = book.renderTo(epubHolder.value, { width: '100%', height: '100%' })
      await book.ready
      if (seq !== epubSeq) return // 期间已切换到其他文件/格式，丢弃本次渲染
      const nav = book.navigation
      if (nav && nav.toc && nav.toc.length) {
        await rendition.display(nav.toc[0].href)
      }
    } catch (e) {
      if (seq !== epubSeq) return
      epubErr.value = `EPUB 预览失败：${e.message || '无法加载'}`
    }
  },
  { immediate: true },
)

function nextTickSafe() {
  return new Promise((r) => setTimeout(r, 50))
}

onBeforeUnmount(() => {
  destroyBook()
})
</script>

<template>
  <div class="reader-panel">
    <div class="reader-bar">
      <span class="reader-title">{{ file.title || bookTitle }}</span>
      <div class="reader-actions">
        <a class="btn" :href="file.url" download>下载</a>
        <button class="btn primary" @click="emit('close')">关闭预览</button>
      </div>
    </div>
    <div class="reader-body">
      <!-- PDF：浏览器原生查看器 -->
      <iframe v-if="file.format === 'pdf'" class="reader-frame" :src="file.url" title="PDF 预览"></iframe>
      <!-- EPUB：epub.js 渲染容器 -->
      <div v-else-if="file.format === 'epub'" ref="epubHolder" class="epub-holder"></div>
      <!-- 音频 -->
      <div v-else-if="file.format === 'audio'" class="audio-wrap">
        <audio controls :src="file.url" class="audio-player"></audio>
      </div>
      <!-- 图片 -->
      <div v-else-if="file.format === 'image'" class="image-wrap">
        <img :src="file.url" :alt="file.title || bookTitle" loading="lazy" />
      </div>
      <p v-else class="reader-err">该格式暂不支持在线预览，请下载后查看。</p>
      <!-- EPUB 加载错误提示（独立于格式分发链之外） -->
      <p v-if="file.format === 'epub' && epubErr" class="reader-err">{{ epubErr }}</p>
    </div>
  </div>
</template>

<style scoped>
.reader-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-md);
  background: var(--panel);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  margin: 0.9rem;
}
.reader-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.55rem 0.9rem;
  border-bottom: 1px solid var(--line-soft);
  background: var(--panel);
}
.reader-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.reader-actions {
  display: flex;
  gap: 0.4rem;
  flex-shrink: 0;
}
.btn {
  font-size: 0.78rem;
  padding: 0.24rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent);
  color: var(--accent);
  background: var(--panel);
  cursor: pointer;
  text-decoration: none;
}
.btn:hover {
  background: var(--accent-soft);
}
.btn.primary {
  background: var(--accent);
  color: #fff;
}
.reader-body {
  flex: 1;
  min-height: 0;
  position: relative;
}
.reader-frame {
  width: 100%;
  height: 100%;
  border: none;
  background: var(--bg);
}
.epub-holder {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background: var(--bg);
}
.audio-wrap {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
}
.audio-player {
  width: min(26rem, 90%);
}
.image-wrap {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  padding: 0.6rem;
}
.image-wrap img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.reader-err {
  padding: 1.2rem;
  text-align: center;
  color: var(--muted);
  font-size: 0.9rem;
}
</style>
