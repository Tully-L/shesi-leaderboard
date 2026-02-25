// ============================================================
// 社死排行榜 - 共享逻辑
// ============================================================

const CONFIG = {
  // Supabase 配置（拿到后填入，填入后改 USE_SUPABASE 为 true）
  SUPABASE_URL: '',
  SUPABASE_KEY: '',
  USE_SUPABASE: false,

  // 智谱 GLM API Key（建议后续换成 Supabase Edge Function 代理）
  GLM_KEY: 'a7f63a7e0146467ba9282ce28cff3c35.YUwhumPeBTkN8vKZ',
  GLM_MODEL: 'glm-4-flash',
};

// ── 用户标识 ──────────────────────────────────────────────
function getAuthorId() {
  let id = localStorage.getItem('shesi_uid');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('shesi_uid', id); }
  return id;
}

// ── 点赞状态 ──────────────────────────────────────────────
function getLiked() { return JSON.parse(localStorage.getItem('shesi_liked') || '[]'); }
function isLiked(id) { return getLiked().includes(id); }
function toggleLiked(id) {
  const arr = getLiked();
  const i = arr.indexOf(id);
  if (i === -1) arr.push(id); else arr.splice(i, 1);
  localStorage.setItem('shesi_liked', JSON.stringify(arr));
  return i === -1; // true = now liked
}

