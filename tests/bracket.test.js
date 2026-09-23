// tests/bracket.test.js
// 赛制逻辑单元测试 —— 迁移前先钉死行为，避免 UI 重写引入回归
import { describe, it, expect } from 'vitest';
import {
  shuffle, getRoundNames, resolveBracketSize, previewFirstRound,
  buildTournament, findMatch, isPlayable, nextPlayable,
  vote, checkChampion, buildChampionPath, findCurrentRound
} from '../src/utils/bracket.js';
import { defaultPoems } from '../src/utils/poems.js';

// 构造测试用诗词
function mkPoems(n, cipai = '测试') {
  return Array.from({ length: n }, (_, i) => ({
    id: 'p' + i, title: `${cipai}·第${i + 1}首`, author: '测试', cipai,
    content: '内容' + i
  }));
}

describe('getRoundNames', () => {
  it('32 强 → 5 轮名称正确', () => {
    expect(getRoundNames(32)).toEqual(['32强赛', '16强赛', '8强赛', '半决赛', '决赛']);
  });
  it('16 强 → 4 轮名称正确', () => {
    expect(getRoundNames(16)).toEqual(['16强赛', '8强赛', '半决赛', '决赛']);
  });
  it('4 强 → 半决赛 / 决赛', () => {
    expect(getRoundNames(4)).toEqual(['半决赛', '决赛']);
  });
  it('2 → 仅决赛', () => {
    expect(getRoundNames(2)).toEqual(['决赛']);
  });
});

describe('resolveBracketSize', () => {
  it('11 首请求 32 强 → 降为 16 强（5 轮空）', () => {
    // 容量够 16，且 16-11=5 < 16/2=8，合法
    expect(resolveBracketSize(11, 32)).toBe(16);
  });
  it('32 首请求 32 强 → 32 强（0 轮空）', () => {
    expect(resolveBracketSize(32, 32)).toBe(32);
  });
  it('4 首请求 8 强 → 降为 4 强（避免首轮全空）', () => {
    expect(resolveBracketSize(4, 8)).toBe(4);
  });
  it('轮空数始终严格小于 size/2', () => {
    for (let total = 2; total <= 64; total++) {
      const size = resolveBracketSize(total, 64);
      expect(size).toBeGreaterThanOrEqual(total);
      expect(size - total).toBeLessThan(size / 2);
    }
  });
  it('结果始终是 2 的幂', () => {
    for (let total = 2; total <= 64; total++) {
      const size = resolveBracketSize(total, 64);
      expect(Math.log2(size) % 1).toBe(0);
    }
  });
});

describe('真实数据：辛弃疾两套模板', () => {
  // 注意：资源库现已收录王国维的《鹧鸪天》，故这里必须按作者过滤，
  // 否则 zgt 会含跨作者的 34 首，与「辛弃疾 32 首」的断言不符。
  const hxl = defaultPoems.filter(p => p.cipai === '贺新郎' && p.author === '辛弃疾');
  const zgt = defaultPoems.filter(p => p.cipai === '鹧鸪天' && p.author === '辛弃疾');

  it('贺新郎 11 首 → 16 强、5 个轮空', () => {
    expect(hxl.length).toBe(11);
    const t = buildTournament(hxl, 32, false);
    expect(t.size).toBe(16);
    expect(t.byes).toBe(5);
    expect(t.rounds.length).toBe(4);
    // 首轮 8 场，其中恰好 5 场有轮空
    expect(t.rounds[0].length).toBe(8);
    const byeMatches = t.rounds[0].filter(m => !m.a || !m.b);
    expect(byeMatches.length).toBe(5);
  });

  it('鹧鸪天 32 首 → 32 强、0 轮空', () => {
    expect(zgt.length).toBe(32);
    const t = buildTournament(zgt, 32, false);
    expect(t.size).toBe(32);
    expect(t.byes).toBe(0);
    expect(t.rounds.length).toBe(5);
    expect(t.rounds[0].length).toBe(16);
    const byeMatches = t.rounds[0].filter(m => !m.a || !m.b);
    expect(byeMatches.length).toBe(0);
  });

  it('轮空不互撞：每场至多 1 个空签', () => {
    for (const poems of [hxl, zgt, mkPoems(10), mkPoems(17), mkPoems(5)]) {
      const t = buildTournament(poems, 32, false);
      t.rounds[0].forEach(m => {
        expect(!m.a && !m.b).toBe(false); // 不存在「双空场」
      });
    }
  });

  it('轮空者已自动晋级到第二轮', () => {
    const t = buildTournament(hxl, 32, false);
    // 第 0 轮有轮空的比赛，胜者应已写入第 1 轮
    const byeMatches = t.rounds[0].filter(m => (!m.a || !m.b) && m.a !== m.b);
    expect(byeMatches.length).toBeGreaterThan(0);
    byeMatches.forEach(m => {
      const winner = m.winner === 'a' ? m.a : m.b;
      const next = t.rounds[1][Math.floor(m.index / 2)];
      const slot = m.index % 2 === 0 ? next.a : next.b;
      expect(slot).toBeTruthy();
      expect(slot.id).toBe(winner.id);
    });
  });

  it('所有参赛作品都出现在第 0 轮', () => {
    const t = buildTournament(hxl, 32, false);
    const ids = new Set();
    t.rounds[0].forEach(m => { if (m.a) ids.add(m.a.id); if (m.b) ids.add(m.b.id); });
    expect(ids.size).toBe(11);
  });
});

