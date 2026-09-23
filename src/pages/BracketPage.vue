<!-- src/pages/BracketPage.vue —— 分组与投票（对应 pages/bracket） -->
<template>
  <div class="page bracket-page">
    <NavBar title="分组与投票" fallback="/" />

    <div class="bar">
      <span class="progress">{{ progressText }}</span>
      <button v-if="finished" class="champ-link" @click="goChampion">查看冠军 ›</button>
      <!-- 缩放控件：桌面端滚轮、手机端双指皆可，此处提供跨设备的显式入口 -->
      <div class="zoom-ctl">
        <button class="zoom-btn" :disabled="scale <= MIN_SCALE" @click="zoomStep(-1)">−</button>
        <button class="zoom-pct" @click="resetView">{{ Math.round(scale * 100) }}%</button>
        <button class="zoom-btn" :disabled="scale >= MAX_SCALE" @click="zoomStep(1)">＋</button>
      </div>
    </div>

    <!-- 视口：自身可滚动；放大后亦可按住拖动平移 -->
    <div
      ref="viewport"
      class="board-scroll"
      :class="{ grabbing, pinching }"
      @wheel.prevent="onWheel"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
      @mousedown="onMouseDown">
      <div class="board-scale" :style="spacerStyle">
        <div class="board" :style="boardStyle">
          <!-- 连线 -->
          <div
            v-for="(c, i) in connectors" :key="'c' + i"
            class="conn" :style="connStyle(c)"></div>

          <!-- 列标题 -->
          <div
            v-for="(col, i) in columns" :key="'h' + i"
            class="col-head" :style="{ left: px(col.left), width: px(W) }">{{ col.name }}</div>

          <!-- 比赛卡片 -->
          <template v-for="(col, i) in columns" :key="'m' + i">
            <div
              v-for="m in col.matches" :key="m.id"
              class="match" :class="{ ready: m.clickable, done: m.done }"
              :style="matchStyle(col.left, m)"
              @click="openVote(m)">
              <div class="slot" :class="{ win: m.winnerSide === 'a', bye: m.aBye }">
                <span class="slot-txt">{{ m.aTitle }}</span>
                <span v-if="m.winnerSide === 'a'" class="crown">胜</span>
              </div>
              <div class="vs-line">VS</div>
              <div class="slot" :class="{ win: m.winnerSide === 'b', bye: m.bBye }">
                <span class="slot-txt">{{ m.bTitle }}</span>
                <span v-if="m.winnerSide === 'b'" class="crown">胜</span>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <div class="tip muted">
      拖动查看赛程 · 电脑滚轮 / 手机双指可缩放 · 左半区向右、右半区向左、决赛居中
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import NavBar from '../components/NavBar.vue';
import * as store from '../utils/store.js';
import * as bracket from '../utils/bracket.js';
import * as poems from '../utils/poems.js';

const router = useRouter();

// 几何常量（沿用小程序设计，单位 rpx → 这里用 px 直接参与像素布局）
// 小程序 750rpx = 屏宽；此处设计基准按 375px 视觉宽折算，卡片 260rpx≈130px
const W = 130;       // 卡片宽度(px)
const GAP = 28;      // 相邻轮次列间距
const SLOT = 92;     // 第 0 轮每场纵向占位
const CARD_H = 86;   // 卡片固定高度
const HEADER = 26;   // 顶部轮次名预留高度

const columns = ref([]);
const connectors = ref([]);
const totalWidth = ref(0);
const containerHeight = ref(0);
const progressText = ref('');
const finished = ref(false);

/* ---------------- 缩放与平移 ----------------
   思路：棋盘仍按原始 px 尺寸排布（保持几何计算不变），
   只在外层套一个 transform: scale()。
   这样缩放不会影响卡片/连线的坐标计算，避免重算整张图。

   注意：不用 transform: scale 会有的问题是"缩放后滚动条长度不变"，
   所以外层视口用 width/height 同步放大，让滚动范围跟着变。
   ------------------------------------------- */
