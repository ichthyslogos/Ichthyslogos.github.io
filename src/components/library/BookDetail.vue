<script setup>
/**
 * BookDetail — 书目详情（图书馆）
 * 元信息 + 描述 + 文件清单（每项：格式/大小/预览/下载）；
 * 预览由 ReaderPanel 按格式分发（PDF 内嵌 / EPUB epub.js / 音频 / 图片）。
 */
import { ref } from 'vue'
import ReaderPanel from './ReaderPanel.vue'

const props = defineProps({
  book: { type: Object, required: true }, // 详情切片（含 files[]）
})
const emit = defineEmits(['back'])

/** 当前预览中的文件（null = 无预览） */
const activeFile = ref(null)

const LANG_NAMES = { zh: '中文', en: '英文', la: '拉丁文', grc: '希腊文', he: '希伯来文', fr: '法文' }

/** 字节 → 可读大小 */
function fmtSize(n) {
  if (!n) return ''
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${n} B`
}

/** 预览能力：当前支持的格式 */
const PREVIEWABLE = new Set(['pdf', 'epub', 'audio', 'image'])
</script>

<template>
  <div class="book-detail">
    <button class="back-btn" @click="emit('back')">← 返回书架</button>
    <div class="detail-head">
      <div class="detail-cover">
        <img v-if="book.cover" :src="book.cover" :alt="book.title" />
        <div v-else class="cover-fallback">{{ (book.title || '?')[0] }}</div>
      </div>
      <div class="detail-info">
        <h1 class="detail-title">{{ book.title }}</h1>
        <div class="detail-author">{{ book.author || '佚名' }}</div>
        <div class="detail-tags">
          <span v-if="book.year" class="tag">{{ book.year }}</span>
          <span class="tag">{{ LANG_NAMES[book.lang] || book.lang || '未标注' }}</span>
          <span v-for="t in book.tags" :key="t" class="tag">{{ t }}</span>
        </div>
        <p v-if="book.description" class="detail-desc">{{ book.description }}</p>
      </div>
    </div>

    <h2 class="files-title">资料文件（{{ book.files?.length || 0 }}）</h2>
    <div v-if="book.files?.length" class="file-list">
      <div v-for="(f, i) in book.files" :key="i" class="file-item">
        <div class="file-info">
          <span class="file-fmt">{{ f.format }}</span>
          <span class="file-name">{{ f.title || f.url }}</span>
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

    <ReaderPanel v-if="activeFile" :file="activeFile" :book-title="book.title" @close="activeFile = null" />
  </div>
</template>

<style scoped>
.book-detail {
  flex: 1;
  overflow-y: auto;
  scrollbar-gutter: stable;
  padding: 1.2rem 1.4rem 3rem;
  max-width: 52rem;
}
.back-btn {
  border: none;
  background: transparent;
  color: var(--accent);
  font-size: 0.9rem;
  padding: 0.2rem 0;
  margin-bottom: 1rem;
  cursor: pointer;
}
.back-btn:hover {
  text-decoration: underline;
}
.detail-head {
  display: flex;
  gap: 1.2rem;
  margin-bottom: 1.6rem;
}
.detail-cover {
  width: 8.5rem;
  flex-shrink: 0;
  aspect-ratio: 3 / 4;
  border-radius: 8px;
  overflow: hidden;
  background: var(--accent-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}
.detail-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cover-fallback {
  font-size: 3rem;
  font-weight: 700;
  color: var(--accent);
  opacity: 0.85;
}
.detail-info {
  min-width: 0;
}
.detail-title {
  margin: 0 0 0.3rem;
  font-size: 1.35rem;
  line-height: 1.4;
}
.detail-author {
  color: var(--muted);
  font-size: 0.95rem;
  margin-bottom: 0.6rem;
}
.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.9rem;
}
.tag {
  font-size: 0.72rem;
  color: var(--muted);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0.1rem 0.55rem;
}
.detail-desc {
  font-size: 0.93rem;
  line-height: 1.85;
  color: #3c4652;
  margin: 0;
}
.files-title {
  font-size: 1.05rem;
  margin: 0 0 0.7rem;
}
.file-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  padding: 0.6rem 0.9rem;
}
.file-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
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
  font-size: 0.9rem;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.file-size {
  font-size: 0.74rem;
  color: var(--muted);
  flex-shrink: 0;
}
.file-actions {
  display: flex;
  gap: 0.4rem;
  flex-shrink: 0;
}
.btn {
  font-size: 0.8rem;
  padding: 0.28rem 0.85rem;
  border-radius: 6px;
  border: 1px solid var(--accent);
  color: var(--accent);
  background: #fff;
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
  font-size: 0.9rem;
}
@media (max-width: 900px) {
  .book-detail {
    padding: 1rem 0.9rem 2.5rem;
  }
  .detail-head {
    flex-direction: column;
    gap: 0.8rem;
  }
  .detail-cover {
    width: 6.5rem;
  }
  .file-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  .file-actions {
    width: 100%;
  }
  .file-actions .btn {
    flex: 1;
    text-align: center;
  }
}
</style>
