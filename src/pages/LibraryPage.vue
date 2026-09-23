<!-- src/pages/LibraryPage.vue —— 资源库管理（窗格视图）

     布局：左侧作者栏 + 右侧内容区。
       左栏：作者列表（含篇数），点击即筛选；「全部」置顶。
       右栏：顶部两级筛选 —— 词牌（仅词有）/ 体裁（词、七律…）；
             下方为当前作者 + 筛选条件下的诗词列表。
     移动端：左栏收成横向滚动的胶囊条，避免挤占正文宽度。

     之所以改成窗格：原先是一条超长列表，123 首要滑很久才能找到作者；
     作者 + 词牌两级收敛后，定位一首只需两次点击。 -->
<template>
  <div class="page lib-page">
    <NavBar title="资源库管理" fallback="/" />

    <div class="lib-body">
      <!-- 左栏：作者 -->
      <aside class="pane-author" :class="{ open: authorPaneOpen }">
        <div class="pane-head">
          <span class="pane-title">作者</span>
          <span class="pane-count">{{ authors.length }}</span>
        </div>
        <div class="author-list">
          <div
            class="author-item"
            :class="{ on: activeAuthor === '' }"
            @click="pickAuthor('')">
            <span class="author-name">全部</span>
            <span class="author-num">{{ total }}</span>
          </div>
          <div
            v-for="a in authors"
            :key="a.name"
            class="author-item"
            :class="{ on: activeAuthor === a.name }"
            @click="pickAuthor(a.name)">
            <span class="author-name">{{ a.name }}</span>
            <span class="author-num">{{ a.count }}</span>
          </div>
        </div>
      </aside>

      <!-- 右栏：筛选 + 列表 -->
      <section class="pane-content">
        <!-- 搜索 -->
        <div class="toolbar">
          <button class="pane-toggle" @click="authorPaneOpen = !authorPaneOpen">
            {{ authorPaneOpen ? '‹ 收起' : '作者 ›' }}
          </button>
          <input
            v-model="keyword"
            class="search" type="search" placeholder="搜索标题 / 作者 / 词牌"
            @input="refresh" />
        </div>

        <!-- 两级筛选：词牌（仅词作品有）与体裁。
             判定用 length > 0 而非 > 1：单一作者的体裁往往只有一种
             （杜甫/杜牧全是七律、王国维全是词），若按 >1 判定则整个体裁行
             在单作者视图下永远不显示，等于失效。只有一个选项时也照常显示，
             用户点它至少能确认「这位作者都是这个体裁」。 -->
        <div class="filters">
          <div v-if="cipaiOptions.length" class="filter-row">
            <span class="filter-label">词牌</span>
            <div class="chips">
              <span class="chip" :class="{ on: activeCipai === '' }" @click="pickCipai('')">全部</span>
              <span
                v-for="c in cipaiOptions"
                :key="c.name"
                class="chip"
                :class="{ on: activeCipai === c.name }"
                @click="pickCipai(c.name)">{{ c.name }}·{{ c.count }}</span>
            </div>
          </div>

          <div v-if="typeOptions.length" class="filter-row">
            <span class="filter-label">体裁</span>
            <div class="chips">
              <span class="chip" :class="{ on: activeType === '' }" @click="pickType('')">全部</span>
              <span
                v-for="t in typeOptions"
                :key="t.name"
                class="chip"
                :class="{ on: activeType === t.name }"
                @click="pickType(t.name)">{{ t.name }}·{{ t.count }}</span>
            </div>
          </div>
        </div>

        <div class="result-bar">
          <span class="muted">共 {{ list.length }} 首</span>
          <span v-if="activeAuthor || activeCipai || activeType || keyword" class="clear-btn" @click="clearFilters">清除筛选</span>
        </div>

        <!-- 列表 -->
        <div class="lib-list">
          <div v-for="p in list" :key="p.id" class="lib-item">
            <div class="lib-text">
              <div class="lib-title">{{ p.dispTitle }}</div>
              <div class="lib-meta muted">
                <span>{{ p.author }}</span>
                <span v-if="p.type" class="tag">{{ p.type }}</span>
                <span v-if="p.dynasty" class="tag">{{ p.dynasty }}</span>
              </div>
            </div>
            <div class="lib-ops">
              <button class="op-btn" @click="openEdit(p.id)">编辑</button>
              <button class="op-btn del" @click="del(p.id)">删除</button>
            </div>
          </div>
          <div v-if="!list.length" class="muted empty">未找到匹配的诗词</div>
        </div>

        <button class="btn-primary add-btn" @click="openAdd">+ 添加新诗词</button>
      </section>
    </div>

    <!-- 编辑表单 -->
    <div v-if="showForm" class="mask" @click.self="closeForm">
      <div class="form-box">
        <div class="form-title">{{ editing ? '编辑诗词' : '添加新诗词' }}</div>

        <label class="field">
          <span class="field-label">标题</span>
          <input v-model="form.title" class="field-input" placeholder="如：贺新郎·赋水仙" />
        </label>

        <div class="field-row">
          <label class="field">
            <span class="field-label">作者</span>
            <input v-model="form.author" class="field-input" placeholder="如：辛弃疾" />
          </label>
          <label class="field">
            <span class="field-label">朝代</span>
            <input v-model="form.dynasty" class="field-input" placeholder="如：宋" />
          </label>
        </div>

        <div class="field-row">
          <label class="field">
            <span class="field-label">词牌（词填写）</span>
            <input v-model="form.cipai" class="field-input" placeholder="如：贺新郎" />
          </label>
          <label class="field">
            <span class="field-label">体裁</span>
            <input v-model="form.type" class="field-input" placeholder="词 / 七律 / 七绝" />
          </label>
        </div>

        <label class="field">
          <span class="field-label">全文内容</span>
          <textarea v-model="form.content" class="field-area" rows="7" placeholder="请输入诗词全文"></textarea>
        </label>

        <div class="form-actions">
          <button class="btn-ghost f-act" @click="closeForm">取消</button>
          <button class="btn-primary f-act" @click="save">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import NavBar from '../components/NavBar.vue';