const viewport = ref(null);
const MIN_SCALE = 0.4;
const MAX_SCALE = 2.5;
const STEP = 0.2;
// scale 会吸附到 0.1 的整数倍，避免出现 87% 这类不好读的数值
const scale = ref(1);
const grabbing = ref(false);

const px = (v) => v + 'px';

// 撑出"缩放后"的真实尺寸，让滚动条长度跟着缩放走。
// 用 min-width/min-height 而非固定值，是为了缩小时仍能填满视口。
const spacerStyle = computed(() => ({
  width: totalWidth.value * scale.value + 'px',
  height: containerHeight.value * scale.value + 'px'
}));

const boardStyle = computed(() => ({
  // 棋盘尺寸始终按原始 px 排布，缩放只作用于 transform，
  // 因此卡片/连线的坐标计算完全不受缩放影响。
  width: px(totalWidth.value),
  height: px(containerHeight.value),
  transform: `scale(${scale.value})`,
  transformOrigin: '0 0'
}));

function clampScale(s) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(s * 10) / 10));
}

// 以视口中心为锚点缩放：先记录中心在"内容坐标系"中的位置，
// 缩放后再把该点移回视口中心，避免放大时内容跑偏到屏幕外。
function applyScale(next) {
  const el = viewport.value;
  const s0 = scale.value;
  const s1 = clampScale(next);
  if (!el || s1 === s0) {
    scale.value = s1;
    return;
  }
  const cx = el.scrollLeft + el.clientWidth / 2;
  const cy = el.scrollTop + el.clientHeight / 2;
  scale.value = s1;
  // 等浏览器应用新尺寸后再校正滚动，否则读到的是旧值
  requestAnimationFrame(() => {
    el.scrollLeft = cx * (s1 / s0) - el.clientWidth / 2;
    el.scrollTop = cy * (s1 / s0) - el.clientHeight / 2;
  });
}

function zoomStep(delta) {
  applyScale(scale.value + delta * STEP);
}

function resetView() {
  applyScale(1);
  const el = viewport.value;
  if (el) {
    requestAnimationFrame(() => { el.scrollLeft = 0; el.scrollTop = 0; });
  }
}

// 桌面端：滚轮缩放（触控板双指滑动同样映射到 wheel）
function onWheel(e) {
  // deltaY < 0 为向上滚（放大），> 0 为向下滚（缩小）
  const factor = e.deltaY < 0 ? 1 : -1;
  applyScale(scale.value + factor * 0.1);
}

/* ---------------- 触摸：单指平移（原生滚动） / 双指缩放 ----------------
 *
 * 分工原则：能交给浏览器的就交给浏览器。
 *   · 单指滑动 → 由 CSS 的 touch-action: pan-x pan-y 走原生滚动。
 *     原生滚动有惯性、跟手，比自己用 scrollLeft 逐帧设置体验好得多，
 *     也是修掉"手指能缩放但不能左右滑动"的关键。
 *   · 双指捏合 → JS 接管（原生没有连续缩放事件），期间临时把
 *     touch-action 切成 none，避免缩放的同时页面跟着乱滑。
 *
 * 早期版本用 touch-action: none 全盘接管，但只写了双指逻辑、
 * 漏了单指平移，于是横向滑动被禁用又无人处理，就直接"划不动"了。
 */
let pinchStartDist = 0;
let pinchStartScale = 1;
const pinching = ref(false);

