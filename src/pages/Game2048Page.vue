<!-- src/pages/Game2048Page.vue —— 2048 数字雅集（对应 pages/game2048） -->
<template>
  <div class="g-page">
    <!-- 顶部：返回 + 标题 + 模式切换 + 重开
         返回与"重开"是两个不同动作：返回=离开本页（回首页），
         重开=留在本页清空棋盘，故拆成两个按钮，避免误触丢分后无法返回。
         「重开」放在右上角而非棋盘下方：它紧挨方向键，滑动/连点时极易误触，
         一旦误触本局进度即清零。移到顶部后与方向键拉开距离，且需要移动
         手指到对角线位置才能碰到，误触概率大幅下降。 -->
    <div class="g-top">
      <div class="g-back" @click="goHome">‹ 返回</div>
      <div class="g-title">2048 · 数字雅集</div>
      <div class="g-restart" @click="restart">↻ 重开</div>
      <div class="g-mode">
        <div class="g-mode-opt" :class="{ on: mode === 'classic' }" @click="switchMode('classic')">经典</div>
        <div class="g-mode-opt" :class="{ on: mode === 'rush' }" @click="switchMode('rush')">疾掠</div>
      </div>
    </div>

    <!-- 计分板 -->
    <div class="g-scores">
      <div class="g-score-box">
        <div class="g-score-label">得分</div>
        <div class="g-score-val">{{ score }}</div>
      </div>
      <div class="g-score-box">
        <div class="g-score-label">{{ modeName }}最高</div>
        <div class="g-score-val">{{ best }}</div>
      </div>
    </div>

    <!-- 模式说明 -->
    <div class="g-mode-desc" :class="{ rush: isRush, late: rushStage > 0, cleared: rushed }">
      <span class="g-mode-tag">{{ modeName }}</span>
      <!-- 阶段胶囊：让玩家随时知道自己在第几阶段、该出什么 -->
      <span v-if="isRush" class="g-stage-tag" :class="'s' + rushStage">
        <template v-if="rushed">终章 · 已通关</template>
        <template v-else-if="rushStage === 0">阶段 0 · 主块 2</template>
        <template v-else>阶段 {{ rushStage }} · 主块 {{ stageBaseText }}</template>
      </span>
      <span>{{ modeDesc }}</span>
      <span class="g-cap-tag">上限 {{ capShort }}</span>
    </div>

    <!-- 通关横幅 -->
    <div v-if="rushed" class="g-cleared">
      疾掠通关 · 已达成 {{ formatTileHi }} —— 彩框方块即为通关印记
    </div>

    <!-- 封顶提示 -->
    <div v-else-if="capped" class="g-capped">
      已达上限 {{ maxTileText }}（{{ capShort }}），再大就装不下这张棋盘了
    </div>

    <!-- 棋盘（滑动区）
         触摸事件挂在整页容器上、而不是仅挂在棋盘上：
         手指从棋盘外缘起滑时也能识别，避免"贴着边滑没反应"。
         touch-action 由 CSS 设为 none，浏览器不会把手势抢去滚动页面，
         因此不再依赖 preventDefault，也就不需要 passive。 -->
    <div class="g-main">
      <div class="g-board-wrap" @touchstart="onTouchStart" @touchend="onTouchEnd" @touchcancel="onTouchCancel">
        <div class="g-board" ref="boardEl" :class="[isRush ? 'st' + rushStage : '', rushed ? 'victory' : '']">
          <div v-for="cell in flatBoard" :key="cell.key" class="g-slot">
            <div
              class="g-cell"
              :class="[cell.fit, cell.win1m ? 'win1m' : '', cell.anim]"
              :style="{
                background: cell.bg,
                color: cell.fg,
                borderColor: cell.rim,
                borderWidth: cell.rimW,
                fontSize: tileFs[cell.value] ? `min(var(--fit), ${tileFs[cell.value]})` : ''
              }">{{ cell.value }}</div>
          </div>
        </div>

        <!-- 结束遮罩 -->
        <div v-if="gameOver" class="g-overlay">
          <div class="g-over-text">无路可走</div>
          <div class="g-over-sub">本局得分 {{ score }}</div>
          <div class="g-over-btns">
            <div v-if="canUndo" class="g-over-btn ghost" @click="undo">撤回一步</div>
            <div class="g-over-btn solid" @click="restart">再来一局</div>
          </div>
        </div>
      </div>

      <!-- 操作区：桌面端与棋盘并排（右下角），保证按键时棋盘在视野内；
           移动端仍在棋盘下方，符合单手操作的拇指活动范围。 -->
      <div class="g-side">
        <!-- 操作提示 -->
        <div class="g-hint">
          <span v-if="started">手机滑动 · 电脑方向键 · 或点下方方向键</span>
          <span v-else>滑动或拖拽棋盘开始，相同数字相撞即合并</span>
        </div>

        <!-- 虚拟方向键（触屏兜底；桌面端可直接用键盘方向键） -->
        <div class="g-dpad">
          <div class="g-dpad-btn" @click="move('up')">↑</div>
          <div class="g-dpad-row">
            <div class="g-dpad-btn" @click="move('left')">←</div>
            <div class="g-dpad-btn" @click="move('down')">↓</div>
            <div class="g-dpad-btn" @click="move('right')">→</div>
          </div>
        </div>

        <!-- 底部操作条：只留「撤回」。
             「重开」已移至右上角 —— 这里与方向键相邻，误触后本局清零，
             而撤回是安全操作（可撤销），留在拇指区反而更方便。 -->
        <div class="g-actions">
          <div class="g-act" :class="{ disabled: !canUndo }" @click="undo">↺ 撤回</div>
        </div>
      </div>
    </div>

    <!-- 模式一句话介绍 -->
    <div class="g-intro" :class="{ rush: isRush }">
      <div class="g-intro-line"></div>
      <div class="g-intro-txt">{{ modeIntro }}</div>
      <div class="g-intro-line"></div>
    </div>
  </div>
</template>

<script setup>
// 2048 小游戏 —— 经典 / 疾掠 双模式
//
// 与小程序版的唯一差异：H5 可以监听物理键盘，因此新增方向键支持
//   ← ↑ → ↓ / WASD  →  对应移动（WASD 为桌面端顺手补充）
//   其余行为（双模式分布、封顶合并、撤回栈、自动存档、脏数据校验）完全一致。
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { toast } from '../utils/ui.js';
import { g2048 } from '../utils/store.js';
import { fitClassOf, formatTile, tileFontPx } from '../utils/tileText.js';
import {
  MAX_STAGE,
  RUSH_ASCEND_AT,
  RUSH_CLEAR_AT,
  STAGE0_POOL,
  ascendPurge,
  rushPoolForStage,
  stageBaseOf,
  stageFromMax
} from '../utils/rush2048.js';

const router = useRouter();

const SIZE = 4;

