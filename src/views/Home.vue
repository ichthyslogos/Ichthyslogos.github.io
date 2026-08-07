<script setup>
/**
 * Home — 网站首页（FISH 品牌）
 * 风格：现代科技极简（白底 + 近黑大字 + 大留白 + 低饱和雾感氛围带做情绪锚点；
 *       非对称两列：左大标题 / 右侧副文+按钮；零边框零卡片，功能以行式列表呈现）
 * 数据统计从 manifest 动态读取：新增译本后自动更新
 */
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchManifest } from '../lib/data.js'

const manifest = ref(null)

onMounted(async () => {
  try {
    manifest.value = await fetchManifest()
  } catch {
    manifest.value = null
  }
})

const stats = computed(() => {
  if (!manifest.value) return null
  const ts = manifest.value.translations
  return {
    versions: ts.length,
    books: ts.reduce((s, t) => s + t.books.length, 0),
  }
})

const features = [
  {
    title: '读经研究平台 (brp)',
    desc: '在线阅读圣经：书卷/章节导航、多译本一键切换、串珠交叉引用（数据驱动，放入即显示）。',
    status: '已上线',
    statusClass: 'on',
    to: '/brp',
  },
  {
    title: '马太亨利译注',
    desc: '解经面板已接入马太亨利圣经注释：按书卷+章节对齐显示概要与小节注释，持续收录扩充中（当前已开放旧约前 10 卷）。',
    status: '已上线',
    statusClass: 'on',
    to: '/brp',
  },
  {
    title: 'Strong 原文研究',
    desc: '规划中：原文（希伯来文/希腊文）与译本数据流隔离，按 Strong 编号挂接词义注解。',
    status: '规划中',
    statusClass: 'soon',
    to: null,
  },
]
</script>

<template>
  <div class="home">
    <!-- 低饱和雾感氛围带：模拟参考风格的实景照片（无文字叠加），下缘奶油色硬切白底 -->
    <div class="atmosphere" aria-hidden="true"></div>

    <section class="hero">
      <h1 class="hero-title">读经<br />研究平台</h1>
      <div class="hero-side">
        <p class="hero-desc">
          轻量中文读经研究工具：多译本对照、马太亨利译注、串珠交叉引用。
          素材与框架严格隔离，数据流水线驱动——新译本放入数据库即可自动上架。
        </p>
        <div class="hero-actions">
          <RouterLink to="/brp" class="btn btn-primary">进入读经研究 <span class="arrow">→</span></RouterLink>
        </div>
        <p v-if="stats" class="hero-stats">{{ stats.versions }} 个译本 · {{ stats.books }} 卷经文</p>
      </div>
    </section>

    <section class="features">
      <div v-for="f in features" :key="f.title" class="feature-row">
        <div class="feature-head">
          <span class="feature-dot" :class="f.statusClass" aria-hidden="true"></span>
          <h2>{{ f.title }}</h2>
          <span class="feature-status" :class="f.statusClass">{{ f.status }}</span>
        </div>
        <p class="feature-desc">{{ f.desc }}</p>
        <RouterLink v-if="f.to" :to="f.to" class="feature-link">打开 →</RouterLink>
      </div>
    </section>

    <footer class="home-footer">
      <p>
        数据源：bible_databases（scrollmapper）· SWORD ChiUns · TSK 串珠素材。
        素材存放于 <code>D:\Eyphka\fish\</code>，与网站 <code>site\</code> 严格隔离，详细架构见 <code>docs\</code>。
      </p>
    </footer>
  </div>
</template>

<style scoped>
.home {
  flex: 1;
  background: #fff;
}

/* 氛围带：雾感海岸山景（天空灰白 → 山脊蓝灰 → 暖棕坡 → 海面青绿 → 奶油水线），
   用 CSS 渐变与色块还原照片质感，避免引入额外图片素材 */
