/* 暴打老板 · 摸鱼发泄室 —— 游戏主逻辑（H5 / 微信小游戏共用） */
(function (root) {
  'use strict';

  var AV = root.BSLib.avatar;
  var RO = root.BSLib.roast;

  var WEAPONS = [
    { name: '祖传拖鞋', mul: 1.0, cost: 0, desc: '塑料质感，胜在顺手' },
    { name: '机械键盘', mul: 1.7, cost: 300, desc: '青轴，敲他丫的' },
    { name: '养生保温杯', mul: 2.6, cost: 1400, desc: '枸杞泡枸杞，物理超度' },
    { name: '卡纸打印机', mul: 4.0, cost: 5200, desc: '卡纸是它的攻击方式' },
    { name: '滚烫美式', mul: 6.2, cost: 16000, desc: '直击灵魂的温度' },
    { name: '一纸离职信', mul: 9.5, cost: 48000, desc: 'A4 纸也能杀人' },
    { name: '仲裁申请书', mul: 15.0, cost: 120000, desc: '法律的重拳' }
  ];

  var BOSSES = [
    { name: '实习生 · 小透明', taunts: ['我来学习一下', '这个我不太会', '前辈你先忙'] },
    { name: '组长 · 画饼侠', taunts: ['明年给你升职', '这个需求很简单', '你再扛一扛'] },
    { name: '主管 · 周报狂魔', taunts: ['周报写详细点', '颗粒度再细一点', '今天能上线吧'] },
    { name: '总监 · 需求变更兽', taunts: ['我们改回第一版', '五彩斑斓的黑', '大胆一点嘛'] },
    { name: '副总 · 会议终结者', taunts: ['拉个会吧', '我简单说两句', '对齐一下颗粒度'] },
    { name: '甲方 · 感觉大师', taunts: ['我要那种感觉', '再年轻一点', '预算不多但要高级'] },
    { name: 'HR · 优化大师', taunts: ['我们是个大家庭', '拥抱变化', '这是给你的机会'] },
    { name: '老板 · 终极画饼王', taunts: ['公司是平台', '要有大局观', '年轻人别只看钱'] }
  ];

  var SAMPLES = [
    '你的管理像合并单元格，看着整齐，一点就废',
    '开会像树懒啃火锅，慢还烫嘴',
    '你的承诺熵值极高，永远不会自发兑现',
    'KPI 是我的薛定谔的猫，打开箱子之前你永远说不清',
    '画饼的半径超过了公司到地铁的距离'
  ];

  function f(size, bold) { return (bold ? 'bold ' : '') + size + 'px sans-serif'; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  function fmt(n) {
    n = Math.floor(n);
    if (n >= 100000000) return (n / 100000000).toFixed(2) + '亿';
    if (n >= 10000) return (n / 10000).toFixed(n >= 100000 ? 0 : 1) + '万';
    return '' + n;
  }

  function create(ad) {
    var W = ad.W, H = ad.H;
    var ctx = ad.ctx;

    // ---------- 存档 ----------
    var S = ad.storage.get('bs_save', null) || {};
    S.cfg = AV.fixCfg(S.cfg || AV.defaultCfg());
    if (S.coins == null) S.coins = 0;
    if (!S.own) S.own = [true, false, false, false, false, false, false];
    if (!S.lv) S.lv = [1, 0, 0, 0, 0, 0, 0];
    if (S.cur == null) S.cur = 0;
    if (S.maxLv == null) S.maxLv = 1;
    if (S.sound == null) S.sound = true;
    if (!S.roasts) S.roasts = [];
    if (!S.hist) S.hist = [];
    function save() { ad.storage.set('bs_save', S); }
    // 音效总开关
    function sf(name, arg) { if (S.sound !== false) ad.sound(name, arg); }

    // ---------- 运行时 ----------
    var st = {
      screen: 'menu',
      t: 0,
      shake: 0,
      flash: 0,
      parts: [],
      ui: [],
      pressed: null,
      help: false
    };
    var crt = { cat: 0, cfg: AV.fixCfg(JSON.parse(JSON.stringify(S.cfg))) };
    var bt = null;   // battle
    var shop = { scroll: 0 }, shopFrom = 'menu';
    var roastRes = null;
    var clearData = null;
    var pointerDown = false, lastP = { x: 0, y: 0 }, holdT = 0;

    // ---------- 粒子 ----------
    function P(o) { o.life = o.life || 1; o.age = 0; st.parts.push(o); return o; }
    function updParts(dt) {
      for (var i = st.parts.length - 1; i >= 0; i--) {
        var p = st.parts[i];
        p.age += dt;
        if (p.age >= p.life) { st.parts.splice(i, 1); continue; }
        p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt;
        if (p.g) p.vy += p.g * dt;
        if (p.k == 'coin') {
          p.vx = lerp(p.vx, (p.tx - p.x) * 4, 0.14);
          p.vy = lerp(p.vy, (p.ty - p.y) * 4, 0.14);
        }
      }
    }
    function drawParts() {
      for (var i = 0; i < st.parts.length; i++) {
        var p = st.parts[i], k = 1 - p.age / p.life;
        ctx.save();
        ctx.globalAlpha = p.k == 'txt' ? clamp(k * 2, 0, 1) : k;
        if (p.k == 'txt') {
          ctx.font = f(p.size, true);
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(30,20,10,.85)';
          ctx.strokeText(p.text, p.x, p.y);
          ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
        } else if (p.k == 'coin') {
          ctx.fillStyle = '#F7C948';
          ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#E0A020'; ctx.font = f(16, true); ctx.textAlign = 'center';
          ctx.fillText('¥', p.x, p.y + 6);
        } else if (p.k == 'ring') {
          ctx.strokeStyle = p.color; ctx.lineWidth = 8 * k;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * (1 - k), 0, Math.PI * 2); ctx.stroke();
        } else if (p.k == 'spark') {
          ctx.fillStyle = p.color;
          ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
          ctx.fillRect(-p.size / 2, -3, p.size, 6);
        } else if (p.k == 'star') {
          ctx.translate(p.x, p.y); ctx.rotate(p.age * 6);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          for (var j = 0; j < 8; j++) {
            var a = j * Math.PI / 4, r = j % 2 ? p.size * 0.4 : p.size;
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          ctx.closePath(); ctx.fill();
        } else if (p.k == 'word') {
          ctx.font = f(p.size || 34, true); ctx.textAlign = 'left';
          ctx.fillStyle = p.color;
          ctx.globalAlpha = clamp(k * 1.6, 0, 0.95);
          ctx.fillText(p.text, p.x, p.y);
        }
        ctx.restore();
      }
    }

    // ---------- UI ----------
    function btn(id, x, y, w, h, label, o) {
      var b = { id: id, x: x, y: y, w: w, h: h, label: label, kind: 'btn' };
      if (o) for (var k in o) b[k] = o[k];
      st.ui.push(b); return b;
    }
    function drawBtn(b) {
      var on = st.pressed === b.id;
      var r = b.r == null ? 18 : b.r;
      ctx.save();
      if (on) ctx.translate(0, 3);
      ctx.fillStyle = b.disabled ? '#B9BECA' : (b.bg || (b.primary ? '#E4572E' : '#2F3A52'));
      AV.rr(ctx, b.x, b.y + 4, b.w, b.h, r); ctx.fill();
      ctx.fillStyle = b.disabled ? '#CFD3DC' : (b.bg2 || (b.primary ? '#FF7A4D' : '#47587A'));
      AV.rr(ctx, b.x, b.y, b.w, b.h, r); ctx.fill();
      ctx.fillStyle = b.fg || '#FFFFFF';
      ctx.font = f(b.size || 34, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
      if (b.icon == 'speaker') {
        var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        ctx.save(); ctx.translate(cx, cy);
        ctx.fillStyle = b.fg || '#FFFFFF'; ctx.strokeStyle = b.fg || '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(-16, -5); ctx.lineTo(-8, -5); ctx.lineTo(0, -14); ctx.lineTo(0, 14);
        ctx.lineTo(-8, 5); ctx.lineTo(-16, 5); ctx.closePath(); ctx.fill();
        ctx.lineWidth = 3; ctx.lineCap = 'round';
        if (b.muted) {
          ctx.beginPath(); ctx.moveTo(7, -8); ctx.lineTo(19, 8); ctx.stroke();
        } else {
          ctx.beginPath(); ctx.arc(2, 0, 8, -0.85, 0.85); ctx.stroke();
          ctx.beginPath(); ctx.arc(2, 0, 15, -0.8, 0.8); ctx.stroke();
        }
        ctx.restore();
      }
      if (b.sub) {
        ctx.font = f(20, false); ctx.fillStyle = 'rgba(255,255,255,.72)';
        ctx.fillText(b.sub, b.x + b.w / 2, b.y + b.h - 20);
      }
      ctx.restore();
    }
    function panel(x, y, w, h, r) {
      ctx.save();
      ctx.fillStyle = 'rgba(20,26,40,.45)';
      AV.rr(ctx, x + 5, y + 9, w, h, r || 26); ctx.fill();
      ctx.fillStyle = '#FBF7F0';
      AV.rr(ctx, x, y, w, h, r || 26); ctx.fill();
      ctx.restore();
    }
    function title(text, x, y, size, color) {
      ctx.font = f(size, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(30,20,10,.35)';
      ctx.strokeText(text, x, y); ctx.fillStyle = color || '#FFF8E7'; ctx.fillText(text, x, y);
    }
    function label(text, x, y, size, color, align) {
      ctx.font = f(size, false); ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = color; ctx.fillText(text, x, y);
    }

    // ---------- 战斗 ----------
    function bossOf(lv) {
      var b = BOSSES[(lv - 1) % BOSSES.length];
      var loop = Math.floor((lv - 1) / BOSSES.length);
      var hp = Math.round(460 * Math.pow(1.72, lv - 1) * (1 + loop * 0.6));
      return {
        base: b, name: b.name + (loop ? ' · 狂暴' + (loop + 1) + '世' : ''),
        hp: hp, max: hp, dodge: Math.min(0.24, ((lv - 1) % BOSSES.length) * 0.03 + loop * 0.04),
        taunts: b.taunts
      };
    }
    function startBattle(lv) {
      var cfg = AV.fixCfg(JSON.parse(JSON.stringify(S.cfg)));
      bt = {
        lv: lv, cfg: cfg, boss: bossOf(lv),
        combo: 0, maxCombo: 0, comboT: 0, rage: 0,
        bx: W / 2, by: H * 0.40, s: 1,
        ox: 0, oy: 0, vx: 0, vy: 0, rot: 0, vrot: 0,
        expr: 'smug', exprT: 0, hurt: 0,
        hitT: 0, hitKind: 'pain', mess: 0, sq: 0, tauntE: 0, pain: 0,
        bruises: [], sweat: [],
        bubble: null, bubbleT: 4,
        healT: lv >= 4 ? 12 : 0,
        got: 0, hits: 0, dead: false, deadT: 0,
        buff: { mul: 1, t: 0, crit: 0, nd: false, text: '' },
        tauntT: 3
      };
      st.bt = bt;
      st.screen = 'battle';
    }
    function baseDmg() {
      var lv = S.lv[S.cur] || 1;
      return (10 + lv * 7) * WEAPONS[S.cur].mul;
    }
    function upCost() { return Math.ceil(90 * Math.pow(1.42, (S.lv[S.cur] || 1) - 1)); }

    function say(t) {
      bt.bubble = { text: t, t: 0 };
      bt.tauntE = 0.85;
    }
    function doHit(px, py, kind) {
      if (!bt || bt.dead) return;
      var b = bt;
      if (b.buff.t > 0 && !b.buff.nd) { /* ok */ }
      if (!b.buff.nd && Math.random() < b.boss.dodge) {
        P({ k: 'txt', x: px, y: py, vx: 0, vy: -60, text: 'MISS', size: 40, color: '#9AA3B0', life: 0.8 });
        b.combo = 0; sf('miss'); return;
      }
      b.combo++; b.comboT = 2.6; b.hits++;
      if (b.combo > b.maxCombo) b.maxCombo = b.combo;

      var crit = Math.random() < (0.15 + b.buff.crit + (S.cur >= 4 ? 0.1 : 0));
      var dmg = baseDmg() * (1 + b.combo * 0.02) * b.buff.mul * (crit ? 2.3 : 1) * (kind == 'ult' ? 20 : 1);
      dmg = Math.max(1, Math.round(dmg));

      b.boss.hp -= dmg;
      b.rage = Math.min(100, b.rage + (kind == 'ult' ? 0 : 3));
      // 受击表情脉冲：普通=痛苦，暴击=震惊
      b.hurt = 1;
      b.expr = crit ? 'shock' : 'pain'; b.exprT = 0.34;
      b.hitT = crit ? 0.52 : 0.34; b.hitKind = crit ? 'shock' : 'pain';
      b.sq = 1;
      b.mess = Math.min(1, b.mess + (crit ? 0.11 : 0.055));
      b.tauntE = 0;
      b.oy += (Math.random() - 0.5) * 14 + 8;
      b.ox += (Math.random() - 0.5) * 20;
      b.vrot += (Math.random() - 0.5) * 0.06;
      st.shake = Math.min(26, st.shake + (crit ? 16 : 9));
      if (kind == 'ult') { st.flash = 1; st.shake = 34; }

      // 飘字
      P({
        k: 'txt', x: px + (Math.random() - 0.5) * 30, y: py, vx: (Math.random() - 0.5) * 40, vy: -180,
        text: (crit ? '暴击 ' : '') + '-' + fmt(dmg), size: crit ? 60 : 42,
        color: crit ? '#FFD24A' : (b.buff.mul > 1.6 ? '#FF8FB1' : '#FFFFFF'), life: 0.95
      });
      // 冲击
      P({ k: 'ring', x: px, y: py, r0: 10, r1: crit ? 190 : 130, color: crit ? 'rgba(255,215,80,.9)' : 'rgba(255,255,255,.8)', life: 0.36 });
      var n = crit ? 12 : 6;
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2, sp = 160 + Math.random() * 340;
        P({
          k: 'spark', x: px, y: py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 700,
          size: 16 + Math.random() * 20, rot: a, color: crit ? '#FFD24A' : '#FFF1D0', life: 0.45
        });
      }
      if (crit) P({ k: 'star', x: px, y: py, size: 52, color: 'rgba(255,220,110,.9)', life: 0.4 });

      // 金币
      var cn = (crit ? 3 : 1) + Math.floor(b.lv * 0.3);
      for (var j = 0; j < cn; j++) {
        P({
          k: 'coin', x: px + (Math.random() - 0.5) * 60, y: py, vx: (Math.random() - 0.5) * 420,
          vy: -300 - Math.random() * 220, g: 900, tx: 60, ty: 52, life: 1.1
        });
      }
      b.got += cn; S.coins += cn;

      // 伤痕：淤青 / 肿包 / 创可贴 / 血口子
      if (b.bruises.length < 9 && Math.random() < 0.42) {
        var r2 = Math.random();
        var tp = r2 < 0.5 ? 'bruise' : r2 < 0.76 ? 'swell' : r2 < 0.92 ? 'band' : 'cut';
        b.bruises.push({
          x: (Math.random() - 0.5) * 150, y: (Math.random() - 0.5) * 130 - 10,
          r: tp === 'band' ? 10 + Math.random() * 6 : 13 + Math.random() * 17,
          t: tp, rot: Math.random() * 3
        });
      }
      if (b.sweat.length < 5 && Math.random() < 0.4) {
        b.sweat.push({ x: (Math.random() - 0.5) * 200, y: -110 - Math.random() * 40, r: 5 + Math.random() * 5 });
      }

      sf(crit ? 'crit' : 'hit', b.combo);
      ad.vibrate(crit ? 26 : 12);

      if (b.boss.hp <= 0) {
        b.boss.hp = 0; b.dead = true; b.deadT = 0; b.expr = 'dead';
        b.mess = 1; b.hitT = 0.7; b.hitKind = 'shock'; b.sq = 1;
        var bonus = Math.round(60 * Math.pow(1.5, b.lv - 1));
        S.coins += bonus; b.got += bonus;
        if (b.lv > S.maxLv) S.maxLv = b.lv;
        save();
        st.flash = 0.8;
        for (var k2 = 0; k2 < 26; k2++) {
          P({
            k: 'coin', x: b.bx + (Math.random() - 0.5) * 300, y: b.by + (Math.random() - 0.5) * 200,
            vx: (Math.random() - 0.5) * 500, vy: -400 - Math.random() * 300, g: 900, tx: 60, ty: 52, life: 1.4
          });
        }
        say('别……别打了……');
        sf('clear');
      }
    }
    function doUlt() {
      if (!bt || bt.dead || bt.rage < 100) return;
      bt.rage = 0;
      sf('ult');
      P({ k: 'txt', x: W / 2, y: H * 0.3, vx: 0, vy: -40, text: WEAPONS[S.cur].name + '·必杀', size: 68, color: '#FF6B4A', life: 1.4 });
      for (var i = 0; i < 5; i++) {
        (function (i2) {
          setTimeoutLike(i2 * 0.08, function () { if (bt) doHit(bt.bx + (Math.random() - 0.5) * 200, bt.by + (Math.random() - 0.5) * 160, 'ult'); });
        })(i);
      }
    }
    var timers = [];
    function setTimeoutLike(delay, fn) { timers.push({ d: delay, f: fn }); }

    function askRoast() {
      if (!ad.input) {
        applyRoast(pick(SAMPLES)); return;
      }
      ad.input({
        title: '输出你的吐槽',
        placeholder: pick(SAMPLES),
        maxLength: 40
      }, function (text) {
        if (!text || !text.trim()) return;
        applyRoast(text.trim());
      });
    }
    function applyRoast(text) {
      var r = RO.score(text, S.hist);
      if (!r) return;
      S.hist.push(r.clean);
      if (S.hist.length > 30) S.hist.shift();
      S.roasts.push({ t: r.clean, s: r.score, g: r.grade });
      S.roasts.sort(function (a, b) { return b.s - a.s; });
      if (S.roasts.length > 8) S.roasts.length = 8;
      save();
      roastRes = { r: r, t: 0 };
      st.screen = 'roast';
      if (bt) {
        bt.buff = { mul: r.mul, t: r.duration, max: r.duration, crit: r.critBonus, nd: r.ignoreDodge, text: r.clean, grade: r.grade };
        P({ k: 'word', x: W, y: H * 0.22, vx: -230, vy: 0, text: r.clean, size: 36, color: 'rgba(255,240,190,.95)', life: 6 });
      }
      sf('roast', r.grade);
    }

    // ---------- 更新 ----------
    function update(dt) {
      st.t += dt;
      st.shake = Math.max(0, st.shake - dt * 70);
      st.flash = Math.max(0, st.flash - dt * 2.4);
      for (var i = timers.length - 1; i >= 0; i--) {
        timers[i].d -= dt;
        if (timers[i].d <= 0) { var fn = timers[i].f; timers.splice(i, 1); fn(); }
      }
      updParts(dt);

      if (st.screen == 'battle' && bt) {
        var b = bt;
        // 回弹
        b.ox = lerp(b.ox, 0, 0.16); b.oy = lerp(b.oy, 0, 0.16);
        b.rot += b.vrot; b.vrot *= 0.86; b.rot = lerp(b.rot, 0, 0.12);
        b.hurt = Math.max(0, b.hurt - dt * 3);
        // 表情：受击脉冲衰减 + 按血量切换阶段表情
        b.exprT -= dt;
        b.hitT = Math.max(0, b.hitT - dt);
        b.sq = Math.max(0, b.sq - dt * 4.2);
        b.tauntE = Math.max(0, b.tauntE - dt * 1.6);
        var pr = clamp(b.boss.hp / b.boss.max, 0, 1);
        b.pain = 1 - pr;
        if (!b.dead) {
          b.expr = pr > 0.68 ? 'smug' : pr > 0.42 ? 'angry' : pr > 0.18 ? 'plead' : 'cry';
        }
        if (b.comboT > 0) { b.comboT -= dt; if (b.comboT <= 0) b.combo = 0; }
        if (b.buff.t > 0) { b.buff.t -= dt; if (b.buff.t <= 0) b.buff.mul = 1; }
        b.tauntT -= dt;
        if (b.tauntT <= 0 && !b.dead) {
          b.tauntT = 5 + Math.random() * 5;
          say(pick(b.boss.taunts.concat(S.cfg.taunt ? [S.cfg.taunt] : [])));
        }
        if (b.bubble) { b.bubble.t += dt; if (b.bubble.t > 2.8) b.bubble = null; }
        if (b.healT > 0 && !b.dead) {
          b.healT -= dt;
          if (b.healT <= 0) {
            b.healT = 13;
            var heal = Math.round(b.boss.max * 0.03);
            if (b.boss.hp > 0 && b.boss.hp < b.boss.max) {
              b.boss.hp = Math.min(b.boss.max, b.boss.hp + heal);
              P({ k: 'txt', x: W / 2, y: H * 0.28, vx: 0, vy: -50, text: '画饼回血 +' + fmt(heal), size: 40, color: '#7BE08A', life: 1.2 });
              say('我们明年一定上市');
            }
          }
        }
        if (b.dead) {
          b.deadT += dt;
          b.oy += dt * 60;
          b.vrot += dt * 0.05;
          b.expr = 'dead';
          if (b.deadT > 1.1) {
            clearData = { lv: b.lv, got: b.got, combo: b.maxCombo, hits: b.hits };
            st.screen = 'clear';
            save();
          }
        }
        // 长按连击
        if (pointerDown && !b.dead && st.screen == 'battle') {
          holdT -= dt;
          if (holdT <= 0) { holdT = 0.14; doHit(lastP.x, lastP.y, 'tap'); }
        }
      }
      if (st.screen == 'roast') { roastRes.t += dt; }
      if (st.screen == 'clear') { /* nothing */ }
    }

    // ---------- 绘制 ----------
    function draw() {
      st.ui = [];
      ctx.save();
      ctx.fillStyle = '#1B2030'; ctx.fillRect(0, 0, W, H);
      if (st.shake > 0.2) {
        ctx.translate((Math.random() - 0.5) * st.shake, (Math.random() - 0.5) * st.shake);
      }

      if (st.screen == 'menu') drawMenu();
      else if (st.screen == 'create') drawCreate();
      else if (st.screen == 'battle') drawBattle();
      else if (st.screen == 'shop') { if (shopFrom == 'battle') { drawBattleBg(); drawBattleChar(); } else { drawMenuBg(); } drawShop(); }
      else if (st.screen == 'roast') { drawBattleBg(); drawBattleChar(); drawRoast(); }
      else if (st.screen == 'clear') { drawBattleBg(); drawBattleChar(); drawClear(); }

      drawParts();
      ctx.restore();

      for (var i = 0; i < st.ui.length; i++) {
        var u = st.ui[i];
        if (u.kind == 'btn') drawBtn(u);
      }

      if (st.flash > 0.01) {
        ctx.save(); ctx.globalAlpha = Math.min(0.75, st.flash);
        ctx.fillStyle = '#FFF6DA'; ctx.fillRect(0, 0, W, H); ctx.restore();
      }
      if (st.help) drawHelp();
    }

    function bgOf() { return (st.screen == 'create' ? crt.cfg : S.cfg).bg; }

    function drawMenuBg() {
      AV.drawBg(ctx, S.cfg.bg, W, H);
      ctx.save(); ctx.fillStyle = 'rgba(18,22,34,.35)'; ctx.fillRect(0, 0, W, H); ctx.restore();
      title('暴 打 老 板', W / 2, H * 0.13, 78, '#FFE9C9');
      title('—— 摸鱼发泄室 ——', W / 2, H * 0.185, 30, '#FFD9A0');
      var sc = 0.85;
      ctx.save();
      ctx.translate(0, Math.sin(st.t * 2) * 6);
      AV.drawCharacter(ctx, S.cfg, { x: W / 2, y: H * 0.36, s: sc, expr: 'smug' });
      ctx.restore();
      panel(W / 2 - 175, H * 0.52, 350, 76, 18);
      label(S.cfg.name || '无名老板', W / 2, H * 0.52 + 26, 34, '#2F3A52', 'center');
      label('「' + (S.cfg.taunt || '…') + '」', W / 2, H * 0.52 + 56, 22, '#7A8290', 'center');
    }

    function drawMenu() {
      drawMenuBg();
      btn('mute', W - 104, 30, 76, 76, '', { size: 32, bg: '#3A4258', bg2: '#4E5B7C', icon: 'speaker', muted: S.sound === false });

      title('暴 打 老 板', W / 2, H * 0.13, 78, '#FFE9C9');
      // 信息条
      var iy = H * 0.60;
      panel(40, iy, W - 80, 76, 18);
      label('💰 ' + fmt(S.coins), 100, iy + 38, 30, '#B87A10', 'center');
      label('🔨 ' + WEAPONS[S.cur].name + ' Lv.' + S.lv[S.cur], W / 2, iy + 38, 28, '#2F3A52', 'center');
      label('🏆 第 ' + S.maxLv + ' 关', W - 100, iy + 38, 28, '#2F3A52', 'center');

      var by = H * 0.70, bw = W - 120, bh = 104;
      btn('play', 60, by, bw, bh, '开 始 上 班', { primary: true, size: 42 });
      btn('create', 60, by + 124, (bw - 20) / 2, 92, '捏一个老板', { bg: '#3E7D5A', bg2: '#57A177' });
      btn('shop', 60 + (bw - 20) / 2 + 20, by + 124, (bw - 20) / 2, 92, '武器库', { bg: '#7A5AA8', bg2: '#9B7CC9' });
      btn('help', 60, by + 232, bw, 82, '玩法说明', { bg: '#4A5268', bg2: '#646E88', size: 30 });

      label('发泄专用 · 现实中请保持微笑', W / 2, H - 30, 22, 'rgba(255,255,255,.55)', 'center');
    }

    function drawCreate() {
      AV.drawBg(ctx, crt.cfg.bg, W, H);
      ctx.save(); ctx.fillStyle = 'rgba(18,22,34,.28)'; ctx.fillRect(0, 0, W, H); ctx.restore();
      title('捏一个你最想打的人', W / 2, 62, 40, '#FFF3DC');

      // 表情轮播，方便预览挨打后的样子
      var DEMO = ['smug', 'taunt', 'angry', 'pain', 'shock', 'plead', 'cry', 'dizzy'];
      var di = Math.floor(st.t / 1.6) % DEMO.length;
      ctx.save();
      ctx.translate(0, Math.sin(st.t * 2) * 5);
      AV.drawCharacter(ctx, crt.cfg, {
        x: W / 2, y: 290, s: 0.62, expr: DEMO[di],
        hit: (DEMO[di] === 'pain' || DEMO[di] === 'shock') ? 1 : 0,
        hitKind: DEMO[di] === 'shock' ? 'shock' : 'pain',
        pain: DEMO[di] === 'cry' ? 0.8 : DEMO[di] === 'plead' ? 0.5 : 0
      });
      ctx.restore();
      label('表情预览：' + ({
        smug: '得意', taunt: '嘲讽', angry: '恼怒', pain: '挨打',
        shock: '暴击', plead: '求饶', cry: '崩溃', dizzy: '晕眩'
      }[DEMO[di]]), W / 2, 424, 24, 'rgba(255,255,255,.9)', 'center');

      var cat = AV.PARTS[AV.KEYS[crt.cat]];
      panel(W / 2 - 190, 452, 380, 62, 16);
      label(cat.label, W / 2, 483, 32, '#2F3A52', 'center');

      // 选择
      btn('prev', 40, 530, 110, 84, '◀', { size: 40 });
      panel(160, 530, W - 320, 84, 16);
      var curName = '';
      cat.opts.forEach(function (o) { if (o.id === crt.cfg[AV.KEYS[crt.cat]]) curName = o.name; });
      label(curName, W / 2, 566, 36, '#2F3A52', 'center');
      btn('next', W - 150, 530, 110, 84, '▶', { size: 40 });

      // 分类 chips
      var gap = 14, cols = 6, cw = (W - 30 - gap * (cols - 1)) / cols, ch = 74;
      var cx = 15, cy = 640;
      for (var i = 0; i < AV.KEYS.length; i++) {
        var col = i % cols, row = Math.floor(i / cols);
        var x = cx + col * (cw + gap), y = cy + row * (ch + gap);
        btn('cat' + i, x, y, cw, ch, AV.PARTS[AV.KEYS[i]].label, {
          size: 25,
          bg: crt.cat === i ? '#E4572E' : '#39435C',
          bg2: crt.cat === i ? '#FF7A4D' : '#4E5B7C'
        });
      }

      var by = cy + 2 * (ch + gap) + 20;
      btn('rand', 15, by, (W - 30 - 30) / 3, 92, '🎲 随机', { bg: '#3E7D5A', bg2: '#57A177', size: 30 });
      btn('rename', 15 + (W - 60) / 3 + 15, by, (W - 60) / 3, 92, '✏ 名字', { bg: '#7A5AA8', bg2: '#9B7CC9', size: 30 });
      btn('done', 15 + ((W - 60) / 3 + 15) * 2, by, (W - 60) / 3, 92, '✔ 就他了', { primary: true, size: 32 });

      label('当前：' + (crt.cfg.name || '无名') + '  「' + (crt.cfg.taunt || '') + '」', W / 2, by + 118, 24, 'rgba(255,255,255,.8)', 'center');
    }

    function drawBattleBg() {
      AV.drawBg(ctx, S.cfg.bg, W, H);
      ctx.save(); ctx.fillStyle = 'rgba(18,22,34,.24)'; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
    function drawBattleChar() {
      if (!bt) return;
      var b = bt;
      var hp = clamp(b.boss.hp / b.boss.max, 0, 1);
      var pulse = Math.min(1, b.hitT / 0.34);
      var ex = b.expr, hit = pulse, kind = b.hitKind;
      // 说垃圾话时短暂切成嘲讽脸
      if (b.tauntE > hit && !b.dead) { ex = 'taunt'; hit = Math.min(1, b.tauntE); kind = 'taunt'; }
      AV.drawCharacter(ctx, b.cfg, {
        x: b.bx + b.ox, y: b.by + b.oy, s: b.s,
        expr: ex, hit: hit, hitKind: kind,
        pain: b.pain, mess: b.mess, sq: b.sq, tilt: b.rot,
        bruises: b.bruises, sweat: b.sweat
      });
    }

    function drawBattle() {
      var b = bt; if (!b) return;
      drawBattleBg();

      // 顶部条
      ctx.save();
      ctx.fillStyle = 'rgba(20,26,40,.55)'; ctx.fillRect(0, 0, W, 128);
      btn('back', 20, 26, 76, 76, '✕', { size: 34, bg: '#3A4258', bg2: '#4E5B7C' });
      btn('mute', 108, 26, 76, 76, '', { size: 32, bg: '#3A4258', bg2: '#4E5B7C', icon: 'speaker', muted: S.sound === false });
      label('第 ' + b.lv + ' 关 · ' + b.boss.name, W / 2, 46, 32, '#FFE9C9', 'center');
      var bw = W - 120, bx = 60, by = 72;
      ctx.fillStyle = 'rgba(0,0,0,.4)'; AV.rr(ctx, bx, by, bw, 30, 15); ctx.fill();
      var ratio = clamp(b.boss.hp / b.boss.max, 0, 1);
      var g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, '#FF5C4D'); g.addColorStop(1, '#FFB03A');
      ctx.fillStyle = g; AV.rr(ctx, bx, by, Math.max(6, bw * ratio), 30, 15); ctx.fill();
      label(fmt(b.boss.hp) + ' / ' + fmt(b.boss.max), W / 2, by + 15, 22, '#FFF', 'center');
      ctx.restore();
      label('💰 ' + fmt(S.coins), W - 60, 30, 34, '#FFD24A', 'right');

      // BOSS 情绪状态
      var mr = clamp(b.boss.hp / b.boss.max, 0, 1);
      var mood = b.dead ? ['K.O.', '#8A4A2A'] :
        mr > 0.68 ? ['😏 得意', '#3E7D5A'] :
          mr > 0.42 ? ['😠 恼怒', '#C97A2A'] :
            mr > 0.18 ? ['🥺 求饶', '#B0552E'] : ['😭 崩溃', '#A32E2E'];
      ctx.save();
      ctx.fillStyle = mood[1];
      AV.rr(ctx, 60, 140, 168, 50, 16); ctx.fill();
      ctx.fillStyle = '#FFF'; ctx.font = f(26, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(mood[0], 144, 166);
      ctx.restore();

      // 濒死红晕
      if (!b.dead && b.pain > 0.55) {
        var vg = ctx.createRadialGradient(W / 2, H * 0.42, H * 0.2, W / 2, H * 0.42, H * 0.62);
        vg.addColorStop(0, 'rgba(180,20,20,0)');
        vg.addColorStop(1, 'rgba(180,20,20,' + ((b.pain - 0.55) * 0.5).toFixed(3) + ')');
        ctx.save(); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H); ctx.restore();
      }

      drawBattleChar();

      // 气泡
      if (b.bubble) {
        var tx = W / 2, ty = b.by - 220;
        ctx.save();
        ctx.font = f(30, false); ctx.textAlign = 'center';
        var tw = ctx.measureText(b.bubble.text).width + 48;
        ctx.fillStyle = 'rgba(255,255,255,.95)';
        AV.rr(ctx, tx - tw / 2, ty - 34, tw, 68, 18); ctx.fill();
        ctx.beginPath(); ctx.moveTo(tx - 14, ty + 32); ctx.lineTo(tx + 14, ty + 32); ctx.lineTo(tx, ty + 58); ctx.fill();
        ctx.fillStyle = '#2F3A52'; ctx.textBaseline = 'middle';
        ctx.fillText(b.bubble.text, tx, ty);
        ctx.restore();
      }

      // combo
      if (b.combo > 2) {
        var cs = 1 + Math.min(0.5, b.combo * 0.012);
        ctx.save();
        ctx.translate(W / 2, H * 0.16); ctx.scale(cs, cs);
        title(b.combo + ' COMBO', 0, 0, 56, '#FFD24A');
        label('伤害 +' + Math.round(b.combo * 2) + '%', 0, 44, 26, '#FFE9C9', 'center');
        ctx.restore();
      }

      // buff 条
      if (b.buff.t > 0) {
        var py = H * 0.235;
        ctx.save();
        ctx.fillStyle = 'rgba(255,120,90,.88)';
        AV.rr(ctx, 40, py, W - 80, 54, 16); ctx.fill();
        ctx.fillStyle = '#FFF';
        ctx.font = f(26, true); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText('吐槽强化 ' + b.buff.mul.toFixed(2) + '×  ' + Math.ceil(b.buff.t) + 's', 60, py + 27);
        ctx.textAlign = 'right';
        ctx.fillText(b.buff.grade || '', W - 60, py + 27);
        ctx.restore();
      }

      // 武器 + 怒气
      var wy = H - 300;
      panel(40, wy, W - 80, 118, 18);
      label('🔨 ' + WEAPONS[S.cur].name + '  Lv.' + S.lv[S.cur], 70, wy + 34, 30, '#2F3A52');
      label('基础伤害 ' + fmt(baseDmg() * b.buff.mul) + (b.buff.mul > 1 ? '（含吐槽加成）' : ''), 70, wy + 82, 24, '#7A8290');
      btn('upgrade', W - 250, wy + 26, 190, 66, '升级 ' + fmt(upCost()), {
        size: 26, disabled: S.coins < upCost(), bg: '#3E7D5A', bg2: '#57A177'
      });

      var ry = H - 165;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.45)'; AV.rr(ctx, 40, ry, W - 80, 34, 17); ctx.fill();
      var rgg = ctx.createLinearGradient(40, 0, W - 40, 0);
      rgg.addColorStop(0, '#4C6EF5'); rgg.addColorStop(1, '#FF6B4A');
      ctx.fillStyle = rgg;
      AV.rr(ctx, 40, ry, Math.max(4, (W - 80) * (b.rage / 100)), 34, 17); ctx.fill();
      label('怒气 ' + Math.floor(b.rage) + '%', W / 2, ry + 17, 22, '#FFF', 'center');
      ctx.restore();

      var bty = H - 110, bth = 92, gap2 = 18, bw2 = (W - 80 - gap2 * 2) / 3;
      btn('shop2', 40, bty, bw2, bth, '🔨 武器', { size: 30, bg: '#7A5AA8', bg2: '#9B7CC9' });
      btn('roast', 40 + bw2 + gap2, bty, bw2, bth, '💬 吐槽强化', { size: 30, primary: true });
      btn('ult', 40 + (bw2 + gap2) * 2, bty, bw2, bth, b.rage >= 100 ? '💥 必杀' : '💤 蓄力', {
        size: 30, disabled: b.rage < 100, bg: '#B7472A', bg2: '#FF6B4A'
      });
    }

    function drawShop() {
      ctx.save(); ctx.fillStyle = 'rgba(10,14,24,.6)'; ctx.fillRect(0, 0, W, H); ctx.restore();
      var px = 30, py = 130, pw = W - 60, ph = H - 260;
      panel(px, py, pw, ph, 28);
      title('武器库', W / 2, py + 52, 44, '#2F3A52');
      label('💰 ' + fmt(S.coins), W / 2, py + 96, 28, '#B87A10', 'center');

      var top = py + 126, rowH = Math.min(112, (py + ph - 120 - top) / WEAPONS.length);
      for (var i = 0; i < WEAPONS.length; i++) {
        var w = WEAPONS[i], y = top + i * rowH;
        var owned = S.own[i], cur = S.cur === i;
        ctx.save();
        ctx.fillStyle = cur ? 'rgba(255,120,80,.16)' : (owned ? 'rgba(60,90,140,.08)' : 'rgba(0,0,0,.04)');
        AV.rr(ctx, px + 20, y + 4, pw - 40, rowH - 10, 14); ctx.fill();
        if (cur) { ctx.strokeStyle = '#E4572E'; ctx.lineWidth = 4; ctx.stroke(); }
        ctx.fillStyle = cur ? '#E4572E' : (owned ? '#2F3A52' : '#9AA3B0');
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.font = f(32, true);
        ctx.fillText(w.name + (owned && S.lv[i] > 0 ? '  Lv.' + S.lv[i] : ''), px + 44, y + rowH / 2 - 12);
        ctx.font = f(22, false); ctx.fillStyle = '#7A8290';
        ctx.fillText(w.desc + ' · 伤害 ×' + w.mul, px + 44, y + rowH / 2 + 18);
        ctx.textAlign = 'right';
        ctx.font = f(28, true);
        if (cur) { ctx.fillStyle = '#E4572E'; ctx.fillText('使用中', px + pw - 44, y + rowH / 2); }
        else if (owned) { ctx.fillStyle = '#3E7D5A'; ctx.fillText('装备', px + pw - 44, y + rowH / 2); }
        else {
          ctx.fillStyle = S.coins >= w.cost ? '#B87A10' : '#B9BECA';
          ctx.fillText('¥' + fmt(w.cost), px + pw - 44, y + rowH / 2);
        }
        ctx.restore();
        btn('wp' + i, px + 20, y + 4, pw - 40, rowH - 10, '', { r: 14, bg: 'rgba(0,0,0,0)', bg2: 'rgba(0,0,0,0)', fg: 'rgba(0,0,0,0)' });
      }
      var sby = py + ph - 84, sbw = (pw - 100) / 2;
      btn('upgrade', px + 30, sby, sbw, 72, '升级 ¥' + fmt(upCost()), {
        size: 28, disabled: S.coins < upCost(), bg: '#3E7D5A', bg2: '#57A177',
        sub: WEAPONS[S.cur].name + ' Lv.' + S.lv[S.cur]
      });
      btn('close', px + 50 + sbw, sby, sbw, 72, '关 闭', { size: 30, bg: '#4A5268', bg2: '#646E88' });
    }

    function drawRoast() {
      var r = roastRes.r;
      ctx.save(); ctx.fillStyle = 'rgba(10,14,24,.66)'; ctx.fillRect(0, 0, W, H); ctx.restore();
      var pw = W - 80, px = 40, py = H * 0.13, ph = H * 0.66;
      panel(px, py, pw, ph, 28);

      var cx = W / 2;
      label('吐槽另类度', cx, py + 46, 28, '#7A8290', 'center');
      // 分数环
      var ry = py + 150, rr2 = 86;
      ctx.save();
      ctx.lineWidth = 18; ctx.strokeStyle = '#E7E1D6';
      ctx.beginPath(); ctx.arc(cx, ry, rr2, 0, Math.PI * 2); ctx.stroke();
      var prog = clamp(r.score / 100, 0, 1) * clamp(roastRes.t / 0.6, 0, 1);
      var col = r.score >= 82 ? '#E4572E' : r.score >= 52 ? '#F0A020' : '#7A8290';
      ctx.strokeStyle = col; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(cx, ry, rr2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog); ctx.stroke();
      ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = f(64, true);
      ctx.fillText('' + Math.round(r.score * clamp(roastRes.t / 0.6, 0, 1)), cx, ry);
      ctx.restore();

      title(r.grade, cx, py + 278, 72, col);
      label(r.comment, cx, py + 336, 28, '#2F3A52', 'center');

      // 明细
      var dy = py + 386;
      ctx.save();
      ctx.font = f(25, false); ctx.textBaseline = 'middle';
      for (var i = 0; i < r.details.length && i < 6; i++) {
        var d = r.details[i];
        ctx.textAlign = 'left'; ctx.fillStyle = '#4A5268';
        ctx.fillText('· ' + d[0], px + 60, dy + i * 40);
        ctx.textAlign = 'right';
        ctx.fillStyle = d[1].indexOf('-') === 0 ? '#C0392B' : '#3E7D5A';
        ctx.font = f(25, true);
        ctx.fillText(d[1], px + pw - 60, dy + i * 40);
        ctx.font = f(25, false);
      }
      ctx.restore();

      var by = py + ph - 96;
      label('武器强化 ' + r.mul.toFixed(2) + '× ，持续 ' + r.duration + ' 秒' + (r.ignoreDodge ? '，且无视闪避' : ''), cx, by - 24, 26, '#B7472A', 'center');
      btn('rok', cx - 130, by, 260, 72, '开 打！', { primary: true, size: 34 });
    }

    function drawClear() {
      ctx.save(); ctx.fillStyle = 'rgba(10,14,24,.62)'; ctx.fillRect(0, 0, W, H); ctx.restore();
      var pw = W - 100, px = 50, ph = 520, py = H * 0.24;
      panel(px, py, pw, ph, 28);
      title('第 ' + clearData.lv + ' 关 · 通过', W / 2, py + 70, 52, '#E4572E');
      label('「' + (bt ? bt.boss.name : '') + '」已躺平', W / 2, py + 124, 28, '#7A8290', 'center');
      var rows = [
        ['获得金币', '+' + fmt(clearData.got)],
        ['最高连击', clearData.combo + ' COMBO'],
        ['挥拳次数', clearData.hits + ' 下'],
        ['当前存款', '💰 ' + fmt(S.coins)]
      ];
      for (var i = 0; i < rows.length; i++) {
        var y = py + 190 + i * 62;
        ctx.font = f(30, false); ctx.textAlign = 'left'; ctx.fillStyle = '#4A5268';
        ctx.fillText(rows[i][0], px + 70, y);
        ctx.textAlign = 'right'; ctx.font = f(32, true); ctx.fillStyle = '#2F3A52';
        ctx.fillText(rows[i][1], px + pw - 70, y);
      }
      var by = py + ph - 96;
      btn('nextlv', px + 40, by, (pw - 110) / 2, 80, '下 一 关 ▶', { primary: true, size: 32 });
      btn('home', px + 70 + (pw - 110) / 2, by, (pw - 110) / 2, 80, '回工位', { size: 32, bg: '#4A5268', bg2: '#646E88' });
    }

    function drawHelp() {
      ctx.save(); ctx.fillStyle = 'rgba(10,14,24,.72)'; ctx.fillRect(0, 0, W, H); ctx.restore();
      var pw = W - 80, px = 40, ph = H * 0.72, py = H * 0.14;
      panel(px, py, pw, ph, 28);
      title('玩 法 说 明', W / 2, py + 56, 42, '#2F3A52');
      var lines = [
        '1. 点/按住 BOSS 就是打，滑动可以更快连击',
        '2. 连击越高伤害越高，2.6 秒不打就断',
        '3. 打中掉金币，金币在武器库换更狠的家伙',
        '4. 怒气满了点「必杀」，一次打出 20 倍伤害',
        '5. 点「吐槽强化」输入一句话，越另类武器越强',
        '   · 用比喻、跨界联想（职场×量子物理）加分',
        '   · 用 996 / 内卷 / 画饼 这类老梗会扣分',
        '   · 重复说过的话也会被扣分',
        '6. BOSS 的表情会随血量变化：得意→恼怒→',
        '   求饶→崩溃，打脸还会淤青、肿包、鼻血',
        '7. 捏脸新增鼻子、胡须，12 类部件随便搭，',
        '   捏脸页可以轮播预览 8 种挨打表情',
        '8. 右上角喇叭可以开关音效（连击越高音调越脆）',
        '',
        '本游戏仅供发泄，请不要在现实中实践'
      ];
      ctx.save();
      ctx.font = f(26, false); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#4A5268';
      for (var i = 0; i < lines.length; i++) ctx.fillText(lines[i], px + 54, py + 130 + i * 46);
      ctx.restore();
      btn('hclose', W / 2 - 130, py + ph - 86, 260, 70, '知道了', { size: 30, bg: '#4A5268', bg2: '#646E88' });
    }

    // ---------- 输入 ----------
    function hitId(x, y) {
      for (var i = st.ui.length - 1; i >= 0; i--) {
        var u = st.ui[i];
        if (x >= u.x && x <= u.x + u.w && y >= u.y && y <= u.y + u.h) return u;
      }
      return null;
    }
    function pointer(type, x, y) {
      if (st.help) {
        if (type == 'down') { var h = hitId(x, y); if (h && h.id == 'hclose') { st.help = false; sf('tap'); } }
        return;
      }
      if (type == 'down') {
        var b = hitId(x, y);
        if (b && b.disabled) return;
        if (b) { st.pressed = b.id; sf('tap'); return; }
        // 场景点击
        if (st.screen == 'battle' && bt && !bt.dead) {
          pointerDown = true; lastP = { x: x, y: y }; holdT = 0.22;
          doHit(x, y, 'tap');
        }
      } else if (type == 'move') {
        if (pointerDown && st.screen == 'battle' && bt && !bt.dead) {
          var dx = x - lastP.x, dy = y - lastP.y;
          if (dx * dx + dy * dy > 40 * 40) { lastP = { x: x, y: y }; holdT = 0.22; doHit(x, y, 'tap'); }
        }
      } else if (type == 'up') {
        pointerDown = false;
        var id = st.pressed;
        st.pressed = null;
        if (!id) return;
        var hit = hitId(x, y);
        if (!hit || hit.id !== id) return;
        onBtn(id);
      }
    }
    function onBtn(id) {
      if (id == 'play') { startBattle(S.maxLv); }
      else if (id == 'create') { crt.cfg = JSON.parse(JSON.stringify(S.cfg)); crt.cat = 0; st.screen = 'create'; }
      else if (id == 'shop') { shopFrom = 'menu'; st.screen = 'shop'; }
      else if (id == 'help') { st.help = true; }
      else if (id == 'back') { save(); st.screen = 'menu'; }
      else if (id == 'mute') { S.sound = S.sound === false; save(); sf('tap'); return; }
      else if (id == 'prev' || id == 'next') {
        var key = AV.KEYS[crt.cat], opts = AV.PARTS[key].opts, idx = 0;
        for (var i = 0; i < opts.length; i++) if (opts[i].id === crt.cfg[key]) idx = i;
        idx = (idx + (id == 'next' ? 1 : opts.length - 1)) % opts.length;
        crt.cfg[key] = opts[idx].id;
      } else if (id.indexOf('cat') === 0) {
        crt.cat = parseInt(id.slice(3), 10);
      } else if (id == 'rand') {
        crt.cfg = AV.randomCfg();
      } else if (id == 'rename') {
        if (ad.input) ad.input({ title: '给他起个名字', placeholder: '王总', value: crt.cfg.name, maxLength: 8 }, function (v) {
          if (v && v.trim()) crt.cfg.name = v.trim();
          if (ad.input) ad.input({ title: '他的口头禅', placeholder: '这个需求很简单', value: crt.cfg.taunt, maxLength: 16 }, function (v2) {
            if (v2 && v2.trim()) crt.cfg.taunt = v2.trim();
          });
        });
      } else if (id == 'done') {
        S.cfg = JSON.parse(JSON.stringify(crt.cfg)); save(); st.screen = 'menu';
      } else if (id == 'upgrade') {
        var c = upCost();
        if (S.coins >= c) { S.coins -= c; S.lv[S.cur] = (S.lv[S.cur] || 1) + 1; save(); sf('buy'); }
      } else if (id.indexOf('wp') === 0) {
        var wi = parseInt(id.slice(2), 10);
        if (S.own[wi]) { S.cur = wi; }
        else if (S.coins >= WEAPONS[wi].cost) {
          S.coins -= WEAPONS[wi].cost; S.own[wi] = true; S.lv[wi] = 1; S.cur = wi; sf('buy');
        } else if (ad.toast) ad.toast('金币不够，再打一会儿');
        save();
      } else if (id == 'shop2') { shopFrom = 'battle'; st.screen = 'shop'; return; }
      else if (id == 'close') { st.screen = shopFrom == 'battle' ? 'battle' : 'menu'; return; }
      else if (id == 'roast') { askRoast(); return; }
      else if (id == 'ult') { doUlt(); return; }
      else if (id == 'rok') { st.screen = 'battle'; return; }
      else if (id == 'nextlv') { startBattle(clearData.lv + 1); return; }
      else if (id == 'home') { st.screen = 'menu'; return; }
    }

    return {
      frame: function (dt) { update(dt); draw(); },
      pointer: pointer,
      state: st,
      save: save,
      data: S
    };
  }

  var api = { create: create, WEAPONS: WEAPONS, BOSSES: BOSSES };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BossSmash = api;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));
