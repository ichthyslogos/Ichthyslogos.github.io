<script setup>
/**
 * BookCard — 书目卡片（图书馆书架）
 * 展示封面（无封面时用书名首字占位）、书名、作者、格式徽章；点击打开详情。
 */
const props = defineProps({
  book: { type: Object, required: true }, // 索引条目（id/title/author/formats/cover/...）
})
const emit = defineEmits(['open'])

const FORMAT_NAMES = { pdf: 'PDF', epub: 'EPUB', audio: '音频', image: '图' }
</script>

<template>
  <button class="book-card" @click="emit('open')" :aria-label="`查看 ${book.title}`">
    <div class="book-cover">
      <img v-if="book.cover" :src="book.cover" :alt="book.title" loading="lazy" />
      <div v-else class="cover-fallback">{{ (book.title || '?')[0] }}</div>
    </div>
    <div class="book-meta">
      <div class="book-title" :title="book.title">{{ book.title }}</div>
      <div class="book-author">{{ book.author || '佚名' }}</div>
      <div class="book-formats">
        <span v-for="f in book.formats" :key="f" class="fmt-badge">{{ FORMAT_NAMES[f] || f }}</span>
      </div>
    </div>
  </button>
</template>

<style scoped>
.book-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
  text-align: left;
  padding: 0;
  cursor: pointer;
  transition: box-shadow 0.18s ease, transform 0.18s ease;
}
.book-card:hover {
  box-shadow: 0 6px 18px rgba(20, 28, 38, 0.12);
  transform: translateY(-2px);
}
.book-cover {
  aspect-ratio: 3 / 4;
  background: var(--accent-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}
.book-cover img {
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
.book-meta {
  padding: 0.55rem 0.7rem 0.65rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}
.book-title {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--text);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
.book-author {
  font-size: 0.78rem;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.book-formats {
  display: flex;
  gap: 0.3rem;
  margin-top: 0.1rem;
}
.fmt-badge {
  font-size: 0.66rem;
  color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: 3px;
  padding: 0 0.28rem;
  opacity: 0.85;
}
</style>
