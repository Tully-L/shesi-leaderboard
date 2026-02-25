// ============================================================
// 社死排行榜 - 共享逻辑
// ============================================================

const CONFIG = {
  SUPABASE_URL: 'https://iynylvpnncsmrhidswkv.supabase.co',
  SUPABASE_KEY: 'sb_publishable_sTRmcwbWwfQQUO8neqmdoQ_7yKlpubM',
  USE_SUPABASE: true,

  // 智谱 GLM API Key（建议后续转移到 Supabase Edge Function 做代理）
  GLM_KEY: 'a7f63a7e0146467ba9282ce28cff3c35.YUwhumPeBTkN8vKZ',
  GLM_MODEL: 'glm-4-flash',
};

// ── Supabase 客户端（懒加载）────────────────────────────────
let _sb = null;
async function getSB() {
  if (_sb) return _sb;
  if (!window.supabase) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  _sb = (window.supabase || supabase).createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
  return _sb;
}

// ── HTML 转义（防止用户内容注入） ───────────────────────────
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── 用户标识 ──────────────────────────────────────────────
function getAuthorId() {
  let id = localStorage.getItem('shesi_uid');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('shesi_uid', id); }
  return id;
}

// ── 点赞状态（本地记录防重复） ─────────────────────────────
function getLiked() { return JSON.parse(localStorage.getItem('shesi_liked') || '[]'); }
function isLiked(id) { return getLiked().includes(id); }
function toggleLiked(id) {
  const arr = getLiked();
  const i = arr.indexOf(id);
  if (i === -1) arr.push(id); else arr.splice(i, 1);
  localStorage.setItem('shesi_liked', JSON.stringify(arr));
  return i === -1;
}

// ── Supabase row → JS 对象 ────────────────────────────────
function mapPost(row) {
  return {
    id: row.id,
    content: row.content,
    tag: row.tag,
    deathIndex: row.death_index,
    deathLevel: row.death_level,
    deathReason: row.death_reason,
    anonymous: row.anonymous,
    location: row.location,
    likes: row.likes,
    authorId: row.author_id,
    commentCount: row.comment_count || 0,
    createdAt: new Date(row.created_at).getTime(),
  };
}
function mapComment(row) {
  return {
    id: row.id,
    postId: row.post_id,
    content: row.content,
    authorId: row.author_id,
    createdAt: new Date(row.created_at).getTime(),
  };
}