function touchDist(touches) {
  const a = touches[0], b = touches[1];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function onTouchStart(e) {
  if (e.touches.length === 2) {
    // 进入双指缩放：记下起始间距与起始倍率
    pinchStartDist = touchDist(e.touches);
    pinchStartScale = scale.value;
    pinching.value = true;
  }
}

function onTouchMove(e) {
  // 单指：不干预，让原生滚动按 touch-action: pan-x pan-y 生效
  if (!pinching.value || e.touches.length !== 2 || !pinchStartDist) return;
  e.preventDefault();   // 双指手势由我们接管，阻止浏览器自身的页面缩放
  const ratio = touchDist(e.touches) / pinchStartDist;
  applyScale(pinchStartScale * ratio);
}

function onTouchEnd(e) {
  // 只要不是双指了，就退出缩放态，把控制权还给原生滚动
  if (e.touches.length < 2) {
    pinchStartDist = 0;
    pinching.value = false;
  }
}

/* ---------------- 鼠标拖拽平移（桌面端） ---------------- */
let dragStartX = 0;
let dragStartY = 0;
let dragScrollX = 0;
let dragScrollY = 0;
let dragging = false;

function onMouseDown(e) {
  const el = viewport.value;
  if (!el) return;
  // 只在左键、且确实超出可视范围时才启用拖拽，
  // 否则会吞掉卡片上的点击（拖拽与点击是竞争关系）。
  if (e.button !== 0) return;
  dragging = true;
  grabbing.value = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragScrollX = el.scrollLeft;
  dragScrollY = el.scrollTop;
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function onMouseMove(e) {
  if (!dragging) return;
  const el = viewport.value;
  if (!el) return;
  // 反向位移：鼠标往右拖 → 内容往右走 → 滚动位置减小
  el.scrollLeft = dragScrollX - (e.clientX - dragStartX);
  el.scrollTop = dragScrollY - (e.clientY - dragStartY);
}

function onMouseUp() {
  dragging = false;
  grabbing.value = false;
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
}

function connStyle(c) {
  return {
    left: px(c.left),
    top: px(c.top),
    width: px(c.width),
    height: px(c.height)
  };
}

function matchStyle(left, m) {
  return {
    left: px(left),
    top: px(m.center - CARD_H / 2),
    width: px(W),
    height: px(CARD_H)
  };
}

onMounted(() => {
  const t = store.getTournament();
  if (!t) {
    router.replace('/');
    return;
  }

  const names = bracket.getRoundNames(t.size);
  const R = t.rounds.length;
  const counts = t.rounds.map((row) => row.length);

  const bodyH = counts[0] * SLOT;
  const totalH = HEADER + bodyH;

  // ---- 水平列位置 ----
  const halfW = (R - 1) * (W + GAP) + W;
  const tw = halfW * 2 + GAP;
  const centerX = tw / 2;
  const leftCol = (k) => k * (W + GAP);
  const rightCol = (k) => tw - (k + 1) * (W + GAP) + GAP;

  // ---- 垂直：每个半区独立居中 ----
  const centerOf = (r, localIdx) => {
    const span = SLOT * Math.pow(2, r);
    const half = counts[r] / 2;
    const bandH = half * span;
    const startY = HEADER + (bodyH - bandH) / 2;
    return startY + localIdx * span + span / 2;
  };

  const cols = [];
  const conns = [];

  // 显示标题
  const titleMap = poems.buildDisplayTitles(
    t.rounds.reduce((acc, row) => {
      row.forEach((m) => { if (m.a) acc.push(m.a); if (m.b) acc.push(m.b); });
      return acc;
    }, [])
  );
  const titleOf = (p) => (p ? (titleMap[p.id] || poems.displayTitle(p)) : '');

  const emptyLabel = (r, m, slot) => {
    if (r !== 0) return '待定';
    const other = slot === 'a' ? m.b : m.a;
    return other ? '轮空' : '待定';
  };

  const packMatch = (m, r, cy) => {
    const ready = !!(m.a && m.b);
    return {
      id: m.id, top: cy, center: cy, height: CARD_H,
      ready, clickable: ready && m.status !== 'done',
      done: m.status === 'done', winnerSide: m.winner,
      aTitle: titleOf(m.a) || emptyLabel(r, m, 'a'),
      bTitle: titleOf(m.b) || emptyLabel(r, m, 'b'),
      aBye: !m.a, bBye: !m.b
    };
  };

  t.rounds.forEach((row, r) => {
    const isFinal = (r === R - 1);
    const half = row.length / 2;

    if (isFinal) {
      const cy = HEADER + bodyH / 2;
      cols.push({
        name: names[r], left: centerX - W / 2, side: 'center',
        matches: [packMatch(row[0], r, cy)]
      });
      return;
    }

    const leftMatches = row.slice(0, half).map((m, i) => packMatch(m, r, centerOf(r, i)));
    cols.push({ name: names[r] + '（左半区）', left: leftCol(r), side: 'left', matches: leftMatches });

    const rightMatches = row.slice(half).map((m, i) => packMatch(m, r, centerOf(r, i)));
    cols.push({ name: names[r] + '（右半区）', left: rightCol(r), side: 'right', matches: rightMatches });
  });

  // ---- 连线 ----
  const connectSide = (opt) => {
    const { fromLeft, fromW, dir, half, parentLeft, childCenter, parentCenter } = opt;
    for (let j = 0; j < half; j++) {
      const y = childCenter(j);
      const ty = parentCenter(Math.floor(j / 2));
      const edgeX = dir === 1 ? (fromLeft + fromW) : fromLeft;
      const parentEdgeX = dir === 1 ? parentLeft : (parentLeft + fromW);
      const midX = edgeX + (parentEdgeX - edgeX) / 2;

      conns.push({ left: Math.min(edgeX, midX), top: y - 1, width: Math.abs(midX - edgeX), height: 2 });
      conns.push({ left: midX - 1, top: Math.min(y, ty), width: 2, height: Math.max(2, Math.abs(ty - y)) });
      conns.push({ left: Math.min(midX, parentEdgeX), top: ty - 1, width: Math.abs(parentEdgeX - midX), height: 2 });
    }
  };

  for (let r = 0; r < R - 1; r++) {
    const half = t.rounds[r].length / 2;
    connectSide({
      fromLeft: leftCol(r), parentLeft: (r + 1 === R - 1) ? centerX - W / 2 : leftCol(r + 1),
      fromW: W, dir: 1, half,
      childCenter: (i) => centerOf(r, i),
      parentCenter: (i) => (r + 1 === R - 1) ? (HEADER + bodyH / 2) : centerOf(r + 1, i)
    });
    connectSide({
      fromLeft: rightCol(r), parentLeft: (r + 1 === R - 1) ? centerX - W / 2 : rightCol(r + 1),
      fromW: W, dir: -1, half,
      childCenter: (i) => centerOf(r, i),
      parentCenter: (i) => (r + 1 === R - 1) ? (HEADER + bodyH / 2) : centerOf(r + 1, i)
    });
  }

  // ---- 进度 ----
  const curR = bracket.findCurrentRound(t);
  const curRow = t.rounds[curR];
  const doneCount = curRow.filter((m) => m.status === 'done').length;
  const finalRow = t.rounds[R - 1][0];
  const fin = finalRow.status === 'done' && !!finalRow.winner;

  columns.value = cols;
  connectors.value = conns;
  totalWidth.value = tw;
  containerHeight.value = totalH + 16;
  finished.value = fin;
  progressText.value = fin
    ? '全部完成 · 已产生结果'
    : (names[curR] + ' · 已完成 ' + doneCount + '/' + curRow.length + ' 场');
});

function openVote(m) {
  if (!m.clickable) return;
  router.push('/vote/' + m.id);
}

function goChampion() {
  router.replace('/champion');
}

// 离场时移除挂在 window 上的拖拽监听，避免切页后残留
onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
});
</script>