// 模式定义：pool 中 w 为相对权重（不必和为 100，抽取时按总和归一化）
// maxTile：本模式的方块上限（达到上限后不再继续合成，形成「封顶」）
//   疾掠模式的上限设为 2^31：阶段 4 主块 32、最高一档才 256，
//   留足合成空间，同时避免数值溢出；通关判定另有独立门槛（见 RUSH_CLEAR_AT）。
const MODES = {
  classic: {
    key: 'classic',
    name: '经典',
    bestKey: 'poem2048_best_classic',
    desc: '新方块只出现 2 和 4',
    intro: '经典的2048数字合并',
    maxTile: 65536,
    pool: [{ v: 2, w: 90 }, { v: 4, w: 10 }]
  },
  rush: {
    key: 'rush',
    name: '疾掠',
    bestKey: 'poem2048_best_rush',
    desc: '主块 2（80%）· 递增至 16',
    intro: '更多方块，更多可能',
    maxTile: 2147483648,
    // 阶段 0 的概率表（保持原始手感）；阶段 ≥ 1 由 rushPoolForStage 动态给出
    pool: STAGE0_POOL
  }
};
const MODE_STORE_KEY = 'poem2048_mode';
const LEGACY_BEST_KEY = 'poem2048_best';
const SAVE_KEY = 'poem2048_save';

// 古典雅致风色板；高段（2048+）底色偏暗，用 rim 描边做第二识别通道
//   · 描边从 2048 起生效；细而克制（1 ~ 2.5 单位）
//   · 色相在色环上拉开（金 → 青 → 薄荷 → 紫 → 金 → 青 → 白）
const TILE_STYLE = {
  2: { bg: '#F3EADA', fg: '#6b6455' },
  4: { bg: '#EADFC4', fg: '#6b6455' },
  8: { bg: '#DFC68A', fg: '#5a4a20' },
  16: { bg: '#D9B26A', fg: '#ffffff' },
  32: { bg: '#C9A84C', fg: '#ffffff' },
  64: { bg: '#B08B33', fg: '#ffffff' },
  128: { bg: '#8FA05A', fg: '#ffffff' },
  256: { bg: '#6E8C3A', fg: '#ffffff' },
  512: { bg: '#4E7226', fg: '#ffffff' },
  1024: { bg: '#2D5016', fg: '#ffffff' },
  2048: { bg: '#1A3A4A', fg: '#F2D98C', rim: '#5FB3D7', w: 1 },
  4096: { bg: '#122834', fg: '#F5DFA0', rim: '#6FD9B0', w: 1.5 },
  8192: { bg: '#0F2430', fg: '#FFE9AE', rim: '#A98BE8', w: 1.5 },
  16384: { bg: '#0C1D28', fg: '#FFE9AE', rim: '#C9A84C', w: 2 },
  32768: { bg: '#091720', fg: '#FFE9AE', rim: '#4FA3C7', w: 2 },
  65536: { bg: '#061118', fg: '#FFF6D8', rim: '#FFF0C2', w: 2.5 },
  // 以下为疾掠模式高阶段才会出现的档位（阶段 3/4 的 128~512）
  131072: { bg: '#040D14', fg: '#FFF6D8', rim: '#7FD3FF', w: 2.5 },
  262144: { bg: '#03090F', fg: '#FFF6D8', rim: '#B7A2FF', w: 2.5 },
  524288: { bg: '#02060A', fg: '#FFF6D8', rim: '#FF9CD2', w: 2.5 },
  1048576: { bg: '#01050A', fg: '#FFFFFF', rim: '#FFD76E', w: 3 }
};
// 空格槽：叠加在棋盘上的一层暗色，保证「空/有」一眼可分
const EMPTY_STYLE = { bg: 'rgba(20, 14, 6, 0.30)', fg: 'transparent' };

function tileStyle(val) {
  if (!val) return EMPTY_STYLE;
  return TILE_STYLE[val] || { bg: '#040d12', fg: '#FFE9AE', rim: '#FFF0C2', w: 2.5 };
}

// 上限专用短标签：与 formatTile 不同，65,536 也要缩写为 65K
// 注：上限都是 2 的幂，用 1024 进制换算才不会出现 65536→66K 的舍入噪声
function formatCap(val) {
  if (val >= 1024 * 1024 * 1024) return Math.round(val / (1024 * 1024 * 1024)) + 'B';
  if (val >= 1024 * 1024) return Math.round(val / (1024 * 1024)) + 'M';
  if (val >= 1024) return Math.round(val / 1024) + 'K';
  return String(val);
}

// 数字显示格式与字号分档都在 utils/tileText.js（纯函数，有单测）：
//   formatTile —— 千分位 / K·M·B 缩写
//   fitClassOf —— 按**显示字符数**给出字号档位（fit3 ~ fit7）
// 历史上这里是按数值大小分档的，把 4 字的 "8192" 和 6 字的 "16,384"
// 划进同一档，导致后者撑爆方块并盖到邻格 —— 详见 tileText.js 顶部说明。

// 按权重抽取数字（纯函数）
function pickWeighted(pool) {
  let total = 0;
  for (let i = 0; i < pool.length; i++) total += pool[i].w;
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= pool[i].w;
    if (r < 0) return pool[i].v;
  }
  return pool[pool.length - 1].v;
}
/* ---------------- 响应式状态 ---------------- */
const flatBoard = ref([]);
const score = ref(0);
const best = ref(0);
const gameOver = ref(false);
const win = ref(false);
const canUndo = ref(false);
const started = ref(false);

const mode = ref('classic');
const modeName = ref('经典');
const modeDesc = ref('新方块只出现 2 和 4');
const modeIntro = ref('');
const maxTileText = ref('65,536');
const capShort = ref('65K');
const capped = ref(false);
const isRush = ref(false);
// 疾掠模式当前阶段（0~4）与「是否已通关」
const rushStage = ref(0);
const rushed = ref(false);
// 模板用：当前阶段主块文案 / 通关门槛文案
const stageBaseText = computed(() => formatCap(stageBaseOf(rushStage.value)));
const formatTileHi = computed(() => formatTile(RUSH_CLEAR_AT));

// 非响应式的对局内部状态（不需要触发渲染）
let board = [];
let history = [];   // 撤回栈，最多 20 步
let animFlip = false;
let winFlag = false;

const blankBoard = () => Array.from({ length: SIZE }, () => new Array(SIZE).fill(0));

function maxOnBoard(b = board) {
  let max = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = b[r][c];
      if (v > max) max = v;
    }
  }
  return max;
}

// 疾掠模式是否已通关（场上出现通关方块）
function isRushed() {
  return mode.value === 'rush' && maxOnBoard() >= RUSH_CLEAR_AT;
}