// ── GLM 社死指数计算 ──────────────────────────────────────
async function calcDeathIndex(content) {
  const prompt = `你是"社死指数评审官"，请评估以下真实社死经历。
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
    if (!res.ok) throw new Error('API ' + res.status);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    const match = text.match(/\{[\s\S]*?\}/);
    if (match) {
      const r = JSON.parse(match[0]);
      if (r.score && r.level && r.reason) return r;
    }
    throw new Error('parse');
  } catch {
    return fallbackScore(content);
  }
}

function fallbackScore(content) {
  const kw = {
    high: ['领导','全公司','直播','朋友圈','发错','全班','当着','所有人','万人','群里'],
    mid: ['同事','朋友','聚会','相亲','面试','老师','家长'],
  };
  let score = 35 + Math.min(30, content.length * 0.07);
  kw.high.forEach(k => { if (content.includes(k)) score += 10; });
  kw.mid.forEach(k => { if (content.includes(k)) score += 5; });
  score = Math.max(10, Math.min(100, Math.round(score)));
  const levels = [
    { min: 90, level: '地狱级社死', reason: '影响范围极大，颜面扫地' },
    { min: 75, level: '极高危社死', reason: '众目睽睽，难以挽回' },
    { min: 60, level: '高危社死', reason: '尴尬至极，难以忘怀' },
    { min: 40, level: '中度社死', reason: '当时很尬，事后能缓' },
    { min: 0,  level: '轻度社死', reason: '稍显尴尬，无伤大雅' },
  ];
  const { level, reason } = levels.find(l => score >= l.min);
  return { score, level, reason };
}

// ── 数据层 ────────────────────────────────────────────────
const DB = {

  // ── 帖子 ──────────────────────────────────────────────

  async getPosts(sort = 'hot') {
    if (CONFIG.USE_SUPABASE) {
      const sb = await getSB();
      let q = sb.from('posts').select('*, comment_count:comments(count)');
      if (sort === 'new')  q = q.order('created_at', { ascending: false });
      else if (sort === 'hall') q = q.order('death_index', { ascending: false });
      else q = q.order('likes', { ascending: false });
      const { data, error } = await q.limit(50);
      if (error) { console.error(error); return localDB.getPosts(sort); }
      return (data || []).map(r => ({ ...mapPost(r), commentCount: r.comment_count?.[0]?.count || 0 }));
    }
    return localDB.getPosts(sort);
  },

  async getPost(id) {
    if (CONFIG.USE_SUPABASE) {
      const sb = await getSB();
      const { data, error } = await sb.from('posts').select('*').eq('id', id).single();
      if (error || !data) return null;
      return mapPost(data);
    }
    return localDB.getPost(id);
  },

  async savePost(post) {
    if (CONFIG.USE_SUPABASE) {
      const sb = await getSB();
      const { data, error } = await sb.from('posts').insert({
        content: post.content,
        tag: post.tag,
        death_index: post.deathIndex,
        death_level: post.deathLevel,
        death_reason: post.deathReason,
        anonymous: post.anonymous,
        location: post.location || '',
        author_id: post.authorId || getAuthorId(),
        likes: 0,
      }).select().single();
      if (error) { console.error(error); throw error; }
      return mapPost(data);
    }
    return localDB.savePost(post);
  },

  async likePost(id) {
    const nowLiked = toggleLiked(id);
    if (CONFIG.USE_SUPABASE) {
      const sb = await getSB();
      await sb.rpc('toggle_like', { p_post_id: id, p_delta: nowLiked ? 1 : -1 });
    } else {
      localDB.likePost(id, nowLiked);
    }
    return nowLiked;
  },

  // ── 评论 ──────────────────────────────────────────────

  async getComments(postId) {
    if (CONFIG.USE_SUPABASE) {
      const sb = await getSB();
      const { data, error } = await sb.from('comments')
        .select('*').eq('post_id', postId).order('created_at', { ascending: false });
      if (error) return [];
      return (data || []).map(mapComment);
    }
    return localDB.getComments(postId);
  },

  async addComment(postId, content) {
    if (CONFIG.USE_SUPABASE) {
      const sb = await getSB();
      const { data, error } = await sb.from('comments').insert({
        post_id: postId,
        content,
        author_id: getAuthorId(),
      }).select().single();
      if (error) throw error;
      return mapComment(data);
    }
    return localDB.addComment(postId, content);
  },

  // ── 用户数据 ──────────────────────────────────────────

  async getUserPosts(authorId) {
    if (CONFIG.USE_SUPABASE) {
      const sb = await getSB();
      const { data, error } = await sb.from('posts')
        .select('*').eq('author_id', authorId).order('death_index', { ascending: false });
      if (error) return [];
      return (data || []).map(mapPost);
    }
    return localDB.getUserPosts(authorId);
  },

  async getUserRank(authorId) {
    if (CONFIG.USE_SUPABASE) {
      const sb = await getSB();
      const { data } = await sb.from('posts')
        .select('author_id, death_index').order('death_index', { ascending: false });
      if (!data) return null;
      const idx = data.findIndex(p => p.author_id === authorId);
      return idx === -1 ? null : idx + 1;
    }
    return localDB.getUserRank(authorId);
  },
};

// ── localStorage fallback ────────────────────────────────
const localDB = {
  _get() {
    const raw = localStorage.getItem('shesi_posts');
    if (!raw) {
      const seed = [
        { id: crypto.randomUUID(), content: '在公司厕所打电话吐槽领导说他开会又臭又长天天画大饼，出来发现领导就站在门口洗手，四目相对了整整三秒钟。更社死的是，第二天领导开会专门表扬了我"敢于直言"，全公司都知道了。', tag: '职场', deathIndex: 98, deathLevel: '地狱级社死', deathReason: '全公司见证，领导亲赐荣誉', anonymous: true, location: '北京', likes: 2341, authorId: 'seed-1', commentCount: 86, createdAt: Date.now() - 7200000 },
        { id: crypto.randomUUID(), content: '相亲饭局上想展示自己会说日语，把"我很喜欢你"说成了"我是变态"。对面沉默三秒，然后叫了服务员结账。', tag: '恋爱', deathIndex: 91, deathLevel: '极高危社死', deathReason: '当场翻车，对方秒退', anonymous: true, location: '上海', likes: 1876, authorId: 'seed-2', commentCount: 54, createdAt: Date.now() - 18000000 },
        { id: crypto.randomUUID(), content: '以为自己退群了，结果只是把群名改了，然后发了条"终于离职了，这群傻X"。', tag: '网络', deathIndex: 87, deathLevel: '极高危社死', deathReason: '全员目睹，已无退路', anonymous: false, location: '', likes: 1543, authorId: 'seed-3', commentCount: 41, createdAt: Date.now() - 86400000 },
        { id: crypto.randomUUID(), content: '面试时聊到上家公司氛围差，面试官突然说"我前夫确实管理有问题"。原来她就是上家老板的前妻。', tag: '职场', deathIndex: 83, deathLevel: '高危社死', deathReason: '现实反转，自掘坟墓', anonymous: true, location: '深圳', likes: 1298, authorId: 'seed-4', commentCount: 33, createdAt: Date.now() - 172800000 },
        { id: crypto.randomUUID(), content: '在全员视频会议上以为静音了，跟妈妈抱怨领导说他又在画饼，300人都听见了。领导停下来说"说得很对，我们下次改进"。', tag: '职场', deathIndex: 95, deathLevel: '地狱级社死', deathReason: '300人见证，领导补刀', anonymous: true, location: '杭州', likes: 2089, authorId: 'seed-5', commentCount: 72, createdAt: Date.now() - 3600000 },
      ];
      localStorage.setItem('shesi_posts', JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw);
  },
  _save(p) { localStorage.setItem('shesi_posts', JSON.stringify(p)); },

  async getPosts(sort) {
    const p = this._get();
    if (sort === 'new')  return p.sort((a,b) => b.createdAt - a.createdAt);
    if (sort === 'hall') return p.sort((a,b) => b.deathIndex - a.deathIndex);
    return p.sort((a,b) => b.likes - a.likes);
  },
  async getPost(id) { return this._get().find(p => p.id === id) || null; },
  async savePost(post) {
    const posts = this._get();
    post.id = crypto.randomUUID(); post.createdAt = Date.now(); post.likes = 0; post.commentCount = 0;
    posts.unshift(post); this._save(posts); return post;
  },
  likePost(id, nowLiked) {
    const posts = this._get();
    const p = posts.find(p => p.id === id);
    if (p) { p.likes = Math.max(0, p.likes + (nowLiked ? 1 : -1)); this._save(posts); }
  },
  async getComments(postId) {
    return JSON.parse(localStorage.getItem('shesi_comments') || '[]')
      .filter(c => c.postId === postId).sort((a,b) => b.createdAt - a.createdAt);
  },
  async addComment(postId, content) {
    const all = JSON.parse(localStorage.getItem('shesi_comments') || '[]');
    const c = { id: crypto.randomUUID(), postId, content, authorId: getAuthorId(), createdAt: Date.now() };
    all.push(c); localStorage.setItem('shesi_comments', JSON.stringify(all)); return c;
  },
  async getUserPosts(authorId) { return this._get().filter(p => p.authorId === authorId); },
  async getUserRank(authorId) {
    const posts = this._get().sort((a,b) => b.deathIndex - a.deathIndex);
    const idx = posts.findIndex(p => p.authorId === authorId);
    return idx === -1 ? null : idx + 1;
  },
};

// ── 工具函数 ──────────────────────────────────────────────
function timeAgo(ts) {
  const d = Date.now() - ts;
  if (d < 60000)   return '刚刚';
  if (d < 3600000) return `${Math.floor(d/60000)}分钟前`;
  if (d < 86400000) return `${Math.floor(d/3600000)}小时前`;
  if (d < 604800000) return `${Math.floor(d/86400000)}天前`;
  return new Date(ts).toLocaleDateString('zh-CN');
}
function formatNum(n) {
  n = Number(n) || 0;
  if (n >= 10000) return (n/10000).toFixed(1)+'w';
  if (n >= 1000)  return (n/1000).toFixed(1)+'k';
  return String(n);
}
function levelColor(level) {
  return { '地狱级社死':'#E11D48','极高危社死':'#F97316','高危社死':'#EAB308','中度社死':'#22C55E','轻度社死':'#6B7280' }[level] || '#E11D48';
}
function showToast(msg, type='info') {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = `position:fixed;top:72px;left:50%;transform:translateX(-50%);background:${type==='error'?'#E11D48':'#1A1A1A'};color:#fff;padding:10px 20px;border-radius:99px;font-size:13px;z-index:9999;opacity:0;transition:opacity .2s;white-space:nowrap;font-family:'DM Sans',sans-serif;pointer-events:none`;
  document.body.appendChild(el);
  requestAnimationFrame(()=>{ el.style.opacity='1'; });
  setTimeout(()=>{ el.style.opacity='0'; setTimeout(()=>el.remove(),300); }, 2500);
}
