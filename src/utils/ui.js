// src/utils/ui.js
// UI 服务层：把 wx.showToast / wx.showModal 的调用形式搬到 H5
//
// 小程序里是「直接调用」，H5 里需要挂到一个宿主组件上渲染。
// 这里用一个极简的发布订阅，让任意模块都能 this-less 地调用：
//   import { toast, confirm } from '@/utils/ui.js'
//   toast('请至少选择 2 首')
//   const ok = await confirm({ title: '确认删除', content: '...' })

import { ref } from 'vue';

// ---------------- Toast ----------------
export const toastState = ref({ show: false, title: '', icon: 'none' });
let toastTimer = null;

export function toast(title, opts = {}) {
  const duration = opts.duration ?? 1800;
  toastState.value = { show: true, title: String(title), icon: opts.icon || 'none' };
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastState.value = { ...toastState.value, show: false };
  }, duration);
}

// ---------------- Confirm ----------------
export const confirmState = ref({
  show: false, title: '', content: '', confirmText: '确定', cancelText: '取消', confirmColor: ''
});
let confirmResolver = null;

export function confirm(opts = {}) {
  // 先解决上一个未决的确认，避免悬挂 Promise
  if (confirmResolver) {
    confirmResolver(false);
    confirmResolver = null;
  }
  confirmState.value = {
    show: true,
    title: opts.title || '',
    content: opts.content || '',
    confirmText: opts.confirmText || '确定',
    cancelText: opts.cancelText || '取消',
    confirmColor: opts.confirmColor || ''
  };
  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

export function resolveConfirm(ok) {
  confirmState.value = { ...confirmState.value, show: false };
  if (confirmResolver) {
    confirmResolver(!!ok);
    confirmResolver = null;
  }
}
