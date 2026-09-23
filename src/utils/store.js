// src/utils/store.js
// 本地存储封装：诗词资源库 & 当前对局（由小程序 utils/store.js 迁移）
//
// 迁移要点：
//   wx.getStorageSync / setStorageSync / removeStorageSync  →  localStorage 等价封装
//   小程序原生支持存对象，localStorage 只能存字符串，因此统一 JSON 序列化。
import { defaultPoems } from './poems.js';

export const LIB_KEY = 'poem_library';     // 诗词资源库
export const TOUR_KEY = 'poem_tournament'; // 当前分组流程

// 与 wx.getStorageSync 语义对齐：读不到返回 ''，由调用方用 || 兜底
function read(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return '';
    return JSON.parse(raw);
  } catch (e) {
    // 数据损坏时按「无数据」处理，避免整个页面崩掉
    console.warn('[store] 读取失败，已忽略：', key, e);
    return '';
  }
}

function write(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.warn('[store] 写入失败：', key, e);
  }
}

function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('[store] 删除失败：', key, e);
  }
}

// 读取诗词库（无则返回空数组）
export function getLibrary() {
  return read(LIB_KEY) || [];
}

// 写入诗词库
export function setLibrary(list) {
  write(LIB_KEY, list);
}

// 首次启动写入默认诗词
export function initLibrary() {
  if (!read(LIB_KEY)) {
    write(LIB_KEY, defaultPoems);
  }
}

// 读取当前分组
export function getTournament() {
  return read(TOUR_KEY) || null;
}

// 保存当前分组
export function setTournament(t) {
  write(TOUR_KEY, t);
}

// 清除当前分组（用于"再来一局"）
export function clearTournament() {
  remove(TOUR_KEY);
}

// ---------- 2048 专用键（与小程序保持一致） ----------
export const G2048_BEST_CLASSIC = 'poem2048_best_classic';
export const G2048_BEST_RUSH = 'poem2048_best_rush';
export const G2048_MODE = 'poem2048_mode';
export const G2048_SAVE = 'poem2048_save';
export const G2048_BEST_LEGACY = 'poem2048_best';

function readRaw(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return '';
    return JSON.parse(raw);
  } catch (e) {
    return '';
  }
}

// 2048 读写走通用接口，方便统一处理序列化
export const g2048 = {
  get(key) { return readRaw(key); },
  set(key, val) { write(key, val); },
  remove(key) { remove(key); }
};
