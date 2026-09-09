/* 暴打老板 · 捏脸部件库 v2（纯 Canvas 程序化绘制，无图片资源）
 * v2 新增：
 *   - 表情系统：五官参数化（眉/眼/嘴/瞳/泪/汗/震颤），支持阶段表情 + 受击脉冲混合
 *   - 新增鼻子、胡须两类部件，脸型细节（皱纹/油光/双下巴/立体阴影）
 *   - 伤痕系统升级：淤青 / 肿包 / 创可贴 / 鼻血
 */
(function (root) {
  'use strict';

  function ell(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); }
  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  var SKINS = ['#FFE3C8', '#F9D0AE', '#E9B489', '#D0956A', '#B87B50', '#8E5A38'];
  var HAIRS = ['#2B2118', '#4A3527', '#6B4A2F', '#1B1B1F', '#8A8F98', '#C4622D'];

  var PARTS = {
    shape: {
      label: '脸型', opts: [
        { id: 'round', name: '福气圆脸' }, { id: 'square', name: '方正国字' },
        { id: 'long', name: '苦命长脸' }, { id: 'egg', name: '标准鹅蛋' },
        { id: 'flat', name: '大饼脸' }, { id: 'tri', name: '心机瓜子' }
      ]
    },
    skin: {
      label: '肤色', opts: [
        { id: 0, name: '冷白皮' }, { id: 1, name: '小麦色' }, { id: 2, name: '健康色' },
        { id: 3, name: '古铜色' }, { id: 4, name: '黝黑' }, { id: 5, name: '包青天' }
      ]
    },
    hair: {
      label: '发型', opts: [
        { id: 'med', name: '地中海' }, { id: 'bald', name: '锃亮全秃' },
        { id: 'short', name: '板寸' }, { id: 'back', name: '油亮背头' },
        { id: 'afro', name: '爆炸头' }, { id: 'bun', name: '丸子头' },
        { id: 'long', name: '长发及腰' }, { id: 'mohawk', name: '莫西干' },
        { id: 'curly', name: '泡面卷' }, { id: 'helmet', name: '头盔假发' }
      ]
    },
    brow: {
      label: '眉毛', opts: [
        { id: 'flat', name: '一字眉' }, { id: 'angry', name: '凶煞眉' },
        { id: 'sad', name: '八字苦眉' }, { id: 'thin', name: '心机细眉' },
        { id: 'bushy', name: '浓密粗眉' }, { id: 'cut', name: '断眉' }
      ]
    },
    eye: {
      label: '眼睛', opts: [
        { id: 'dot', name: '圆豆眼' }, { id: 'line', name: '眯眯眼' },
        { id: 'dead', name: '死鱼眼' }, { id: 'cross', name: '斗鸡眼' },
        { id: 'tired', name: '加班黑眼圈' }, { id: 'big', name: '无辜大眼' },
        { id: 'money', name: '铜钱眼' }
      ]
    },
    nose: {
      label: '鼻子', opts: [
        { id: 'normal', name: '普通鼻' }, { id: 'bulb', name: '酒糟蒜头' },
        { id: 'hook', name: '心机鹰钩' }, { id: 'flat', name: '塌鼻梁' },
        { id: 'long', name: '通天长鼻' }, { id: 'pig', name: '朝天猪鼻' }
      ]
    },
    mouth: {
      label: '嘴巴', opts: [
        { id: 'flat', name: '抿嘴' }, { id: 'teeth', name: '大龅牙' },
        { id: 'wry', name: '歪嘴战神' }, { id: 'shout', name: '咆哮大嘴' },
        { id: 'smirk', name: '冷笑' }, { id: 'gold', name: '金牙暴发户' }
      ]
    },
    facial: {
      label: '胡须', opts: [
        { id: 'none', name: '干干净净' }, { id: 'goatee', name: '山羊胡' },
        { id: 'eight', name: '八字胡' }, { id: 'full', name: '络腮大胡' },
        { id: 'stubble', name: '青色胡茬' }, { id: 'hair', name: '鼻毛外露' }
      ]
    },
    glass: {
      label: '眼部', opts: [
        { id: 'none', name: '裸眼' }, { id: 'round', name: '圆框眼镜' },
        { id: 'gold', name: '金丝眼镜' }, { id: 'sun', name: '装X墨镜' },
        { id: 'patch', name: '独眼龙眼罩' }, { id: 'band', name: '战损绷带' }
      ]
    },
    outfit: {
      label: '服装', opts: [
        { id: 'shirt', name: '白衬衫' }, { id: 'suit', name: '西装革履' },
        { id: 'grid', name: '程序员格子衫' }, { id: 'hoodie', name: '摸鱼卫衣' },
        { id: 'tee', name: '文化衫' }, { id: 'vest', name: '土味马甲' }
      ]
    },
    prop: {
      label: '道具', opts: [
        { id: 'none', name: '空手' }, { id: 'coffee', name: '续命咖啡' },
        { id: 'cup', name: '保温杯' }, { id: 'badge', name: '工牌' },
        { id: 'report', name: '一沓报表' }, { id: 'phone', name: '手机摸鱼' }
      ]
    },
    bg: {
      label: '场景', opts: [
        { id: 'cubicle', name: '工位隔断' }, { id: 'meeting', name: '会议室' },
        { id: 'pantry', name: '茶水间' }, { id: 'toilet', name: '厕所隔间' },
        { id: 'night', name: '加班深夜' }, { id: 'kpi', name: 'KPI 看板' }
      ]
    }
  };

  var KEYS = ['shape', 'skin', 'hair', 'brow', 'eye', 'nose', 'mouth', 'facial', 'glass', 'outfit', 'prop', 'bg'];

  function defaultCfg() {
    return {
      shape: 'round', skin: 1, hair: 'med', brow: 'angry', eye: 'tired',
      nose: 'normal', mouth: 'shout', facial: 'none', glass: 'gold',
      outfit: 'suit', prop: 'coffee', bg: 'cubicle',
      name: '王总', taunt: '这个需求很简单'
    };
  }
  function fixCfg(c) {
    var d = defaultCfg();
    for (var k in d) if (c[k] === undefined) c[k] = d[k];
    return c;
  }
  function randomCfg() {
    var c = defaultCfg();
    KEYS.forEach(function (k) {
      var o = PARTS[k].opts;
      c[k] = o[(Math.random() * o.length) | 0].id;
    });
    return c;
  }

  // ============ 表情系统 ============
  // 五官参数：browY 上移量 / browTilt 正=内侧下压(怒) 负=内侧上扬(苦)
  // eyeOpen 睁眼 0~1 / eyeWide 瞳孔缩小(惊) / tear 泪 / blush 脸红 / sweat 汗
  function baseExpr() {
    return {
      browY: 0, browTilt: 0, browW: 1,
      eyeOpen: 0.85, eyeWide: 0, lookX: 0, lookY: 0,
      shut: 0,          // 0 无 / 1 ^ ^ 弧线 / 2 > < 叉
      mouthOpen: 0, mouthCurve: 0, mouthW: 1, tremble: 0, tongue: 0,
      tear: 0, blush: 0, sweat: 0, dizzy: 0, angry: 0
    };
  }
  var EXPRS = {
    idle: {},
    smug: { browY: 0.18, browTilt: -0.25, eyeOpen: 0.5, mouthOpen: 0, mouthCurve: 0.55, mouthW: 0.9 },
    taunt: { browY: 0.3, browTilt: -0.3, eyeOpen: 0.42, mouthOpen: 0.16, mouthCurve: 0.7, mouthW: 0.95 },
    angry: { browY: -0.22, browTilt: 0.95, eyeOpen: 1, eyeWide: 0.1, mouthOpen: 0.2, mouthCurve: -0.35, angry: 1, blush: 0.3 },
    pain: { browY: 0.42, browTilt: -0.85, shut: 2, eyeOpen: 0.05, mouthOpen: 0.95, mouthCurve: -0.2, mouthW: 1.25, tremble: 0.5, sweat: 1 },
    shock: { browY: 0.6, browTilt: -0.5, eyeOpen: 1, eyeWide: 0.85, mouthOpen: 0.8, mouthW: 0.72, sweat: 0.8 },
    plead: { browY: 0.38, browTilt: -1, eyeOpen: 0.55, tear: 1, mouthOpen: 0.35, mouthCurve: -0.7, tremble: 0.7, sweat: 0.6 },
    cry: { browY: 0.3, browTilt: -0.95, shut: 1, eyeOpen: 0.05, tear: 1, mouthOpen: 1, mouthCurve: -0.6, mouthW: 1.2, tremble: 0.6, sweat: 0.5 },
    dizzy: { browY: 0.1, browTilt: -0.2, eyeOpen: 0.6, dizzy: 1, mouthOpen: 0.4, mouthCurve: -0.3, mouthW: 1.1, tremble: 0.4 },
    dead: { browY: 0.45, browTilt: -0.6, shut: 2, eyeOpen: 0, mouthOpen: 0.55, mouthCurve: -0.5, mouthW: 0.85, tongue: 0.5 }
  };
  function exprOf(id) {
    var e = baseExpr(), d = EXPRS[id] || EXPRS.idle;
    for (var k in d) e[k] = d[k];
    return e;
  }
  function blend(a, b, t) {
    var e = {};
    for (var k in a) e[k] = lerp(a[k], b[k], t);
    return e;
  }
  /** 阶段表情 + 受击脉冲 */
  function makeExpr(id, hit, hitKind) {
    var e = exprOf(id);
    if (hit > 0.02) e = blend(e, exprOf(hitKind || 'pain'), clamp(hit, 0, 1));
    return e;
  }

  // ============ 头部轮廓 ============
  function headShape(c, shape) {
    switch (shape) {
      case 'square': rr(c, -92, -96, 184, 192, 34); return { rx: 92, ry: 96, top: -96, chin: 96 };
      case 'long': ell(c, 0, 0, 86, 116); return { rx: 86, ry: 116, top: -116, chin: 116 };
      case 'flat': ell(c, 0, 0, 122, 94); return { rx: 122, ry: 94, top: -94, chin: 94 };
      case 'tri':
        c.beginPath(); c.moveTo(-100, -70);
        c.bezierCurveTo(-100, -124, 100, -124, 100, -70);
        c.bezierCurveTo(96, 12, 42, 110, 0, 114);
        c.bezierCurveTo(-42, 110, -96, 12, -100, -70);
        c.closePath(); return { rx: 100, ry: 110, top: -104, chin: 114 };
      case 'egg':
        c.beginPath(); c.moveTo(0, -110);
        c.bezierCurveTo(62, -110, 100, -52, 100, 8);
        c.bezierCurveTo(100, 70, 56, 108, 0, 108);
        c.bezierCurveTo(-56, 108, -100, 70, -100, 8);
        c.bezierCurveTo(-100, -52, -62, -110, 0, -110);
        c.closePath(); return { rx: 100, ry: 108, top: -110, chin: 108 };
      default: ell(c, 0, 0, 104, 100); return { rx: 104, ry: 100, top: -100, chin: 100 };
    }
  }

  // ============ 身体 / 服装 ============
  var OUTFIT_COLOR = {
    shirt: '#F2F4F8', suit: '#2F3A52', grid: '#5C7FA8', hoodie: '#8C6FB1', tee: '#E8836B', vest: '#C8A15A'
  };
  function drawBody(c, id, e) {
    var col = OUTFIT_COLOR[id] || '#F2F4F8';
    var dark = 'rgba(0,0,0,.16)';

    // 手臂 / 袖子
    [-1, 1].forEach(function (s) {
      c.save();
      c.beginPath();
      c.moveTo(s * 78, 104);
      c.quadraticCurveTo(s * 168, 132, s * 176, 300);
      c.lineTo(s * 96, 300);
      c.quadraticCurveTo(s * 104, 190, s * 66, 132);
      c.closePath();
      c.fillStyle = col; c.fill();
      c.strokeStyle = dark; c.lineWidth = 6; c.stroke();
      c.restore();
    });

    // 躯干
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(-64, 86);
    c.quadraticCurveTo(-100, 96, -152, 132);
    c.lineTo(-152, 300); c.lineTo(152, 300);
    c.lineTo(152, 132);
    c.quadraticCurveTo(100, 96, 64, 86);
    c.closePath(); c.fill();
    // 立体阴影（右侧）
    c.save(); c.clip();
    var g = c.createLinearGradient(-150, 0, 150, 0);
    g.addColorStop(0, 'rgba(255,255,255,.16)');
    g.addColorStop(0.55, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(0,0,0,.22)');
    c.fillStyle = g; c.fillRect(-160, 80, 320, 240);
    c.restore();

    // 领口
    c.fillStyle = 'rgba(0,0,0,.18)';
    c.beginPath(); c.moveTo(-42, 86); c.lineTo(0, 146); c.lineTo(42, 86); c.closePath(); c.fill();

    if (id === 'suit') {
      c.fillStyle = '#F7F7FA';
      c.beginPath(); c.moveTo(-30, 88); c.lineTo(0, 156); c.lineTo(30, 88); c.lineTo(8, 84); c.lineTo(0, 110); c.lineTo(-8, 84); c.closePath(); c.fill();
      c.fillStyle = '#C0392B';
      c.beginPath(); c.moveTo(-9, 124); c.lineTo(9, 124); c.lineTo(15, 158); c.lineTo(0, 262); c.lineTo(-15, 158); c.closePath(); c.fill();
      c.fillStyle = '#A93024';
      c.beginPath(); c.moveTo(0, 128); c.lineTo(9, 124); c.lineTo(15, 158); c.lineTo(0, 170); c.closePath(); c.fill();
      c.fillStyle = '#F5C542'; rr(c, -10, 116, 20, 12, 3); c.fill();
      // 口袋
      c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(-104, 196); c.lineTo(-46, 196); c.lineTo(-46, 232); c.lineTo(-104, 232); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(46, 196); c.lineTo(104, 196); c.lineTo(104, 232); c.lineTo(46, 232); c.closePath(); c.stroke();
    } else if (id === 'grid') {
      c.save(); c.beginPath();
      c.moveTo(-64, 86); c.quadraticCurveTo(-100, 96, -152, 132); c.lineTo(-152, 300); c.lineTo(152, 300); c.lineTo(152, 132);
      c.quadraticCurveTo(100, 96, 64, 86); c.closePath(); c.clip();
      c.strokeStyle = 'rgba(255,255,255,.32)'; c.lineWidth = 5;
      for (var i = -170; i <= 170; i += 36) { c.beginPath(); c.moveTo(i, 90); c.lineTo(i * 1.15, 300); c.stroke(); }
      for (var j = 100; j <= 300; j += 36) { c.beginPath(); c.moveTo(-160, j); c.lineTo(160, j); c.stroke(); }
      c.restore();
      c.fillStyle = '#F7F7FA';
      c.beginPath(); c.moveTo(-26, 88); c.lineTo(0, 132); c.lineTo(26, 88); c.closePath(); c.fill();
    } else if (id === 'hoodie') {
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 6; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, 152); c.lineTo(0, 226); c.stroke();
      c.beginPath(); c.arc(0, 100, 52, 0.12 * Math.PI, 0.88 * Math.PI); c.stroke();
      c.fillStyle = 'rgba(0,0,0,.18)';
      [-1, 1].forEach(function (s) { rr(c, s * 60 - 16, 206, 32, 54, 12); c.fill(); });
    } else if (id === 'tee') {
      c.fillStyle = 'rgba(0,0,0,.55)'; c.font = 'bold 40px sans-serif'; c.textAlign = 'center';
      c.fillText('社畜', 0, 200);
      c.fillStyle = 'rgba(0,0,0,.35)'; c.font = 'bold 20px sans-serif';
      c.fillText('NO.996', 0, 232);
    } else if (id === 'vest') {
      c.fillStyle = 'rgba(0,0,0,.14)'; rr(c, -18, 96, 36, 200, 6); c.fill();
      c.fillStyle = '#8F7038';
      for (var b = 0; b < 5; b++) { c.beginPath(); c.arc(0, 118 + b * 38, 6, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#F7F7FA';
      c.beginPath(); c.moveTo(-28, 88); c.lineTo(0, 140); c.lineTo(28, 88); c.closePath(); c.fill();
    } else {
      c.fillStyle = '#4C6EF5';
      c.beginPath(); c.moveTo(-9, 118); c.lineTo(9, 118); c.lineTo(13, 150); c.lineTo(0, 214); c.lineTo(-13, 150); c.closePath(); c.fill();
      c.fillStyle = '#F7F7FA';
      c.beginPath(); c.moveTo(-28, 88); c.lineTo(0, 138); c.lineTo(28, 88); c.closePath(); c.fill();
      c.fillStyle = 'rgba(0,0,0,.12)';
      for (var n = 0; n < 4; n++) { c.beginPath(); c.arc(0, 168 + n * 34, 5, 0, Math.PI * 2); c.fill(); }
    }
  }

  // ============ 头发 ============
  function drawHair(c, id, h, color, mess) {
    var rx = h.rx, ry = h.ry, top = h.top;
    c.fillStyle = color; c.strokeStyle = color; c.lineCap = 'round';
    var shake = mess * 1;
    switch (id) {
      case 'bald':
        c.fillStyle = 'rgba(255,255,255,.22)';
        c.beginPath(); c.ellipse(-rx * 0.34, top + ry * 0.26, 30, 16, -0.5, 0, Math.PI * 2); c.fill();
        break;
      case 'med':
        // 头顶一圈稀疏带 + 两鬓，贴合头轮廓
        c.lineWidth = 30;
        c.beginPath(); c.ellipse(0, 8, rx * 0.97, ry * 1.0, 0, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
        [-1, 1].forEach(function (s) {
          c.beginPath(); c.ellipse(s * rx * 0.93, 26, 13, 30, 0, 0, Math.PI * 2); c.fill();
        });
        // 几根倔强 survivor
        c.lineWidth = 5;
        for (var i = 0; i < 5; i++) {
          var x0 = -44 + i * 22;
          c.beginPath(); c.moveTo(x0, top + 6);
          c.quadraticCurveTo(x0 + shake * 26, top - 16, x0 + shake * 40, top - 30);
          c.stroke();
        }
        break;
      case 'short':
        c.beginPath(); c.ellipse(0, top + ry * 0.36, rx * 0.99, ry * 0.62, 0, Math.PI, Math.PI * 2); c.fill();
        c.fillRect(-rx * 0.99, top + ry * 0.3, rx * 1.98, ry * 0.2);
        break;
      case 'back':
        c.beginPath(); c.ellipse(0, top + ry * 0.34, rx * 1.0, ry * 0.66, 0, Math.PI, Math.PI * 2); c.fill();
        c.fillRect(-rx, top + ry * 0.28, rx * 2, ry * 0.16);
        c.lineWidth = 7;
        for (var b = -3; b <= 3; b++) {
          c.beginPath(); c.moveTo(b * 20, top + ry * 0.3);
          c.lineTo(b * 26 + shake * 18, top + ry * 0.02); c.stroke();
        }
        c.fillStyle = 'rgba(255,255,255,.18)';
        c.beginPath(); c.ellipse(-rx * 0.36, top + ry * 0.2, 28, 12, -0.35, 0, Math.PI * 2); c.fill();
        break;
      case 'afro':
        for (var a = 0; a < 24; a++) {
          var ang = Math.PI * 1.02 + Math.PI * 0.96 * (a / 23);
          var px = Math.cos(ang) * rx * (1.12 + mess * 0.16), py = top + ry * 0.42 + Math.sin(ang) * ry * (0.95 + mess * 0.14);
          ell(c, px, py, 30, 30); c.fill();
        }
        break;
      case 'bun':
        c.beginPath(); c.ellipse(0, top + ry * 0.38, rx * 0.98, ry * 0.6, 0, Math.PI, Math.PI * 2); c.fill();
        ell(c, shake * 22, top - 34 + shake * 10, 34, 34); c.fill();
        c.strokeStyle = '#C0392B'; c.lineWidth = 8;
        c.beginPath(); c.arc(0, top - 26, 26, 0.2, Math.PI * 1.8); c.stroke();
        break;
      case 'long':
        c.beginPath(); c.ellipse(0, top + ry * 0.36, rx * 1.02, ry * 0.68, 0, Math.PI, Math.PI * 2); c.fill();
        rr(c, -rx * 1.06 - shake * 10, top + ry * 0.2, rx * 0.5, ry * 2.0, 22); c.fill();
        rr(c, rx * 0.56 + shake * 10, top + ry * 0.2, rx * 0.5, ry * 2.0, 22); c.fill();
        break;
      case 'mohawk':
        c.beginPath(); c.moveTo(-rx * 0.3, top + ry * 0.3);
        c.quadraticCurveTo(shake * 40, top - ry * 1.05, rx * 0.3, top + ry * 0.3); c.closePath(); c.fill();
        break;
      case 'curly':
        for (var d = 0; d < 15; d++) {
          var an = Math.PI + Math.PI * (d / 14);
          ell(c, Math.cos(an) * rx * (0.85 + mess * 0.12), top + ry * 0.42 + Math.sin(an) * ry * (0.72 + mess * 0.12), 22, 22); c.fill();
        }
        c.fillRect(-rx * 0.9, top + ry * 0.2, rx * 1.8, ry * 0.3);
        break;
      case 'helmet':
        c.beginPath(); c.ellipse(0, top + ry * 0.4, rx * 1.04, ry * 0.78, 0, Math.PI, Math.PI * 2); c.fill();
        c.fillRect(-rx * 1.04, top + ry * 0.34, rx * 2.08, ry * 0.14);
        c.fillStyle = 'rgba(255,255,255,.22)';
        c.beginPath(); c.ellipse(-rx * 0.4, top + ry * 0.16, 26, 14, -0.4, 0, Math.PI * 2); c.fill();
        break;
    }
    // 受击炸毛：飞出的发丝
    if (mess > 0.15) {
      c.strokeStyle = color; c.lineWidth = 4; c.lineCap = 'round';
      for (var s = 0; s < 7; s++) {
        var aa = -Math.PI * 0.9 + Math.PI * 0.8 * (s / 6);
        var sx = Math.cos(aa) * rx * 0.9, sy = top + Math.sin(aa) * ry * 0.5;
        c.beginPath(); c.moveTo(sx, sy);
        c.quadraticCurveTo(sx + Math.cos(aa) * 26 * mess, sy + Math.sin(aa) * 30 * mess - 12,
          sx + Math.cos(aa) * 46 * mess, sy + Math.sin(aa) * 40 * mess - 6);
        c.stroke();
      }
    }
  }

  // ============ 眉毛 ============
  function browShape(c, id, s) {
    // s = ±1 左右；d 指向鼻梁，保证左右眉镜像一致
    var x = s * 42, d = -s;
    var ix = x + d * 28, ox = x - d * 26;   // 内端点 / 外端点
    c.lineCap = 'round';
    switch (id) {
      case 'angry': // 内侧低压 —— 凶
        c.lineWidth = 11; c.beginPath(); c.moveTo(ix, 9); c.lineTo(ox, -7); c.stroke(); break;
      case 'sad':   // 内侧高抬 —— 八字苦相
        c.lineWidth = 10; c.beginPath(); c.moveTo(ix, -10); c.lineTo(ox, 10); c.stroke(); break;
      case 'thin':
        c.lineWidth = 5; c.beginPath(); c.moveTo(ix, 1); c.quadraticCurveTo(x, -8, ox, 2); c.stroke(); break;
      case 'bushy':
        c.lineWidth = 19; c.beginPath(); c.moveTo(ix + d * 2, 0); c.lineTo(ox - d * 2, -2); c.stroke(); break;
      case 'cut':
        c.lineWidth = 11;
        c.beginPath(); c.moveTo(ix, -2); c.lineTo(x + d * 2, -4); c.stroke();
        c.beginPath(); c.moveTo(x - d * 14, -6); c.lineTo(ox, -9); c.stroke();
        break;
      default:
        c.lineWidth = 11; c.beginPath(); c.moveTo(ix, 0); c.lineTo(ox, 0); c.stroke();
    }
  }
  function drawBrow(c, id, e) {
    c.save();
    c.translate(0, -40 - e.browY * 16);
    c.strokeStyle = '#2A2118';
    for (var s = -1; s <= 1; s += 2) {
      c.save();
      // browTilt>0（怒）：内侧下压；<0（苦/惊）：内侧上扬
      c.rotate(-s * e.browTilt * 0.30);
      browShape(c, id, s);
      c.restore();
    }
    c.restore();
  }

  // ============ 眼睛 ============
  function eyeBall(c, id, e, s) {
    // s = ±1（左右）。原点 = 眼睛中心
    var open = clamp(e.eyeOpen, 0, 1);
    var wide = e.eyeWide;

    if (e.dizzy > 0.5) { // 晕眩：螺旋
      c.strokeStyle = '#231A12'; c.lineWidth = 5; c.lineCap = 'round';
      c.beginPath();
      for (var a = 0; a < Math.PI * 3.2; a += 0.22) {
        var r0 = 4 + a * 4.4;
        if (a === 0) c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
        else c.lineTo(Math.cos(a) * r0, Math.sin(a) * r0);
      }
      c.stroke();
      return;
    }
    if (e.shut === 2 || (e.shut === 1 && open < 0.1)) { // 紧闭
      c.strokeStyle = '#231A12'; c.lineWidth = 6; c.lineCap = 'round';
      if (e.shut === 2) {
        c.beginPath(); c.moveTo(-18, -11); c.lineTo(18, 9); c.moveTo(-18, 9); c.lineTo(18, -11); c.stroke();
      } else {
        c.beginPath(); c.arc(0, 6, 18, Math.PI * 1.12, Math.PI * 1.88); c.stroke();
      }
      return;
    }
    if (open < 0.16) { // 眯成线
      c.strokeStyle = '#231A12'; c.lineWidth = 6; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-18, 0); c.quadraticCurveTo(0, -6, 18, 0); c.stroke();
      return;
    }

    // 眼型基础尺寸
    var w = 20, h = 16, pupil = 8;
    if (id === 'big') { w = 25; h = 23; pupil = 11; }
    else if (id === 'line') { w = 21; h = 10; pupil = 7; }
    else if (id === 'dead') { w = 21; h = 14; pupil = 6; }
    else if (id === 'money') { w = 19; h = 14; pupil = 7; }
    h *= (0.35 + 0.65 * open);
    if (e.eyeWide > 0.4) { h = Math.max(h, 22); w = Math.max(w, 23); }

    var hh = Math.min(h, 26);
    c.save();
    // 眼白
    c.beginPath(); c.ellipse(0, 0, w, hh, 0, 0, Math.PI * 2);
    c.fillStyle = '#FFFFFF'; c.fill();
    c.save(); c.clip();
    if (id === 'money') {
      c.fillStyle = '#F5C542'; c.fillRect(-w, -hh, w * 2, hh * 2);
    }
    // 虹膜 + 瞳孔（look 偏移 + 斗鸡眼）
    var lx = e.lookX * 6 + (id === 'cross' ? -s * 9 : 0);
    var ly = e.lookY * 5;
    var pr = pupil * (1 - wide * 0.45);
    c.fillStyle = id === 'money' ? '#8A6A10' : (id === 'big' ? '#4A3524' : '#3A2A1C');
    c.beginPath(); c.ellipse(lx, ly, pr, Math.min(pr, hh * 0.92), 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#141414';
    c.beginPath(); c.ellipse(lx, ly, pr * 0.52, Math.min(pr * 0.52, hh * 0.6), 0, 0, Math.PI * 2); c.fill();
    // 高光
    c.fillStyle = 'rgba(255,255,255,.92)';
    c.beginPath(); c.arc(lx - pr * 0.42, ly - pr * 0.46, Math.max(2.2, pr * 0.3), 0, Math.PI * 2); c.fill();
    if (id === 'big') {
      c.fillStyle = 'rgba(255,255,255,.6)';
      c.beginPath(); c.arc(lx + pr * 0.4, ly + pr * 0.4, pr * 0.18, 0, Math.PI * 2); c.fill();
    }
    // 上眼睑投影
    c.fillStyle = 'rgba(0,0,0,.16)';
    c.fillRect(-w, -hh, w * 2, hh * 0.4);
    c.restore();
    // 眼眶
    c.strokeStyle = '#231A12'; c.lineWidth = 3;
    c.beginPath(); c.ellipse(0, 0, w, hh, 0, 0, Math.PI * 2); c.stroke();
    // 上睫毛线
    c.lineWidth = 4.5; c.lineCap = 'round';
    c.beginPath(); c.ellipse(0, 0, w + 1, hh + 1, 0, Math.PI * 1.06, Math.PI * 1.94); c.stroke();
    c.restore();
  }
  function drawEye(c, id, e) {
    for (var s = -1; s <= 1; s += 2) {
      c.save();
      c.translate(s * 42, -6);
      if (id === 'tired') {
        c.fillStyle = 'rgba(96,112,176,.42)';
        c.beginPath(); c.ellipse(0, 15, 21, 9, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(60,70,120,.28)';
        c.beginPath(); c.ellipse(0, 12, 22, 6, 0, 0, Math.PI * 2); c.fill();
      }
      if (id === 'dead') {
        c.fillStyle = 'rgba(120,120,140,.2)';
        c.beginPath(); c.ellipse(0, 12, 22, 8, 0, 0, Math.PI * 2); c.fill();
      }
      eyeBall(c, id, e, s);
      c.restore();
    }
    // 眼泪
    if (e.tear > 0.15) {
      var t = e.tear;
      for (var k = -1; k <= 1; k += 2) {
        c.fillStyle = 'rgba(96,168,240,.85)';
        c.beginPath();
        c.moveTo(k * 42 - 9, 6);
        c.quadraticCurveTo(k * 42 - 20, 26 + 22 * t, k * 42 - 4, 30 + 34 * t);
        c.quadraticCurveTo(k * 42 + 12, 26 + 22 * t, k * 42 + 9, 6);
        c.closePath(); c.fill();
        c.fillStyle = 'rgba(255,255,255,.5)';
        c.beginPath(); c.ellipse(k * 42 - 5, 14 + 14 * t, 3, 5, 0, 0, Math.PI * 2); c.fill();
      }
      // 飞出的泪珠
      c.fillStyle = 'rgba(96,168,240,.8)';
      for (var d = 0; d < 3; d++) {
        var dx = (d === 0 ? -1 : 1) * (58 + d * 6), dy = 34 + d * 26;
        c.beginPath(); c.ellipse(dx, dy, 5, 7, 0, 0, Math.PI * 2); c.fill();
      }
    }
  }

  // ============ 鼻子 ============
  function drawNose(c, id, e) {
    var y = 18;
    c.strokeStyle = 'rgba(120,80,60,.55)';
    c.fillStyle = 'rgba(120,80,60,.35)';
    c.lineWidth = 5; c.lineCap = 'round';
    switch (id) {
      case 'bulb':
        c.fillStyle = 'rgba(196,86,72,.45)';
        c.beginPath(); c.ellipse(0, y + 6, 19, 16, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(120,60,50,.5)'; c.lineWidth = 4;
        c.beginPath(); c.arc(-6, y + 8, 7, 0.2, Math.PI * 1.4); c.stroke();
        c.beginPath(); c.arc(7, y + 9, 7, 0.4, Math.PI * 1.5); c.stroke();
        break;
      case 'hook':
        c.beginPath(); c.moveTo(0, y - 16);
        c.quadraticCurveTo(14, y + 2, 4, y + 14);
        c.quadraticCurveTo(-8, y + 16, -12, y + 6); c.stroke();
        c.fillStyle = 'rgba(120,80,60,.3)';
        c.beginPath(); c.ellipse(-6, y + 8, 6, 4, 0, 0, Math.PI * 2); c.fill();
        break;
      case 'flat':
        c.beginPath(); c.moveTo(-8, y - 10); c.lineTo(-8, y + 6); c.stroke();
        c.beginPath(); c.moveTo(8, y - 10); c.lineTo(8, y + 6); c.stroke();
        c.fillStyle = 'rgba(120,80,60,.3)';
        c.beginPath(); c.ellipse(0, y + 8, 11, 5, 0, 0, Math.PI * 2); c.fill();
        break;
      case 'long':
        c.beginPath(); c.moveTo(0, y - 14); c.quadraticCurveTo(10, y + 16, 12, y + 34); c.stroke();
        c.beginPath(); c.moveTo(-12, y + 32); c.quadraticCurveTo(0, y + 40, 12, y + 32); c.stroke();
        break;
      case 'pig':
        c.fillStyle = 'rgba(120,80,60,.4)';
        c.beginPath(); c.ellipse(0, y + 6, 17, 12, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#3A2A1C';
        c.beginPath(); c.ellipse(-6, y + 4, 4, 5, 0, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(6, y + 4, 4, 5, 0, 0, Math.PI * 2); c.fill();
        break;
      default:
        c.beginPath(); c.moveTo(0, y - 12); c.quadraticCurveTo(9, y + 4, -7, y + 10); c.stroke();
        c.fillStyle = 'rgba(120,80,60,.28)';
        c.beginPath(); c.ellipse(-7, y + 11, 7, 4, 0, 0, Math.PI * 2); c.fill();
    }
    // 呼吸/喷气（受击时）
    if (e.mouthOpen > 0.6 && e.sweat > 0.5) {
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 4;
      [-1, 1].forEach(function (s) {
        c.beginPath(); c.moveTo(s * 12, y + 14);
        c.quadraticCurveTo(s * 26, y + 20, s * 34, y + 10); c.stroke();
      });
    }
  }

  // ============ 嘴巴 ============
  function drawMouth(c, id, e) {
    var y = 48;
    var open = clamp(e.mouthOpen, 0, 1);
    var curve = e.mouthCurve;
    var w = 26 * e.mouthW;
    var tr = e.tremble ? Math.sin(Date.now() / 42) * 2.4 * e.tremble : 0;

    c.save();
    c.translate(0, tr);
    c.lineCap = 'round';

    // 张嘴（口）
    if (open > 0.12) {
      var oh = open * 30;
      c.save();
      c.beginPath();
      c.moveTo(-w, y - curve * 6);
      c.quadraticCurveTo(0, y - oh * 1.1 - curve * 10, w, y - curve * 6);
      c.quadraticCurveTo(0, y + oh * 1.5 - curve * 8, -w, y - curve * 6);
      c.closePath();
      c.fillStyle = '#5B2020'; c.fill();
      c.save(); c.clip();
      // 舌头
      if (open > 0.5 || e.tongue > 0.2) {
        c.fillStyle = '#C4506A';
        c.beginPath(); c.ellipse(0, y + oh * 0.75, w * 0.62, oh * 0.62, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,255,255,.22)';
        c.beginPath(); c.ellipse(-w * 0.2, y + oh * 0.5, w * 0.24, oh * 0.18, 0, 0, Math.PI * 2); c.fill();
      }
      // 牙齿
      c.fillStyle = '#FFFFFF';
      var tw = w * 1.5, th = Math.min(11, oh * 0.5);
      c.fillRect(-tw / 2, y - oh * 0.55 - curve * 4, tw, th);
      c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 2;
      for (var i = -3; i <= 3; i++) {
        c.beginPath(); c.moveTo(i * (tw / 7), y - oh * 0.55 - curve * 4);
        c.lineTo(i * (tw / 7), y - oh * 0.55 - curve * 4 + th); c.stroke();
      }
      c.restore();
      c.restore();
      // 嘴唇轮廓
      c.strokeStyle = '#8A3A34'; c.lineWidth = 4;
      c.beginPath();
      c.moveTo(-w, y - curve * 6);
      c.quadraticCurveTo(0, y - oh * 1.1 - curve * 10, w, y - curve * 6);
      c.quadraticCurveTo(0, y + oh * 1.5 - curve * 8, -w, y - curve * 6);
      c.stroke();
      if (id === 'gold') {
        c.fillStyle = '#F5C542'; rr(c, -w * 0.55, y - oh * 0.5 - curve * 4, 12, 12, 2); c.fill();
        rr(c, w * 0.18, y - oh * 0.5 - curve * 4, 12, 12, 2); c.fill();
      }
      if (id === 'teeth') {
        c.fillStyle = '#fff';
        rr(c, -9, y + oh * 0.9 - curve * 6, 8, 14, 2); c.fill();
        rr(c, 3, y + oh * 0.9 - curve * 6, 8, 14, 2); c.fill();
      }
    } else {
      // 闭嘴：曲线
      c.strokeStyle = '#231A12'; c.lineWidth = 6;
      c.beginPath();
      c.moveTo(-w, y + curve * 4);
      c.quadraticCurveTo(0, y - curve * 16, w, y + curve * 4);
      c.stroke();
      if (id === 'gold') {
        c.fillStyle = '#F5C542'; rr(c, -14, y - 2, 11, 12, 2); c.fill();
      }
      if (id === 'teeth') {
        c.fillStyle = '#fff'; rr(c, -12, y + 2, 22, 9, 2); c.fill();
      }
    }
    // 口水/白沫（惨）
    if (e.dizzy > 0.5 || open > 0.85) {
      c.fillStyle = 'rgba(255,255,255,.75)';
      c.beginPath(); c.arc(w + 8, y + 6, 6, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(w + 16, y + 16, 4, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  // ============ 胡须 ============
  function drawFacial(c, id, e) {
    if (id === 'none') return;
    c.fillStyle = 'rgba(40,30,22,.88)';
    c.strokeStyle = 'rgba(40,30,22,.88)';
    c.lineCap = 'round';
    var m = e.mouthOpen > 0.4 ? -4 : 0;
    if (id === 'goatee') {
      c.beginPath(); c.ellipse(0, 78 + m, 16, 20, 0, 0, Math.PI * 2); c.fill();
      c.lineWidth = 9;
      c.beginPath(); c.arc(0, 56, 22, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    } else if (id === 'eight') {
      c.lineWidth = 10;
      [-1, 1].forEach(function (s) {
        c.beginPath(); c.moveTo(s * 4, 30);
        c.quadraticCurveTo(s * 30, 36, s * 40, 58 + m); c.stroke();
      });
    } else if (id === 'full') {
      // 两颊 + 下巴 + 上唇，中间留出嘴巴
      c.beginPath(); c.ellipse(-40, 50, 24, 34, -0.15, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(40, 50, 24, 34, 0.15, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(0, 80 + m, 32, 22, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(0, 30, 34, 13, 0, 0, Math.PI * 2); c.fill();
    } else if (id === 'stubble') {
      // 黄金角均匀分布，保证每帧一致不闪烁
      c.fillStyle = 'rgba(60,52,58,.30)';
      c.beginPath(); c.ellipse(0, 52, 52, 34, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(40,34,40,.20)';
      for (var i = 0; i < 44; i++) {
        var a = i * 2.39996, r = Math.sqrt((i + 0.5) / 44);
        c.beginPath(); c.arc(Math.cos(a) * 50 * r, 52 + Math.sin(a) * 32 * r, 1.9, 0, Math.PI * 2); c.fill();
      }
    } else if (id === 'hair') {
      c.strokeStyle = '#2A2118'; c.lineWidth = 4;
      [-1, 1].forEach(function (s) {
        c.beginPath(); c.moveTo(s * 5, 22);
        c.quadraticCurveTo(s * 16, 12, s * 22, 4); c.stroke();
        c.beginPath(); c.moveTo(s * 8, 24);
        c.quadraticCurveTo(s * 20, 16, s * 28, 12); c.stroke();
      });
    }
  }

  // ============ 眼镜 ============
  function drawGlass(c, id, e) {
    c.lineWidth = 6;
    var cracked = e.shut === 2 && e.sweat > 0.6; // 挨打时镜片裂纹
    if (id === 'round' || id === 'gold') {
      var col = id === 'gold' ? '#D9A93A' : '#3A3A3A';
      c.strokeStyle = col;
      [-42, 42].forEach(function (x) {
        if (id === 'gold') { rr(c, x - 34, -32, 68, 52, 13); c.stroke(); }
        else { c.beginPath(); c.arc(x, -6, 31, 0, Math.PI * 2); c.stroke(); }
      });
      c.beginPath(); c.moveTo(-10, -8); c.lineTo(10, -8); c.stroke();
      // 镜腿
      c.beginPath(); c.moveTo(-74, -12); c.lineTo(-96, -4); c.stroke();
      c.beginPath(); c.moveTo(74, -12); c.lineTo(96, -4); c.stroke();
      c.fillStyle = id === 'gold' ? 'rgba(255,255,255,.14)' : 'rgba(180,220,255,.18)';
      [-42, 42].forEach(function (x) {
        if (id === 'gold') { rr(c, x - 31, -29, 62, 46, 11); c.fill(); }
        else { ell(c, x, -6, 28, 28); c.fill(); }
      });
      if (cracked) {
        c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 2.5;
        c.beginPath(); c.moveTo(-52, -30); c.lineTo(-40, -10); c.lineTo(-48, 8); c.lineTo(-34, 18); c.stroke();
        c.beginPath(); c.moveTo(-40, -10); c.lineTo(-22, -16); c.stroke();
        c.beginPath(); c.moveTo(-40, -10); c.lineTo(-56, 4); c.stroke();
      }
    } else if (id === 'sun') {
      c.fillStyle = '#1C1C22'; rr(c, -84, -28, 168, 50, 15); c.fill();
      c.fillStyle = 'rgba(255,255,255,.16)'; rr(c, -76, -24, 66, 17, 6); c.fill();
      c.strokeStyle = '#1C1C22'; c.lineWidth = 6;
      c.beginPath(); c.moveTo(-84, -12); c.lineTo(-102, -6); c.stroke();
      c.beginPath(); c.moveTo(84, -12); c.lineTo(102, -6); c.stroke();
    } else if (id === 'patch') {
      c.fillStyle = '#22222A'; rr(c, -76, -36, 76, 60, 13); c.fill();
      c.strokeStyle = '#22222A'; c.lineWidth = 8;
      c.beginPath(); c.moveTo(-76, -24); c.lineTo(98, -44); c.stroke();
      c.beginPath(); c.moveTo(-76, -6); c.lineTo(60, 6); c.stroke();
    } else if (id === 'band') {
      c.save(); c.translate(-30, -6); c.rotate(-0.45);
      c.fillStyle = '#F3EDE2'; rr(c, -56, -19, 112, 38, 4); c.fill();
      c.strokeStyle = '#D8CFC0'; c.lineWidth = 2;
      for (var i = -42; i <= 42; i += 14) { c.beginPath(); c.moveTo(i, -19); c.lineTo(i - 8, 19); c.stroke(); }
      // 渗血
      c.fillStyle = 'rgba(190,50,50,.5)';
      c.beginPath(); c.ellipse(6, 0, 14, 8, 0, 0, Math.PI * 2); c.fill();
      c.restore();
    }
  }

  // ============ 脸部细节（皱纹 / 立体 / 油光） ============
  function drawFaceDetail(c, cfg, h, e, pain) {
    c.save();
    headShape(c, cfg.shape); c.clip();
    // 立体阴影
    var g = c.createRadialGradient(-h.rx * 0.4, -h.ry * 0.35, h.ry * 0.15, 0, 0, h.rx * 1.25);
    g.addColorStop(0, 'rgba(255,255,255,.24)');
    g.addColorStop(0.55, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(0,0,0,.26)');
    c.fillStyle = g; c.fillRect(-h.rx * 1.2, -h.ry * 1.2, h.rx * 2.4, h.ry * 2.4);

    // 抬头纹（痛苦/年老时明显）
    var wr = clamp(0.25 + pain * 0.6 + (cfg.hair === 'med' || cfg.hair === 'bald' ? 0.3 : 0), 0, 1);
    if (wr > 0.3) {
      c.strokeStyle = 'rgba(120,86,66,' + (0.20 * wr) + ')'; c.lineWidth = 3.5; c.lineCap = 'round';
      for (var i = 0; i < 3; i++) {
        c.beginPath();
        c.moveTo(-52, -64 - i * 15);
        c.quadraticCurveTo(0, -72 - i * 15 - e.browY * 6, 52, -64 - i * 15);
        c.stroke();
      }
    }
    // 法令纹
    var nl = clamp(0.2 + pain * 0.7, 0, 1);
    c.strokeStyle = 'rgba(120,86,66,' + (0.18 + 0.16 * nl) + ')'; c.lineWidth = 4;
    [-1, 1].forEach(function (s) {
      c.beginPath(); c.moveTo(s * 22, 24);
      c.quadraticCurveTo(s * 46, 40, s * 40, 64); c.stroke();
    });
    // 鱼尾纹
    c.strokeStyle = 'rgba(120,86,66,.16)'; c.lineWidth = 2.5;
    [-1, 1].forEach(function (s) {
      for (var k = 0; k < 3; k++) {
        c.beginPath(); c.moveTo(s * 62, -14 + k * 9);
        c.lineTo(s * (78 + k * 3), -20 + k * 12); c.stroke();
      }
    });
    // 双下巴（圆脸 / 大饼脸）
    if (cfg.shape === 'round' || cfg.shape === 'flat') {
      c.strokeStyle = 'rgba(120,86,66,.22)'; c.lineWidth = 5;
      c.beginPath(); c.arc(0, h.ry * 0.55, h.rx * 0.62, 0.25 * Math.PI, 0.75 * Math.PI); c.stroke();
    }
    // 油光/汗光
    if (cfg.hair === 'back' || cfg.hair === 'helmet' || e.sweat > 0.4) {
      c.fillStyle = 'rgba(255,255,255,' + (0.10 + 0.12 * e.sweat) + ')';
      c.beginPath(); c.ellipse(-h.rx * 0.45, -h.ry * 0.45, 26, 14, -0.5, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(h.rx * 0.42, -h.ry * 0.3, 16, 9, -0.4, 0, Math.PI * 2); c.fill();
    }
    c.restore();

    // 腮红 / 羞辱红
    var bl = clamp(0.22 + e.blush * 0.5 + pain * 0.18, 0, 0.72);
    c.fillStyle = 'rgba(233,120,120,' + bl + ')';
    ell(c, -h.rx * 0.6, 30, 22, 13); c.fill();
    ell(c, h.rx * 0.6, 30, 22, 13); c.fill();

    // 愤怒井字号
    if (e.angry > 0.4) {
      c.save();
      c.strokeStyle = 'rgba(200,60,60,.75)'; c.lineWidth = 5; c.lineCap = 'round';
      c.translate(h.rx * 0.52, -h.ry * 0.62);
      for (var a = 0; a < 4; a++) {
        var ang = a * Math.PI / 2 + 0.4;
        c.beginPath();
        c.moveTo(Math.cos(ang) * 8, Math.sin(ang) * 8);
        c.lineTo(Math.cos(ang) * 24, Math.sin(ang) * 24);
        c.stroke();
      }
      c.restore();
    }
  }

  // ============ 伤痕 ============
  function drawDamage(c, list) {
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      c.save(); c.translate(b.x, b.y); c.rotate(b.rot || 0);
      if (b.t === 'swell') {
        c.fillStyle = 'rgba(214,120,110,.5)';
        c.beginPath(); c.ellipse(0, 0, b.r, b.r * 0.86, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(240,170,160,.55)';
        c.beginPath(); c.ellipse(-b.r * 0.2, -b.r * 0.2, b.r * 0.5, b.r * 0.4, 0, 0, Math.PI * 2); c.fill();
      } else if (b.t === 'band') {
        c.fillStyle = '#F6E3C0';
        rr(c, -b.r * 1.5, -b.r * 0.5, b.r * 3, b.r, b.r * 0.28); c.fill();
        c.fillStyle = '#EBD3A8'; rr(c, -b.r * 0.42, -b.r * 0.5, b.r * 0.84, b.r, b.r * 0.2); c.fill();
        c.strokeStyle = '#C9B48A'; c.lineWidth = 1.5;
        c.strokeRect(-b.r * 1.5, -b.r * 0.5, b.r * 3, b.r);
      } else if (b.t === 'cut') {
        c.strokeStyle = 'rgba(150,30,40,.8)'; c.lineWidth = 4; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-b.r, -b.r * 0.4); c.lineTo(b.r * 0.6, b.r * 0.5); c.stroke();
        c.fillStyle = 'rgba(170,40,40,.7)';
        c.beginPath(); c.arc(0, 0, 3, 0, Math.PI * 2); c.fill();
      } else {
        var a = 0.16 + 0.12 * (b.r / 20);
        c.fillStyle = 'rgba(138,48,68,' + a + ')';
        c.beginPath(); c.ellipse(0, 0, b.r, b.r * 0.72, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(96,30,50,' + (a * 0.7) + ')';
        c.beginPath(); c.ellipse(b.r * 0.2, b.r * 0.12, b.r * 0.45, b.r * 0.3, 0, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    }
  }

  // ============ 汗 / 血 ============
  function drawFluid(c, o, e, pain) {
    // 汗滴
    if (o.sweat) {
      c.fillStyle = 'rgba(120,190,240,.9)';
      o.sweat.forEach(function (p) {
        c.save(); c.translate(p.x, p.y);
        c.beginPath();
        c.moveTo(0, -p.r * 1.4);
        c.quadraticCurveTo(p.r, p.r * 0.2, 0, p.r * 1.35);
        c.quadraticCurveTo(-p.r, p.r * 0.2, 0, -p.r * 1.4);
        c.fill();
        c.restore();
      });
    }
    if (e.sweat > 0.5) {
      c.fillStyle = 'rgba(120,190,240,.75)';
      for (var i = 0; i < 4; i++) {
        var sx = (i % 2 ? 1 : -1) * (96 + i * 8), sy = -70 + i * 42;
        c.beginPath();
        c.moveTo(sx, sy - 10); c.quadraticCurveTo(sx + 7, sy + 3, sx, sy + 11);
        c.quadraticCurveTo(sx - 7, sy + 3, sx, sy - 10); c.fill();
      }
    }
    // 鼻血（重伤）
    if (pain > 0.72) {
      c.strokeStyle = 'rgba(200,40,40,.85)'; c.lineWidth = 6; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-8, 30); c.lineTo(-11, 62); c.stroke();
      c.beginPath(); c.moveTo(8, 30); c.lineTo(11, 58); c.stroke();
      c.fillStyle = 'rgba(200,40,40,.8)';
      c.beginPath(); c.ellipse(-11, 70, 5, 8, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(11, 66, 4, 7, 0, 0, Math.PI * 2); c.fill();
    }
  }

  // ============ 道具 ============
  function drawProp(c, id) {
    if (id === 'coffee') {
      c.fillStyle = '#F3EDE2'; rr(c, 108, 170, 56, 74, 8); c.fill();
      c.fillStyle = '#7A4B22'; rr(c, 112, 176, 48, 16, 4); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 5;
      for (var i = 0; i < 3; i++) { c.beginPath(); c.arc(126 + i * 14, 150, 10, 0.2 * Math.PI, 1.4 * Math.PI); c.stroke(); }
    } else if (id === 'cup') {
      c.fillStyle = '#9AA3AD'; rr(c, 110, 164, 52, 84, 10); c.fill();
      c.fillStyle = '#B9C2CC'; rr(c, 114, 150, 44, 20, 6); c.fill();
      c.fillStyle = '#D94F3D'; rr(c, 118, 200, 36, 40, 6); c.fill();
      c.fillStyle = '#7BA05B'; c.font = 'bold 16px sans-serif'; c.textAlign = 'center';
      c.fillText('枸杞', 136, 226);
    } else if (id === 'badge') {
      c.strokeStyle = '#3B4E6B'; c.lineWidth = 5;
      c.beginPath(); c.moveTo(-30, 110); c.quadraticCurveTo(0, 190, 30, 110); c.stroke();
      c.fillStyle = '#F7F7FA'; rr(c, -30, 176, 60, 82, 6); c.fill();
      c.strokeStyle = '#C7CFDA'; c.lineWidth = 3; c.stroke();
      c.fillStyle = '#8A94A3'; rr(c, -18, 190, 36, 26, 4); c.fill();
      c.fillRect(-18, 226, 36, 6); c.fillRect(-18, 240, 24, 6);
    } else if (id === 'report') {
      c.fillStyle = '#F7F3E8'; rr(c, -128, 190, 70, 92, 4); c.fill();
      c.fillStyle = '#EDE6D6'; rr(c, -122, 196, 70, 92, 4); c.fill();
      c.strokeStyle = '#C7BFA8'; c.lineWidth = 3; c.stroke();
      c.strokeStyle = '#C0392B'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(-116, 210); c.lineTo(-70, 210); c.stroke();
    } else if (id === 'phone') {
      c.fillStyle = '#22222A'; rr(c, 104, 186, 50, 88, 10); c.fill();
      c.fillStyle = '#4CC9F0'; rr(c, 110, 194, 38, 70, 6); c.fill();
      c.fillStyle = 'rgba(255,255,255,.55)';
      for (var k = 0; k < 3; k++) { rr(c, 114, 204 + k * 20, 30 - k * 8, 7, 3); c.fill(); }
    }
  }

  // ============ 背景 ============
  function drawBg(c, id, w, h) {
    var g = c.createLinearGradient(0, 0, 0, h);
    if (id === 'meeting') { g.addColorStop(0, '#DDE6F0'); g.addColorStop(1, '#AFC0D4'); }
    else if (id === 'pantry') { g.addColorStop(0, '#F6E7CF'); g.addColorStop(1, '#D8B98C'); }
    else if (id === 'toilet') { g.addColorStop(0, '#DCEDEA'); g.addColorStop(1, '#A9CDC7'); }
    else if (id === 'night') { g.addColorStop(0, '#2B3350'); g.addColorStop(1, '#141A2E'); }
    else if (id === 'kpi') { g.addColorStop(0, '#FFE9E2'); g.addColorStop(1, '#F2C3B4'); }
    else { g.addColorStop(0, '#EAF0F7'); g.addColorStop(1, '#C6D3E3'); }
    c.fillStyle = g; c.fillRect(0, 0, w, h);

    c.save();
    if (id === 'cubicle') {
      c.fillStyle = 'rgba(255,255,255,.35)';
      for (var i = 0; i < 6; i++) { rr(c, -40 + i * 150, h * 0.42, 110, h * 0.6, 8); c.fill(); }
    } else if (id === 'meeting') {
      c.fillStyle = 'rgba(255,255,255,.5)'; rr(c, w * 0.1, h * 0.3, w * 0.8, h * 0.22, 10); c.fill();
      c.fillStyle = 'rgba(60,80,110,.25)'; rr(c, w * 0.2, h * 0.56, w * 0.6, 26, 8); c.fill();
    } else if (id === 'night') {
      c.fillStyle = 'rgba(255,240,180,.75)';
      for (var k = 0; k < 22; k++) { ell(c, 40 + k * 36, 90 + (k % 5) * 130, 6, 10); c.fill(); }
    } else if (id === 'kpi') {
      c.fillStyle = 'rgba(220,80,60,.5)';
      for (var j = 0; j < 5; j++) { var bh = 40 + j * 34; rr(c, 50 + j * 130, h * 0.62 - bh, 80, bh, 6); c.fill(); }
    } else if (id === 'toilet') {
      c.strokeStyle = 'rgba(120,160,155,.5)'; c.lineWidth = 8;
      for (var m = 0; m < 4; m++) { c.beginPath(); c.moveTo(m * (w / 3), 0); c.lineTo(m * (w / 3), h); c.stroke(); }
    } else {
      c.fillStyle = 'rgba(255,255,255,.4)'; rr(c, w * 0.08, h * 0.5, w * 0.84, 30, 8); c.fill();
    }
    c.restore();
  }

  /**
   * 绘制角色（原点 = 头部中心）
   * o: { x,y,s, expr:'smug|angry|plead|cry|dead…', hit:0~1 受击脉冲, hitKind:'pain|shock',
   *      pain:0~1 血量越低越大, mess:0~1 头发凌乱, sq:0~1 挤压, tilt, damage:[], sweat:[] }
   */
  function drawCharacter(c, cfg, o) {
    o = o || {};
    cfg = cfg || defaultCfg();
    var s = o.s || 1;
    var pain = clamp(o.pain || 0, 0, 1);
    var mess = clamp(o.mess || 0, 0, 1);
    var e = makeExpr(o.expr || 'smug', o.hit || 0, o.hitKind || 'pain');
    var sq = clamp(o.sq || 0, 0, 1);
    var skin = SKINS[cfg.skin] || SKINS[1];

    c.save();
    c.translate(o.x || 0, o.y || 0);
    c.rotate(o.tilt || 0);
    c.scale(s * (1 + 0.13 * sq), s * (1 - 0.11 * sq));

    drawBody(c, cfg.outfit, e);

    // 脖子
    c.fillStyle = skin; rr(c, -34, 56, 68, 66, 16); c.fill();
    c.fillStyle = 'rgba(0,0,0,.14)'; rr(c, -34, 56, 68, 26, 12); c.fill();

    // 头
    var h = headShape(c, cfg.shape);
    c.fillStyle = skin; c.fill();
    c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 4; c.stroke();

    // 耳朵
    c.fillStyle = skin;
    ell(c, -h.rx, 8, 17, 25); c.fill(); ell(c, h.rx, 8, 17, 25); c.fill();
    c.strokeStyle = 'rgba(120,86,66,.35)'; c.lineWidth = 3;
    [-1, 1].forEach(function (s2) {
      c.beginPath(); c.arc(s2 * h.rx, 8, 9, s2 > 0 ? -0.7 : Math.PI + 0.7, s2 > 0 ? 0.9 : Math.PI - 0.9); c.stroke();
    });

    drawFaceDetail(c, cfg, h, e, pain);
    drawHair(c, cfg.hair, h, HAIRS[(cfg.skin + String(cfg.hair).length) % HAIRS.length], mess);
    drawBrow(c, cfg.brow, e);
    drawEye(c, cfg.eye, e);
    drawNose(c, cfg.nose, e);
    drawFacial(c, cfg.facial, e);
    drawMouth(c, cfg.mouth, e);
    drawGlass(c, cfg.glass, e);
    drawDamage(c, o.damage || o.bruises);
    drawProp(c, cfg.prop);
    drawFluid(c, o, e, pain);

    c.restore();
  }

  var api = {
    PARTS: PARTS, KEYS: KEYS, SKINS: SKINS, EXPRS: EXPRS,
    defaultCfg: defaultCfg, fixCfg: fixCfg, randomCfg: randomCfg,
    exprOf: exprOf, makeExpr: makeExpr,
    drawCharacter: drawCharacter, drawBg: drawBg, rr: rr, ell: ell, headShape: headShape
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BSLib = root.BSLib || {};
  root.BSLib.avatar = api;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));