// 阶段说明文案：告诉玩家「现在该出什么了」，随阶段与通关变化
function rushStageDesc() {
  if (rushed.value) return '已通关 · ' + formatTile(RUSH_CLEAR_AT) + ' 达成';
  const s = rushStage.value;
  if (s === 0) return '主块 2（80%）· 递增至 16 · 达 1K 跃升';
  const b = stageBaseOf(s);
  const nextAt = RUSH_ASCEND_AT[s];
  const tail = nextAt ? ' · 达 ' + formatCap(nextAt) + ' 跃升' : ' · 终章';
  return '主块 ' + formatCap(b) + '（80%）· 递增至 ' + formatCap(b * 8) + tail;
}

function currentDesc() {
  if (mode.value === 'rush') return rushStageDesc();
  return MODES.classic.desc;
}

// 棋盘上是否已出现当前模式的封顶方块（通关后不再重复提示）
function hasMaxTile() {
  if (isRushed()) return false;
  const cap = (MODES[mode.value] || MODES.classic).maxTile;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] >= cap) return true;
    }
  }
  return false;
}

// 当前应当使用的数字分布（池）
function activePool() {
  if (mode.value === 'rush') return rushPoolForStage(rushStage.value);
  return MODES.classic.pool;
}

function addRandom() {
  const empty = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) empty.push([r, c]);
    }
  }
  if (!empty.length) return null;
  const pos = empty[Math.floor(Math.random() * empty.length)];
  board[pos[0]][pos[1]] = pickWeighted(activePool());
  return pos;
}

/* ---------------- 方块字号自适应（防遮挡保险） ----------------
   分档字号（--fit）已经按字符数给对了基准值，但「1em 到底有多宽」取决于
   设备上真正命中哪个字体（安卓上没有 Songti SC / SimSun，会回落到系统衬线，
   字宽与桌面可能差 10%~20%）。所以再加一层实测保险：
     · 用 canvas 按同一个 font-family 量出这段文字「1px 字号下的宽度」；
     · 按方块实测内宽反推最大可用字号，写成 `min(档位字号, 实测字号)`；
   这样无论什么字体/什么屏宽，数字都不会再顶出方块。只会往小收，不会放大。 */

const boardEl = ref(null);       // .g-board 的模板引用，用来读方块实际内宽
const tileFs = ref({});          // 文本 → '20.4px'，模板里与档位字号取 min
const emWidthCache = new Map();  // 文本 → 每 1px 字号占多少 px 宽
let measureCtx = null;           // null=尚未创建 / false=本环境不支持 canvas
let fitPending = false;
// 必须与 .g-cell 的 font-family / font-weight 完全一致，否则量出来的宽度不作数
const MEASURE_FONT = '700 100px "Songti SC", "SimSun", serif';

function emWidthOf(text) {
  if (emWidthCache.has(text)) return emWidthCache.get(text);
  if (measureCtx === null) measureCtx = document.createElement('canvas').getContext('2d') || false;
  if (!measureCtx) return 0;   // 拿不到 2D 上下文（极端环境）→ 退回纯 CSS 档位字号
  measureCtx.font = MEASURE_FONT;
  const w = measureCtx.measureText(text).width / 100;
  emWidthCache.set(text, w);
  return w;
}

function autoFitFonts() {
  fitPending = false;
  const sample = boardEl.value && boardEl.value.querySelector('.g-slot');
  const boxWidth = sample ? sample.clientWidth : 0;
  if (!boxWidth) return;                 // 还没布局出来，等下一次 render 再算
  const next = {};
  for (const cell of flatBoard.value) {
    const t = cell.value;
    if (!t || next[t]) continue;
    const px = tileFontPx(boxWidth, emWidthOf(t));
    if (px > 0) next[t] = Math.round(px * 10) / 10 + 'px';
  }
  tileFs.value = next;
}

// 合并多次触发：一帧内只量一次（render 每次移动都会调用）
function scheduleAutoFit() {
  if (fitPending) return;
  fitPending = true;
  nextTick(autoFitFonts);
}

/* ---------------- 渲染 ---------------- */

// 统一渲染：所有状态由参数显式传入（避免依赖异步更新的旧值）
// opts.mergeMask: { 棋盘下标: true } 表示该格刚发生合并 → 播合并动画
// opts.spawnKey : 新生成方块的下标 → 播出现动画
// 说明：CSS 动画同名重播需先移除再添加，故用 a/b 两套类名交替，强制重新触发。
function render(opts = {}) {
  const mergeMask = opts.mergeMask || {};
  const spawnKey = typeof opts.spawnKey === 'number' ? opts.spawnKey : -1;
  animFlip = !animFlip;
  const tag = animFlip ? 'a' : 'b';
  const flat = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const val = board[r][c];
      const st = tileStyle(val);
      const idx = r * SIZE + c;
      let anim = '';
      if (idx === spawnKey) anim = 'pop-' + tag;
      else if (mergeMask[idx]) anim = 'merge-' + tag;
      const text = formatTile(val);
      flat.push({
        key: r + '-' + c,
        value: text,
        bg: st.bg,
        fg: st.fg,
        rim: st.rim || 'transparent',
        rimW: st.w ? st.w + 'px' : '0px',
        // 字号档位按「显示字符数」定（fit3 ~ fit7），不再按数值大小分档
        fit: fitClassOf(text),
        // 通关方块（1048576）单独做彩色流动边框
        win1m: val >= 1048576,
        anim
      });
    }
  }
  flatBoard.value = flat;
  gameOver.value = !!opts.gameOver;
  win.value = !!opts.win;
  canUndo.value = history.length > 0;
  started.value = !!opts.started;
  capped.value = hasMaxTile();
  // 阶段与通关状态一律由棋盘推导，保证读档 / 撤回 / 跃升后始终自洽
  rushStage.value = stageFromMax(maxOnBoard());
  rushed.value = isRushed();
  modeDesc.value = currentDesc();
  // 棋盘尺寸/字号可能已变（首屏、转屏、桌面端窗口缩放），重新量一次
  scheduleAutoFit();
}

/* ---------------- 存档 ---------------- */

function saveGame() {
  if (!started.value && !score.value) return;
  const payload = {
    v: 1,
    mode: mode.value,
    board,
    score: score.value,
    win: !!win.value,
    // 阶段仅作记录；读档时以棋盘重算为准（防止篡改阶段绕过清除规则）
    stage: rushStage.value,
    at: Date.now()
  };
  g2048.set(SAVE_KEY, payload);
}

// 读取并校验存档；不合法则返回 null（直接开新局），避免脏数据导致白屏
function loadSave() {
  const raw = g2048.get(SAVE_KEY);
  if (!raw || typeof raw !== 'object') return null;
  if (raw.v !== 1) return null;
  if (!raw.mode || !MODES[raw.mode]) return null;

  const cap = MODES[raw.mode].maxTile;
  const b = raw.board;
  if (!Array.isArray(b) || b.length !== SIZE) return null;
  for (let r = 0; r < SIZE; r++) {
    if (!Array.isArray(b[r]) || b[r].length !== SIZE) return null;
    for (let c = 0; c < SIZE; c++) {
      const v = b[r][c];
      if (typeof v !== 'number' || !isFinite(v) || v < 0 || v % 1 !== 0) return null;
      if (v !== 0 && (v < 2 || (v & (v - 1)) !== 0 || v > cap)) return null;
    }
  }
  let total = 0;
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) total += b[r][c];
  if (total === 0) return null;

  const sc = Number(raw.score);
  if (!isFinite(sc) || sc < 0) return null;

  return { mode: raw.mode, board: b, score: sc, win: !!raw.win };
}