.atmosphere {
  position: relative;
  height: 42vh;
  min-height: 260px;
  background: linear-gradient(
    180deg,
    #e9e8e5 0%,
    #aab0b6 30%,
    #8fa0a8 46%,
    #5e7a80 62%,
    #3f6b78 80%,
    #f3ecdd 84%,
    #f3ecdd 100%
  );
  overflow: hidden;
}
/* 左侧暗色山崖 */
.atmosphere::before {
  content: '';
  position: absolute;
  left: 0;
  top: 34%;
  bottom: 16%;
  width: 20%;
  background: linear-gradient(180deg, #4a403c, #1a1a1a);
}
/* 右侧受光暖棕坡面 */
.atmosphere::after {
  content: '';
  position: absolute;
  right: 0;
  top: 40%;
  bottom: 0;
  width: 32%;
  background: linear-gradient(180deg, #b1a08c, #8f8070);
  opacity: 0.5;
}

/* Hero：非对称两列（左大标题 / 右侧副文+按钮），中缝留白 */
.hero {
  display: flex;
  justify-content: space-between;
  gap: 5rem;
  max-width: 74rem;
  margin: 0 auto;
  padding: 5rem 2.5rem 4.5rem;
}
.hero-title {
  margin: 0;
  font-size: 3rem;
  line-height: 1.18;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #101010;
}
.hero-side {
  max-width: 22rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1.4rem;
  padding-top: 0.4rem;
}
.hero-desc {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.9;
  color: #666;
}
.hero-actions {
  display: flex;
  gap: 0.8rem;
}
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #181818;
  color: #fff;
  border-radius: 8px;
  padding: 0.55rem 1.5rem;
  font-size: 0.95rem;
  font-weight: 600;
  text-decoration: none;
}
.btn-primary:hover {
  background: #000;
  text-decoration: none;
}
.arrow {
  font-size: 1rem;
  line-height: 1;
}
.hero-stats {
  margin: 0;
  font-size: 0.85rem;
  color: #999;
}

/* 功能列表：行式呈现（无卡片框），极浅分隔线区分 */
.features {
  max-width: 74rem;
  margin: 0 auto;
  padding: 0 2.5rem 4rem;
}
.feature-row {
  padding: 1.7rem 0;
  border-top: 1px solid #eee;
}
.feature-row:last-child {
  border-bottom: 1px solid #eee;
}
.feature-head {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}
.feature-head h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: #101010;
}
.feature-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #999;
  flex-shrink: 0;
}
.feature-dot.on {
  background: #1f6f4a;
}
.feature-dot.soon {
  background: #c9a227;
}
.feature-status {
  font-size: 0.75rem;
  color: #999;
}
.feature-status.on {
  color: #1f6f4a;
}
.feature-status.soon {
  color: #8a6d1a;
}
.feature-desc {
  margin: 0.7rem 0 0;
  max-width: 46rem;
  font-size: 0.92rem;
  line-height: 1.9;
  color: #666;
}
.feature-link {
  display: inline-block;
  margin-top: 0.6rem;
  font-size: 0.9rem;
  font-weight: 600;
}

.home-footer {
  border-top: 1px solid #eee;
  padding: 1.6rem 2.5rem 2.4rem;
  text-align: center;
  font-size: 0.8rem;
  color: #999;
}
.home-footer code {
  background: #f2f3f5;
  padding: 0.05rem 0.35rem;
  border-radius: 4px;
}

/* 窄屏：氛围带降低、两列堆叠 */
@media (max-width: 600px) {
  .atmosphere {
    height: 30vh;
    min-height: 190px;
  }
  .hero {
    flex-direction: column;
    gap: 2rem;
    padding: 3rem 1.5rem 3rem;
  }
  .hero-title {
    font-size: 2.2rem;
  }
  .hero-side {
    max-width: none;
  }
  .features {
    padding: 0 1.5rem 3rem;
  }
}
</style>
