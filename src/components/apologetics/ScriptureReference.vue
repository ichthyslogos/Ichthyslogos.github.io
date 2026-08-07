<script setup>
/**
 * ScriptureReference — 经文引用条目（证据面板内）
 * 支持跳转读经研究：解析「书卷名 章:节」→ /brp/{bookId}/{chapter}
 * 无法识别的书卷名则不渲染链接（纯文本展示）。
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps({
  refText: { type: String, required: true },
  note: { type: String, default: '' },
})

/** 中文书卷名 → BRP bookId（和合本 66 卷编号） */
const BOOK_IDS = {
  创世记: '01', 出埃及记: '02', 利未记: '03', 民数记: '04', 申命记: '05',
  约书亚记: '06', 士师记: '07', 路得记: '08', 撒母耳记上: '09', 撒母耳记下: '10',
  列王纪上: '11', 列王纪下: '12', 历代志上: '13', 历代志下: '14', 以斯拉记: '15',
  尼希米记: '16', 以斯帖记: '17', 约伯记: '18', 诗篇: '19', 箴言: '20',
  传道书: '21', 雅歌: '22', 以赛亚书: '23', 耶利米书: '24', 耶利米哀歌: '25',
  以西结书: '26', 但以理书: '27', 何西阿书: '28', 约珥书: '29', 阿摩司书: '30',
  俄巴底亚书: '31', 约拿书: '32', 弥迦书: '33', 那鸿书: '34', 哈巴谷书: '35',
  西番雅书: '36', 哈该书: '37', 撒迦利亚书: '38', 玛拉基书: '39', 马太福音: '40',
  马可福音: '41', 路加福音: '42', 约翰福音: '43', 使徒行传: '44', 罗马书: '45',
  哥林多前书: '46', 哥林多后书: '47', 加拉太书: '48', 以弗所书: '49', 腓立比书: '50',
  歌罗西书: '51', 帖撒罗尼迦前书: '52', 帖撒罗尼迦后书: '53', 提摩太前书: '54', 提摩太后书: '55',
  提多书: '56', 腓利门书: '57', 希伯来书: '58', 雅各书: '59', 彼得前书: '60',
  彼得后书: '61', 约翰一书: '62', 约翰二书: '63', 约翰三书: '64', 犹大书: '65', 启示录: '66',
}

/** 解析「创世记 1:1」→ { bookId, chapter }；失败返回 null */
const target = computed(() => {
  const m = props.refText.match(/^([\u4e00-\u9fa5]+)\s*(\d+)(?::\d+)?/)
  if (!m) return null
  const id = BOOK_IDS[m[1]]
  if (!id) return null
  return { bookId: id, chapter: Number(m[2]) }
})
</script>

<template>
  <RouterLink v-if="target" :to="`/brp/${target.bookId}/${target.chapter}`" class="scripture-ref">
    <span class="sr-ref">{{ refText }}</span>
    <span v-if="note" class="sr-note">{{ note }}</span>
    <span class="sr-go">读经 →</span>
  </RouterLink>
  <div v-else class="scripture-ref">
    <span class="sr-ref">{{ refText }}</span>
    <span v-if="note" class="sr-note">{{ note }}</span>
  </div>
</template>

<style scoped>
.scripture-ref {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  text-decoration: none;
  padding: 0.1rem 0;
}
.sr-ref {
  flex-shrink: 0;
  font-size: 0.85rem;
  font-weight: 700;
  color: #1f2937;
}
.sr-note {
  flex: 1;
  min-width: 0;
  font-size: 0.8rem;
  color: #8a93a0;
  line-height: 1.6;
}
.sr-go {
  flex-shrink: 0;
  font-size: 0.75rem;
  color: #8b7355;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.scripture-ref:hover .sr-go {
  opacity: 1;
}
.scripture-ref:hover .sr-ref {
  color: #8b7355;
}
</style>
