// src/main.js —— 应用入口（对应小程序 app.js）
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { initLibrary } from './utils/store.js';
import './styles/global.css';

// 若本地存储中还没有诗词库，则写入内置默认诗词（与 app.js onLaunch 一致）
initLibrary();

createApp(App).use(router).mount('#app');
