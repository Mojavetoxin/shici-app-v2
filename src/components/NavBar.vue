<!-- src/components/NavBar.vue —— 顶部导航条（对应小程序 navigationBar） -->
<template>
  <div class="navbar">
    <button v-if="back" class="navbar-back" @click="goBack" aria-label="返回">‹</button>
    <span class="navbar-title">{{ title }}</span>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';

const props = defineProps({
  title: { type: String, default: '' },
  back: { type: Boolean, default: true },
  // 返回目标：默认浏览器后退，兜底回首页
  fallback: { type: String, default: '/' }
});

const router = useRouter();

function goBack() {
  // 有历史记录则回退，否则回首页（等价于小程序的 navigateBack 兜底）
  if (window.history.length > 1) router.back();
  else router.replace(props.fallback);
}
</script>

<style scoped>
.navbar-title {
  font-size: 17px;
  letter-spacing: 1px;
}
</style>
