// src/utils/rush2048.js
// 2048「疾掠」模式的动态概率与阶段跃升机制（纯函数，便于单测）
//
// 设计要点：
//   · 阶段由「场上最大数字」决定，不靠额外记忆 —— 读档 / 撤回后按棋盘重算即为真值
//   · 概率表由「主块」推导，避免手写 5 张表在迭代中互相写错
//   · 跃升时清除上一阶段主块，两个旧主块换一个当前主块（奇数余 1 个不返还）
//
// 阶段表：
//   阶段 0：最大 < 1024       主块 2，分布 2/4/8/16 = 80/12/6/2
//   阶段 1：最大 ≥ 1024       主块 4，  4/8/16/32   = 80/12/6/2
//   阶段 2：最大 ≥ 8192       主块 8，  8/16/32/64 = 80/12/6/2
//   阶段 3：最大 ≥ 65536      主块 16， 16/32/64/128 = 80/12/6/2
//   阶段 4：最大 ≥ 262144     主块 32， 32/64/128/256 = 80/12/6/2
//   达 1048576 → 通关（阶段 5 的门槛，仅作判定，不进入阶段 5）

// 各阶段主块；下标即阶段号
export const RUSH_STAGE_BASE = [2, 4, 8, 16, 32];

// 第 n 次跃升的门槛（场上最大数首次达到即跃升）；下标 0 表示 阶段 0 → 1
export const RUSH_ASCEND_AT = [1024, 8192, 65536, 262144];

// 通关门槛
export const RUSH_CLEAR_AT = 1048576;

// 最高阶段
export const MAX_STAGE = RUSH_STAGE_BASE.length - 1; // 4

// 阶段 0 的分布：2026-09 起统一为 主块80 / 次12 / 三6 / 四2，
// 与阶段 1+ 同一套比例，只是主块取 2、最高一档到 16（不再出现 32）。
// 这样「阶段 0 手感特殊」这件事就不存在了，整条曲线更连贯。
export const STAGE0_POOL = [
  { v: 2, w: 80 },
  { v: 4, w: 12 },
  { v: 8, w: 6 },
  { v: 16, w: 2 }
];

/**
 * 由棋盘最大数字反推当前阶段。
 * 门槛是「达到即跃升」，故用 >= 比较；从高到低匹配，避免多次跃升时写错边界。
 * @param {number} max 场上最大数字（空棋盘传 0）
 * @returns {number} 阶段号 0..MAX_STAGE
 */
export function stageFromMax(max) {
  if (!max || max < RUSH_ASCEND_AT[0]) return 0;
  let stage = 0;
  for (let i = 0; i < RUSH_ASCEND_AT.length && i < MAX_STAGE; i++) {
    if (max >= RUSH_ASCEND_AT[i]) stage = i + 1;
    else break;
  }
  return Math.min(stage, MAX_STAGE);
}

/**
 * 某阶段的生成概率表。
 * 阶段 0 用原始分布；其余阶段统一为 主块 80% / 次块 12% / 三块 6% / 四块 2%。
 * @param {number} stage
 * @returns {{v:number,w:number}[]}
 */
export function rushPoolForStage(stage) {
  const s = Math.min(Math.max(stage | 0, 0), MAX_STAGE);
  if (s === 0) return STAGE0_POOL.map((p) => ({ ...p }));
  const base = RUSH_STAGE_BASE[s];
  return [
    { v: base, w: 80 },
    { v: base * 2, w: 12 },
    { v: base * 4, w: 6 },
    { v: base * 8, w: 2 }
  ];
}

/** 某阶段的主块数值 */
export function stageBaseOf(stage) {
  const s = Math.min(Math.max(stage | 0, 0), MAX_STAGE);
  return RUSH_STAGE_BASE[s];
}

/** 跃升 n-1 → n 时需要清除的旧主块数值 */
export function ascendClearValue(fromStage) {
  const s = Math.min(Math.max(fromStage | 0, 0), MAX_STAGE);
  return RUSH_STAGE_BASE[s];
}

/**
 * 执行一次「阶段跃升」的棋盘变更（原地修改传入的 board，并返回统计）。
 *
 * 规则：
 *   1. 清除棋盘上所有等于旧主块的格子，统计数量 count
 *   2. 生成 floor(count / 2) 个「当前阶段主块」，放入随机空格
 *   3. count 为奇数时余下 1 个不返还（净减少棋子）
 *
 * 安全性：先清出的空格数 = count ≥ floor(count/2)，故位置天然充足；
 * 仍保留空数组防御，避免调用方传入非法棋盘时崩掉。
 *
 * @param {number[][]} board SIZE×SIZE 的数字矩阵（会被原地修改）
 * @param {number} fromStage 跃升前的阶段号
 * @param {(max:number)=>number} [rand] 取 [0,max) 的随机函数（便于测试注入）
 * @returns {{cleared:number, spawned:number, spawnedValue:number, positions:number[][]}}
 */
export function ascendPurge(board, fromStage, rand = Math.random) {
  const SIZE = board.length;
  const oldValue = ascendClearValue(fromStage);
  const newStage = Math.min(fromStage + 1, MAX_STAGE);
  const newValue = stageBaseOf(newStage);

  // 1) 清除旧主块
  const emptied = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === oldValue) {
        board[r][c] = 0;
        emptied.push([r, c]);
      }
    }
  }
  const cleared = emptied.length;

  // 2) 两个旧主块合成一个新主块；奇数余 1 个直接消失
  const spawnCount = Math.floor(cleared / 2);
  const positions = [];
  // 清空后的空格 = 原有空格 + 被清出的格
  const empty = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) empty.push([r, c]);
    }
  }

  for (let i = 0; i < spawnCount; i++) {
    if (!empty.length) break;              // 防御：理论上不会触发
    const k = Math.floor(rand(empty.length) * empty.length);
    const idx = Math.min(Math.max(k, 0), empty.length - 1);
    const pos = empty.splice(idx, 1)[0];
    board[pos[0]][pos[1]] = newValue;
    positions.push(pos);
  }

  return {
    cleared,
    spawned: positions.length,
    spawnedValue: newValue,
    positions
  };
}

/**
 * 按权重抽取数字（与页面内实现一致，此处导出便于测试分布）。
 * @param {{v:number,w:number}[]} pool
 * @param {()=>number} [rand] 取 [0,1) 的随机函数
 */
export function pickWeightedFrom(pool, rand = Math.random) {
  let total = 0;
  for (let i = 0; i < pool.length; i++) total += pool[i].w;
  let r = rand() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= pool[i].w;
    if (r < 0) return pool[i].v;
  }
  return pool[pool.length - 1].v;
}
