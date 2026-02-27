// test.mjs — Supabase query verification tests
import { execSync } from 'child_process';
import { createRequire } from 'module';

// Install @supabase/supabase-js if not present
try {
  createRequire(import.meta.url)('@supabase/supabase-js');
} catch {
  console.log('Installing @supabase/supabase-js...');
  execSync('npm install @supabase/supabase-js', { stdio: 'inherit', cwd: '/Users/tully/00temp/0225-shesi' });
}

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iynylvpnncsmrhidswkv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_sTRmcwbWwfQQUO8neqmdoQ_7yKlpubM';

let passed = 0;
let failed = 0;
let testPostId = null;

function ok(label, detail = '') {
  console.log(`  PASS: ${label}${detail ? ' — ' + detail : ''}`);
  passed++;
}
function fail(label, detail = '') {
  console.log(`  FAIL: ${label}${detail ? ' — ' + detail : ''}`);
  failed++;
}

// ── Test 1: createClient ────────────────────────────────────────────────────
console.log('\nTest 1: createClient with sb_publishable_ key');
let sb;
try {
  sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  if (sb && typeof sb.from === 'function') {
    ok('createClient returned a valid client');
  } else {
    fail('createClient did not return expected client shape');
  }
} catch (e) {
  fail('createClient threw: ' + e.message);
  process.exit(1);
}

// ── Test 2: getPosts with comment_count ────────────────────────────────────
console.log('\nTest 2: select with comment_count:comments(count)');
{
  const { data, error } = await sb.from('posts')
    .select('*, comment_count:comments(count)')
    .order('likes', { ascending: false })
    .limit(50);

  if (error) {
    fail('query returned error', JSON.stringify(error));
    console.log('  Trying fallback: comments(count) without alias...');

    const { data: data2, error: error2 } = await sb.from('posts')
      .select('*, comments(count)')
      .order('likes', { ascending: false })
      .limit(50);

    if (error2) {
      fail('fallback query also failed', JSON.stringify(error2));
    } else {
      ok('fallback comments(count) works', `rows=${data2?.length}, sample comments field: ${JSON.stringify(data2?.[0]?.comments)}`);
      console.log('  NOTE: app.js mapPost needs to read r.comments?.[0]?.count instead of r.comment_count?.[0]?.count');
    }
  } else {
    const sample = data?.[0];
    const cc = sample?.comment_count;
    ok('query succeeded', `rows=${data?.length}, comment_count sample=${JSON.stringify(cc)}`);
    // Verify the shape
    if (Array.isArray(cc) && typeof cc[0]?.count !== 'undefined') {
      ok('comment_count is array with {count}', `value=${cc[0].count}`);
    } else if (cc !== undefined) {
      fail('comment_count has unexpected shape', JSON.stringify(cc));
    }
  }
}

// ── Test 3: Insert a post and retrieve it ──────────────────────────────────
console.log('\nTest 3: Insert a post and retrieve it');
{
  const { data, error } = await sb.from('posts').insert({
    content: 'TEST POST — please ignore (automated test)',
    tag: '测试',
    death_index: 42,
    death_level: '中度社死',
    death_reason: '自动化测试',
    anonymous: true,
    location: '测试城市',
    author_id: 'test-automated-' + Date.now(),
    likes: 0,
  }).select().single();

  if (error) {
    fail('insert failed', JSON.stringify(error));
  } else {
    testPostId = data.id;
    ok('insert succeeded', `id=${data.id}`);

    // Now retrieve it
    const { data: fetched, error: fetchErr } = await sb.from('posts')
      .select('*').eq('id', testPostId).single();
    if (fetchErr || !fetched) {
      fail('retrieve after insert failed', JSON.stringify(fetchErr));
    } else {
      ok('retrieve by id succeeded', `content starts: ${fetched.content.slice(0, 30)}`);
    }
  }
}

// ── Test 4: toggle_like RPC ────────────────────────────────────────────────
console.log('\nTest 4: rpc toggle_like');
if (testPostId) {
  const { data, error } = await sb.rpc('toggle_like', {
    p_post_id: testPostId,
    p_delta: 1,
  });
  if (error) {
    fail('toggle_like rpc failed', JSON.stringify(error));
  } else {
    ok('toggle_like succeeded', `result=${JSON.stringify(data)}`);
  }
} else {
  fail('toggle_like skipped — no testPostId (insert failed)');
}

// ── Test 5: getComments ────────────────────────────────────────────────────
console.log('\nTest 5: getComments');
if (testPostId) {
  const { data, error } = await sb.from('comments')
    .select('*').eq('post_id', testPostId).order('created_at', { ascending: false });
  if (error) {
    fail('getComments failed', JSON.stringify(error));
  } else {
    ok('getComments succeeded', `count=${data?.length}`);
  }
} else {
  // Try with any existing post
  const { data: posts } = await sb.from('posts').select('id').limit(1);
  if (posts?.length) {
    const pid = posts[0].id;
    const { data, error } = await sb.from('comments')
      .select('*').eq('post_id', pid).order('created_at', { ascending: false });
    if (error) {
      fail('getComments failed', JSON.stringify(error));
    } else {
      ok('getComments succeeded (on existing post)', `count=${data?.length}`);
    }
  } else {
    fail('getComments skipped — no posts available');
  }
}

// ── Cleanup test post ──────────────────────────────────────────────────────
if (testPostId) {
  const { error } = await sb.from('posts').delete().eq('id', testPostId);
  if (error) {
    console.log(`  WARN: Could not clean up test post ${testPostId}:`, error.message);
  } else {
    console.log(`\n  (cleaned up test post ${testPostId})`);
  }
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log('All tests PASSED.');
} else {
  console.log('Some tests FAILED — see above for details.');
}
process.exit(failed > 0 ? 1 : 0);
