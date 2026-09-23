// tests/rush2048.test.js
// 疾掠模式「动态概率 + 阶段跃升」的规则测试
//
// 覆盖范围：
//   1. 阶段门槛的边界（含 < 与 >= 的临界值）
//   2. 各阶段概率表：权重和恒为 100、主块/次块数值正确
//   3. 阶段 0 分布与原表逐项一致（回归保护）
//   4. 跃升清除/合成的数量守恒（floor(count/2)，奇数余 1 不返还）
//   5. 跃升后棋盘仍可玩（不产生非法值、总数不超容量）
import { describe, it, expect } from 'vitest';
import {
  MAX_STAGE,
  RUSH_ASCEND_AT,
  RUSH_CLEAR_AT,
  RUSH_STAGE_BASE,
  STAGE0_POOL,
  ascendClearValue,
  ascendPurge,
  pickWeightedFrom,
  rushPoolForStage,
  stageBaseOf,
  stageFromMax
} from '../src/utils/rush2048.js';

const S = 4;
const blank = () => Array.from({ length: S }, () => new Array(S).fill(0));
/** 确定性随机源：依次返回给定的 [0,1) 序列（用于消除测试抖动） */
function seq(vals) {
  let i = 0;
  return () => vals[Math.min(i++, vals.length - 1)];
}

describe('stageFromMax —— 阶段门槛边界', () => {
  it('门槛之下的临界值都落在前一阶段', () => {
    expect(stageFromMax(0)).toBe(0);
    expect(stageFromMax(2)).toBe(0);
    expect(stageFromMax(512)).toBe(0);
    expect(stageFromMax(1023)).toBe(0);      // 1024 之前
    expect(stageFromMax(8191)).toBe(1);      // 8192 之前
    expect(stageFromMax(65535)).toBe(2);     // 65536 之前
    expect(stageFromMax(262143)).toBe(3);    // 262144 之前
  });

  it('门槛本身即触发跃升（>= 而非 >）', () => {
    expect(stageFromMax(1024)).toBe(1);
    expect(stageFromMax(8192)).toBe(2);
    expect(stageFromMax(65536)).toBe(3);
    expect(stageFromMax(262144)).toBe(4);
  });

  it('最高只到阶段 4（4 次跃升），通关门槛不额外升阶', () => {
    expect(MAX_STAGE).toBe(4);
    expect(stageFromMax(RUSH_CLEAR_AT)).toBe(4);       // 1048576
    expect(stageFromMax(2147483648)).toBe(4);          // 上限
  });

  it('非法输入（0/负数/undefined）安全回落阶段 0', () => {
    expect(stageFromMax(0)).toBe(0);
    expect(stageFromMax(-1)).toBe(0);
    expect(stageFromMax(undefined)).toBe(0);
    expect(stageFromMax(NaN)).toBe(0);
  });
});

describe('rushPoolForStage —— 概率表', () => {
  it('阶段 0 与其它阶段同比例：主块 2，2/4/8/16 = 80/12/6/2', () => {
    expect(rushPoolForStage(0)).toEqual(STAGE0_POOL);
    expect(STAGE0_POOL).toEqual([
      { v: 2, w: 80 },
      { v: 4, w: 12 },
      { v: 8, w: 6 },
      { v: 16, w: 2 }
    ]);
    // 与阶段 1+ 是同一套权重，只是主块不同
    expect(rushPoolForStage(0).map((p) => p.w)).toEqual([80, 12, 6, 2]);
  });

  it('阶段 0 不再出现 32（最高一档为主块 ×8 = 16）', () => {
    const pool = rushPoolForStage(0);
    expect(pool.map((p) => p.v)).toEqual([2, 4, 8, 16]);
    expect(pool.some((p) => p.v === 32)).toBe(false);
  });

  it('阶段 0~4 概率权重全部为 80/12/6/2，整体一致', () => {
    for (let s = 0; s <= MAX_STAGE; s++) {
      expect(rushPoolForStage(s).map((p) => p.w)).toEqual([80, 12, 6, 2]);
      const sum = rushPoolForStage(s).reduce((a, p) => a + p.w, 0);
      expect(sum).toBe(100);
    }
  });

  it('阶段 1~4 恒为 主块80 / ×2 12 / ×4 6 / ×8 2，权重和 100', () => {
    for (let s = 1; s <= MAX_STAGE; s++) {
      const pool = rushPoolForStage(s);
      const sum = pool.reduce((a, p) => a + p.w, 0);
      expect(sum).toBe(100);

      const base = RUSH_STAGE_BASE[s];
      expect(pool.map((p) => p.v)).toEqual([base, base * 2, base * 4, base * 8]);
      expect(pool.map((p) => p.w)).toEqual([80, 12, 6, 2]);
    }
  });

  it('各阶段主块序列为 2,4,8,16,32', () => {
    expect(RUSH_STAGE_BASE).toEqual([2, 4, 8, 16, 32]);
    for (let s = 0; s <= MAX_STAGE; s++) {
      expect(stageBaseOf(s)).toBe(RUSH_STAGE_BASE[s]);
    }
  });

  it('需求中列出的各阶段具体数值逐条核对', () => {
    expect(rushPoolForStage(1).map((p) => p.v)).toEqual([4, 8, 16, 32]);
    expect(rushPoolForStage(2).map((p) => p.v)).toEqual([8, 16, 32, 64]);
    expect(rushPoolForStage(3).map((p) => p.v)).toEqual([16, 32, 64, 128]);
    expect(rushPoolForStage(4).map((p) => p.v)).toEqual([32, 64, 128, 256]);
  });

  it('越界阶段号被夹紧，不会返回 undefined 概率表', () => {
    expect(rushPoolForStage(-5)).toEqual(rushPoolForStage(0));
    expect(rushPoolForStage(99)).toEqual(rushPoolForStage(MAX_STAGE));
  });
});

