<!-- src/components/ToastHost.vue —— 全局轻提示（替代 wx.showToast） -->
<template>
  <transition name="toast-fade">
    <div v-if="toastState.show" class="toast-wrap">
      <div class="toast-box">
        <span v-if="toastState.icon === 'success'" class="toast-ico">✓</span>
        <span class="toast-text">{{ toastState.title }}</span>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { toastState } from '../utils/ui.js';
</script>

<style scoped>
.toast-wrap {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 18vh;
  z-index: 200;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.toast-box {
  max-width: 74vw;
  background: rgba(26, 26, 26, .86);
  color: #fff;
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.6;
  text-align: center;
  backdrop-filter: blur(4px);
  word-break: break-word;
}

.toast-ico {
  margin-right: 6px;
  color: #8be08b;
  font-weight: 700;
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity .2s ease, transform .2s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