describe('预览与实际对阵一致（所见即所得）', () => {
  it('previewFirstRound(keepOrder=true) 与 buildTournament(keepOrder=true) 同源', () => {
    const poems = mkPoems(11);
    const pairs = previewFirstRound(poems, 32, true);
    const t = buildTournament(poems, 32, true);
    expect(pairs.length).toBe(t.rounds[0].length);
    pairs.forEach((p, i) => {
      const m = t.rounds[0][i];
      expect(p.a ? p.a.id : null).toBe(m.a ? m.a.id : null);
      expect(p.b ? p.b.id : null).toBe(m.b ? m.b.id : null);
    });
  });

  it('keepOrder=true 时选手顺序被完整沿用（不重排集合）', () => {
    // 注意：allocateSlots 先填满所有 a 位、再填 b 位（这样轮空才不会互撞），
    // 因此「按比赛展平」的顺序并非原序；但「每个选手都在场、无新增/丢失」必须成立。
    const poems = mkPoems(8);
    const t = buildTournament(poems, 8, true);
    const flat = [];
    t.rounds[0].forEach(m => { if (m.a) flat.push(m.a.id); if (m.b) flat.push(m.b.id); });
    expect(flat.length).toBe(8);
    // 顺序严格等于 allocateSlots 的结果：a 位优先，故为 0,4,1,5,2,6,3,7
    expect(flat).toEqual(['p0', 'p4', 'p1', 'p5', 'p2', 'p6', 'p3', 'p7']);
  });

  it('keepOrder=true 时所有选手恰好出现一次', () => {
    const poems = mkPoems(11);
    const t = buildTournament(poems, 32, true);
    const flat = [];
    t.rounds[0].forEach(m => { if (m.a) flat.push(m.a.id); if (m.b) flat.push(m.b.id); });
    expect(flat.slice().sort()).toEqual(poems.map(p => p.id).sort());
    expect(new Set(flat).size).toBe(flat.length);
  });
});

describe('投票与晋级', () => {
  it('isPlayable 判定正确', () => {
    const t = buildTournament(mkPoems(4), 4, false);
    const playable = t.rounds[0].filter(m => isPlayable(m));
    expect(playable.length).toBe(2);
  });

  it('投票后胜者写入下一轮', () => {
    const t = buildTournament(mkPoems(4), 4, false);
    const m0 = t.rounds[0][0];
    const winner = m0.a;
    vote(t, m0.id, 'a');
    expect(m0.status).toBe('done');
    expect(m0.winner).toBe('a');
    const next = t.rounds[1][0];
    const slot = m0.index % 2 === 0 ? next.a : next.b;
    expect(slot.id).toBe(winner.id);
  });

  it('完整 4 强流程能产生冠军', () => {
    const t = buildTournament(mkPoems(4), 4, false);
    vote(t, t.rounds[0][0].id, 'a');
    vote(t, t.rounds[0][1].id, 'a');
    const finished = vote(t, t.rounds[1][0].id, 'a');
    expect(finished).toBe(true);
    expect(t.championId).toBeTruthy();
  });

  it('重复投票无效（已完成的场次不可再投）', () => {
    const t = buildTournament(mkPoems(4), 4, false);
    const m = t.rounds[0][0];
    vote(t, m.id, 'a');
    const again = vote(t, m.id, 'b');
    expect(again).toBe(false);
    expect(m.winner).toBe('a');
  });

  it('非法 side 被拒绝', () => {
    const t = buildTournament(mkPoems(4), 4, false);
    expect(vote(t, t.rounds[0][0].id, 'x')).toBe(false);
  });

  it('32 强全程走完 → 产生冠军', () => {
    const t = buildTournament(mkPoems(32), 32, false);
    let guard = 0;
    let m;
    while ((m = nextPlayable(t)) && guard++ < 100) {
      vote(t, m.id, 'a');
    }
    expect(guard).toBe(31); // 31 场比赛
    expect(t.championId).toBeTruthy();
  });

  it('11 首 16 强赛全程走完 → 产生冠军', () => {
    const t = buildTournament(defaultPoems.filter(p => p.cipai === '贺新郎'), 32, false);
    let played = 0;
    let m;
    // 注意：不能用 while((m = nextPlayable(t)) && played++ < 100)，最后 null 会短路掉计数
    while ((m = nextPlayable(t))) {
      vote(t, m.id, 'b');
      played++;
    }
    // 11 首 → 16 强：总 15 场，其中 5 场轮空自动完成 → 实投 15 - 5 = 10 场
    expect(played).toBe(10);
    expect(t.rounds.reduce((a, r) => a + r.length, 0)).toBe(15);
    expect(t.rounds[0].filter(m => m.autoBye).length).toBe(5);
    expect(t.championId).toBeTruthy();
  });
});

