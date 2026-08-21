<script setup>
/* MetaTopicNode — 总图谱主题节点（按论证角色配色；点击下钻到该主题内部论证图） */
import { computed } from 'vue'
const props = defineProps({ data: { type: Object, default: {} }, selected: { type: Boolean, default: false } })

const ROLE_CLASS = {
  claim: 'role-claim',
  evidence: 'role-evidence',
  objection: 'role-objection',
  application: 'role-application',
}
const theme = computed(() => ROLE_CLASS[props.data.role] || 'role-claim')
</script>

<template>
  <div class="gn mt-topic" :class="[theme, { sel: selected }]">
    <div class="gn-head">
      <span class="gn-kind">{{ data.roleLabel }}</span>
      <span class="gn-num">{{ data.sqCount }} 个子命题</span>
    </div>
    <div class="gn-title">{{ data.titleZh }}</div>
    <div v-if="data.titleEn" class="gn-en">{{ data.titleEn }}</div>
    <div v-if="data.tags?.length" class="gn-tags">{{ data.tags.join(' · ') }}</div>
    <div class="gn-drill">点击查看论证细节 →</div>
  </div>
</template>

<style scoped>
.gn {
  width: 300px;
  border-radius: 14px;
  padding: 0.95rem 1.1rem;
  background: var(--panel);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: box-shadow var(--dur) var(--ease), border-color var(--dur) var(--ease), transform var(--dur) var(--ease);
}
.gn:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
.gn.sel { box-shadow: var(--shadow-md); }

.gn-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.5rem; }
.gn-kind { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; color: #fff; border-radius: 999px; padding: 0.1rem 0.6rem; }
.gn-num { font-size: 0.72rem; color: #a7adb6; font-variant-numeric: tabular-nums; }
.gn-title { font-size: 1.08rem; font-weight: 700; line-height: 1.5; color: var(--text); }
.gn-en { font-size: 0.78rem; color: #a7adb6; letter-spacing: 0.03em; margin-top: 0.2rem; }
.gn-tags { margin-top: 0.4rem; font-size: 0.74rem; color: #a7adb6; }
.gn-drill { margin-top: 0.6rem; padding-top: 0.55rem; border-top: 1px solid var(--line-soft); font-size: 0.74rem; font-weight: 600; color: var(--gold); }

/* 角色配色 */
.role-claim { border: 1.5px solid #c9d6ea; }
.role-claim .gn-kind { background: var(--accent); }
.role-claim.sel, .role-claim:hover { border-color: var(--accent); }

.role-evidence { border: 1.5px solid #d7cfe6; background: #faf9fc; }
.role-evidence .gn-kind { background: #7a5f9e; }
.role-evidence.sel, .role-evidence:hover { border-color: #7a5f9e; }

.role-objection { border: 1.5px solid #e4bdb3; background: #fdf7f5; }
.role-objection .gn-kind { background: #b3452e; }
.role-objection .gn-title { color: #7a4a3c; }
.role-objection.sel, .role-objection:hover { border-color: #b3452e; }

.role-application { border: 1.5px solid #bcd9d3; background: #f5fbfa; }
.role-application .gn-kind { background: #3d7a80; }
.role-application.sel, .role-application:hover { border-color: #3d7a80; }
</style>