-- 社死排行榜 数据库结构
-- 在 Supabase Dashboard > SQL Editor 运行此文件

-- Posts 表
create table if not exists posts (
  id uuid default gen_random_uuid() primary key,
  content text not null,
  tag text default '其他',
  death_index integer default 0,
  death_level text default '中度社死',
  death_reason text default '',
  anonymous boolean default true,
  location text default '',
  likes integer default 0,
  author_id text not null,
  created_at timestamptz default now()
);

-- Comments 表
create table if not exists comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references posts(id) on delete cascade,
  content text not null,
  author_id text not null,
  created_at timestamptz default now()
);

-- 开启行级安全（RLS）
alter table posts enable row level security;
alter table comments enable row level security;

-- 公开读写策略（轻应用，无需登录）
create policy "posts_select" on posts for select using (true);
create policy "posts_insert" on posts for insert with check (true);
create policy "posts_update" on posts for update using (true);
create policy "comments_select" on comments for select using (true);
create policy "comments_insert" on comments for insert with check (true);
create policy "posts_delete" on posts for delete using (true);
create policy "comments_delete" on comments for delete using (true);

-- 原子点赞函数（防并发冲突）
create or replace function toggle_like(p_post_id uuid, p_delta integer)
returns integer as $$
  update posts
  set likes = greatest(0, likes + p_delta)
  where id = p_post_id
  returning likes;
$$ language sql security definer;