import * as store from '../utils/store.js';
import * as poems from '../utils/poems.js';
import { toast, confirm } from '../utils/ui.js';

const lib = ref([]);            // 全量库
const list = ref([]);           // 当前筛选结果
const total = ref(0);
const keyword = ref('');
const activeAuthor = ref('');
const activeCipai = ref('');
const activeType = ref('');
const authorPaneOpen = ref(false);   // 移动端左栏是否展开
const showForm = ref(false);
const editing = ref(false);
const form = ref({
  id: '', title: '', author: '', dynasty: '', cipai: '', type: '', content: ''
});

// 左栏作者（基于全量库，不受搜索影响，保证导航稳定）
const authors = computed(() => poems.groupByAuthor(lib.value));

// 当前作者范围内的作品（用于推导可选的词牌/体裁）
const scope = computed(() => {
  if (!activeAuthor.value) return lib.value;
  return lib.value.filter((p) => (p.author || '佚名') === activeAuthor.value);
});

const cipaiOptions = computed(() => poems.groupByCipai(scope.value));
const typeOptions = computed(() => poems.groupByType(scope.value));

function pickAuthor(name) {
  activeAuthor.value = name;
  activeCipai.value = '';
  activeType.value = '';
  authorPaneOpen.value = false;
  refresh();
}

function pickCipai(name) {
  activeCipai.value = activeCipai.value === name ? '' : name;
  refresh();
}

function pickType(name) {
  activeType.value = activeType.value === name ? '' : name;
  refresh();
}

function clearFilters() {
  activeAuthor.value = '';
  activeCipai.value = '';
  activeType.value = '';
  keyword.value = '';
  refresh();
}

function refresh() {
  lib.value = store.getLibrary();
  total.value = lib.value.length;
  const k = (keyword.value || '').trim();
  const filtered = lib.value.filter((p) => {
    if (activeAuthor.value && (p.author || '佚名') !== activeAuthor.value) return false;
    if (activeCipai.value && (p.cipai || '') !== activeCipai.value) return false;
    if (activeType.value && poems.typeOf(p) !== activeType.value) return false;
    if (k) {
      const hit = (p.title || '').indexOf(k) >= 0 ||
                  (p.author || '').indexOf(k) >= 0 ||
                  (p.cipai || '').indexOf(k) >= 0;
      if (!hit) return false;
    }
    return true;
  });
  const titleMap = poems.buildDisplayTitles(lib.value);
  list.value = filtered.map((p) => ({
    ...p,
    dispTitle: titleMap[p.id] || poems.displayTitle(p)
  }));
}

onMounted(refresh);

function openAdd() {
  showForm.value = true;
  editing.value = false;
  // 预填当前作者/体裁，方便连续录入同一批作品
  form.value = {
    id: '', title: '',
    author: activeAuthor.value || '',
    dynasty: '',
    cipai: activeCipai.value || '',
    type: activeType.value || '',
    content: ''
  };
}