function clearSave() {
  g2048.remove(SAVE_KEY);
}

// 把旧版单一最高分迁移到「经典模式」的 key（仅在新 key 不存在时执行一次）
function migrateLegacyBest() {
  const legacy = Number(g2048.get(LEGACY_BEST_KEY)) || 0;
  if (legacy <= 0) return;
  const cur = Number(g2048.get(MODES.classic.bestKey)) || 0;
  if (cur <= 0) g2048.set(MODES.classic.bestKey, legacy);
}

function readBest(modeKey) {
  const key = (MODES[modeKey] || MODES.classic).bestKey;
  return Number(g2048.get(key)) || 0;
}

// 把模式相关字段写入响应式状态（初始化与 switchMode 共用）
function applyModeData(m) {
  const md = MODES[m] || MODES.classic;
  mode.value = m;
  modeName.value = md.name;
  modeIntro.value = md.intro;
  maxTileText.value = formatTile(md.maxTile);
  capShort.value = formatCap(md.maxTile);
  isRush.value = m === 'rush';
  best.value = readBest(m);
  // 阶段/通关由棋盘决定；此处仅保证切换模式时立即刷新文案
  rushStage.value = stageFromMax(maxOnBoard());
  rushed.value = isRushed();
  modeDesc.value = currentDesc();
}

/* ---------------- 游戏逻辑 ---------------- */

// 单行向左合并，返回新行（同时累加得分）
// 上限规则：合并后的结果若超过当前模式的 maxTile，则数值不再翻倍，
//   但两个同值方块仍然合并为一个（计 0 分、不触发胜利提示）。
//   例（经典上限 65536）：32768+32768 → 65536（正常翻倍、计分）
//                        65536+65536 → 65536（封顶，两块并一块、不计分）
function slide(line, mergePos) {
  const arr = line.filter((v) => v !== 0);
  const cap = (MODES[mode.value] || MODES.classic).maxTile;
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    if (i < arr.length - 1 && arr[i] === arr[i + 1]) {
      const raw = arr[i] * 2;
      const cappedMerge = raw > cap;
      const merged = cappedMerge ? arr[i] : raw;
      if (!cappedMerge && mergePos) mergePos[out.length] = true;
      out.push(merged);
      if (!cappedMerge) {
        score.value += merged;
        if (merged >= 2048) winFlag = true;
      }
      i++;
    } else {
      out.push(arr[i]);
    }
  }
  while (out.length < SIZE) out.push(0);
  return out;
}

function hasEmpty() {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) return true;
    }
  }
  return false;
}

function isDead() {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) return false;
    }
  }
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (c < SIZE - 1 && board[r][c] === board[r][c + 1]) return false;
      if (r < SIZE - 1 && board[r][c] === board[r + 1][c]) return false;
    }
  }
  return true;
}

function updateBest() {
  if (score.value > best.value) {
    best.value = score.value;
    const key = (MODES[mode.value] || MODES.classic).bestKey;
    g2048.set(key, score.value);
  }
}

// 疾掠模式：检查是否触发阶段跃升（由本回合合并出的新数字驱动）
//
// 跃升必须发生在 addRandom() 之前 —— 否则新方块会用旧阶段的概率生成，
// 表现为「已经到阶段 2 了还在刷 2」，这是本机制最容易做错的地方。
//
// 一次滑动理论上最多产生一个新值，但这里用 while 循环更稳：
// 读档 / 撤回后若阶段标记与棋盘不同步，也能一次性追平。
function checkAscend() {
  if (mode.value !== 'rush') return null;
  let lastResult = null;
  let guard = 0;
  while (guard++ < MAX_STAGE + 1) {
    const stage = stageFromMax(maxOnBoard());
    if (stage <= rushStage.value) break;         // 未达新门槛
    if (rushStage.value >= MAX_STAGE) break;     // 已是最高阶段
    const res = ascendPurge(board, rushStage.value);
    rushStage.value = rushStage.value + 1;
    lastResult = res;
  }
  return lastResult;
}

function move(dir) {
  // 已结束：不再响应滑动（结束遮罩上另有"撤回/再来一局"）
  if (gameOver.value) return;

  const snapshot = {
    board: board.map((row) => row.slice()),
    score: score.value,
    win: win.value,
    stage: rushStage.value
  };

  const before = JSON.stringify(board);
  winFlag = false;

  const merges = {};

  for (let i = 0; i < SIZE; i++) {
    let line;
    if (dir === 'left') line = board[i].slice();
    else if (dir === 'right') line = board[i].slice().reverse();
    else if (dir === 'up') line = [board[0][i], board[1][i], board[2][i], board[3][i]];
    else if (dir === 'down') line = [board[3][i], board[2][i], board[1][i], board[0][i]];
    else return;

    const mergePos = {};
    const newLine = slide(line, mergePos);

    // 把 line 下标换算成棋盘坐标
    for (const k in mergePos) {
      const idx = Number(k);
      let r, c;
      if (dir === 'left') { r = i; c = idx; }
      else if (dir === 'right') { r = i; c = SIZE - 1 - idx; }
      else if (dir === 'up') { r = idx; c = i; }
      else { r = SIZE - 1 - idx; c = i; }
      merges[r * SIZE + c] = true;
    }

    if (dir === 'left') board[i] = newLine;
    else if (dir === 'right') board[i] = newLine.reverse();
    else if (dir === 'up') for (let j = 0; j < SIZE; j++) board[j][i] = newLine[j];
    else if (dir === 'down') for (let j = 0; j < SIZE; j++) board[SIZE - 1 - j][i] = newLine[j];
  }

  const after = JSON.stringify(board);
  const moved = after !== before;

  // 无效移动（棋盘没有任何变化）的处理：
  //   棋盘尚有空格 → 仍然算一个回合，生成新方块（方块位置不变）
  //   棋盘已满     → 不生成（否则会被无限消耗，且此时通常已接近死局）
  // 这样设计的目的：手滑方向不对时不会"白滑一下"，
  // 但棋盘满时也不会因此被塞进新方块而无谓地提前结束。
  if (!moved && !hasEmpty()) return;

  history.push(snapshot);
  if (history.length > 20) history.shift();

  // 先判定跃升（会改写棋盘），再生成新方块 —— 顺序不可颠倒
  const ascended = checkAscend();

  const spawn = addRandom();

  // 通关判定：疾掠模式达到 1048576
  const justCleared = isRushed() && !rushed.value;

  let w = win.value;
  if (justCleared) {
    w = true;
    toast('疾掠通关！达 ' + formatTile(RUSH_CLEAR_AT), { icon: 'success', duration: 2200 });
  } else if (ascended && ascended.cleared > 0) {
    // 跃升提示：让玩家知道刚才棋盘为什么变了
    toast(
      '阶段 ' + rushStage.value + ' · 清除 ' + ascended.cleared + ' 个 ' +
      formatCap(stageBaseOf(rushStage.value - 1)) +
      (ascended.spawned ? '，合成 ' + ascended.spawned + ' 个 ' + formatCap(ascended.spawnedValue) : ''),
      { icon: 'success', duration: 2000 }
    );
  } else if (winFlag && !w) {
    w = true;
    toast('达成 2048 ！', { icon: 'success', duration: 1600 });
  }

  updateBest();
  const dead = isDead();
  render({
    gameOver: dead,
    win: w,
    started: true,
    mergeMask: merges,
    spawnKey: spawn ? spawn[0] * SIZE + spawn[1] : -1
  });
  // 每步即时存档：手机切后台 / 直接关标签页 / 硬刷新都不会丢进度。
  // 仅依赖 onBeforeUnmount 是不够的（那些场景 Vue 不会 unmount）。
  saveGame();
}

