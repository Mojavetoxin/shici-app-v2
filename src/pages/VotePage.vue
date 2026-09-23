<!-- src/pages/VotePage.vue —— 诗词投票（对应 pages/vote） -->
<template>
  <div class="page">
    <NavBar title="诗词投票" fallback="/bracket" />

    <div v-if="a && b" class="pad">
      <div v-if="sameCipai" class="cipai-note">同词牌 · {{ cipai }}</div>

      <!-- A 方 -->
      <div class="card side" :class="{ picked: voting }">
        <div class="side-head">
          <span class="side-tag">甲</span>
          <span class="side-title">{{ a.title }}</span>
        </div>
        <div class="side-meta muted">{{ a.author }} · {{ a.cipai }}</div>
        <div class="side-content">{{ showA ? aFull : aPrev }}</div>
        <button v-if="aFull.length > 80" class="more" @click="showA = !showA">
          {{ showA ? '收起 ▴' : '展开全文 ▾' }}
        </button>
        <button class="btn-primary vote-btn" :disabled="voting" @click="vote('a')">投票给这首</button>
      </div>

      <div class="vs-mid">— 比 较 —</div>

      <!-- B 方 -->
      <div class="card side" :class="{ picked: voting }">
        <div class="side-head">
          <span class="side-tag">乙</span>
          <span class="side-title">{{ b.title }}</span>
        </div>
        <div class="side-meta muted">{{ b.author }} · {{ b.cipai }}</div>
        <div class="side-content">{{ showB ? bFull : bPrev }}</div>
        <button v-if="bFull.length > 80" class="more" @click="showB = !showB">
          {{ showB ? '收起 ▴' : '展开全文 ▾' }}
        </button>
        <button class="btn-primary vote-btn" :disabled="voting" @click="vote('b')">投票给这首</button>
      </div>
    </div>

    <div v-else class="pad empty-tip muted">未找到该对局，正在返回…</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import NavBar from '../components/NavBar.vue';
import * as store from '../utils/store.js';
import * as bracket from '../utils/bracket.js';
import * as poems from '../utils/poems.js';

const route = useRoute();
const router = useRouter();

const a = ref(null);
const b = ref(null);
const sameCipai = ref(false);
const cipai = ref('');
const aFull = ref('');
const aPrev = ref('');
const bFull = ref('');
const bPrev = ref('');
const showA = ref(false);
const showB = ref(false);
const voting = ref(false);

// 长文截断预览
function preview(s) {
  if (!s) return '';
  return s.length > 80 ? s.slice(0, 80) + '…' : s;
}

function load() {
  const id = route.params.id;
  const t = store.getTournament();
  const m = bracket.findMatch(t, id);
  if (!m || !m.a || !m.b) {
    router.replace('/bracket');
    return;
  }
  const same = m.a.cipai && m.b.cipai && m.a.cipai === m.b.cipai;
  const titleMap = poems.buildDisplayTitles(store.getLibrary());
  a.value = { ...m.a, title: titleMap[m.a.id] || poems.displayTitle(m.a) };
  b.value = { ...m.b, title: titleMap[m.b.id] || poems.displayTitle(m.b) };
  sameCipai.value = !!same;
  cipai.value = same ? m.a.cipai : '';
  aFull.value = m.a.content;
  aPrev.value = preview(m.a.content);
  bFull.value = m.b.content;
  bPrev.value = preview(m.b.content);
}

onMounted(load);

function vote(side) {
  if (voting.value) return;
  voting.value = true;

  const t = store.getTournament();
  const finished = bracket.vote(t, route.params.id, side);
  store.setTournament(t);

  if (finished) {
    router.replace('/champion');
  } else {
    router.back();
  }
}
</script>

<style scoped>
.pad { padding-top: 4vw; }

.cipai-note {
  text-align: center;
  font-size: 3.4vw;
  color: var(--warm);
  background: #f6ecd6;
  border-radius: 999px;
  padding: 1.4vw 0;
  margin-bottom: 3vw;
  display: inline-block;
  width: 100%;
}

.side { padding: 4.4vw 4vw; margin-bottom: 3vw; }

.side-head { display: flex; align-items: flex-start; gap: 2.4vw; }

.side-tag {
  flex: 0 0 auto;
  width: 7vw;
  height: 7vw;
  max-width: 34px;
  max-height: 34px;
  background: var(--indigo);
  color: #F2D98C;
  border-radius: 1.2vw;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3.8vw;
  font-weight: 700;
}

.side-title {
  font-size: 4.4vw;
  font-weight: 700;
  color: var(--ink-green);
  line-height: 1.45;
  flex: 1;
  min-width: 0;
}

.side-meta { font-size: 3.2vw; margin: 2vw 0 2.6vw; }

.side-content {
  font-size: 3.8vw;
  line-height: 1.95;
  color: #4a4a4a;
  white-space: pre-wrap;
  word-break: break-word;
  letter-spacing: .5px;
}

.more {
  font-size: 3.2vw;
  color: var(--warm);
  margin-top: 2.2vw;
  background: none;
  padding: 0;
}

.vote-btn { margin-top: 4vw; font-size: 4.2vw; border-radius: 1.6vw; }

.vs-mid {
  text-align: center;
  color: var(--gold);
  font-size: 3.6vw;
  letter-spacing: 2px;
  margin: 1vw 0 3vw;
}

.empty-tip { padding-top: 20vw; text-align: center; font-size: 3.8vw; }

@media (min-width: 640px) {
  .pad { max-width: 640px; margin: 0 auto; }
  .cipai-note { font-size: 13px; padding: 5px 0; }
  .side { padding: 20px 18px; }
  .side-title { font-size: 17px; }
  .side-tag { width: 34px; height: 34px; font-size: 15px; border-radius: 6px; }
  .side-meta { font-size: 12.5px; }
  .side-content { font-size: 14.5px; }
  .more { font-size: 13px; }
  .vote-btn { font-size: 16px; padding: 13px 0; }
  .vs-mid { font-size: 14px; }
}
</style>
