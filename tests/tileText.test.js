// tests/tileText.test.js
// 2048 方块数字文本的格式化与字号分档测试
//
// 覆盖范围：
//   1. formatTile：千分位分组 / K·M·B 缩写 的边界
//   2. fitClassOf：按**显示字符数**分档（回归保护：4 字的 "8192" 与
//      6 字的 "16,384" 必须在不同档 —— 这正是「文字过大互相遮挡」的根因）
//   3. tileFontPx：上限系数、填充系数、异常入参
import { describe, it, expect } from 'vitest';
import {
  TILE_FS_MAX_RATIO,
  TILE_TEXT_FILL,
  fitClassOf,
  formatTile,
  tileFontPx
} from '../src/utils/tileText.js';

describe('formatTile：数字显示格式', () => {
  it('空值返回空串', () => {
    expect(formatTile(0)).toBe('');
    expect(formatTile(null)).toBe('');
    expect(formatTile(undefined)).toBe('');
  });

  it('4 位以内不分组', () => {
    expect(formatTile(2)).toBe('2');
    expect(formatTile(128)).toBe('128');
    expect(formatTile(1024)).toBe('1024');
    expect(formatTile(8192)).toBe('8192');
  });

  it('5~6 位加千分位（≤ 65536）', () => {
    expect(formatTile(16384)).toBe('16,384');
    expect(formatTile(32768)).toBe('32,768');
    expect(formatTile(65536)).toBe('65,536');
  });

  it('> 65536 缩写为 K / M / B（沿用 1000 进制，与现有显示一致）', () => {
    // 注意：这里刻意是 1000 进制（131072 → 131K），与「上限」胶囊用的
    // formatCap（1024 进制，262144 → 256K）不同。前者是方块上的既有显示
    // （用户截图上就是 131K），保持一致以免观感突变。
    expect(formatTile(131072)).toBe('131K');
    expect(formatTile(262144)).toBe('262K');
    expect(formatTile(524288)).toBe('524K');
    expect(formatTile(1048576)).toBe('1M');
    expect(formatTile(2147483648)).toBe('2B');
  });

  it('经典模式上限 65536 仍在千分位档（回归）', () => {
    expect(formatTile(65536)).toBe('65,536');
    expect(formatTile(65536).length).toBe(6);
  });
});

describe('fitClassOf：字号按显示字符数分档', () => {
  it('档位与字符数对应', () => {
    expect(fitClassOf('')).toBe('');
    expect(fitClassOf('2')).toBe('fit3');
    expect(fitClassOf('128')).toBe('fit3');
    expect(fitClassOf('1024')).toBe('fit4');
    expect(fitClassOf('65536')).toBe('fit5');   // 5 字（当前格式不会出现，仅档位兜底）
    expect(fitClassOf('16,384')).toBe('fit6');
    expect(fitClassOf('65,536')).toBe('fit6');
    expect(fitClassOf('1234567')).toBe('fit7');
  });

  it('回归：4 字的 8192 与 6 字的 16,384 不能再同档', () => {
    expect(fitClassOf(formatTile(8192))).toBe('fit4');
    expect(fitClassOf(formatTile(16384))).toBe('fit6');
    expect(fitClassOf(formatTile(8192))).not.toBe(fitClassOf(formatTile(16384)));
    // 三个「过大遮挡」的档位必须都落在长文本档
    for (const v of [16384, 32768, 65536]) {
      expect(fitClassOf(formatTile(v))).toBe('fit6');
    }
  });

  it('档位号随字符数单调不降', () => {
    const num = (c) => Number(c.replace('fit', ''));
    let prev = 3;
    for (const t of ['2', '222', '2222', '22222', '222222', '2222222']) {
      const n = num(fitClassOf(t));
      expect(n).toBeGreaterThanOrEqual(prev);
      prev = n;
    }
  });
});

describe('tileFontPx：按方块内宽反推最大字号', () => {
  const BOX = 70;   // 手机上 393px 宽屏幕里的方块内宽约 70px

  it('短文本受上限系数约束（不会因为字少就无限放大）', () => {
    expect(tileFontPx(BOX, 0.58)).toBeCloseTo(BOX * TILE_FS_MAX_RATIO, 5);
  });

  it('上限系数不能小于修复前的观感（手机 8vw≈内宽45.7% / 桌面 40px≈内宽49%）', () => {
    expect(TILE_FS_MAX_RATIO).toBeGreaterThanOrEqual(0.5);
  });

  it('长文本受填充系数约束', () => {
    const em = 3.12;  // "65,536" 大约的宽/字号比
    expect(tileFontPx(BOX, em)).toBeCloseTo((BOX * TILE_TEXT_FILL) / em, 5);
  });

  it('文字越宽字号越小', () => {
    const a = tileFontPx(BOX, 1.2);
    const b = tileFontPx(BOX, 2.4);
    const c = tileFontPx(BOX, 3.2);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
  });

  it('按结果排的字号确实塞得进方块（留白 ≥ 14%）', () => {
    for (const text of ['2', '128', '1024', '8192', '16,384', '65,536', '131K', '2B']) {
      const em = 0.58 * [...text].filter((ch) => ch !== ',').length + 0.22 * (text.split(',').length - 1);
      const px = tileFontPx(BOX, em);
      expect(px * em).toBeLessThanOrEqual(BOX * TILE_TEXT_FILL + 1e-9);
    }
  });

  it('异常入参返回 0（不产生 NaN 字号）', () => {
    expect(tileFontPx(0, 2)).toBe(0);
    expect(tileFontPx(70, 0)).toBe(0);
    expect(tileFontPx(-5, 2)).toBe(0);
    expect(tileFontPx(70, -1)).toBe(0);
  });
});
