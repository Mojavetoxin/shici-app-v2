<!-- src/components/ConfirmHost.vue —— 全局确认框（替代 wx.showModal） -->
<template>
  <transition name="cf">
    <div v-if="confirmState.show" class="mask" @click.self="resolveConfirm(false)">
      <div class="cf-box">
        <div v-if="confirmState.title" class="cf-title">{{ confirmState.title }}</div>
        <div v-if="confirmState.content" class="cf-content">{{ confirmState.content }}</div>
        <div class="cf-actions">
          <button class="cf-btn cf-cancel" @click="resolveConfirm(false)">{{ confirmState.cancelText }}</button>
          <button class="cf-btn cf-ok" :style="confirmState.confirmColor ? { color: confirmState.confirmColor } : {}"
                  @click="resolveConfirm(true)">{{ confirmState.confirmText }}</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { confirmState, resolveConfirm } from '../utils/ui.js';
</script>

<style scoped>
.cf-box {
  width: 74vw;
  max-width: 360px;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, .22);
}

.cf-title {
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  color: #2b2b2b;
  padding: 20px 20px 0;
}

.cf-content {
  text-align: center;
  font-size: 14px;
  color: #6b6455;
  line-height: 1.7;
  padding: 10px 22px 18px;
}

.cf-actions {
  display: flex;
  border-top: 1px solid #eee;
}

.cf-btn {
  flex: 1;
  padding: 13px 0;
  font-size: 15.5px;
  background: none;
  border: none;
  cursor: pointer;
}

.cf-cancel { color: #7a7a7a; border-right: 1px solid #eee; }
.cf-ok { color: var(--ink-green); font-weight: 600; }
.cf-btn:active { background: #f6f3ec; }

.cf-enter-active, .cf-leave-active { transition: opacity .2s ease; }
.cf-enter-from, .cf-leave-to { opacity: 0; }
.cf-enter-active .cf-box { transition: transform .2s ease; }
.cf-enter-from .cf-box { transform: scale(.94); }
</style>