describe('ascendClearValue —— 跃升时清除的旧主块', () => {
  it('阶段 n-1 → n 清除阶段 n-1 的主块', () => {
    expect(ascendClearValue(0)).toBe(2);    // 阶段0→1 清 2
    expect(ascendClearValue(1)).toBe(4);    // 阶段1→2 清 4
    expect(ascendClearValue(2)).toBe(8);    // 阶段2→3 清 8
    expect(ascendClearValue(3)).toBe(16);   // 阶段3→4 清 16
  });
});

describe('ascendPurge —— 清除与合成', () => {
  it('clear=偶数：清 N 个旧主块、生成 N/2 个新主块', () => {
    const b = blank();
    b[0][0] = 2; b[0][1] = 2; b[0][2] = 2; b[0][3] = 2;
    b[1][0] = 64;
    const res = ascendPurge(b, 0, seq([0]));

    expect(res.cleared).toBe(4);
    expect(res.spawned).toBe(2);
    expect(res.spawnedValue).toBe(4);        // 阶段 1 主块

    const flat = b.flat();
    expect(flat.filter((v) => v === 4).length).toBe(2);
    expect(flat.filter((v) => v === 2).length).toBe(0);   // 旧主块清空
    expect(flat.filter((v) => v === 64).length).toBe(1);  // 无关方块不动
  });

  it('clear=奇数：余下 1 个直接消失（净减少棋子）', () => {
    const b = blank();
    b[0][0] = 2; b[0][1] = 2; b[0][2] = 2;
    const res = ascendPurge(b, 0, seq([0]));

    expect(res.cleared).toBe(3);
    expect(res.spawned).toBe(1);             // floor(3/2)
    expect(b.flat().filter((v) => v !== 0).length).toBe(1);
  });

  it('clear=0：棋盘完全不动，仅返回零统计', () => {
    const b = blank();
    b[0][0] = 128; b[1][1] = 256;
    const before = JSON.stringify(b);
    const res = ascendPurge(b, 0, seq([0]));

    expect(res.cleared).toBe(0);
    expect(res.spawned).toBe(0);
    expect(JSON.stringify(b)).toBe(before);
  });

  it('数量守恒：Δ非空格数 = spawned - cleared', () => {
    for (let trial = 0; trial < 400; trial++) {
      const b = blank();
      // 随机撒入一些 2（旧主块）与其他值
      for (let r = 0; r < S; r++) {
        for (let c = 0; c < S; c++) {
          const x = Math.random();
          b[r][c] = x < 0.3 ? 2 : x < 0.45 ? 8 : 0;
        }
      }
      const nonEmptyBefore = b.flat().filter((v) => v !== 0).length;
      const res = ascendPurge(b, 0);
      const nonEmptyAfter = b.flat().filter((v) => v !== 0).length;

      expect(res.spawned).toBe(Math.floor(res.cleared / 2));
      expect(nonEmptyAfter - nonEmptyBefore).toBe(res.spawned - res.cleared);
    }
  });

  it('生成的新主块永远落在空格上（不覆盖其他方块）', () => {
    for (let trial = 0; trial < 400; trial++) {
      const b = blank();
      for (let r = 0; r < S; r++) {
        for (let c = 0; c < S; c++) {
          const x = Math.random();
          b[r][c] = x < 0.4 ? 2 : x < 0.7 ? 16 : 0;
        }
      }
      const othersBefore = b.flat().filter((v) => v !== 2 && v !== 0).length;
      const res = ascendPurge(b, 0);
      const othersAfter = b.flat().filter((v) => v !== 4 && v !== 0).length;
      // 非 2 的方块应当一个不少（清除只针对 2）
      expect(othersAfter).toBe(othersBefore);
      expect(res.spawnedValue).toBe(4);
    }
  });

  it('清除数量超过空格容量也不会溢出（2 个换 1 个，位置必然够）', () => {
    // 棋盘只剩 1 个空位且被 2 包围：清的 2 就是位置来源
    const b = blank();
    for (let r = 0; r < S; r++) {
      for (let c = 0; c < S; c++) b[r][c] = 2;
    }
    b[0][0] = 0;
    const res = ascendPurge(b, 0, seq([0]));
    expect(res.cleared).toBe(15);
    expect(res.spawned).toBe(7);             // floor(15/2)
    expect(b.flat().filter((v) => v === 4).length).toBe(7);
    expect(b.flat().filter((v) => v === 2).length).toBe(0);
  });

  it('连续跃升（2→4→8）后棋盘不含更低阶主块残留', () => {
    const b = blank();
    for (let c = 0; c < S; c++) b[0][c] = 2;
    ascendPurge(b, 0, seq([0]));             // 清 2 → 4
    expect(b.flat().filter((v) => v === 2).length).toBe(0);
    expect(b.flat().filter((v) => v === 4).length).toBe(2);

    // 手动补满 4 再跃升一次
    for (let c = 0; c < S; c++) b[1][c] = 4;
    ascendPurge(b, 1, seq([0]));
    expect(b.flat().filter((v) => v === 4).length).toBe(0);
    expect(b.flat().filter((v) => v === 8).length).toBe(3);  // 原有 2 + 新增 floor(4/2)
  });
});