describe('冠军路径', () => {
  it('未结束时返回空', () => {
    const t = buildTournament(mkPoems(4), 4, false);
    const res = buildChampionPath(t);
    expect(res.champion).toBe(null);
    expect(res.path).toEqual([]);
  });

  it('结束后路径长度 = 轮数，且末项为决赛', () => {
    const t = buildTournament(mkPoems(4), 4, false);
    vote(t, t.rounds[0][0].id, 'a');
    vote(t, t.rounds[0][1].id, 'a');
    vote(t, t.rounds[1][0].id, 'a');
    const res = buildChampionPath(t);
    expect(res.champion).toBeTruthy();
    expect(res.path.length).toBe(2);              // 半决赛 + 决赛
    expect(res.path[res.path.length - 1].roundName).toBe('决赛');
  });

  it('含轮空时路径标记 bye', () => {
    // 构造「冠军本人在首轮轮空」的情形：
    // 5 首打 8 强 → 3 个轮空。轮空位分别在 m0/m1/m2 的 b 位（allocateSlots 规则）。
    // 第 0 轮 m0 的 a 位是 p0；让 p0 一路获胜，则其路径首段对手即为「（轮空）」。
    const t = buildTournament(mkPoems(5), 8, true);
    const byeMatch = t.rounds[0].find(m => m.a && !m.b);
    expect(byeMatch).toBeTruthy();

    // 让 byeMatch 的 a 位（轮空受益者）一路胜出
    const winnerId = byeMatch.a.id;
    let m;
    while ((m = nextPlayable(t))) {
      // 只要该场含 winnerId，就投它所在的一侧；否则随便投 a
      if (m.a && m.a.id === winnerId) vote(t, m.id, 'a');
      else if (m.b && m.b.id === winnerId) vote(t, m.id, 'b');
      else vote(t, m.id, 'a');
    }
    expect(t.championId).toBe(winnerId);

    const res = buildChampionPath(t);
    expect(res.champion.id).toBe(winnerId);
    const byeStep = res.path.find(p => p.bye);
    expect(byeStep).toBeTruthy();
    expect(byeStep.title).toBe('（轮空）');
  });
});

describe('findCurrentRound', () => {
  it('全部未完成时为首轮', () => {
    const t = buildTournament(mkPoems(4), 4, false);
    expect(findCurrentRound(t)).toBe(0);
  });
  it('首轮完成后为次轮', () => {
    const t = buildTournament(mkPoems(4), 4, false);
    vote(t, t.rounds[0][0].id, 'a');
    vote(t, t.rounds[0][1].id, 'a');
    expect(findCurrentRound(t)).toBe(1);
  });
});

describe('findMatch / shuffle', () => {
  it('findMatch 能按 id 取回比赛', () => {
    const t = buildTournament(mkPoems(4), 4, false);
    const m = findMatch(t, 'r0_m1');
    expect(m).toBe(t.rounds[0][1]);
  });
  it('findMatch 对非法 id 返回 null', () => {
    const t = buildTournament(mkPoems(4), 4, false);
    expect(findMatch(t, 'bad')).toBe(null);
    expect(findMatch(t, 'r9_m0')).toBe(null);
    expect(findMatch(t, null)).toBe(null);
  });
  it('shuffle 不改动原数组且元素守恒', () => {
    const arr = [1, 2, 3, 4, 5];
    const out = shuffle(arr);
    expect(arr).toEqual([1, 2, 3, 4, 5]);
    expect(out.slice().sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('极端情况', () => {
  it('2 首 → 直接决赛', () => {
    const t = buildTournament(mkPoems(2), 2, false);
    expect(t.rounds.length).toBe(1);
    expect(t.size).toBe(2);
  });

  it('大量随机模拟：每届都能跑到冠军且赛程完整', () => {
    for (let trial = 0; trial < 60; trial++) {
      const n = 2 + Math.floor(Math.random() * 40);
      const t = buildTournament(mkPoems(n), 32, false);
      let guard = 0, m;
      while ((m = nextPlayable(t))) {
        vote(t, m.id, Math.random() < 0.5 ? 'a' : 'b');
        if (++guard > 200) throw new Error('投票循环未收敛');
      }
      expect(t.championId).toBeTruthy();
      // 每个非首轮比赛都应被填满
      for (let r = 1; r < t.rounds.length; r++) {
        t.rounds[r].forEach(mm => {
          expect(mm.a).toBeTruthy();
          expect(mm.b).toBeTruthy();
        });
      }
    }
  });
});