<style scoped>
/* 对阵表页：占满视口高度并固定，让中间的对阵区成为「内部滚动容器」。
   若只给 min-height（通用 .page 的默认行为），页面会随内容长高，
   .board-scroll 的 flex:1 + min-height:0 就永远拿不到受限高度，
   纵向滚动条不会出现 —— 表现就是「上下滑不动」。
   dvh 兜底 vh：移动端浏览器地址栏收起/展开时 dvh 更准。 */
.bracket-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  padding-bottom: 0;
  overflow: hidden;
}

.bar {
  display: flex;
  align-items: center;
  gap: 2.4vw;
  padding: 3vw 4.27vw;
  background: #fffdf8;
  border-bottom: 1px solid var(--line);
}

.progress { font-size: 3.4vw; color: var(--warm); font-weight: 600; flex: 1; min-width: 0; }

.champ-link {
  flex: 0 0 auto;
  font-size: 3.3vw;
  color: #fff8e6;
  background: var(--ink-green);
  border-radius: 999px;
  padding: 1.4vw 3.4vw;
}

/* 缩放控件 */
.zoom-ctl {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: 999px;
  overflow: hidden;
  background: #fff;
}

.zoom-btn {
  width: 8.5vw;
  max-width: 40px;
  padding: 1.2vw 0;
  font-size: 4.4vw;
  line-height: 1;
  color: var(--ink-green);
  background: transparent;
}
.zoom-btn:disabled { color: #cfc7b6; }
.zoom-btn:active:not(:disabled) { background: rgba(45, 80, 22, .08); }

.zoom-pct {
  padding: 1.2vw 2vw;
  font-size: 2.9vw;
  color: var(--muted);
  min-width: 11vw;
  border-left: 1px solid var(--line);
  border-right: 1px solid var(--line);
}

/* 画布滚动容器：替代 scroll-view，双向可滚 */
.board-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: #faf6ec;
  /* 放大后可拖拽平移；未放大时浏览器原生滚动照旧 */
  cursor: grab;
  -webkit-overflow-scrolling: touch;
  /* 单指交给浏览器原生滚动（横向 + 纵向都要给，否则只能上下滑），
     双指缩放才由 JS 接管（onTouchMove 里在双指时 preventDefault）。
     之前写成 touch-action: none 会把原生滚动一并禁掉，
     表现为"手指能缩放但不能左右滑动"——这里必须放行 pan-x pan-y。 */
  touch-action: pan-x pan-y;
  overscroll-behavior: contain;
}
.board-scroll.grabbing { cursor: grabbing; }

