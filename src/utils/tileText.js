// src/utils/tileText.js
// 2048 方块的「数字文本格式化 + 字号适配」纯函数（便于单测）
//
// 为什么单独拆出来：
//   原先字号是按**数值大小**分档的（`val >= 1024 && val <= 65536` → 6.93vw，
//   `val > 65536` → 4.8vw）。但真正决定文字宽度的是**格式化之后的字符数**：
//       8192  → "8192"    4 字 → 宽度约 2.1 em
//       16384 → "16,384"  6 字 → 宽度约 3.1 em（5 位起会插千分位逗号）
//   两者被划进了同一档，后者宽度是前者的 1.5 倍 —— 于是在手机上
//   65,536 / 32,768 / 16,384 直接顶出方块、盖到右边邻格上。
//   本模块改成「按显示字符数定档」，formatTile 的格式再变，字号也会自动跟着变。

// 数字显示格式（两级策略）：
//   1) ≤ 65536：千分位分组，如 65,536（4 位以内不分组，如 1024 → "1024"）
//   2) > 65536：缩写为 K / M / B 整数，如 131K、67M、2B
// 因此实际可能出现的文本长度只有 1~4 字与 6 字两种形态。
export function formatTile(val) {
  if (!val) return '';
  if (val > 65536) {
    const units = [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
    for (let i = 0; i < units.length; i++) {
      const base = units[i][0];
      if (val >= base) return Math.round(val / base) + units[i][1];
    }
  }
  const s = String(val);
  if (s.length <= 4) return s;
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ',';
    out += s[i];
  }
  return out;
}

// 字号档位：按「显示字符数」定档（fit3 ~ fit7），CSS 里给出各档基准字号。
// 档位名直接当 class 用，故返回 '' 表示不挂额外 class（用 .g-cell 的基础档）。
export function fitClassOf(text) {
  const n = typeof text === 'string' ? text.length : 0;
  if (!n) return '';
  if (n <= 3) return 'fit3';      // 2 / 128 / 512 / 2B
  if (n === 4) return 'fit4';     // 1024 / 2048 / 4096 / 8192 / 131K / 512K
  if (n === 5) return 'fit5';     // 预留（当前格式不会出现）
  if (n === 6) return 'fit6';     // 16,384 / 32,768 / 65,536
  return 'fit7';                  // 预留（更长文本）
}

// —— 字号适配参数 ——
// 上限系数：即使只有 1~2 个字，字号也不超过方块内宽的 50%。
// 取 0.50 是为了与修复前的观感对齐（手机 8vw ≈ 内宽 45.7%、桌面 40px ≈ 内宽 49%），
// 即「短数字字号不变，长数字才收」。
export const TILE_FS_MAX_RATIO = 0.5;
// 填充系数：长数字最多占方块内宽的 86%，两侧留白，避免贴边 / 压到邻格
export const TILE_TEXT_FILL = 0.86;

// 在给定方块内宽与「文字宽/字号」比值下，算出最大可用字号（px）。
// 这是设备无关的：换字体、换屏宽都会用实测比值重新算，不再靠猜字宽。
export function tileFontPx(boxWidth, emWidth) {
  if (!(boxWidth > 0) || !(emWidth > 0)) return 0;
  return Math.min(boxWidth * TILE_FS_MAX_RATIO, (boxWidth * TILE_TEXT_FILL) / emWidth);
}
