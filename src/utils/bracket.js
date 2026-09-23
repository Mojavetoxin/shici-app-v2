// utils/bracket.js
// 淘汰赛核心逻辑（左右半区对称赛制 + 轮空支持）
//
// 设计要点
//  - 左右半区对称：左半区与右半区各自内战至半决赛，决赛在中路相遇。
//  - 参赛人数为 2 的幂（16 / 32）：首轮无轮空，随机相邻配对。
//  - 参赛人数非 2 的幂（如 10 首打 16 强）：首轮设置轮空，轮空选手直接进入第二轮。
//    * 关键约束：轮空位彼此不相遇（每场最多 1 个轮空位），否则会出现「双空场」导致赛程断裂。
//    * 若轮空数 > size/2（差距过大），则自动改用下一档更小的赛制（如 16 改 8），保证赛程完整。
//  - 决赛的两个位置分别来自左半区冠军与右半区冠军，保证冠亚军来自不同半区。

// 轮次名
// size=32 -> [32强赛,16强赛,8强赛,半决赛,决赛]
function getRoundNames(size) {
  const names = [];
  let n = size;
  while (n >= 2) {
    if (n === 2) names.push('决赛');
    else if (n === 4) names.push('半决赛');
    else names.push(n + '强赛');
    n = n / 2;
  }
  return names;
}

// Fisher-Yates 洗牌
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 选择实际使用的赛制规模（2 的幂）：
//   - 容量必须容纳全部参赛者（size >= total），否则向上扩容；
//   - 轮空数必须严格小于 size/2（否则首轮会出现「整轮无人」的空场，赛程形同虚设）；
//   - 结果始终是 2 的幂，且 size >= total。
// 例：4 首参赛 → 采用 4 强赛（0 轮空），而不是 8 强赛（4 轮空，首轮全空）。
function resolveBracketSize(total, preferred) {
  if (!total || total < 2) total = 2;
  // 先确保容量足够（向上取到最近且不小于 total 的 2 的幂）
  let size = 2;
  while (size < total) size *= 2;
  // 若请求规模比所需更大，则采用请求规模（用户主动想打更大的赛制）
  if (preferred > size) size = preferred;
  // 轮空过多时向下缩容：要求 byes < size/2，即 size - total < size/2 ⇔ total > size/2
  while (size > 2 && (size - total) * 2 >= size) {
    const smaller = size / 2;
    if (smaller < total) break; // 再缩就装不下
    size = smaller;
  }
  return size;
}

// 判断某场比赛属于左半区还是右半区
function halfOf(t, r, m) {
  return m.index < t.rounds[r].length / 2 ? 'left' : 'right';
}

// 把胜者写入下一轮：floor(index/2) 定位下一场，index 奇偶决定 a/b
function promote(t, r, m) {
  const winnerPoem = m.winner === 'a' ? m.a : m.b;
  if (!winnerPoem) return;
  const nextRow = t.rounds[r + 1];
  if (!nextRow) return;
  const next = nextRow[Math.floor(m.index / 2)];
  if (!next) return;
  const half = halfOf(t, r, m);
  if (m.index % 2 === 0) { next.a = winnerPoem; next.aSrc = half; }
  else { next.b = winnerPoem; next.bSrc = half; }
}

// 构建第 0 轮签表：保证每个轮空位落在不同的比赛里
// 关键：数组下标必须与比赛 index/id 严格对应（findMatch 依赖此约定），
//       因此不能打乱 row 数组本身，只能打乱「选手分配到各签位」的顺序。
// 分配策略：
//   1. 打乱选手；
//   2. 先给每场比赛的 a 位放一名选手；
//   3. 再把剩余选手（若有）依次放入 b 位；
//   4. 选手不足时，未填的签位即为轮空（null），每场至多一个 null。
// 【公共配对逻辑】把「选手序列」分配到各场的 a / b 签位。
// 这是首轮签表的唯一真相来源：正式生成（buildRow0）与页面预览
// （previewFirstRound）都必须走这里，否则「预览」与「实际对阵」会不一致。
// 输入 players 必须已经是排好序的选手数组（调用方自行决定是否洗牌）。
// 规则：先给每场 a 位放一人，再给每场 b 位放一人；
//       人数不足时未填的签位为轮空（null），且每场至多一个 null（轮空不互撞）。
function allocateSlots(players, size) {
  const matchCount = size / 2;
  const list = players.slice();
  const pairs = [];
  for (let i = 0; i < matchCount; i++) pairs.push({ a: null, b: null });
  for (let i = 0; i < matchCount && list.length; i++) pairs[i].a = list.shift();
  for (let i = 0; i < matchCount && list.length; i++) pairs[i].b = list.shift();
  return pairs;
}

// 构建第 0 轮签表：保证每个轮空位落在不同的比赛里
// 关键：数组下标必须与比赛 index/id 严格对应（findMatch 依赖此约定），
//       因此不能打乱 row 数组本身，只能打乱「选手分配到各签位」的顺序。
// keepOrder=true 时沿用 poems 的现有顺序，不再二次洗牌
//（用于「预览 → 生成」所见即所得：调用方已按目标顺序排好）。
function buildRow0(poems, size, byes, keepOrder) {
  const players = keepOrder ? poems.slice() : shuffle(poems);
  const pairs = allocateSlots(players, size);
  return pairs.map((p, i) => ({
    id: 'r0_m' + i, round: 0, index: i, status: 'pending',
    a: p.a, b: p.b,
    winner: null, autoBye: false, aSrc: null, bSrc: null
  }));
}