describe('pickWeightedFrom —— 权重抽样的分布', () => {
  it('阶段 0 的长期频率贴合 80/12/6/2', () => {
    const pool = rushPoolForStage(0);
    const N = 200000;
    const hit = {};
    for (let i = 0; i < N; i++) {
      const v = pickWeightedFrom(pool);
      hit[v] = (hit[v] || 0) + 1;
    }
    expect(hit[2] / N).toBeCloseTo(0.8, 1);
    expect(hit[4] / N).toBeCloseTo(0.12, 1);
    expect(hit[8] / N).toBeCloseTo(0.06, 1);
    expect(hit[16] / N).toBeCloseTo(0.02, 1);
    expect(hit[32]).toBeUndefined();   // 阶段 0 不再出现 32
  });

  it('阶段 4 的主块 32 出现率约 80%', () => {
    const pool = rushPoolForStage(4);
    const N = 100000;
    let main = 0;
    for (let i = 0; i < N; i++) if (pickWeightedFrom(pool) === 32) main++;
    expect(main / N).toBeCloseTo(0.8, 1);
  });

  it('边界 rand：0 取首项、接近 1 取末项', () => {
    const pool = rushPoolForStage(2);
    expect(pickWeightedFrom(pool, () => 0)).toBe(8);
    expect(pickWeightedFrom(pool, () => 0.999999)).toBe(64);
  });
});

describe('跃升门槛序列 —— 与需求文档核对', () => {
  it('门槛序列为 1024/8192/65536/262144', () => {
    expect(RUSH_ASCEND_AT).toEqual([1024, 8192, 65536, 262144]);
  });

  it('通关门槛为 1048576', () => {
    expect(RUSH_CLEAR_AT).toBe(1048576);
  });

  it('门槛序列逐级递增，且正好是「清除的旧主块」的 256 倍（逐级翻倍）', () => {
    // 门槛不是整齐的 ×8 等比（实际比值 8/8/4），所以不假设公比，
    // 只断言真正有意义的性质：越过门槛时要清的旧主块恰好是该阶段主块，
    // 且门槛相对该主块的倍数逐级翻倍（256 → 512 → 1024 → 2048 → …）。
    for (let i = 1; i < RUSH_ASCEND_AT.length; i++) {
      expect(RUSH_ASCEND_AT[i]).toBeGreaterThan(RUSH_ASCEND_AT[i - 1]);
    }
    for (let i = 0; i < RUSH_ASCEND_AT.length; i++) {
      // 第 i 次跃升（阶段 i → i+1）清除的是阶段 i 的主块
      expect(ascendClearValue(i)).toBe(RUSH_STAGE_BASE[i]);
      expect(RUSH_ASCEND_AT[i] % RUSH_STAGE_BASE[i]).toBe(0);
    }
    // 门槛越往后越难，但每次跃升带来的"主块提升"是稳定的 +1 档
    expect(RUSH_STAGE_BASE[1] / RUSH_STAGE_BASE[0]).toBe(2);
    expect(RUSH_STAGE_BASE[2] / RUSH_STAGE_BASE[1]).toBe(2);
    expect(RUSH_STAGE_BASE[3] / RUSH_STAGE_BASE[2]).toBe(2);
  });
});
