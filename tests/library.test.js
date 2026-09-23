// tests/library.test.js
// 资源库数据与窗格分组逻辑的单元测试
import { describe, it, expect } from 'vitest';
import {
  defaultPoems, displayTitle, buildDisplayTitles, firstLine,
  groupByAuthor, groupByType, groupByCipai, typeOf
} from '../src/utils/poems.js';

describe('资源库数据完整性', () => {
  it('id 唯一', () => {
    const ids = defaultPoems.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('每首都有标题、作者、正文', () => {
    const bad = defaultPoems.filter(p => !p.title || !p.author || !p.content);
    expect(bad).toEqual([]);
  });

  it('每首都有体裁（老数据也已补齐）', () => {
    const bad = defaultPoems.filter(p => !typeOf(p));
    expect(bad).toEqual([]);
  });

  it('收录三份文档中「有涂色」的篇目：王国维15 / 杜牧30 / 杜甫35', () => {
    const cnt = a => defaultPoems.filter(p => p.author === a).length;
    expect(cnt('王国维')).toBe(15);
    expect(cnt('杜牧')).toBe(30);
    expect(cnt('杜甫')).toBe(35);
  });

  it('温庭筠全部篇目无涂色 → 一首都不收录', () => {
    expect(defaultPoems.filter(p => p.author === '温庭筠')).toEqual([]);
  });

  it('诗无词牌、词有词牌', () => {
    defaultPoems.forEach(p => {
      if (p.type === '词') expect(p.cipai).toBeTruthy();
      else expect(p.cipai).toBe('');
    });
  });

  it('词牌字段本身不含「·」（不含词题的词，title 与 cipai 相同）', () => {
    // 注意：辛弃疾的 title 是「词牌·词题」形式，其中的「·」属于标题，
    // 而 cipai 字段本身必须只是纯词牌名。
    const withCipai = defaultPoems.filter(p => p.cipai);
    withCipai.forEach(p => {
      expect(p.type).toBe('词');
      expect(p.cipai).not.toContain('·');
    });
  });

  it('诗（type 非词）的 cipai 一律为空', () => {
    defaultPoems.filter(p => p.type !== '词').forEach(p => {
      expect(p.cipai).toBe('');
    });
  });

  it('正文不含混入的评语/摘句', () => {
    // 评语特征：「某某曰：」引述他人诗句、「某某云，」引述诗话。
    // 用冒号限定，避免误伤「一片归心拟乱云，春来…」这类正常诗句。
    defaultPoems.forEach(p => {
      p.content.split('\n').forEach(line => {
        expect(line).not.toMatch(/^[^，。]{1,8}(曰|云)：/);
        expect(line).not.toMatch(/^按[：:]/);
      });
    });
  });
});

describe('groupByAuthor', () => {
  it('按篇数降序，并带朝代', () => {
    const g = groupByAuthor(defaultPoems);
    const names = g.map(x => x.name);
    expect(names).toContain('辛弃疾');
    expect(names).toContain('王国维');
    // 降序
    for (let i = 1; i < g.length; i++) {
      expect(g[i - 1].count).toBeGreaterThanOrEqual(g[i].count);
    }
    expect(g.find(x => x.name === '辛弃疾').count).toBe(43);
  });

  it('作者缺失时归入「佚名」', () => {
    const g = groupByAuthor([{ id: 'a', title: 't', content: 'c' }]);
    expect(g[0].name).toBe('佚名');
  });
});

describe('groupByType / groupByCipai', () => {
  it('体裁归类正确', () => {
    const g = groupByType(defaultPoems);
    const m = Object.fromEntries(g.map(x => [x.name, x.count]));
    expect(m['词']).toBe(58);
    expect(m['七律']).toBe(65);
  });

  it('词牌只统计有词牌的作品', () => {
    const g = groupByCipai(defaultPoems);
    const m = Object.fromEntries(g.map(x => [x.name, x.count]));
    expect(m['鹧鸪天']).toBe(34);   // 辛弃疾 32 + 王国维 2
    expect(m['贺新郎']).toBe(11);   // 仅辛弃疾
    const total = g.reduce((s, x) => s + x.count, 0);
    expect(total).toBe(defaultPoems.filter(p => p.cipai).length);
  });
});

describe('窗格视图筛选的一致性', () => {
  it('按作者筛选后，其下词牌计数之和不超过该作者篇数', () => {
    const authors = groupByAuthor(defaultPoems);
    authors.forEach(({ name }) => {
      const scope = defaultPoems.filter(p => (p.author || '佚名') === name);
      const cipaiTotal = groupByCipai(scope).reduce((s, x) => s + x.count, 0);
      const typeTotal = groupByType(scope).reduce((s, x) => s + x.count, 0);
      expect(cipaiTotal).toBeLessThanOrEqual(scope.length);
      expect(typeTotal).toBe(scope.length);   // 体裁覆盖全部
    });
  });

  it('杜甫全部为七律', () => {
    const df = defaultPoems.filter(p => p.author === '杜甫');
    expect(df.every(p => p.type === '七律')).toBe(true);
  });

  it('单一作者也有体裁选项（避免筛选行整体消失）', () => {
    // 回归测试：筛选行曾用 `length > 1` 判定，而每位作者都只对应一种体裁，
    // 导致单作者视图下体裁行永远不渲染、筛选功能等于失效。
    ;['杜甫', '杜牧', '王国维', '辛弃疾'].forEach(name => {
      const scope = defaultPoems.filter(p => (p.author || '佚名') === name);
      expect(groupByType(scope).length).toBeGreaterThan(0);
    });
  });

  it('杜甫/杜牧 无词牌 → 词牌行应隐藏（length = 0）', () => {
    ;['杜甫', '杜牧'].forEach(name => {
      const scope = defaultPoems.filter(p => (p.author || '佚名') === name);
      expect(groupByCipai(scope).length).toBe(0);
    });
  });

  it('王国维/辛弃疾 有词牌 → 词牌行应显示', () => {
    ;['王国维', '辛弃疾'].forEach(name => {
      const scope = defaultPoems.filter(p => (p.author || '佚名') === name);
      expect(groupByCipai(scope).length).toBeGreaterThan(0);
    });
  });
});

describe('局部分组函数不修改入参', () => {
  it('groupByAuthor 不改动原数组', () => {
    const src = [{ id: '1', author: 'A', content: 'x' }];
    const copy = JSON.parse(JSON.stringify(src));
    groupByAuthor(src);
    expect(src).toEqual(copy);
  });
});

describe('displayTitle 与新数据的配合', () => {
  it('王国维词只有词牌 → 显示为「词牌·首句」', () => {
    const p = defaultPoems.find(x => x.author === '王国维' && x.title === '浣溪沙');
    expect(p).toBeTruthy();
    const t = displayTitle(p);
    expect(t.startsWith('浣溪沙·')).toBe(true);
    expect(t).toBe('浣溪沙·' + firstLine(p));
  });

  it('诗已有诗题 → title 不含「·」时由显示层补首句', () => {
    // 显示层规则是统一的：title 不含「·」就补「标题·首句」，
    // 诗与词一视同仁，因此「登高」会显示为「登高·风急天高猿啸哀」。
    const p = defaultPoems.find(x => x.title === '登高' && x.author === '杜甫');
    expect(displayTitle(p)).toBe('登高·' + firstLine(p));
  });

  it('标题已含「·」→ 原样显示，不再补首句', () => {
    const p = defaultPoems.find(x => x.title === '长安杂题长句六首·其五');
    expect(p).toBeTruthy();
    expect(displayTitle(p)).toBe('长安杂题长句六首·其五');
  });

  it('辛弃疾《贺新郎·赋水仙》原样显示', () => {
    const p = defaultPoems.find(x => x.title === '贺新郎·赋水仙');
    expect(displayTitle(p)).toBe('贺新郎·赋水仙');
  });

  it('同词牌同首句的重名会被区分开', () => {
    const ww = defaultPoems.filter(x => x.author === '王国维');
    const map = buildDisplayTitles(defaultPoems);
    const titles = ww.map(p => map[p.id]);
    expect(new Set(titles).size).toBe(ww.length);
  });
});