/* ---------------- 按钮与交互 ---------------- */

// 返回首页：离开本页会触发 onBeforeUnmount 自动存档，
// 因此这里不需要额外 saveGame()，下次进来仍能接着玩。
function goHome() {
  router.push('/');
}

function undo() {
  if (!history.length) return;
  const snap = history.pop();
  board = snap.board;
  score.value = snap.score;
  // 阶段随快照回退（render 里也会按棋盘重算，此处是双保险）
  if (typeof snap.stage === 'number') rushStage.value = snap.stage;
  render({ gameOver: false, win: snap.win, started: history.length > 0 });
}

function restart() {
  board = blankBoard();
  score.value = 0;
  winFlag = false;
  history = [];
  rushStage.value = 0;
  rushed.value = false;
  clearSave();     // 主动开新局 → 清掉旧存档
  applyModeData(mode.value);
  addRandom();
  addRandom();
  render({ gameOver: false, win: false, started: false });
}

// 切换模式：视作开新局 —— 清空棋盘/得分/撤回栈，并载入该模式自己的最高分
function switchMode(key) {
  const target = MODES[key] ? key : (mode.value === 'classic' ? 'rush' : 'classic');
  if (target === mode.value) return;

  mode.value = target;
  g2048.set(MODE_STORE_KEY, target);

  board = blankBoard();
  score.value = 0;
  winFlag = false;
  history = [];
  rushStage.value = 0;
  rushed.value = false;
  clearSave();

  applyModeData(target);
  addRandom();
  addRandom();
  render({ gameOver: false, win: false, started: false });
  toast('已切换：' + MODES[target].name + '模式', { duration: 1200 });
}

/* ---------------- 触摸 / 鼠标拖拽 ---------------- */
let startX = 0;
let startY = 0;
let startT = 0;
let touchActive = false;

// 多指（缩放）时不当作滑动，避免双指误触发移动
function onTouchStart(e) {
  if (e.touches && e.touches.length > 1) {
    touchActive = false;
    return;
  }
  const t = e.touches && e.touches[0];
  if (!t) return;
  startX = t.clientX;
  startY = t.clientY;
  startT = Date.now();
  touchActive = true;
}

// 手势被系统/浏览器打断（来电、通知、切后台）时清理状态，
// 否则 touchActive 会一直为 true，导致下一次滑动被误判。
function onTouchCancel() {
  touchActive = false;
}

function onTouchEnd(e) {
  if (!touchActive) return;
  touchActive = false;
  const t = e.changedTouches && e.changedTouches[0];
  if (!t) return;
  const dx = t.clientX - startX;
  const dy = t.clientY - startY;
  const THRESHOLD = 16; // 有效滑动的最小位移（px），手机上手指抖动约 10px 以内
  if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return;

  // 方向由位移较大的轴决定；位移相同时不动作，避免斜滑误判
  if (Math.abs(dx) === Math.abs(dy)) return;

  let dir;
  if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 'right' : 'left';
  else dir = dy > 0 ? 'down' : 'up';
  move(dir);
}

/* ---------------- 键盘（H5 独有） ---------------- */
const KEY_DIR = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
  W: 'up', S: 'down', A: 'left', D: 'right'
};

function onKeydown(e) {
  const dir = KEY_DIR[e.key];
  if (!dir) return;
  e.preventDefault();   // 阻止方向键滚动页面
  move(dir);
}

/* ---------------- 生命周期 ---------------- */
onMounted(() => {
  migrateLegacyBest();
  history = [];
  touchActive = false;

  // 方块字号实测保险：字号要跟着「方块真实内宽」走，
  // 因此字体加载完成、窗口尺寸变化（含手机转屏、桌面拉窗口）都要重新量一次。
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleAutoFit);
  window.addEventListener('resize', scheduleAutoFit);

  // 优先尝试恢复存档；失败则按「上次使用的模式」开新局
  const save = loadSave();
  if (save) {
    mode.value = save.mode;
    board = save.board;
    score.value = save.score;
    applyModeData(save.mode);
    render({ gameOver: isDead(), win: save.win, started: true });
    toast('已回到上次的对局', { duration: 1500 });
    window.addEventListener('keydown', onKeydown);
    // 兜底：手机切后台/直接关标签页时 Vue 不会 unmount，
    // 仅靠 onBeforeUnmount 会丢掉最后一步；pagehide 是移动端最可靠的钩子。
    window.addEventListener('pagehide', saveGame);
    return;
  }

  let m = 'classic';
  const saved = g2048.get(MODE_STORE_KEY);
  if (saved && MODES[saved]) m = saved;
  mode.value = m;

  board = blankBoard();
  score.value = 0;
  applyModeData(m);
  addRandom();
  addRandom();
  render({ gameOver: false, win: false, started: false });
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('pagehide', saveGame);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('pagehide', saveGame);
  window.removeEventListener('resize', scheduleAutoFit);
  saveGame();   // 离开页面（返回首页 / 切换路由）时存档
});
</script>

<style scoped>
.g-page {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 3.2vw 3.73vw 5.33vw;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--paper);
}

/* 顶部条 */
.g-top {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.6vw;
  margin-bottom: 2.67vw;
}
.g-back {
  flex: none;
  font-size: 3.2vw;
  color: var(--ink-green);
  border: 1px solid var(--ink-green);
  border-radius: 3.2vw;
  padding: 0.8vw 2.93vw;
  cursor: pointer;
}
.g-back:active { background: rgba(45, 80, 22, 0.08); }

/* 右上角「重开」：描边样式比实心更弱，降低视觉诱惑与误触后的挫败感；
   放在标题右侧、模式切换之前，与左下角方向键成对角，手指难以顺手碰到。 */