function openEdit(id) {
  const p = store.getLibrary().find((x) => x.id === id);
  if (!p) return;
  showForm.value = true;
  editing.value = true;
  form.value = {
    id: p.id,
    title: p.title,
    author: p.author,
    dynasty: p.dynasty || '',
    cipai: p.cipai || '',
    type: p.type || '',
    content: p.content
  };
}

function closeForm() {
  showForm.value = false;
}

function save() {
  const f = form.value;
  if (!f.title.trim()) {
    toast('请填写标题');
    return;
  }
  if (!f.content.trim()) {
    toast('请填写全文');
    return;
  }
  const arr = store.getLibrary();
  const obj = {
    id: f.id || ('p' + Date.now()),
    title: f.title.trim(),
    author: f.author.trim(),
    dynasty: f.dynasty.trim(),
    cipai: f.cipai.trim(),
    type: f.type.trim(),
    content: f.content.trim()
  };
  if (f.id) {
    const i = arr.findIndex((x) => x.id === f.id);
    if (i >= 0) arr[i] = obj;
  } else {
    arr.push(obj);
  }
  store.setLibrary(arr);
  showForm.value = false;
  refresh();
}

async function del(id) {
  const ok = await confirm({
    title: '确认删除',
    content: '删除后不可恢复，确定要删除这首诗词吗？',
    confirmColor: '#b8860b'
  });
  if (!ok) return;
  const arr = store.getLibrary().filter((x) => x.id !== id);
  store.setLibrary(arr);
  refresh();
}
</script>

<style scoped>
/* ---------- 主体：左作者栏 + 右内容 ---------- */
.lib-body {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px 4.27vw calc(30px + var(--safe-bottom));
}

.pane-author {
  flex: 0 0 auto;
  width: 104px;
  background: var(--paper-card);
  border: 0.27vw solid var(--line);
  border-radius: 1.6vw;
  padding: 10px 8px;
  /* 与右侧列表一起滚动会让左栏「跑掉」，这里让它跟随页面但保持贴顶 */
  position: sticky;
  top: calc(var(--nav-h) + var(--safe-top) + 8px);
  max-height: calc(100vh - var(--nav-h) - 40px);
  overflow-y: auto;
}

.pane-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0 4px 8px;
  border-bottom: 1px dashed var(--line);
  margin-bottom: 6px;
}

.pane-title { font-size: 13px; font-weight: 700; color: var(--ink-green); }
.pane-count { font-size: 11px; color: var(--muted); }

.author-list { display: flex; flex-direction: column; gap: 2px; }

.author-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 7px 8px;
  border-radius: 7px;
  font-size: 13.5px;
  color: #3a3a3a;
  cursor: pointer;
  transition: background .15s, color .15s;
}

