// migrate.mjs — 删除所有现有社死经历，插入 temp.md 中的新内容
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iynylvpnncsmrhidswkv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_sTRmcwbWwfQQUO8neqmdoQ_7yKlpubM';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// 新的社死经历数据
const newPosts = [
  {
    content: '想到之前坐地铁，打包的牛蛙带回家吃，下车的时候人出来了，我的蛙还在里面卡着，在快关门的时候有人给我扔出来了。这段回忆至今难忘。',
    likes: 16000,
    death_index: 85,
    death_level: '重度社死',
    tag: '公共交通',
  },
  {
    content: '以为会议室没人，就把屁股挪进去放了炸天屁。服辣友们，我已经尬得一整天都没缓过来了... 是这样，这还得说到昨晚，我跟朋友下馆子，胡吃海塞了一大顿，还喝了好多气泡水。其实从那时开始，肚子就已经咕噜咕噜的了，但昨晚愣是没掀起什么大的波澜，都是一些小打小闹、蜻蜓点水、呢喃细语的小屁。谁知道，原来一切的"好果子"都让命运给我留到了今早。今早上班路上和电梯里都还好，可一进到我们这层楼的办公区，感觉来了，肚子里又开始咕噜噜噜，比昨天汹涌多了，是那种一波还未平息，一波早就来临的推波助澜的感觉。',
    likes: 54000,
    death_index: 95,
    death_level: '地狱级社死',
    tag: '职场',
  },
  {
    content: '有一次领导发了个自己的人生感悟，我评论说：说的太对了。。。。一天过去后我又翻到那条朋友圈才发现我评论的是：说的太多了。还有一次领导让我交东西，我解释了一下当天交不了的原因然后回复"明天给你可以吗"，把给字打成了"日"，额，领导回复，好的。过会儿领导又给我发：下次发信息前检查一下。。。。',
    likes: 6915,
    death_index: 75,
    death_level: '重度社死',
    tag: '职场',
  },
  {
    content: '我这个脸盲又认错人了！！！今天去吃麻薯，误把一个陌生人当成了小伙伴。我问：你吃麻薯没，她有点迟疑，然后说：吃了。我又问：你觉得好吃嘛，她有点迷茫，回答我：还行吧。我又继续追问：你准备买多少啊，她变得更懵逼了，问了句：你认识我吗…… 我猛然醒悟，认错人了啊啊啊啊啊！！我一回头小伙伴在我的后面…… 我立刻转身就跑啊啊啊啊啊！！我真的好尬啊！我拉着别人衣服讲半天结果是陌生人，有没有人懂那种两眼对视彼此沉默的尴尬气氛啊！',
    likes: 103,
    death_index: 50,
    death_level: '轻度社死',
    tag: '日常',
  },
  {
    content: '高中骑小电驴接同学一起上学，一路上我超大声说八卦然后拍大腿哈哈大笑，等红灯的时候我还在说，然后发现路人都在看我，我就问同学怎么路人都在看我啊？问了好几句我同学都不说话，我气的回头问她干嘛不理我？结果一回头发现后座没人，原来十几分钟的路上我就跟疯子一样大声地自言自语还狂笑，我同学没上车还在后面追我，由于我笑的声音太大导致她喊我我也没听见。小学有次考试，我在那挖鼻屎，结果挖出来一坨连着鼻孔的鼻屎，周围人都在看我，我尴尬的笑了，随后放出了两个屁……',
    likes: 252000,
    death_index: 98,
    death_level: '地狱级社死',
    tag: '校园',
  },
  {
    content: '勾起了我的回忆，我小时候捂着耳朵听不到声，以为别人也听不到，上课坐那捂着耳朵大叫，老师同学惊恐的眼神，谁懂',
    likes: 0,
    death_index: 72,
    death_level: '中度社死',
    tag: '校园',
  },
  {
    content: '想跟朋友吐槽一个男生，结果发给他本人了，而且就坐在我对面，还是他提醒我发错消息了',
    likes: 0,
    death_index: 80,
    death_level: '重度社死',
    tag: '社交',
  },
  {
    content: '把一个男的背影看成了我朋友，用力捏了下他屁股，估计有点疼吧他尖叫了一声，然后我才发现我认错了，，',
    likes: 0,
    death_index: 88,
    death_level: '重度社死',
    tag: '日常',
  },
  {
    content: '我小时候以为明星不用洗脚，我和同学说我从来不洗脚',
    likes: 0,
    death_index: 65,
    death_level: '中度社死',
    tag: '校园',
  },
  {
    content: '之前在学校食堂餐厅打银耳汤，走路的时候不小心被别人撞了一下，然后汤就泼到了一个男同学身上，我当时拼命给他道歉，他回头看着我一直没说话，我问他怎么了，他突然从他后背衣领里掏出了一个银耳😶',
    likes: 16000,
    death_index: 85,
    death_level: '重度社死',
    tag: '校园',
  },
  {
    content: '去超市逛了一下，后面发现没什么想买的，但是两手空空从超市出来怕被认为偷东西的，所以在出门时候想顺嘴说一句"没啥想买的"，结果嘴滑说成"没啥想偷的"……😂',
    likes: 18000,
    death_index: 88,
    death_level: '重度社死',
    tag: '日常',
  },
  {
    content: '去卫生间上厕所，玩手机没咋看路，看见前面有个人要出去，我往左她往左，我往右她也往右，我退她也退，我直接笑了，做了个请的姿势让她先过去，抬头发现面前是一个镜子🥺',
    likes: 9501,
    death_index: 78,
    death_level: '重度社死',
    tag: '日常',
  },
  {
    content: '中午抢食堂，鞋带开了，因为一直是贴边上跑的就就地蹲下了，结果后面有个哥们没刹住卡裆了，卡在了老娘我脑袋上🥰，他垫着脚想往前走绕过我，我低着头往前爬想给他让道，我俩就以这样奇怪的姿势前进了1米多😂，最后我受不了爬下了，我俩才成功解体。',
    likes: 11000,
    death_index: 82,
    death_level: '重度社死',
    tag: '校园',
  },
  {
    content: '出去玩儿被人碰了，以为是我朋友骂了一声"滚"，结果骂成了"呱"，一回头，发现是一个帅哥，他犹豫的来了一句"拜见蛤蟆大王"',
    likes: 387000,
    death_index: 99,
    death_level: '地狱级社死',
    tag: '日常',
  },
  {
    content: '去年在格拉读书，某次连续下了一个月雨后突然出太阳，我又在赶due。胡子没刮，头发没梳，穿着睡衣就冲出去到公园晒太阳。正当我享受久违的核聚变时，一个homeless大叔走过来说：朋友，隔壁街在发汉堡，你再不去没了🤡',
    likes: 2371,
    death_index: 68,
    death_level: '中度社死',
    tag: '海外',
  },
  {
    content: '刚出国的第一年去酒吧，一个白人姑娘在聊天中对我说"You look hot"，我以为是问我看起来太热了，于是我马上把外套脱了',
    likes: 301,
    death_index: 55,
    death_level: '轻度社死',
    tag: '海外',
  },
];