.g-restart {
  flex: none;
  font-size: 3.2vw;
  color: var(--warm);
  border: 1px solid var(--gold);
  border-radius: 3.2vw;
  padding: 0.8vw 2.67vw;
  background: #fffdf8;
  cursor: pointer;
  white-space: nowrap;
}
.g-restart:active { background: #f6ecd6; }

.g-title {
  flex: 1;
  min-width: 0;
  text-align: center;
  font-size: 4vw;
  font-weight: 700;
  color: var(--ink-green);
  letter-spacing: 0.27vw;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 右上角模式切换（分段控件） */
.g-mode {
  flex: none;
  display: flex;
  border: 1px solid var(--gold);
  border-radius: 3.2vw;
  overflow: hidden;
  background: #fffdf8;
}
.g-mode-opt {
  font-size: 2.93vw;
  padding: 1.07vw 2.4vw;
  color: var(--ink-green);
  cursor: pointer;
  transition: background 0.16s ease, color 0.16s ease;
}
.g-mode-opt.on {
  background: var(--ink-green);
  color: #f7f1e3;
  font-weight: 600;
}
.g-mode-opt.on:last-child { background: #b08b33; color: #fff8e6; }

/* 计分板 */
.g-scores {
  width: 100%;
  display: flex;
  gap: 2.67vw;
  margin-bottom: 3.2vw;
}
.g-score-box {
  flex: 1;
  background: #fffdf8;
  border: 1px solid #e7ddc8;
  border-radius: 1.6vw;
  padding: 2.13vw 0;
  text-align: center;
  box-shadow: 0 0.53vw 2.13vw rgba(45, 80, 22, 0.06);
}
.g-score-label {
  font-size: 2.93vw;
  color: var(--muted);
  letter-spacing: 0.53vw;
  margin-bottom: 0.8vw;
}
.g-score-val {
  font-size: 5.33vw;
  font-weight: 700;
  color: var(--ink-green);
  font-family: "Songti SC", "SimSun", serif;
}

/* 模式说明条 */
.g-mode-desc {
  width: 100%;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1.33vw;
  font-size: 2.93vw;
  color: var(--muted);
  margin: -1.07vw 0 2.13vw;
}
.g-mode-tag {
  flex: none;
  font-size: 2.67vw;
  padding: 0.53vw 1.87vw;
  border-radius: 2.67vw;
  background: #eef3e4;
  color: var(--ink-green);
  font-weight: 600;
}
.g-mode-desc.rush .g-mode-tag { background: #f6ecd6; color: #8a6a1e; }
.g-mode-desc.rush.late .g-mode-tag { background: #8a6a1e; color: #fff8e6; font-weight: 700; }
.g-mode-desc.rush.late { color: #8a6a1e; }
.g-mode-desc.rush.cleared { color: #a8455f; }

/* 阶段胶囊：--glow 由阶段 class 提供，光效、描边、文字色统一由它驱动，
   避免为 5 个阶段各写一份重复规则。 */
.g-stage-tag {
  --glow: #9bbf6a;
  flex: none;
  font-size: 2.67vw;
  padding: 0.53vw 1.87vw;
  border-radius: 2.67vw;
  background: #fffdf8;
  color: #5a4a20;
  font-weight: 700;
  letter-spacing: 0.07vw;
  box-shadow: 0 0 0 1px var(--glow), 0 0 3.2vw -1.33vw var(--glow);
  transition: box-shadow 0.3s ease, color 0.3s ease;
}
.g-stage-tag.s0 { --glow: #9bbf6a; }
.g-stage-tag.s1 { --glow: #c9a84c; }
.g-stage-tag.s2 { --glow: #5fb3d7; }
.g-stage-tag.s3 { --glow: #a98be8; }
.g-stage-tag.s4 {
  --glow: #ff6b9d;
  animation: gStagePulse 1.8s ease-in-out infinite;
}
@keyframes gStagePulse {
  0%, 100% { box-shadow: 0 0 0 1px var(--glow), 0 0 2.4vw -1.33vw var(--glow); }
  50%      { box-shadow: 0 0 0 1px var(--glow), 0 0 5.6vw -0.53vw var(--glow); }
}

.g-cap-tag {
  flex: none;
  margin-left: auto;
  font-size: 2.67vw;
  padding: 0.53vw 1.87vw;
  border-radius: 2.67vw;
  border: 1px solid #e2d6bd;
  background: #fffdf8;
  color: #a8987a;
  letter-spacing: 0.07vw;
}

/* 封顶提示条 */
.g-capped {
  width: 100%;
  margin: 0 0 2.13vw;
  padding: 1.6vw 2.4vw;
  border-radius: 1.33vw;
  background: #fdf4e0;
  border: 1px solid #ecd9a8;
  color: #8a6a1e;
  font-size: 2.93vw;
  text-align: center;
  animation: gIntroIn 0.3s ease-out;
}

/* 通关横幅 */
.g-cleared {
  width: 100%;
  margin: 0 0 2.13vw;
  padding: 1.6vw 2.4vw;
  border-radius: 1.33vw;
  font-size: 2.93vw;
  text-align: center;
  font-weight: 700;
  color: #4a1030;
  background: linear-gradient(100deg, #ffe3f1, #fff4d6, #dff3ff, #ffe3f1);
  background-size: 300% 100%;
  animation: gClearFlow 4s linear infinite, gIntroIn 0.3s ease-out;
}
@keyframes gClearFlow {
  0%   { background-position: 0% 50%; }
  100% { background-position: 300% 50%; }
}

/* 主区：所有屏幕尺寸统一为「棋盘在上、操作在下」的纵向结构，整体居中。
   不做左右分栏 —— 分栏会让棋盘偏左、操作区偏右，视觉重心不居中，
   手机与电脑观感割裂；上下居中在两端都对称、也贴合拇指活动范围。 */
.g-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.g-side {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

/* 棋盘 */
.g-board-wrap {
  position: relative;
  width: 100%;
  max-width: 82.67vw;   /* 620rpx */
  /* 关键：告知浏览器这块区域不参与滚动/缩放手势，
     否则移动端会把纵向滑动判定为"页面滚动"并抢走事件，
     表现为 touchend 不触发（或只触发 touchcancel）→ 划不动。
     pan-x pan-y 都不给，等同完全接管。 */
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}
.g-board {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: 1fr;
  gap: 2.13vw;
  width: 100%;
  aspect-ratio: 1 / 1;
  /* 棋盘底沿用 V1.2 原始配色（深棕） */
  background: linear-gradient(145deg, #6d5a3c, #4a3d29);
  /* 边框随疾掠阶段变色（--stage-glow 由 .st0~.st4 提供），经典模式回落金色 */
  border: 2px solid var(--gold);
  border-color: var(--stage-glow, var(--gold));
  padding: 2.13vw;
  border-radius: 2.13vw;
  box-sizing: border-box;
  box-shadow: 0 1.07vw 3.73vw rgba(45, 80, 22, 0.18);
  transition: border-color 0.5s ease, box-shadow 0.5s ease;
}

/* 疾掠各阶段：棋盘外圈光效随阶段升阶递进，给"我在推进"的正反馈 */
.g-board.st0 { --stage-glow: #9bbf6a; }
.g-board.st1 { --stage-glow: #c9a84c; box-shadow: 0 0 3.2vw -0.8vw #c9a84c, 0 1.07vw 3.73vw rgba(45, 80, 22, 0.18); }
.g-board.st2 { --stage-glow: #5fb3d7; box-shadow: 0 0 4vw -0.8vw #5fb3d7, 0 1.07vw 3.73vw rgba(45, 80, 22, 0.18); }
.g-board.st3 { --stage-glow: #a98be8; box-shadow: 0 0 4.8vw -0.8vw #a98be8, 0 1.07vw 3.73vw rgba(45, 80, 22, 0.18); }
.g-board.st4 {
  --stage-glow: #ff6b9d;
  animation: gBoardPulse 2s ease-in-out infinite;
}
@keyframes gBoardPulse {
  0%, 100% { box-shadow: 0 0 3.2vw -1.07vw #ff6b9d, 0 1.07vw 3.73vw rgba(45, 80, 22, 0.18); }
  50%      { box-shadow: 0 0 6.4vw -0.53vw #ff6b9d, 0 1.07vw 3.73vw rgba(45, 80, 22, 0.18); }
}

/* 通关：棋盘彩色流动边框 */
.g-board.victory {
  animation: gVictory 3s linear infinite;
  border-width: 3px;
}
@keyframes gVictory {
  0%   { border-color: #ff6b9d; box-shadow: 0 0 6vw -0.8vw #ff6b9d; }
  25%  { border-color: #ffd76e; box-shadow: 0 0 6vw -0.8vw #ffd76e; }
  50%  { border-color: #5fe3c0; box-shadow: 0 0 6vw -0.8vw #5fe3c0; }
  75%  { border-color: #7fb3ff; box-shadow: 0 0 6vw -0.8vw #7fb3ff; }
  100% { border-color: #ff6b9d; box-shadow: 0 0 6vw -0.8vw #ff6b9d; }
}

/* 通关方块本体：白字 + 彩色流动描边 */
.g-cell.win1m {
  animation: gWinTile 2.4s linear infinite;
  text-shadow: 0 0 1.33vw rgba(255, 255, 255, 0.9);
}
@keyframes gWinTile {
  0%   { border-color: #ff6b9d; box-shadow: inset 0 0 2.13vw rgba(255,107,157,0.55); }
  25%  { border-color: #ffd76e; box-shadow: inset 0 0 2.13vw rgba(255,215,110,0.55); }
  50%  { border-color: #5fe3c0; box-shadow: inset 0 0 2.13vw rgba(95,227,192,0.55); }
  75%  { border-color: #7fb3ff; box-shadow: inset 0 0 2.13vw rgba(127,179,255,0.55); }
  100% { border-color: #ff6b9d; box-shadow: inset 0 0 2.13vw rgba(255,107,157,0.55); }
}
/* 槽位：用 padding-top 撑成正方形，保证有字/无字格子尺寸完全一致 */
.g-slot {
  position: relative;
  width: 100%;
  padding-top: 100%;
}
.g-cell {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 1.33vw;
  /* 描边由数据驱动（高段各档不同色相 + 逐级加粗），此处仅定基线 */
  border-style: solid;
  border-width: 0;
  border-color: transparent;
  font-weight: 700;
  /* --fit 是「基准口径」的字号档位（见下方 .fit3~.fit7）；
     实际生效值 = min(档位字号, 实测可用字号)，后者由 JS 按方块真实内宽算出，
     用于兜住不同字体的字宽差异（安卓没有 Songti/SimSun，会回落到系统衬线）。 */
  --fit: 8vw;
  font-size: var(--fit);
  font-family: "Songti SC", "SimSun", serif;
  line-height: 1;
  box-sizing: border-box;
  transition: background 0.16s ease, color 0.16s ease;
}
/* 字号按**显示字符数**分档，与 utils/tileText.js 的 fitClassOf 一一对应。
   方块内宽约 18vw，按「数字 0.58em / 逗号 0.22em / 字母 0.72em」估算并留余量：
     3 字内（2 / 128 / 2B）        最宽 ≈ 1.7em → 8vw   ≈ 13.6vw
     4 字  （1024 / 8192 / 512K）  最宽 ≈ 2.5em → 6.2vw ≈ 15.5vw
     5 字  （预留）                最宽 ≈ 3.0em → 5.6vw ≈ 16.8vw
     6 字  （16,384 / 65,536）     最宽 ≈ 3.2em → 5vw   ≈ 16.0vw
     7 字+（预留）                              → 4.4vw
   修复前的写法是「1024 ~ 65536 一律 6.93vw」，把 4 字的 8192 和 6 字的
   16,384 放进同一档：6.93vw × 3.1em ≈ 21.5vw > 18vw，于是 16,384 / 32,768 /
   65,536 顶出方块、盖到右边邻格上。 */
.g-cell.fit3 { --fit: 8vw; }
.g-cell.fit4 { --fit: 6.2vw; }
.g-cell.fit5 { --fit: 5.6vw; }
.g-cell.fit6 { --fit: 5vw; }
.g-cell.fit7 { --fit: 4.4vw; }

/* ---- 动画 ---- */
.g-cell.pop-a, .g-cell.pop-b { animation: gPop 0.2s cubic-bezier(0.22, 1.2, 0.36, 1); }
@keyframes gPop {
  0%   { transform: scale(0.35); opacity: 0.25; }
  65%  { transform: scale(1.07); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
.g-cell.merge-a, .g-cell.merge-b {
  animation: gMerge 0.24s cubic-bezier(0.22, 1.2, 0.36, 1);
  z-index: 2;
}
@keyframes gMerge {
  0%   { transform: scale(1); }
  45%  { transform: scale(1.17); }
  100% { transform: scale(1); }
}

/* 结束遮罩 */
.g-overlay {
  position: absolute;
  inset: 0;
  background: rgba(26, 58, 74, 0.82);
  border-radius: 2.13vw;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  animation: gFade 0.28s ease-out;
}
@keyframes gFade { 0% { opacity: 0; } 100% { opacity: 1; } }
.g-over-text {
  font-size: 6.13vw;
  font-weight: 700;
  color: #F2D98C;
  letter-spacing: 1.07vw;
  font-family: "Songti SC", "SimSun", serif;
}
.g-over-sub { font-size: 3.47vw; color: #e8e0cc; margin-top: 1.6vw; }
.g-over-btns { display: flex; gap: 2.67vw; margin-top: 4.8vw; }
.g-over-btn { padding: 2.13vw 5.33vw; border-radius: 1.33vw; font-size: 3.73vw; cursor: pointer; }
.g-over-btn.solid { background: var(--gold); color: #3a2f14; font-weight: 700; }
.g-over-btn.ghost { border: 1px solid #F2D98C; color: #F2D98C; }
.g-over-btn:active { opacity: 0.85; }

/* 提示 */
.g-hint {
  margin-top: 2.93vw;
  font-size: 3.2vw;
  color: var(--muted);
  text-align: center;
  min-height: 4.53vw;
}

/* 操作条 */
.g-actions { display: flex; gap: 2.67vw; margin-top: 1.07vw; }
.g-act {
  padding: 1.87vw 5.87vw;
  border-radius: 1.6vw;
  font-size: 3.73vw;
  color: var(--ink-green);
  background: #fffdf8;
  border: 1px solid #e7ddc8;
  cursor: pointer;
  user-select: none;
}
.g-act:active { background: rgba(45, 80, 22, 0.06); }
.g-act.disabled { color: #c4bca8; border-color: #eee5d2; }

/* 虚拟方向键 */
.g-dpad { margin-top: 4.27vw; display: flex; flex-direction: column; align-items: center; }
.g-dpad-row { display: flex; }
.g-dpad-btn {
  width: 12.8vw;
  height: 12.8vw;
  max-width: 62px;
  max-height: 62px;
  line-height: 12.8vw;
  text-align: center;
  margin: 1.07vw;
  font-size: 5.87vw;
  color: #f7f1e3;
  background: var(--ink-green);
  border: 1px solid var(--gold);
  border-radius: 1.87vw;
  cursor: pointer;
  user-select: none;
}
.g-dpad-btn:active { background: #244011; transform: scale(0.94); }

/* 模式一句话介绍（页面底部） */
.g-intro {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 1.87vw;
  margin-top: 4.53vw;
  padding: 0 0.8vw 1.07vw;
}
.g-intro-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, rgba(201, 168, 76, 0), rgba(201, 168, 76, 0.55));
}
.g-intro-line:last-child {
  background: linear-gradient(to left, rgba(201, 168, 76, 0), rgba(201, 168, 76, 0.55));
}
.g-intro-txt {
  flex: none;
  max-width: 78%;
  font-size: 2.93vw;
  line-height: 1.7;
  color: var(--muted);
  text-align: center;
  letter-spacing: 0.07vw;
  font-family: "Songti SC", "SimSun", serif;
  animation: gIntroIn 0.32s ease-out;
}
.g-intro.rush .g-intro-txt { color: #8a6a1e; }
.g-intro.rush .g-intro-line {
  background: linear-gradient(to right, rgba(176, 139, 51, 0), rgba(176, 139, 51, 0.7));
}
.g-intro.rush .g-intro-line:last-child {
  background: linear-gradient(to left, rgba(176, 139, 51, 0), rgba(176, 139, 51, 0.7));
}

@keyframes gIntroIn {
  0%   { opacity: 0; transform: translateY(1.07vw); }
  100% { opacity: 1; transform: translateY(0); }
}

/* 桌面端：vw 过大会失衡，缩放关键字号；
   并把棋盘与操作区改为左右两栏 —— 这是「按键离棋盘太远」的正解：
   原先竖排时棋盘在顶、方向键在几百像素之下，按方向键时看不到棋盘。 */
@media (min-width: 640px) {
  /* 紧凑化顶部与计分区：桌面端这两块原本各占 ~30px 高 + 大量留白，
     合计吃掉近 290px 纵向空间，直接挤压棋盘。压缩后棋盘能明显变大。 */
  .g-page { padding: 10px 18px 16px; }
  .g-top { margin-bottom: 10px; }
  .g-back { font-size: 13px; border-radius: 14px; padding: 3px 12px; }
  .g-restart { font-size: 13px; border-radius: 14px; padding: 3px 12px; }
  .g-title { font-size: 17px; }
  .g-mode-opt { font-size: 12px; padding: 4px 10px; }
  .g-scores { margin-bottom: 10px; gap: 12px; }
  .g-score-box { padding: 6px 0; border-radius: 8px; }
  .g-score-label { font-size: 11px; letter-spacing: 1px; margin-bottom: 2px; }
  .g-score-val { font-size: 19px; }
  .g-mode-desc { margin: 0 0 8px; }
  .g-mode-desc, .g-capped, .g-cleared { font-size: 12.5px; }
  .g-mode-tag, .g-cap-tag, .g-stage-tag { font-size: 11px; }
  .g-capped, .g-cleared { margin-bottom: 8px; padding: 6px 12px; border-radius: 8px; }

  /* 布局：宽屏也保持「棋盘居中、操作区在下」的上下结构。
     不做左右分栏 —— 分栏后棋盘偏左、操作区偏右，视觉重心不居中，
     手机与电脑观感也不一致；统一上下居中最稳。

     棋盘宽度受高度约束：顶部信息条 + 棋盘下方操作区这部分必须同屏，
     实测压缩后约 420px。底部那句介绍文案属于装饰，可以落到首屏之外，
     故不计入预算 —— 否则 1366×768 这类笔记本屏上棋盘会被压得过小。 */
  .g-board-wrap {
    width: min(420px, calc(100vh - 420px), calc(100vw - 36px));
    max-width: none;
  }
  .g-main { max-width: none; }

  .g-hint { font-size: 12.5px; margin-top: 12px; min-height: 0; line-height: 1.55; }

  .g-dpad { margin-top: 10px; }
  .g-dpad-btn {
    width: 52px;
    height: 52px;
    max-width: 52px;
    max-height: 52px;
    line-height: 52px;
    margin: 4px;
    font-size: 23px;
    border-radius: 10px;
  }

  .g-actions { margin-top: 12px; gap: 12px; }
  .g-act { font-size: 14px; padding: 7px 22px; }

  .g-board { gap: 10px; padding: 10px; border-radius: 10px; }
  /* 桌面端棋盘宽度 = min(420px, 100vh - 420px, ...)，方块内宽约 73~92px，
     故改成定值 px；比手机端更小的场景由 JS 实测兜底再收一档。 */
  .g-cell { --fit: 40px; border-radius: 7px; }
  .g-cell.fit3 { --fit: 40px; }
  .g-cell.fit4 { --fit: 33px; }
  .g-cell.fit5 { --fit: 29px; }
  .g-cell.fit6 { --fit: 25px; }
  .g-cell.fit7 { --fit: 20px; }
  .g-over-text { font-size: 26px; letter-spacing: 5px; }
  .g-over-sub { font-size: 15px; }
  .g-over-btns { gap: 11px; margin-top: 20px; }
  .g-over-btn { padding: 9px 22px; font-size: 16px; }
  .g-intro { max-width: 760px; margin-top: 10px; }
  .g-intro-txt { font-size: 12px; line-height: 1.5; }
}
</style>