/* 双指缩放进行中：临时关闭原生滚动，避免缩放同时页面跟着滑 */
.board-scroll.pinching { touch-action: none; }

/* 缩放占位层：transform 不改变布局尺寸，滚动条不会自动变长。
   因此外层用一个显式尺寸的容器把"缩放后的实际大小"撑出来，
   棋盘自身再以 transform-origin: 0 0 缩放，两者配合滚动范围才正确。
   尺寸由 spacerStyle 内联注入（随 scale 变化）。 */
.board-scale {
  position: relative;
}

.board {
  position: relative;
  background: #faf6ec;
  will-change: transform;
}

.conn { position: absolute; background: #d8cdb4; }

.col-head {
  position: absolute;
  top: 4px;
  text-align: center;
  font-size: 11px;
  color: var(--warm);
  font-weight: 700;
  letter-spacing: .5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.match {
  position: absolute;
  border-radius: 8px;
  background: #fff;
  border: 1px solid var(--line);
  box-shadow: 0 1px 4px rgba(45, 80, 22, .08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: box-shadow .15s, transform .12s;
}

.match.ready { border-color: var(--gold); cursor: pointer; }
.match.ready:active { transform: scale(.98); }
.match.done { opacity: .92; }

.slot {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 0 6px;
  min-height: 0;
  overflow: hidden;
}

.slot.bye { opacity: .55; }
.slot.win { background: #f2f8e9; }

.slot-txt {
  font-size: 11px;
  line-height: 1.3;
  color: #3a3a3a;
  flex: 1;
  min-width: 0;
  /* 最多两行，超出省略，保证卡片高度稳定 */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
}

.crown {
  flex: 0 0 auto;
  margin-left: 4px;
  font-size: 9px;
  color: #fff;
  background: var(--ink-green);
  border-radius: 999px;
  padding: 1px 5px;
}

.vs-line {
  text-align: center;
  font-size: 8px;
  color: var(--gold);
  letter-spacing: 1px;
  line-height: 1;
  padding: 1px 0;
  border-top: 1px dashed #eee;
  border-bottom: 1px dashed #eee;
}

.tip {
  text-align: center;
  font-size: 3.1vw;
  padding: 3vw 4.27vw calc(4vw + var(--safe-bottom));
}

@media (min-width: 640px) {
  .progress { font-size: 13px; }
  .champ-link { font-size: 12.5px; padding: 5px 13px; }
  .tip { font-size: 12.5px; }
  .zoom-btn { width: 32px; padding: 4px 0; font-size: 17px; }
  .zoom-pct { padding: 4px 8px; font-size: 12px; min-width: 46px; }
}
</style>
