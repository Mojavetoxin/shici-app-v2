<!-- src/pages/SetupPage.vue —— 诗词分组（对应 pages/setup） -->
<template>
  <div class="page">
    <NavBar title="诗词分组" fallback="/" />

    <div class="pad">
      <!-- 模板信息条 -->
      <div v-if="fromTemplate" class="card tpl-note">
        <div class="tpl-note-name">{{ templateName }}</div>
        <div class="tpl-note-sub muted">{{ templateNote }}</div>
      </div>

      <!-- 诗词数量 -->
      <div class="block-title">诗词数量</div>
      <div class="count-row">
        <button
          v-for="c in [16, 32]" :key="c"
          class="count-opt" :class="{ on: count === c }"
          @click="changeCount(c)">{{ c }} 首</button>
      </div>

      <!-- 选诗方式 -->
      <div class="block-title">选诗方式</div>
      <div class="ops">
        <button class="btn-ghost op" @click="randomPick">一键随机抽取</button>
        <button class="btn-ghost op" @click="reshuffle">重新洗牌</button>
        <button class="btn-ghost op" @click="clearAll">清空</button>
      </div>
      <div class="muted hint">已选 {{ selectedCount }} 首（至少 2 首方可分组）</div>

      <!-- 资源库列表 -->
      <div class="block-title">
        资源库
        <span class="muted small">共 {{ library.length }} 首</span>
      </div>
      <div class="lib-list">
        <div
          v-for="it in library" :key="it.poem.id"
          class="lib-item" :class="{ checked: it.checked }"
          @click="toggle(it.poem.id)">
          <span class="cb">
            <span v-if="it.checked" class="cb-tick">✓</span>
          </span>
          <span class="lib-text">
            <span class="lib-title">{{ it.dispTitle }}</span>
            <span class="lib-meta muted">{{ it.poem.author }} · {{ it.poem.cipai }}</span>
          </span>
        </div>
      </div>

      <!-- 首轮分组预览 -->
      <div class="block-title">
        首轮分组预览
        <button class="reshuffle" @click="reshuffle">↺ 重新洗牌（换一批对阵）</button>
      </div>
      <div v-if="previewTip" class="muted hint">{{ previewTip }}</div>
      <div v-if="previewMatches.length" class="preview" :key="shuffleFlip">
        <div v-for="(p, i) in previewMatches" :key="i" class="pv-row">
          <span class="pv-a">{{ p.aTitle }}</span>
          <span class="pv-vs">VS</span>
          <span class="pv-b">{{ p.bTitle }}</span>
          <span v-if="p.isBye" class="pv-bye">轮空</span>
        </div>
      </div>
      <div v-else class="muted hint">选择至少 2 首后显示首轮分组</div>

      <!-- 为悬浮按钮预留空间，避免遮住最后一项 -->
      <div class="floating-spacer"></div>
    </div>

    <!-- 生成：固定在底部悬浮，跟随滚动始终可见
         （原先在列表最末尾，诗词多时要滑很久才能点到） -->
    <div class="gen-bar">
      <button class="btn-primary gen-btn" @click="generate">
        生成分组
        <span v-if="selectedCount" class="gen-count">（{{ selectedCount }} 首）</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import NavBar from '../components/NavBar.vue';
import * as store from '../utils/store.js';
import * as bracket from '../utils/bracket.js';
import * as poems from '../utils/poems.js';
import { toast } from '../utils/ui.js';

const route = useRoute();
const router = useRouter();

const TEMPLATES = {
  t1: { name: '辛弃疾《贺新郎》巅峰赛', cipai: '贺新郎', size: 32 },
  t2: { name: '辛弃疾《鹧鸪天》巅峰赛', cipai: '鹧鸪天', size: 32 }
};

// 列表项：{ poem, dispTitle, checked }
const library = ref([]);
const count = ref(32);
const selectedIds = ref([]);
const fromTemplate = ref(false);
const templateName = ref('');
const templateNote = ref('');

const previewMatches = ref([]);
const previewOrder = ref([]);
const previewTip = ref('');
const shuffleFlip = ref(false);

const selectedCount = computed(() => selectedIds.value.length);

function buildLibrary(checkedSet) {
  const lib = store.getLibrary();
  const titleMap = poems.buildDisplayTitles(lib);
  return lib.map((p) => ({
    poem: p,
    dispTitle: titleMap[p.id] || poems.displayTitle(p),
    checked: !!(checkedSet && checkedSet[p.id])
  }));
}

