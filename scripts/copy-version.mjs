// scripts/copy-version.mjs
// 构建后把仓库根目录的 version.md 复制进 dist/，随静态产物一起发布。
//
// 为什么要单独跑一步：vite.config.js 里 emptyOutDir: true，
// 每次构建都会清空 dist/，所以这份文件必须在构建「之后」写入，
// 否则会被下一次构建抹掉。
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../../version.md');
const outDir = resolve(here, '../dist');
const dest = resolve(outDir, 'version.md');

if (!existsSync(src)) {
  console.warn('[copy-version] 未找到 version.md，跳过：', src);
  process.exit(0);
}
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

copyFileSync(src, dest);
console.log('[copy-version] version.md → dist/version.md');