// ── GLM 社死指数计算 ──────────────────────────────────────
async function calcDeathIndex(content) {
  const prompt = `你是"社死指数评审官"，请评估以下真实发生的社死经历。
综合三个维度：尴尬程度（当场想挖地洞）、影响范围（几个人目睹）、无力感（能否挽回）。

只返回 JSON，不要有任何其他内容：
{"score":整数,"level":"等级名","reason":"不超过15字的一句话点评"}

等级规则：90-100=地狱级社死 / 75-89=极高危社死 / 60-74=高危社死 / 40-59=中度社死 / 1-39=轻度社死

社死经历：${content}`;

  try {
    const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.GLM_KEY}`,
      },
      body: JSON.stringify({
        model: CONFIG.GLM_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 200,
      }),
    });
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    const match = text.match(/\{[\s\S]*?\}/);
    if (match) {
      const result = JSON.parse(match[0]);
      if (result.score && result.level && result.reason) return result;
    }
    throw new Error('parse error');
  } catch (e) {
    // 备用：关键词算法
    return fallbackScore(content);
  }
}

function fallbackScore(content) {
  const keywords = {
    high: ['领导','全公司','直播','朋友圈','发错','全班','当着','所有人','万人'],
    mid: ['同事','朋友','聚会','相亲','面试','群消息'],
    low: ['自己','一个人','回家'],
  };
  let score = 40;
  score += Math.min(30, content.length * 0.08);
  keywords.high.forEach(k => { if (content.includes(k)) score += 12; });
  keywords.mid.forEach(k => { if (content.includes(k)) score += 6; });
  keywords.low.forEach(k => { if (content.includes(k)) score -= 5; });
  score = Math.max(10, Math.min(100, Math.round(score)));
  const levels = [
    { min: 90, level: '地狱级社死', reason: '影响范围极大，颜面扫地' },
    { min: 75, level: '极高危社死', reason: '众目睽睽，难以挽回' },
    { min: 60, level: '高危社死', reason: '尴尬至极，记忆深刻' },
    { min: 40, level: '中度社死', reason: '当时很尬，事后能缓' },
    { min: 0,  level: '轻度社死', reason: '稍显尴尬，无伤大雅' },
  ];
  const { level, reason } = levels.find(l => score >= l.min);
  return { score, level, reason };
}

// ── 数据层 (localStorage) ────────────────────────────────
// 后续接入 Supabase 时，替换此对象的方法实现即可
const DB = {
  _getPosts() {
    const raw = localStorage.getItem('shesi_posts');
    if (!raw) {
      // 初始化种子数据
      const seed = [
        { id: crypto.randomUUID(), content: '在公司厕所打电话吐槽领导说他开会又臭又长天天画大饼，出来发现领导就站在门口洗手，我们四目相对了整整三秒钟。更社死的是，第二天领导开会专门表扬了我"敢于直言"，全公司都知道了。', tag: '职场', deathIndex: 98, deathLevel: '地狱级社死', deathReason: '全公司见证，领导亲赐荣誉，窒息', anonymous: true, location: '北京', likes: 2341, authorId: 'seed', createdAt: Date.now() - 7200000 },
        { id: crypto.randomUUID(), content: '相亲饭局上想展示自己会说日语，把"我很喜欢你"说成了"我是变态"。对面沉默三秒，然后叫了服务员结账。', tag: '恋爱', deathIndex: 91, deathLevel: '极高危社死', deathReason: '当场翻车，对方秒退', anonymous: true, location: '上海', likes: 1876, authorId: 'seed', createdAt: Date.now() - 18000000 },
        { id: crypto.randomUUID(), content: '以为自己退群了，结果只是把群名改了，然后发了条"终于离职了，这群傻X"。', tag: '网络', deathIndex: 87, deathLevel: '极高危社死', deathReason: '全员目睹，已无退路', anonymous: false, location: '', likes: 1543, authorId: 'seed', createdAt: Date.now() - 86400000 },
        { id: crypto.randomUUID(), content: '面试时聊到上家公司氛围差，面试官突然说"我前夫确实管理有问题"。原来她就是上家老板的前妻。', tag: '职场', deathIndex: 83, deathLevel: '高危社死', deathReason: '现实反转，自掘坟墓', anonymous: true, location: '深圳', likes: 1298, authorId: 'seed', createdAt: Date.now() - 172800000 },
        { id: crypto.randomUUID(), content: '在全员视频会议上以为静音了，跟妈妈抱怨领导，300人都听见了。领导停下来说"说得很对，我们改进"。', tag: '职场', deathIndex: 95, deathLevel: '地狱级社死', deathReason: '300人见证，领导补刀', anonymous: true, location: '杭州', likes: 2089, authorId: 'seed', createdAt: Date.now() - 3600000 },
      ];
      localStorage.setItem('shesi_posts', JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw);
  },
  _savePosts(posts) { localStorage.setItem('shesi_posts', JSON.stringify(posts)); },

  async getPosts(sort = 'likes') {
    const posts = this._getPosts();
    if (sort === 'new')  return posts.sort((a, b) => b.createdAt - a.createdAt);
    if (sort === 'hall') return posts.sort((a, b) => b.deathIndex - a.deathIndex);
    return posts.sort((a, b) => b.likes - a.likes); // hot
  },

  async getPost(id) {
    return this._getPosts().find(p => p.id === id) || null;
  },

  async savePost(post) {
    const posts = this._getPosts();
    post.id = crypto.randomUUID();
    post.createdAt = Date.now();
    post.likes = 0;
    post.authorId = post.authorId || getAuthorId();
    posts.unshift(post);
    this._savePosts(posts);
    return post;
  },

  async likePost(id) {
    const posts = this._getPosts();
    const post = posts.find(p => p.id === id);
    if (!post) return false;
    const nowLiked = toggleLiked(id);
    post.likes = Math.max(0, post.likes + (nowLiked ? 1 : -1));
    this._savePosts(posts);
    return nowLiked;
  },

  async getComments(postId) {
    const all = JSON.parse(localStorage.getItem('shesi_comments') || '[]');
    return all.filter(c => c.postId === postId).sort((a, b) => b.createdAt - a.createdAt);
  },

  async addComment(postId, content) {
    const all = JSON.parse(localStorage.getItem('shesi_comments') || '[]');
    const comment = {
      id: crypto.randomUUID(),
      postId,
      content,
      authorId: getAuthorId(),
      createdAt: Date.now(),
    };
    all.push(comment);
    localStorage.setItem('shesi_comments', JSON.stringify(all));
    return comment;
  },

  async getUserPosts(authorId) {
    const posts = this._getPosts();
    return posts.filter(p => p.authorId === authorId);
  },

  async getUserRank(authorId) {
    const posts = await this.getPosts('hall');
    const idx = posts.findIndex(p => p.authorId === authorId);
    return idx === -1 ? null : idx + 1;
  },
};

// ── 工具函数 ──────────────────────────────────────────────
function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
  return new Date(ts).toLocaleDateString('zh-CN');
}

function formatNum(n) {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

function levelColor(level) {
  const map = { '地狱级社死': '#E11D48', '极高危社死': '#F97316', '高危社死': '#EAB308', '中度社死': '#22C55E', '轻度社死': '#6B7280' };
  return map[level] || '#E11D48';
}

// toast 通知
function showToast(msg, type = 'info') {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = `position:fixed;top:80px;left:50%;transform:translateX(-50%);background:${type==='error'?'#E11D48':'#1A1A1A'};color:#fff;padding:10px 20px;border-radius:99px;font-size:14px;z-index:9999;opacity:0;transition:opacity 0.2s;white-space:nowrap;font-family:'DM Sans',sans-serif`;
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; });
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2500);
}
