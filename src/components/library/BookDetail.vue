<script setup>
/**
 * BookDetail — 书目详情（图书馆，左右分栏）
 * 左栏：返回 + 封面 + 元信息 + 描述 + 文件清单（内容多时内部滚动）
 * 右栏：预览常驻（自动预览第一个可预览文件；无预览时显示占位提示）
 * 页面本身不滚动（整屏布局）；移动端退回上下布局（信息 + 下方预览）。
 */
import { ref, computed } from 'vue'
import ReaderPanel from './ReaderPanel.vue'

const props = defineProps({
  book: { type: Object, required: true }, // 详情切片（含 files[]）
})
const emit = defineEmits(['back'])

/** 当前预览中的文件（null = 无预览） */
const activeFile = ref(null)

/** 首个可预览文件（自动预览用） */
const PREVIEWABLE = new Set(['pdf', 'epub', 'audio', 'image'])
const firstPreviewable = computed(
  () => (props.book.files || []).find((f) => PREVIEWABLE.has(f.format)) || null,
)
activeFile.value = firstPreviewable.value

const LANG_NAMES = { zh: '中文', en: '英文', la: '拉丁文', grc: '希腊文', he: '希伯来文', fr: '法文' }

/** 字节 → 可读大小 */
function fmtSize(n) {
  if (!n) return ''
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${n} B`
}
</script>

<template>
  <div class="book-detail">
    <!-- 左栏：书目信息 + 文件清单 -->
    <aside class="detail-left">
      <button class="back-btn" @click="emit('back')">← 返回书架</button>
      <div class="detail-cover">
        <img v-if="book.cover" :src="book.cover" :alt="book.title" />
        <div v-else class="cover-fallback">{{ (book.title || '?')[0] }}</div>
      </div>
      <h1 class="detail-title">{{ book.title }}</h1>
      <div class="detail-author">{{ book.author || '佚名' }}</div>
      <div class="detail-tags">
        <span v-if="book.year" class="tag">{{ book.year }}</span>
        <span class="tag">{{ LANG_NAMES[book.lang] || book.lang || '未标注' }}</span>
        <span v-for="t in book.tags" :key="t" class="tag">{{ t }}</span>
      </div>
      <p v-if="book.description" class="detail-desc">{{ book.description }}</p>

      <h2 class="files-title">资料文件（{{ book.files?.length || 0 }}）</h2>
      <div v-if="book.files?.length" class="file-list">
        <div v-for="(f, i) in book.files" :key="i" class="file-item">
          <div class="file-info">
            <span class="file-fmt">{{ f.format }}</span>
            <span class="file-name" :title="f.title || f.url">{{ f.title || f.url }}</span>
            <span v-if="f.size" class="file-size">{{ fmtSize(f.size) }}</span>
          </div>
          <div class="file-actions">
            <button
              v-if="PREVIEWABLE.has(f.format)"
              class="btn"
              :class="{ primary: activeFile === f }"
              @click="activeFile = activeFile === f ? null : f"
            >
              {{ activeFile === f ? '收起预览' : '预览' }}
            </button>
            <a class="btn" :href="f.url" download :download="`${book.title}.${f.format}`">下载</a>
          </div>
        </div>
      </div>
      <p v-else class="no-files">本书暂未提供文件。</p>
    </aside>

    <!-- 右栏：预览常驻 -->
    <section class="detail-right">
      <ReaderPanel v-if="activeFile" :file="activeFile" :book-title="book.title" @close="activeFile = null" />
      <div v-else class="preview-placeholder">
        <p>选择上方文件即可预览</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* 整屏左右分栏：页面本身不滚动（删除滚轮），左栏内容多时内部滚动 */
.book-detail {
  flex: 1;
  display: flex;
  min-height: 0;
}
.detail-left {
  width: min(21rem, 30vw);
  flex-shrink: 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
  padding: 1.2rem 1.3rem 2rem;
  border-right: 1px solid var(--line-soft);
  background: var(--panel);
}
.back-btn {
  border: none;
  background: transparent;
  color: var(--accent);
  font-size: 0.9rem;
  padding: 0.2rem 0;
  margin-bottom: 0.9rem;
  cursor: pointer;
}
.back-btn:hover {
  text-decoration: underline;
}
.detail-cover {
  width: 7.5rem;
  aspect-ratio: 3 / 4;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: linear-gradient(160deg, var(--accent-soft) 0%, var(--gold-soft) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.9rem;
  box-shadow: var(--shadow-sm);
}
.detail-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cover-fallback {
  font-size: 2.6rem;
  font-weight: 700;
  color: var(--accent);
  opacity: 0.85;
}
.detail-title {
  margin: 0 0 0.3rem;
  font-size: 1.2rem;
  line-height: 1.45;
}
.detail-author {
  color: var(--muted);
  font-size: 0.92rem;
  margin-bottom: 0.6rem;
}
.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.8rem;
}
.tag {
  font-size: 0.72rem;
  color: var(--muted);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0.1rem 0.55rem;
}
.detail-desc {
  font-size: 0.9rem;
  line-height: 1.8;
  color: #3c4652;
  margin: 0 0 1.1rem;
}
.files-title {
  font-size: 1rem;
  margin: 0 0 0.6rem;
}
.file-list {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.file-item {
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-sm);
  background: var(--panel);
  box-shadow: var(--shadow-sm);
  padding: 0.55rem 0.8rem;
}
.file-info {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
  margin-bottom: 0.45rem;
}
.file-fmt {
  font-size: 0.66rem;
  font-weight: 700;
  color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: 3px;
  padding: 0 0.3rem;
  flex-shrink: 0;
}
.file-name {
  font-size: 0.88rem;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.file-size {
  font-size: 0.72rem;
  color: var(--muted);
  flex-shrink: 0;
  margin-left: auto;
}
.file-actions {
  display: flex;
  gap: 0.4rem;
}
.btn {
  font-size: 0.78rem;
  padding: 0.26rem 0.8rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent);
  color: var(--accent);
  background: var(--panel);
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
}
.btn:hover {
  background: var(--accent-soft);
}
.btn.primary {
  background: var(--accent);
  color: #fff;
}
.no-files {
  color: var(--muted);
  font-size: 0.88rem;
}
/* 右栏：预览占满剩余空间 */
.detail-right {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}
.preview-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  font-size: 0.92rem;
}

/* 移动端：退回上下布局（信息 + 文件 + 下方预览，右栏占满高度） */
@media (max-width: 900px) {
  .book-detail {
    flex-direction: column;
    overflow-y: auto;
  }
  .detail-left {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--line);
    padding: 1rem 0.9rem;
    overflow: visible;
  }
  .detail-right {
    flex: none;
    height: 78vh;
  }
}
</style>