async function main() {
  // Step 1: 查询所有现有帖子
  console.log('正在查询现有帖子...');
  const { data: existingPosts, error: fetchErr } = await sb
    .from('posts')
    .select('id')
    .limit(1000);

  if (fetchErr) {
    console.error('查询失败:', fetchErr.message);
    process.exit(1);
  }

  console.log(`找到 ${existingPosts?.length || 0} 条现有帖子`);

  // Step 2: 删除所有现有帖子
  if (existingPosts && existingPosts.length > 0) {
    console.log('正在删除所有现有帖子...');
    const ids = existingPosts.map((p) => p.id);
    // Delete in batches to avoid issues
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50);
      const { error: delErr } = await sb
        .from('posts')
        .delete()
        .in('id', batch);
      if (delErr) {
        console.error(`删除批次 ${i / 50 + 1} 失败:`, delErr.message);
        process.exit(1);
      }
      console.log(`  已删除 ${Math.min(i + 50, ids.length)}/${ids.length}`);
    }
    console.log('所有现有帖子已删除');
  }

  // Step 3: 插入新的社死经历
  console.log(`\n正在插入 ${newPosts.length} 条新社死经历...`);

  let successCount = 0;
  for (let i = 0; i < newPosts.length; i++) {
    const post = newPosts[i];
    const { data, error } = await sb
      .from('posts')
      .insert({
        content: post.content,
        tag: post.tag,
        death_index: post.death_index,
        death_level: post.death_level,
        death_reason: post.tag,
        anonymous: true,
        likes: post.likes,
        author_id: `seed-${Date.now()}-${i}`,
      })
      .select()
      .single();

    if (error) {
      console.error(`  [${i + 1}] 插入失败: ${error.message}`);
      console.error(`     内容: ${post.content.slice(0, 40)}...`);
    } else {
      successCount++;
      console.log(
        `  [${i + 1}] 插入成功 (id=${data.id}) — ${post.content.slice(0, 30)}... 点赞:${post.likes}`
      );
    }
  }

  console.log(`\n完成！成功插入 ${successCount}/${newPosts.length} 条`);
}

main().catch((e) => {
  console.error('脚本出错:', e);
  process.exit(1);
});