onMounted(() => {
  const lib = store.getLibrary();
  let data = { checkedSet: null };

  const tplKey = route.query.template;
  if (tplKey && TEMPLATES[tplKey]) {
    const t = TEMPLATES[tplKey];
    const picked = lib.filter((p) => p.cipai === t.cipai);
    const idSet = {};
    picked.forEach((p) => (idSet[p.id] = true));

    const actualSize = bracket.resolveBracketSize(picked.length, t.size);
    const byes = actualSize - picked.length;
    let note = '共 ' + picked.length + ' 首 · 采用 ' + actualSize + ' 强赛制';
    if (byes > 0) note += '（首轮 ' + byes + ' 个轮空，轮空者直接晋级）';

    data.checkedSet = idSet;
    templateName.value = t.name;
    templateNote.value = note;
    fromTemplate.value = true;
    count.value = actualSize;
    selectedIds.value = picked.map((p) => p.id);
  }

  library.value = buildLibrary(data.checkedSet);
  refreshPreview(false);
});

function changeCount(c) {
  count.value = c;
  refreshPreview(false);
}

function toggle(id) {
  const ids = selectedIds.value.slice();
  const idx = ids.indexOf(id);
  const nowChecked = idx < 0;
  if (nowChecked) ids.push(id);
  else ids.splice(idx, 1);
  selectedIds.value = ids;
  library.value = library.value.map((it) =>
    it.poem.id === id ? { ...it, checked: nowChecked } : it
  );
  refreshPreview(false);
}

function randomPick() {
  const size = count.value;
  const all = bracket.shuffle(library.value.map((it) => it.poem)).slice(0, size);
  const idSet = {};
  all.forEach((p) => (idSet[p.id] = true));
  library.value = library.value.map((it) => ({ ...it, checked: !!idSet[it.poem.id] }));
  selectedIds.value = all.map((p) => p.id);
  refreshPreview(false);
}

function clearAll() {
  library.value = library.value.map((it) => ({ ...it, checked: false }));
  selectedIds.value = [];
  refreshPreview(false);
}

// 【重新洗牌】只重排已选诗词在签表中的位置，不改动选中集合
function reshuffle() {
  if (selectedIds.value.length < 2) {
    toast('请至少选择 2 首');
    return;
  }
  previewOrder.value = [];
  refreshPreview(true);
}

// 依据当前选中集合 + 赛制规模，重建首轮分组预览。
// 统一走 bracket.previewFirstRound，保证「预览」与「实际分组」同源。
function refreshPreview(force) {
  const ids = selectedIds.value;
  const cnt = count.value;
  if (ids.length < 2 || ids.length > cnt) {
    previewMatches.value = [];
    previewOrder.value = [];
    previewTip.value = '';
    return;
  }
  const map = {};
  library.value.forEach((it) => (map[it.poem.id] = it.poem));

  // 现有顺序是否仍覆盖全部选中项（未换人 → 沿用，保持连贯）
  const cur = previewOrder.value || [];
  const sameSet = cur.length === ids.length && ids.every((id) => cur.indexOf(id) >= 0);
  const order = (!force && sameSet) ? cur : bracket.shuffle(ids);

  const poems_ = order.map((id) => map[id]);
  const pairs = bracket.previewFirstRound(poems_, cnt, true);

  previewMatches.value = pairs.map((p) => ({
    aTitle: p.a ? p.a.title : '（轮空）',
    bTitle: p.b ? p.b.title : '（轮空）',
    isBye: !p.a || !p.b
  }));

  const size = bracket.resolveBracketSize(order.length, cnt);
  const byes = size - order.length;
  let tip = '首轮 ' + pairs.length + ' 场';
  if (byes > 0) tip += ' · ' + byes + ' 位轮空直接晋级';
  tip += '（不满意可点「重新洗牌」）';

  previewOrder.value = order;
  previewTip.value = tip;
  shuffleFlip.value = !shuffleFlip.value;
}

function generate() {
  const cnt = count.value;
  const ids = selectedIds.value;
  if (ids.length < 2) {
    toast('请至少选择 2 首');
    return;
  }
  if (ids.length > cnt) {
    toast('超出 ' + cnt + ' 首，请取消部分选择');
    return;
  }
  const map = {};
  library.value.forEach((it) => (map[it.poem.id] = it.poem));

  // 所见即所得：优先沿用预览顺序
  const order = previewOrder.value;
  const useOrder = !!(order && order.length === ids.length && ids.every((id) => order.indexOf(id) >= 0));

  const tournament = bracket.buildTournament(
    useOrder ? order.map((id) => map[id]) : bracket.shuffle(ids.map((id) => map[id])),
    cnt,
    useOrder
  );
  store.setTournament(tournament);
  router.replace('/bracket');
}
</script>

<style scoped>
.pad { padding-top: 4vw; }

.block-title {
  font-size: 4.2vw;
  font-weight: 700;
  color: var(--ink-green);
  margin: 6vw 0 3vw;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2vw;
}

.block-title .small { font-weight: 400; }

.tpl-note {
  border: 0.27vw solid var(--gold);
  background: #fffaf0;
  padding: 3.4vw 3.6vw;
  border-radius: 1.6vw;
}

.tpl-note-name { font-size: 4.2vw; font-weight: 700; color: var(--warm); }
.tpl-note-sub { font-size: 3.3vw; margin-top: 1vw; }