.author-item:hover { background: #f4ecda; }

.author-item.on {
  background: var(--ink-green);
  color: #fff;
  font-weight: 600;
}

.author-item.on .author-num { color: rgba(255, 255, 255, .8); }

.author-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.author-num { font-size: 11px; color: var(--muted); flex: 0 0 auto; }

.pane-content { flex: 1; min-width: 0; }

/* ---------- 工具条 ---------- */
.toolbar { display: flex; gap: 8px; margin-bottom: 10px; }

.pane-toggle {
  display: none;              /* 桌面端不需要收起按钮 */
  flex: 0 0 auto;
  font-size: 12.5px;
  color: var(--warm);
  background: #f6ecd6;
  border-radius: 999px;
  padding: 0 12px;
  white-space: nowrap;
}

.search {
  flex: 1;
  min-width: 0;
  background: var(--paper-card);
  border: 0.27vw solid var(--line);
  border-radius: 999px;
  padding: 3vw 4.4vw;
  font-size: 3.6vw;
  outline: none;
}

.search:focus { border-color: var(--gold); }

/* ---------- 两级筛选 ---------- */
.filters { display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; }

.filter-row { display: flex; align-items: flex-start; gap: 8px; }

.filter-label {
  flex: 0 0 auto;
  font-size: 12px;
  color: var(--warm);
  padding-top: 5px;
  letter-spacing: 1px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.chip {
  font-size: 12.5px;
  line-height: 1;
  padding: 6px 11px;
  border-radius: 999px;
  background: #f3ecdc;
  color: #5d5340;
  border: 1px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  transition: background .15s, color .15s;
}

.chip:hover { background: #ebdfc4; }

.chip.on {
  background: var(--gold);
  color: #fff;
  border-color: var(--gold-deep);
  font-weight: 600;
}

/* ---------- 结果条 ---------- */
.result-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12.5px;
  margin-bottom: 8px;
}

.clear-btn { color: var(--gold-deep); cursor: pointer; }

/* ---------- 列表 ---------- */
.lib-list { display: flex; flex-direction: column; gap: 2.4vw; }

.lib-item {
  display: flex;
  align-items: center;
  gap: 3vw;
  background: var(--paper-card);
  border: 0.27vw solid var(--line);
  border-radius: 1.6vw;
  padding: 3.2vw 3.4vw;
}

.lib-text { flex: 1; min-width: 0; }
.lib-title { font-size: 3.9vw; font-weight: 600; line-height: 1.45; word-break: break-all; }

.lib-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 3.1vw;
  margin-top: 0.8vw;
}

.tag {
  font-size: 10.5px;
  line-height: 1;
  padding: 3px 7px;
  border-radius: 4px;
  background: #eee6d2;
  color: var(--warm);
}

.lib-ops { display: flex; gap: 2vw; flex: 0 0 auto; }

.op-btn {
  font-size: 3.2vw;
  color: var(--warm);
  background: #f6ecd6;
  border-radius: 999px;
  padding: 1.4vw 3vw;
}

.op-btn.del { color: var(--danger); background: #fbeaea; }

.empty { text-align: center; padding: 12vw 0; font-size: 3.6vw; }

.add-btn { margin-top: 20px; font-size: 4.2vw; border-radius: 1.6vw; width: 100%; }

/* ---------- 表单 ---------- */
.form-box {
  width: 86vw;
  max-width: 460px;
  max-height: 84vh;
  overflow-y: auto;
  background: #fff;
  border-radius: 12px;
  padding: 20px 20px 18px;
}

.form-title {
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  color: var(--ink-green);
  margin-bottom: 16px;
}

.field { display: block; margin-bottom: 14px; }
.field-row { display: flex; gap: 10px; }
.field-row .field { flex: 1; min-width: 0; }

.field-label {
  display: block;
  font-size: 13px;
  color: var(--warm);
  margin-bottom: 6px;
}

.field-input, .field-area {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 14px;
  outline: none;
  background: #fffdf9;
  color: #2b2b2b;
}

.field-input:focus, .field-area:focus { border-color: var(--gold); }
.field-area { resize: vertical; line-height: 1.7; }

.form-actions { display: flex; gap: 12px; margin-top: 6px; }
.f-act { flex: 1; font-size: 15px; padding: 11px 0; }

/* ---------- 移动端 ---------- */
@media (max-width: 639px) {
  /* 左栏收成顶部可折叠面板：默认折叠，点「作者 ›」展开为整幅列表，
     避免固定宽度的窄栏把正文挤到只剩一行几个字。 */
  .lib-body { flex-direction: column; gap: 0; }
  .pane-toggle { display: block; }

  .pane-author {
    width: 100%;
    position: static;
    max-height: none;
    border-radius: 1.6vw;
    margin-bottom: 10px;
    display: none;
  }

  .pane-author.open { display: block; }

  .author-list { flex-direction: row; flex-wrap: wrap; gap: 2vw; }
  .author-item {
    flex: 1 1 auto;
    justify-content: flex-start;
    gap: 8px;
    background: #f3ecdc;
    border-radius: 999px;
    padding: 7px 14px;
  }
  .author-item.on { background: var(--ink-green); }
  .pane-head { display: none; }
  .pane-content { width: 100%; }
}

/* ---------- 桌面端 ---------- */
@media (min-width: 640px) {
  .lib-body { max-width: 960px; margin: 0 auto; padding: 18px 20px 40px; }
  .pane-author { width: 132px; padding: 12px 10px; }
  .author-item { font-size: 14px; padding: 8px 10px; }
  .search { font-size: 14px; padding: 10px 16px; border-width: 1px; }
  .chip { font-size: 13px; padding: 7px 13px; }
  .lib-item { padding: 12px 14px; gap: 12px; border-width: 1px; border-radius: 10px; }
  .lib-title { font-size: 15px; }
  .lib-meta { font-size: 12.5px; margin-top: 3px; }
  .op-btn { font-size: 13px; padding: 5px 12px; }
  .empty { font-size: 14px; }
  .add-btn { font-size: 15px; padding: 11px 0; border-radius: 10px; }
}
</style>
