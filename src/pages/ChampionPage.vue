<!-- src/pages/ChampionPage.vue —— 最终结果（对应 pages/champion） -->
<template>
  <div class="page">
    <NavBar title="最终结果" :back="false" />

    <div v-if="champion" class="pad">
      <!-- 冠军头衔 -->
      <div class="crown">
        <div class="crown-label">本届冠军</div>
        <div class="crown-seal">冠</div>
      </div>

      <!-- 冠军诗词 -->
      <div class="card champ-card">
        <div class="champ-title">{{ champion.title }}</div>
        <div class="champ-meta muted">{{ champion.author }} · {{ champion.cipai }}</div>
        <div class="champ-content">{{ champion.content }}</div>
      </div>

      <!-- 晋级之路 -->
      <div class="block-title">晋级之路</div>
      <div class="path">
        <div v-for="(p, i) in path" :key="i" class="path-row">
          <span class="path-round">{{ p.roundName }}</span>
          <span class="path-vs">胜</span>
          <span class="path-opp" :class="{ bye: p.bye }">
            {{ p.bye ? '（轮空，直接晋级）' : p.title }}
          </span>
        </div>
      </div>

      <div class="actions">
        <button class="btn-ghost act" @click="again">再来一局</button>
        <button class="btn-primary act" @click="home">返回首页</button>
      </div>
    </div>

    <div v-else class="pad empty-tip">
      <div class="muted">尚未产生冠军</div>
      <button class="btn-primary home-btn" @click="home">返回首页</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import NavBar from '../components/NavBar.vue';
import * as store from '../utils/store.js';
import * as bracket from '../utils/bracket.js';
import * as poems from '../utils/poems.js';

const router = useRouter();
const champion = ref(null);
const path = ref([]);

onMounted(() => {
  const t = store.getTournament();
  if (!t) {
    router.replace('/');
    return;
  }
  const res = bracket.buildChampionPath(t);
  const titleMap = poems.buildDisplayTitles(store.getLibrary());
  const tt = (p) => (p ? titleMap[p.id] || poems.displayTitle(p) : '');

  champion.value = res.champion ? { ...res.champion, title: tt(res.champion) } : null;
  path.value = (res.path || []).map((it) => {
    if (!it) return it;
    const o = { ...it };
    if (o.id && titleMap[o.id]) o.title = titleMap[o.id];
    return o;
  });
});

function again() {
  store.clearTournament();
  router.replace('/');
}

function home() {
  store.clearTournament();
  router.replace('/');
}
</script>

<style scoped>
.pad { padding-top: 6vw; }

.crown { text-align: center; margin-bottom: 4vw; }

.crown-label {
  font-size: 3.6vw;
  color: var(--warm);
  letter-spacing: 3px;
  margin-bottom: 2.4vw;
}

.crown-seal {
  width: 17vw;
  height: 17vw;
  max-width: 84px;
  max-height: 84px;
  margin: 0 auto;
  background: linear-gradient(145deg, var(--gold), #a8832a);
  color: #fff8e6;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9vw;
  font-weight: 700;
  box-shadow: 0 3px 14px rgba(201, 168, 76, .5);
}

.champ-card { padding: 5vw 4.4vw; }

.champ-title {
  font-size: 5.2vw;
  font-weight: 700;
  color: var(--ink-green);
  line-height: 1.45;
  text-align: center;
}

.champ-meta { text-align: center; font-size: 3.3vw; margin: 2vw 0 3.6vw; }

.champ-content {
  font-size: 3.9vw;
  line-height: 2;
  color: #4a4a4a;
  white-space: pre-wrap;
  word-break: break-word;
  letter-spacing: .5px;
}

.block-title {
  font-size: 4.2vw;
  font-weight: 700;
  color: var(--ink-green);
  margin: 8vw 0 3vw;
}

.path { display: flex; flex-direction: column; gap: 2vw; }

.path-row {
  display: flex;
  align-items: center;
  gap: 3vw;
  background: var(--paper-card);
  border: 0.27vw solid var(--line);
  border-radius: 1.4vw;
  padding: 3vw 3.4vw;
  font-size: 3.5vw;
}

.path-round {
  flex: 0 0 auto;
  color: var(--warm);
  background: #f6ecd6;
  border-radius: 0.8vw;
  padding: 0.8vw 2.2vw;
  font-size: 3vw;
}

.path-vs {
  flex: 0 0 auto;
  color: #fff;
  background: var(--ink-green);
  border-radius: 999px;
  padding: 0.4vw 2vw;
  font-size: 2.9vw;
}

.path-opp { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.path-opp.bye { color: var(--muted); font-size: 3.2vw; }

.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 3.2vw; margin-top: 9vw; }
.act { font-size: 4.2vw; border-radius: 1.6vw; }

.empty-tip { padding-top: 24vw; text-align: center; }
.home-btn { margin-top: 6vw; font-size: 4.2vw; }

@media (min-width: 640px) {
  .pad { max-width: 640px; margin: 0 auto; }
  .crown-label { font-size: 14px; }
  .crown-seal { width: 84px; height: 84px; font-size: 40px; }
  .champ-card { padding: 24px 20px; }
  .champ-title { font-size: 20px; }
  .champ-meta { font-size: 13px; }
  .champ-content { font-size: 14.5px; }
  .block-title { font-size: 17px; margin: 34px 0 14px; }
  .path-row { font-size: 14px; padding: 12px 14px; }
  .path-round { font-size: 12.5px; }
  .path-vs { font-size: 12px; }
  .path-opp.bye { font-size: 13px; }
  .act { font-size: 16px; padding: 13px 0; }
  .home-btn { font-size: 16px; padding: 13px 0; }
}
</style>