.count-row { display: grid; grid-template-columns: 1fr 1fr; gap: 3.2vw; }

.count-opt {
  padding: 3.2vw 0;
  border-radius: 1.6vw;
  border: 0.27vw solid var(--line);
  background: var(--paper-card);
  color: #6b6455;
  font-size: 4.2vw;
  font-weight: 600;
}

.count-opt.on {
  background: var(--ink-green);
  color: #fff8e6;
  border-color: var(--ink-green);
}

.ops { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.4vw; }
.op { font-size: 3.6vw; padding: 2.8vw 0; border-radius: 1.4vw; }

.hint { font-size: 3.3vw; margin-top: 2.4vw; }

/* 资源库列表 */
.lib-list { display: flex; flex-direction: column; gap: 2vw; }

.lib-item {
  display: flex;
  align-items: center;
  gap: 3vw;
  background: var(--paper-card);
  border: 0.27vw solid var(--line);
  border-radius: 1.6vw;
  padding: 3.2vw 3.4vw;
  cursor: pointer;
}

.lib-item.checked { border-color: var(--ink-green); background: #f4f8ee; }

.cb {
  width: 5.6vw;
  height: 5.6vw;
  max-width: 24px;
  max-height: 24px;
  flex: 0 0 auto;
  border: 0.4vw solid #c9bfa8;
  border-radius: 0.8vw;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lib-item.checked .cb { background: var(--ink-green); border-color: var(--ink-green); }
.cb-tick { color: #fff; font-size: 3.6vw; line-height: 1; }

.lib-text { display: flex; flex-direction: column; min-width: 0; }
.lib-title { font-size: 3.9vw; font-weight: 600; line-height: 1.4; word-break: break-all; }
.lib-meta { font-size: 3.1vw; margin-top: 0.6vw; }

/* 预览 */
.reshuffle {
  margin-left: auto;
  font-size: 3.2vw;
  color: var(--warm);
  background: #f6ecd6;
  padding: 1.6vw 3vw;
  border-radius: 999px;
  font-weight: 400;
}

.preview { display: flex; flex-direction: column; gap: 1.8vw; margin-top: 2.4vw; }

.pv-row {
  display: flex;
  align-items: center;
  gap: 2.4vw;
  background: var(--paper-card);
  border: 0.27vw solid var(--line);
  border-radius: 1.4vw;
  padding: 2.6vw 3vw;
  font-size: 3.5vw;
}

.pv-a, .pv-b { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pv-a { text-align: right; }
.pv-vs { color: var(--gold); font-weight: 700; flex: 0 0 auto; font-size: 3.2vw; }
.pv-bye {
  flex: 0 0 auto;
  font-size: 2.8vw;
  color: var(--warm);
  background: #f6ecd6;
  border-radius: 999px;
  padding: 0.4vw 2vw;
}

/* 悬浮生成的占位：让列表底部内容不被固定条遮住 */
.floating-spacer {
  height: calc(20vw + var(--safe-bottom));
}

.gen-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  padding: 2.4vw 4.27vw calc(2.4vw + var(--safe-bottom));
  background: linear-gradient(to top, var(--paper) 72%, rgba(245, 240, 232, 0));
  /* 上边缘用极淡的描边暗示"悬浮层"，避免按钮看起来是页面内容的一部分 */
  box-shadow: 0 -0.27vw 3vw rgba(45, 80, 22, .08);
}

.gen-btn { font-size: 4.4vw; border-radius: 1.8vw; width: 100%; }
.gen-count { font-weight: 400; opacity: .85; font-size: 3.6vw; }

@media (min-width: 640px) {
  .floating-spacer { height: 96px; }
  .gen-bar {
    padding: 12px 0 14px;
    /* 桌面端与内容同宽居中，不做通栏，视觉更收敛 */
    left: 50%;
    right: auto;
    transform: translateX(-50%);
    width: 100%;
    max-width: 640px;
    padding-left: 0;
    padding-right: 0;
  }
  .gen-btn { font-size: 16px; padding: 13px 0; }
  .gen-count { font-size: 14px; }
  .pad { max-width: 640px; margin: 0 auto; }
  .block-title { font-size: 17px; margin: 26px 0 14px; gap: 8px; }
  .tpl-note-name { font-size: 16px; }
  .tpl-note-sub, .hint { font-size: 13px; }
  .count-opt { font-size: 16px; padding: 13px 0; border-radius: 8px; }
  .op { font-size: 15px; padding: 11px 0; }
  .lib-title { font-size: 15px; }
  .lib-meta { font-size: 12.5px; }
  .cb { width: 24px; height: 24px; border-width: 2px; }
  .reshuffle { font-size: 13px; padding: 6px 12px; }
  .pv-row { font-size: 14px; }
  .pv-vs { font-size: 13px; }
  .pv-bye { font-size: 11.5px; }
}
</style>