// 【页面预览用】返回首轮对阵，形如 [{ a, b }]（a/b 可能为 null 表示轮空）。
// 内部与 buildRow0 共用 allocateSlots，保证「预览即所得」。
// 传入 skipShuffle=true 时沿用 poems 的现有顺序（用于复现同一份对阵）。
function previewFirstRound(poems, size, skipShuffle) {
  const total = poems.length;
  const bracketSize = resolveBracketSize(total, size);
  const players = skipShuffle ? poems.slice() : shuffle(poems);
  return allocateSlots(players, bracketSize);
}

// 生成完整淘汰赛
// poems: 参赛诗词数组；size: 期望的 2 的幂（16 / 32）
// keepOrder: true 时严格沿用 poems 的顺序（「预览即所得」），不二次洗牌；
//            默认 false，表示自行随机配对。
function buildTournament(poems, size, keepOrder) {
  const total = poems.length;
  const bracketSize = resolveBracketSize(total, size); // 实际采用的规模
  const byes = bracketSize - total;
  const R = Math.round(Math.log2(bracketSize)); // 总轮数

  const rounds = [buildRow0(poems, bracketSize, byes, keepOrder)];
  for (let r = 1; r < R; r++) {
    const cnt = bracketSize / Math.pow(2, r + 1);
    const row = [];
    for (let i = 0; i < cnt; i++) {
      row.push({
        id: 'r' + r + '_m' + i, round: r, index: i, status: 'pending',
        a: null, b: null, winner: null, autoBye: false, aSrc: null, bSrc: null
      });
    }
    rounds.push(row);
  }

  const t = {
    size: bracketSize, requestedSize: size, total: total, byes: byes,
    rounds: rounds, createdAt: Date.now(), championId: null
  };

  // 第 0 轮轮空：每个空签（null）所在的比赛，另一方直接晋级
  // 由于已保证每场至多一个 null，不会出现双空场
  t.rounds[0].forEach(m => {
    if (m.a && m.b) return;
    if (!m.a && !m.b) { m.status = 'done'; m.winner = null; m.autoBye = true; return; }
    m.status = 'done';
    m.winner = m.a ? 'a' : 'b';
    m.autoBye = true;
    promote(t, 0, m);
  });
  return t;
}

// 按比赛 id 查找
function findMatch(t, id) {
  const m = /^r(\d+)_m(\d+)$/.exec(id || '');
  if (!m) return null;
  const r = Number(m[1]), i = Number(m[2]);
  if (!t.rounds[r] || !t.rounds[r][i]) return null;
  return t.rounds[r][i];
}

// 可投票：双方都是真实诗词且未完成
function isPlayable(m) {
  return !!(m && m.a && m.b && m.status !== 'done');
}

// 下一场可投票的比赛（轮次优先）
function nextPlayable(t) {
  for (let r = 0; r < t.rounds.length; r++) {
    for (const m of t.rounds[r]) if (isPlayable(m)) return m;
  }
  return null;
}

// 投票；返回 true 表示整届赛事结束（产生冠军）
function vote(t, id, side) {
  const m = findMatch(t, id);
  if (!isPlayable(m)) return false;
  if (side !== 'a' && side !== 'b') return false;
  m.status = 'done';
  m.winner = side;
  promote(t, m.round, m);
  return !!checkChampion(t);
}

// 检查冠军（仅决赛完成才算）
function checkChampion(t) {
  const final = t.rounds[t.rounds.length - 1][0];
  if (final && final.status === 'done' && final.winner) {
    t.championId = final[final.winner].id;
    return t;
  }
  return null;
}

// 冠军与夺冠路径（第 0 轮 -> 决赛，含轮空说明）
function buildChampionPath(t) {
  const rounds = t.rounds;
  const names = getRoundNames(t.size);
  const final = rounds[rounds.length - 1][0];
  if (!final || final.status !== 'done' || !final.winner) {
    return { champion: null, path: [] };
  }
  const champ = final[final.winner];

  const chain = [];
  let cur = final;
  for (let r = rounds.length - 1; r >= 0; r--) {
    chain.push({ r: r, m: cur });
    if (r === 0) break;
    const prev = rounds[r - 1];
    let next = null;
    const src = cur.winner === 'a' ? cur.aSrc : cur.bSrc;
    const posInPrev = (src === 'left') ? cur.index : (prev.length - 1 - cur.index);
    if (prev[posInPrev] && (prev[posInPrev].a === champ || prev[posInPrev].b === champ)) {
      next = prev[posInPrev];
    }
    if (!next) {
      for (const mm of prev) {
        if (mm.a === champ || mm.b === champ) { next = mm; break; }
      }
    }
    if (!next) break;
    cur = next;
  }

  const path = [];
  for (let i = chain.length - 1; i >= 0; i--) {
    const { r, m } = chain[i];
    const oppSide = m.winner === 'a' ? 'b' : 'a';
    const opp = m[oppSide];
    path.push({
      roundName: names[r],
      id: opp ? opp.id : '',
      title: opp ? opp.title : '（轮空）',
      author: opp ? opp.author : '',
      cipai: opp ? opp.cipai : '',
      bye: !opp
    });
  }
  return { champion: champ, path: path };
}

// 当前「最早尚未完成」的轮次（用于进度）
function findCurrentRound(t) {
  for (let r = 0; r < t.rounds.length; r++) {
    if (t.rounds[r].some(m => m.status !== 'done')) return r;
  }
  return t.rounds.length - 1;
}

export {
  shuffle,
  getRoundNames,
  resolveBracketSize,
  previewFirstRound,
  buildTournament,
  findMatch,
  isPlayable,
  nextPlayable,
  vote,
  checkChampion,
  buildChampionPath,
  findCurrentRound
};
