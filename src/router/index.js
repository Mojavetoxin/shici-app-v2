// src/router/index.js —— 路由表（对应 app.json 的 pages）
// 小程序栈：index → setup → bracket → vote → champion，另有 library 与 game2048
import { createRouter, createWebHashHistory } from 'vue-router';

// 用 hash 模式：Capacitor 以 file:// 加载，history 模式会 404
const routes = [
  { path: '/', name: 'index', component: () => import('../pages/IndexPage.vue'), meta: { title: '诗词巅峰赛' } },
  { path: '/setup', name: 'setup', component: () => import('../pages/SetupPage.vue'), meta: { title: '诗词分组' } },
  { path: '/bracket', name: 'bracket', component: () => import('../pages/BracketPage.vue'), meta: { title: '分组与投票' } },
  { path: '/vote/:id', name: 'vote', component: () => import('../pages/VotePage.vue'), meta: { title: '诗词投票' } },
  { path: '/champion', name: 'champion', component: () => import('../pages/ChampionPage.vue'), meta: { title: '最终结果' } },
  { path: '/library', name: 'library', component: () => import('../pages/LibraryPage.vue'), meta: { title: '资源库管理' } },
  { path: '/game2048', name: 'game2048', component: () => import('../pages/Game2048Page.vue'), meta: { title: '2048' } },
  { path: '/:pathMatch(.*)*', redirect: '/' }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  }
});

router.afterEach((to) => {
  const t = to.meta && to.meta.title;
  if (t) document.title = t;
});

export default router;
