/* 暴打老板 · 吐槽「另类度」评分引擎（纯本地，无网络） */
(function (root) {
  'use strict';

  var DOMAINS = {
    '黑话': ['闭环', '赋能', '抓手', '颗粒度', '对齐', '心智', '链路', '飞轮', '护城河', '沉淀', '打法', '阵型', '组合拳', '底层逻辑', '拉通', '透传', '水位'],
    '职场': ['KPI', 'OKR', '周报', '日报', '早会', '复盘', '述职', '绩效', '年终奖', '调薪', '团建', '排期', '上线', '发版', '验收', '背锅', '甩锅'],
    '吃货': ['火锅', '麻辣烫', '煎饼', '奶茶', '螺蛳粉', '香菜', '折耳根', '豆汁', '烤冷面', '粽子', '月饼', '豆腐脑', '隔夜菜'],
    '动物': ['哈士奇', '树懒', '水豚', '鹦鹉', '章鱼', '蜗牛', '企鹅', '骆驼', '刺猬', '考拉', '鸭子', '单身狗', '草履虫'],
    '理科': ['熵', '黑洞', '量子', '薛定谔', '光速', '奇点', '引力', '真空', '递归', '无穷', '概率', '维度', '莫比乌斯', '氦闪'],
    '游戏': ['BOSS', '副本', '掉线', '外挂', '氪金', '秒杀', '暴击', '闪现', '回城', '蓝条', '存档', '读档', 'NPC'],
    '养生': ['颈椎', '腰椎', '脱发', '失眠', '养生', '保温杯', '枸杞', '针灸', '理疗', '结节', '体检报告'],
    '玄学': ['风水', '八字', '星座', '水逆', '塔罗', '转运', '锦鲤', '开光', '还愿']
  };
  var RARE = ['合并单元格', '未响应', '404', '蓝屏', '死锁', '内存泄漏', '薛定谔', '熵增', '熵值', '降维', '莫比乌斯', '五彩斑斓', '五彩斑斓的黑', '递归', '格式化', '宕机', '空指针'];
  var ADVANCED = ['承诺', '兑现', '自发', '荒诞', '荒谬', '悖论', '荒唐', '虚妄', '冠冕堂皇', '自洽', '双标', '绑架', '透支', '压榨', '格局', '体面', '狼狈', '苟且', '嘲讽', '荒腔走板', '伪命题', '自证'];
  var CLICHE = ['996', '007', '内卷', '福报', '画饼', '打工人', '狼性', '加班', '太累了', '不想上班', '我要辞职', '不想干了', '老板傻'];
  var BAD = ['傻逼', '傻B', '智障', '去死', '弄死你', '该死'];

  var COMMENTS = {
    SSS: ['全网最另类，老板听不懂但大受震撼', '这句够他回去想三天', '建议直接发朋友圈置顶', '武器已被你的才华点燃'],
    SS: ['刀法刁钻，伤害拉满', '这角度，HR 都找不出毛病', '阴阳怪气到了艺术层面'],
    S: ['有点东西，老板开始冒汗了', '狠，但狠得很有文化', '杀伤力与文学性兼具'],
    A: ['不错，能听出你真的受过委屈', '中规中矩但有效', '老板：隐约感觉被骂了'],
    B: ['力度一般，再来点想象力', '这句他每天听八遍', '建议加点比喻或者跨界'],
    C: ['骂了个寂寞', '老板甚至想给你加薪', '缺乏灵魂，再想想'],
    D: ['这……你是来夸他的吧', '骂人也是门手艺', '建议观摩评论区学习']
  };

  function bigrams(t) {
    var a = [], i;
    for (i = 0; i < t.length - 1; i++) a.push(t.slice(i, i + 2));
    return a;
  }
  function sim(a, b) {
    var A = bigrams(a), B = bigrams(b);
    if (!A.length || !B.length) return a === b ? 1 : 0;
    var set = {}, inter = 0, i;
    A.forEach(function (x) { set[x] = 1; });
    B.forEach(function (x) { if (set[x]) { inter++; set[x] = 2; } });
    var union = A.length + B.length - inter;
    return union ? inter / union : 0;
  }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function has(t, list) {
    var hits = [];
    list.forEach(function (w) { if (t.indexOf(w) >= 0) hits.push(w); });
    return hits;
  }

  /**
   * 评分
   * @param {string} text 吐槽内容
   * @param {Array<string>} history 历史吐槽
   * @returns {{score,grade,comment,details,mul,duration,ignoreDodge,critBonus,clean}}
   */
  function score(text, history) {
    history = history || [];
    var clean = (text || '').trim();
    var up = clean.toUpperCase();
    var details = [];
    var s = 0;

    // 敏感词打码
    var bad = has(clean, BAD);
    if (bad.length) {
      bad.forEach(function (w) { clean = clean.split(w).join('*'.repeat(w.length)); });
      details.push(['已自动打码，文明发泄', '±0']);
    }
    up = clean.toUpperCase();

    var n = Array.from(clean).length;
    if (n === 0) return null;
    s += 10; details.push(['有话说出来就是进步', '+10']);
    if (n < 5) { s -= 22; details.push(['太短了，多骂两句', '-22']); }
    else if (n <= 40) { s += 15; details.push(['长度刚好，句句到位', '+15']); }
    else { s += 8; details.push(['长篇控诉，情绪饱满', '+8']); }

    // 比喻
    if (/像|如|似|仿佛|宛如|就跟|好比|简直是/.test(clean)) { s += 14; details.push(['比喻手法', '+14']); }

    // 跨界联想
    var doms = [];
    Object.keys(DOMAINS).forEach(function (k) {
      var hits = has(up, DOMAINS[k].map(function (w) { return w.toUpperCase(); }));
      if (hits.length) doms.push([k, hits[0]]);
    });
    if (doms.length >= 1) {
      var base1 = 6 * Math.min(doms.length, 3);
      s += base1;
      details.push(['专业词汇：' + doms.slice(0, 3).map(function (d) { return d[1]; }).join('、'), '+' + base1]);
    }
    if (doms.length >= 2) {
      var add = 16 * (doms.length - 1);
      s += add;
      details.push(['跨界联想 ' + doms.length + ' 个领域', '+' + add]);
    }

    // 高级词汇
    var adv = has(clean, ADVANCED);
    if (adv.length) {
      var aa = 8 * Math.min(adv.length, 2);
      s += aa;
      details.push(['高级词汇「' + adv.slice(0, 2).join('、') + '」', '+' + aa]);
    }

    // 另类词库
    var rare = has(up, RARE.map(function (w) { return w.toUpperCase(); }));
    if (rare.length) {
      var ra = Math.min(rare.length, 2) * 15;
      s += ra;
      details.push(['稀有词库「' + rare.slice(0, 2).join('、') + '」', '+' + ra]);
    }

    // 灵魂反问
    if (/[？?]/.test(clean) && /(吗|呢|难道|岂|何|凭什么|谁|就这)/.test(clean)) { s += 12; details.push(['灵魂反问', '+12']); }
    // 排比
    var segs = clean.split(/[，,。！!；;、\n]/).filter(function (x) { return x.length > 1; });
    if (segs.length >= 3) { s += 10; details.push(['连珠炮排比', '+10']); }
    // 数据佐证（996/007 这类老梗不算）
    if (/[0-9零一二三四五六七八九十百千万亿]+/.test(clean) && !/996|007/.test(clean)) { s += 8; details.push(['数据佐证', '+8']); }
    // 中英混搭
    if (/[a-zA-Z]{2,}/.test(clean)) { s += 7; details.push(['中英混搭', '+7']); }
    // 表情
    if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(clean)) { s += 6; details.push(['表情包加持', '+6']); }
    // 押韵（尾字重复）
    if (segs.length >= 2 && segs[segs.length - 1].slice(-1) === segs[segs.length - 2].slice(-1)) { s += 9; details.push(['居然还押韵', '+9']); }

    // 老梗惩罚
    var cl = has(clean, CLICHE);
    if (cl.length) {
      var cp = -9 * Math.min(cl.length, 3);
      s += cp;
      details.push(['老梗警告：「' + cl.slice(0, 3).join('、') + '」', '' + cp]);
    }
    // 重复惩罚
    var maxSim = 0;
    history.forEach(function (h) { maxSim = Math.max(maxSim, sim(clean, h)); });
    if (maxSim > 0.62) { s -= 30; details.push(['这句你说过了', '-30']); }
    else if (maxSim > 0.4) { s -= 12; details.push(['有点眼熟', '-12']); }

    s += Math.round((Math.random() - 0.5) * 12);
    s = Math.max(1, Math.min(100, s));

    var grade = s >= 92 ? 'SSS' : s >= 82 ? 'SS' : s >= 68 ? 'S' : s >= 52 ? 'A' : s >= 35 ? 'B' : s >= 20 ? 'C' : 'D';
    var mul = 1 + (s / 100) * 2;
    return {
      score: s, grade: grade, clean: clean,
      comment: pick(COMMENTS[grade]),
      details: details,
      mul: Math.round(mul * 100) / 100,
      duration: 18 + Math.round(s / 6),
      ignoreDodge: s >= 92,
      critBonus: s >= 82 ? 0.25 : s >= 68 ? 0.12 : 0,
      domains: doms.map(function (d) { return d[0]; })
    };
  }

  function tips() {
    return [
      '把老板和一种动物联系起来试试',
      '用「像」造句：你的方案像____',
      '混搭两个不相关的领域（厨房 × 量子物理）',
      '结尾加个反问，杀伤力翻倍',
      '避免 996 / 内卷 / 画饼 这类老梗'
    ];
  }

  var api = { score: score, tips: tips, DOMAINS: DOMAINS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BSLib = root.BSLib || {};
  root.BSLib.roast = api;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));
