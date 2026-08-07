<script setup>
/**
 * Home — 网站首页（FISH 鱼与饼 · 基督教研究平台品牌页）
 * 风格：现代 SaaS 极简奢华——白底、古典油画横幅、衬线大字标题、非对称两列、
 *       标题下功能关键词；大留白、无卡片、无渐变装饰。
 * 数据统计从 manifest 动态读取：新增译本后自动更新。
 */
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchManifest } from '../lib/data.js'
import bannerUrl from '../assets/hero-banner.jpg'

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
</script>

<template>
  <div class="home">
    <!-- 古典油画横幅：圣保拉在奥斯蒂亚登船（克劳德·洛兰, 1640，公有领域） -->
    <div class="banner" role="img" aria-label="古典油画：圣保拉在奥斯蒂亚港登船">
      <img :src="bannerUrl" alt="克劳德·洛兰《圣保拉在奥斯蒂亚登船》1640" />
    </div>

    <!-- Hero：左衬线大标题 + 经文副题 + 功能关键词 / 右侧描述 + 按钮（非对称两列） -->
    <section class="hero">
      <div class="hero-copy">
        <p class="hero-eyebrow">FISH · 基督教研究平台</p>
        <h1 class="hero-title">鱼与饼</h1>
        <p class="hero-sub">五饼二鱼，众人吃饱（约翰福音 6:1-14）</p>
        <p class="hero-tags">多译本对照 · 解经译注 · 串珠引用 · 护教问答 · 原文研究</p>
      </div>
      <div class="hero-side">
        <p class="hero-desc">
          面向中文读者的基督教研究与学习平台：多译本对照阅读、马太亨利译注、串珠交叉引用、护教问答。
          素材与框架严格隔离，数据流水线驱动——新内容放入数据库即可自动上架。
        </p>
        <div class="hero-actions">
          <RouterLink to="/brp" class="btn btn-primary">进入读经研究 <span class="arrow">→</span></RouterLink>
        </div>
        <p v-if="stats" class="hero-stats">{{ stats.versions }} 个译本 · {{ stats.books }} 卷经文</p>
      </div>
    </section>

    <footer class="home-footer">
      <p>
        <template v-if="stats">{{ stats.versions }} 个译本 · {{ stats.books }} 卷经文 · </template>
        FISH 鱼与饼 · 基督教研究平台
      </p>
    </footer>
  </div>
</template>

<style scoped>
.home {
  flex: 1;
  background: #fff;
}

/* 古典油画横幅：全宽，约 300px 高，cover 裁切 */
.banner {
  width: 100%;
  height: 300px;
  overflow: hidden;
  background: #d9d3c8; /* 油画底色，加载时占位 */
}
.banner img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center; /* 已预裁切横幅构图带，居中显示 */
  display: block;
}

/* Hero：非对称两列（左衬线大标题 / 右侧描述+按钮），内容区充满页面（左右 padding 而非居中限宽） */
.hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 5rem;
  margin: 0 auto;
  padding: 3.2rem 6rem 3.2rem;
}
.hero-title {
  margin: 0;
  font-family: var(--serif);
  font-size: 4rem;
  line-height: 1.15;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: #101010;
}
/* 品牌小字：FISH · 基督教研究平台 */
.hero-eyebrow {
  margin: 0 0 1.1rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: #8b7355;
  letter-spacing: 0.24em;
}
/* 经文副题 */
.hero-sub {
  margin: 1rem 0 0;
  font-size: 0.95rem;
  color: #8a8a8a;
  letter-spacing: 0.05em;
}
.hero-side {
  width: 300px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1.5rem;
  padding-top: 0.6rem;
}
.hero-desc {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.9;
  color: #555;
}
.hero-actions {
  display: flex;
  gap: 0.7rem;
}
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 1.4rem;
  border-radius: 999px;
  font-size: 0.92rem;
  font-weight: 600;
  text-decoration: none;
}
.btn-primary {
  background: #181818;
  color: #fff;
}
.btn-primary:hover {
  background: #000;
  text-decoration: none;
}
.arrow {
  font-size: 1rem;
  line-height: 1;
}

/* 标题下方功能关键词：小字灰色横排 */
.hero-tags {
  margin: 1.2rem 0 0;
  font-size: 0.95rem;
  color: #8a8a8a;
  letter-spacing: 0.06em;
}

.home-footer {
  padding: 2rem 2.5rem 2.6rem;
  text-align: center;
  font-size: 0.8rem;
  color: #999;
}

/* 响应式：平板缩小标题，移动端堆叠 */
@media (max-width: 900px) {
  .hero {
    gap: 3rem;
    padding: 3rem 2rem;
  }
  .hero-title {
    font-size: 3rem;
  }
}
@media (max-width: 600px) {
  .banner {
    height: 200px;
  }
  .hero {
    flex-direction: column;
    gap: 1.8rem;
    padding: 2.2rem 1.5rem 2.5rem;
  }
  .hero-title {
    font-size: 2.3rem;
    line-height: 1.22;
  }
  .hero-side {
    width: 100%;
    gap: 1.3rem;
  }
  .hero-desc {
    font-size: 0.9rem;
  }
  /* 主按钮通栏：移动端整行可点 */
  .hero-actions {
    width: 100%;
  }
  .hero-actions .btn {
    width: 100%;
    justify-content: center;
    padding: 0.7rem 1.4rem;
  }
  .home-footer {
    padding: 1.5rem 1.5rem 2rem;
    font-size: 0.75rem;
  }
}
</style>
