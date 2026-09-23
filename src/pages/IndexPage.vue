<!-- src/pages/IndexPage.vue —— 首页（对应 pages/index） -->
<template>
  <div class="page home">
    <div class="navbar">
      <span class="navbar-title">诗词巅峰赛</span>
    </div>

    <div class="pad">
      <!-- 标题区 -->
      <div class="hero">
        <div class="hero-seal">詩</div>
        <div class="hero-title">诗词巅峰赛</div>
        <div class="hero-sub">以互动之形，论诗词之高下</div>
      </div>

      <!-- 两个主入口 -->
      <div class="entry">
        <button class="btn-primary entry-btn" @click="goSetup">开始互动</button>
        <button class="btn-ghost entry-btn" @click="goLibrary">管理资源库</button>
      </div>

      <!-- 默认模板 -->
      <div class="section-title">
        <span class="bar"></span>默认模板
        <span class="muted small">（资源库共 {{ libCount }} 首）</span>
      </div>

      <div class="tpl-list">
        <div v-for="t in templates" :key="t.id" class="card tpl-card" @click="goTemplate(t.id)">
          <div class="tpl-icon">{{ t.icon }}</div>
          <div class="tpl-body">
            <div class="tpl-name">{{ t.title }}</div>
            <div class="tpl-desc muted">{{ t.desc }}</div>
          </div>
          <div class="tpl-arrow">›</div>
        </div>

        <!-- 模板3：2048 -->
        <div class="card tpl-card" @click="go2048">
          <div class="tpl-icon tpl-icon-game">数</div>
          <div class="tpl-body">
            <div class="tpl-name">2048 · 数字雅集</div>
            <div class="tpl-desc muted">滑动合并数字，锻炼脑力思维</div>
          </div>
          <div class="tpl-arrow">›</div>
        </div>
      </div>

      <div class="foot muted">点击卡片即可进入诗词分组与投票</div>

      <div class="watermark">诗词文娱工具 · made by 清染</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onActivated, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getLibrary } from '../utils/store.js';

const router = useRouter();
const libCount = ref(0);

// 与小程序 onShow 一致：每次进入都刷新数量
function refresh() {
  libCount.value = getLibrary().length;
}
onMounted(refresh);
onActivated(refresh);

const templates = [
  { id: 't1', icon: '贺', title: '辛弃疾《贺新郎》巅峰赛', desc: '辛弃疾《贺新郎》全 11 首 · 自动降为 16 强（5 个轮空）' },
  { id: 't2', icon: '鹧', title: '辛弃疾《鹧鸪天》巅峰赛', desc: '辛弃疾《鹧鸪天》全 32 首 · 32 强赛（首轮无轮空）' }
];

function goSetup() { router.push('/setup'); }
function goLibrary() { router.push('/library'); }
function goTemplate(id) { router.push('/setup?template=' + id); }
function go2048() { router.push('/game2048'); }
</script>

<style scoped>
.home { padding-bottom: 40px; }

/* ---------- 标题区 ---------- */
.hero {
  text-align: center;
  padding: 8vw 0 6vw;
}

.hero-seal {
  width: 11vw;
  height: 11vw;
  max-width: 62px;
  max-height: 62px;
  margin: 0 auto 3vw;
  background: var(--ink-green);
  color: #F5E9C8;
  border-radius: 1.6vw;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 7vw;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(45, 80, 22, .25);
}

.hero-title {
  font-size: 8vw;
  letter-spacing: 3px;
  color: var(--ink-green);
  font-weight: 700;
  line-height: 1.3;
}

.hero-sub {
  margin-top: 2.4vw;
  font-size: 3.5vw;
  color: #8a7a5c;
  letter-spacing: 1px;
}

/* ---------- 主入口 ---------- */
.entry {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3.2vw;
  margin-bottom: 7vw;
}

.entry-btn {
  font-size: 4.4vw;
  padding: 3.6vw 0;
  border-radius: 1.8vw;
}

/* ---------- 区块标题 ---------- */
.section-title {
  display: flex;
  align-items: center;
  font-size: 4.2vw;
  font-weight: 700;
  color: var(--ink-green);
  margin-bottom: 3.4vw;
}

.section-title .bar {
  width: 1.1vw;
  height: 4.4vw;
  background: var(--gold);
  border-radius: 1vw;
  margin-right: 2.2vw;
}

.section-title .small { margin-left: 1.4vw; font-weight: 400; }

/* ---------- 模板卡片 ---------- */
.tpl-list { display: flex; flex-direction: column; gap: 3vw; }

.tpl-card {
  display: flex;
  align-items: center;
  padding: 3.6vw 3.4vw;
  border: 0.27vw solid var(--line);
  cursor: pointer;
  transition: transform .12s;
}

.tpl-card:active { transform: scale(.99); }

.tpl-icon {
  width: 11vw;
  height: 11vw;
  max-width: 58px;
  max-height: 58px;
  flex: 0 0 auto;
  background: #f0ebdd;
  color: var(--warm);
  border-radius: 1.8vw;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 5.6vw;
  font-weight: 700;
}

.tpl-icon-game {
  background: var(--indigo);
  color: #F2D98C;
}

.tpl-body { flex: 1; margin-left: 3.2vw; min-width: 0; }

.tpl-name {
  font-size: 4.2vw;
  font-weight: 700;
  color: #2b2b2b;
  line-height: 1.4;
}

.tpl-desc {
  font-size: 3.3vw;
  margin-top: 0.8vw;
  line-height: 1.5;
}

.tpl-arrow {
  color: #c9bfa8;
  font-size: 5.4vw;
  margin-left: 2vw;
}

.foot {
  text-align: center;
  font-size: 3.3vw;
  margin-top: 6vw;
}

/* 桌面端限制宽度，避免卡片被拉得过宽 */
@media (min-width: 640px) {
  .hero-seal { width: 62px; height: 62px; font-size: 34px; }
  .hero-title { font-size: 34px; }
  .hero-sub { font-size: 15px; }
  .entry-btn { font-size: 16px; padding: 14px 0; border-radius: 8px; }
  .section-title { font-size: 17px; }
  .section-title .bar { width: 5px; height: 20px; }
  .tpl-name { font-size: 16px; }
  .tpl-desc { font-size: 13px; }
  .tpl-icon { width: 58px; height: 58px; font-size: 26px; border-radius: 8px; }
  .tpl-arrow { font-size: 22px; }
  .foot { font-size: 13px; }
  .pad { max-width: 640px; margin: 0 auto; }
}
</style>
