<!-- src/App.vue —— 根组件，承载全局 Toast / 确认框 -->
<template>
  <router-view v-slot="{ Component }">
    <transition name="fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>

  <!-- 全局 Toast（替代 wx.showToast） -->
  <ToastHost />
  <!-- 全局确认框（替代 wx.showModal） -->
  <ConfirmHost />
</template>

<script setup>
import ToastHost from './components/ToastHost.vue';
import ConfirmHost from './components/ConfirmHost.vue';
</script>
