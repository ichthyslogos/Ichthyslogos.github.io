<script setup>
/**
 * ApologeticsPage — 护教页面（图谱优先 · 双层论证图谱）
 *
 * 设计依据：《FISH 护教论证图谱 v1.0》。抛弃长文章列表为主的表现方式，
 * 以「可拖动无限画布 + 逻辑节点 + 关系边」呈现，并做成双层结构来论证基督教客观性：
 *
 *   总图谱（Meta）  全部护教主题按论证角色连成一张证明「基督教信仰客观性」的
 *                   整体论证图（核心结论 ← 命题/证据支柱；苦难问题为反方并被回应）。
 *   子图谱（Topic） 点任一主题下钻，展开其内部论证：命题 → 质疑 → 回应 → 证据/经文。
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { fetchApologetics } from '../../lib/data.js'
import EmptyState from '../../components/EmptyState.vue'
import MetaGraph from '../../components/apologetics/MetaGraph.vue'
import ArgumentGraph from '../../components/apologetics/ArgumentGraph.vue'

const route = useRoute()

/** 主题索引（总图谱 + 下钻用） */
const index = ref(null)
const loading = ref(false)
const error = ref('')
/** 视图：meta=总论证图谱（落地） / topic=单主题内部论证图 */
const view = ref('meta')
const activeTopicId = ref('')

/** 深链下钻：/apologetics?topic=<id>（搜索结果跳转用）。
 * 组件已挂载时 query 变化也响应（watch），首次加载由 onMounted 触发。 */
function applyTopicDeepLink(t) {
  if (!t || !index.value) return
  if (index.value.topics.some((x) => x.id === t)) openTopic(t)
}
watch(() => route.query.topic, applyTopicDeepLink)

onMounted(async () => {
  loading.value = true
  try {
    index.value = await fetchApologetics()
    error.value = ''
    applyTopicDeepLink(route.query.topic)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

const topics = computed(() => index.value?.topics || [])

/** 点主题 → 下钻到其内部论证图 */
function openTopic(id) {
  activeTopicId.value = id
  view.value = 'topic'
}

/** 返回总图谱 */
function backToMeta() {
  view.value = 'meta'
}
</script>

<template>
  <div class="apologetics" :class="{ 'ap-graph-mode': view !== 'meta' }">
    <div v-if="loading" class="page-state">内容加载中…</div>
    <EmptyState v-else-if="error" title="内容加载失败" :message="error" />

    <!-- ===== 总论证图谱（护教页落地视图） ===== -->
    <MetaGraph v-else-if="view === 'meta'" :topics="topics" @open-topic="openTopic" />

    <!-- ===== 单主题内部论证图 ===== -->
    <ArgumentGraph v-else :key="activeTopicId" :topic-id="activeTopicId" @back="backToMeta" />
  </div>
</template>

<style scoped>
.apologetics { flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--bg); }
.page-state { text-align: center; padding: 4rem 0; color: var(--muted); }
.apologetics.ap-graph-mode { height: 100%; overflow: hidden; }
</style>