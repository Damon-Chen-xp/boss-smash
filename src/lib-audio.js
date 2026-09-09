/* 暴打老板 · 音效引擎
   做法：纯 JS 离线合成 PCM → 编码成 WAV → 用 HTML5 <audio> 播放（微信内置浏览器 / iOS 静音键都能响）
   微信小游戏端走同一个配方，但用 wx.createWebAudioContext() 播 AudioBuffer。
   零音频文件、零网络请求。 */
(function (root) {
  'use strict';

  var SR = 22050;

  // ---------------- 离线合成 ----------------
  function lp(buf, fc) {
    var dt = 1 / SR, rc = 1 / (2 * Math.PI * Math.max(60, fc)), a = dt / (rc + dt), y = 0;
    for (var i = 0; i < buf.length; i++) { y += a * (buf[i] - y); buf[i] = y; }
  }
  function hp(buf, fc) {
    var dt = 1 / SR, rc = 1 / (2 * Math.PI * Math.max(60, fc)), a = rc / (rc + dt), y = 0, prev = 0;
    for (var i = 0; i < buf.length; i++) { var x = buf[i]; y = a * (y + x - prev); prev = x; buf[i] = y; }
  }
  function wave(type, ph) {
    if (type === 'square') return ph < 0.5 ? 1 : -1;
    if (type === 'triangle') return 4 * Math.abs(ph - 0.5) - 1;
    if (type === 'saw') return 2 * ph - 1;
    return Math.sin(2 * Math.PI * ph);
  }

  /** voices: [{k:'osc'|'noise', type, f0, f1, filter, fc, t0, dur, vol}] */
  function render(voices, dur) {
    var n = Math.ceil(dur * SR) + 1;
    var out = new Float32Array(n);
    for (var v = 0; v < voices.length; v++) {
      var o = voices[v];
      var odur = o.dur || 0.1;
      var start = Math.floor((o.t0 || 0) * SR);
      var len = Math.ceil(odur * SR);
      if (len <= 0 || start >= n) continue;
      var tmp = new Float32Array(len), i;
      if (o.k === 'noise') {
        for (i = 0; i < len; i++) tmp[i] = Math.random() * 2 - 1;
        if (o.filter === 'lp') lp(tmp, o.fc || 1200);
        else if (o.filter === 'hp') hp(tmp, o.fc || 2200);
        else { hp(tmp, (o.fc || 2200) * 0.55); lp(tmp, (o.fc || 2200) * 1.7); }
      } else {
        var ph = 0, f0 = o.f0 || 220;
        var ratio = (o.f1 && o.f1 > 0) ? (o.f1 / f0) : 1;
        for (i = 0; i < len; i++) {
          var fr = f0 * Math.pow(ratio, i / len);
          ph += fr / SR; if (ph >= 1) ph -= Math.floor(ph);
          tmp[i] = wave(o.type || 'sine', ph);
        }
      }
      var vol = o.vol == null ? 0.2 : o.vol;
      var atk = Math.max(1, Math.floor(0.004 * SR));
      var tau = odur / 3.2;
      for (i = 0; i < len; i++) {
        var idx = start + i; if (idx >= n) break;
        var t = i / SR;
        var g = Math.exp(-t / tau) * (1 - Math.pow(t / odur, 3));
        if (g < 0) g = 0;
        if (i < atk) g *= i / atk;
        out[idx] += tmp[i] * g * vol;
      }
    }
    for (var m = 0; m < n; m++) out[m] = Math.tanh(out[m] * 1.15) * 0.9;
    return out;
  }

  // ---------------- 配方 ----------------
  var HIT_STEPS = 6;
  function hitVoices(p) {
    var v = [
      { k: 'osc', type: 'sine', f0: 195 * p, f1: 46, dur: 0.14, vol: 0.62 },
      { k: 'osc', type: 'triangle', f0: 98 * p, f1: 40, dur: 0.10, vol: 0.24 },
      { k: 'noise', filter: 'lp', fc: 1500, dur: 0.075, vol: 0.34 },
      { k: 'noise', filter: 'hp', fc: 2600 + 500 * (p - 1), dur: 0.042, vol: 0.26 }
    ];
    if (p > 1.5) v.push({ k: 'noise', filter: 'bp', fc: 3300, dur: 0.06, vol: 0.14, t0: 0.01 });
    return v;
  }
  function recipes() {
    var r = {};
    for (var i = 0; i < HIT_STEPS; i++) {
      var p = 1 + i * 0.2;
      r['hit' + i] = { dur: 0.19, voices: hitVoices(p) };
    }
    r.crit = {
      dur: 0.55, voices: [
        { k: 'osc', type: 'sine', f0: 250, f1: 55, dur: 0.22, vol: 0.65 },
        { k: 'noise', filter: 'lp', fc: 2200, dur: 0.09, vol: 0.36 },
        { k: 'noise', filter: 'hp', fc: 3200, dur: 0.14, vol: 0.28 },
        { k: 'osc', type: 'square', f0: 880, dur: 0.42, vol: 0.11 },
        { k: 'osc', type: 'triangle', f0: 1290, dur: 0.35, vol: 0.09 },
        { k: 'osc', type: 'square', f0: 1760, dur: 0.28, vol: 0.07 },
        { k: 'osc', type: 'square', f0: 2350, dur: 0.21, vol: 0.05 },
        { k: 'osc', type: 'sine', f0: 1150, f1: 2500, dur: 0.28, vol: 0.22, t0: 0.02 },
        { k: 'osc', type: 'sine', f0: 988, dur: 0.07, vol: 0.14, t0: 0.05 },
        { k: 'osc', type: 'sine', f0: 1319, dur: 0.13, vol: 0.12, t0: 0.105 }
      ]
    };
    r.coin = {
      dur: 0.22, voices: [
        { k: 'osc', type: 'sine', f0: 988, dur: 0.07, vol: 0.18 },
        { k: 'osc', type: 'sine', f0: 1319, dur: 0.14, vol: 0.16, t0: 0.055 }
      ]
    };
    r.miss = {
      dur: 0.18, voices: [
        { k: 'noise', filter: 'bp', fc: 700, dur: 0.13, vol: 0.16 },
        { k: 'osc', type: 'sine', f0: 320, f1: 170, dur: 0.13, vol: 0.14 }
      ]
    };
    r.ult = {
      dur: 1.05, voices: [
        { k: 'osc', type: 'sine', f0: 75, f1: 26, dur: 0.95, vol: 0.62 },
        { k: 'osc', type: 'saw', f0: 300, f1: 55, dur: 0.55, vol: 0.14 },
        { k: 'noise', filter: 'lp', fc: 900, dur: 0.55, vol: 0.34 },
        { k: 'noise', filter: 'hp', fc: 2200, dur: 0.32, vol: 0.30, t0: 0.06 },
        { k: 'osc', type: 'triangle', f0: 523, f1: 1046, dur: 0.5, vol: 0.10 },
        { k: 'osc', type: 'triangle', f0: 659, f1: 1318, dur: 0.5, vol: 0.09, t0: 0.03 },
        { k: 'osc', type: 'triangle', f0: 784, f1: 1568, dur: 0.5, vol: 0.08, t0: 0.06 },
        { k: 'osc', type: 'triangle', f0: 1047, f1: 2094, dur: 0.5, vol: 0.07, t0: 0.09 }
      ]
    };
    r.clear = {
      dur: 0.85, voices: [
        { k: 'osc', type: 'triangle', f0: 523, dur: 0.42, vol: 0.18 },
        { k: 'osc', type: 'triangle', f0: 659, dur: 0.42, vol: 0.18, t0: 0.085 },
        { k: 'osc', type: 'triangle', f0: 784, dur: 0.42, vol: 0.18, t0: 0.17 },
        { k: 'osc', type: 'triangle', f0: 1047, dur: 0.45, vol: 0.18, t0: 0.255 },
        { k: 'osc', type: 'triangle', f0: 1319, dur: 0.5, vol: 0.18, t0: 0.34 },
        { k: 'noise', filter: 'hp', fc: 4000, dur: 0.4, vol: 0.12, t0: 0.1 }
      ]
    };
    r.buy = {
      dur: 0.3, voices: [
        { k: 'osc', type: 'square', f0: 700, dur: 0.06, vol: 0.16 },
        { k: 'osc', type: 'square', f0: 1050, dur: 0.14, vol: 0.13, t0: 0.05 },
        { k: 'osc', type: 'sine', f0: 988, dur: 0.07, vol: 0.13, t0: 0.09 },
        { k: 'osc', type: 'sine', f0: 1319, dur: 0.14, vol: 0.12, t0: 0.145 }
      ]
    };
    r.tap = { dur: 0.08, voices: [{ k: 'osc', type: 'sine', f0: 660, dur: 0.05, vol: 0.11 }] };
    r.taunt = { dur: 0.2, voices: [{ k: 'osc', type: 'saw', f0: 220, f1: 300, dur: 0.16, vol: 0.09 }] };
    r.__silence = { dur: 0.03, voices: [{ k: 'osc', type: 'sine', f0: 100, dur: 0.01, vol: 0.0001 }] };

    var up = {
      SSS: [523, 659, 784, 1047, 1319, 1568], SS: [523, 659, 784, 1047],
      S: [523, 659, 784], A: [523, 659], B: [523, 587], C: [392, 349], D: [330, 262]
    };
    Object.keys(up).forEach(function (g) {
      var arr = up[g], down = (g === 'C' || g === 'D'), vs = [];
      for (var i = 0; i < arr.length; i++) {
        vs.push({
          k: 'osc', type: down ? 'saw' : 'square', f0: arr[i],
          f1: down ? arr[i] * 0.94 : null, dur: down ? 0.34 : 0.26,
          vol: down ? 0.14 : 0.13, t0: i * 0.075
        });
      }
      if (g === 'SSS') {
        vs.push({ k: 'noise', filter: 'hp', fc: 5000, dur: 0.5, vol: 0.16, t0: 0.1 });
        vs.push({ k: 'osc', type: 'sine', f0: 2093, dur: 0.5, vol: 0.10, t0: 0.34 });
      }
      r['roast_' + g] = { dur: 0.35 + arr.length * 0.075 + (g === 'SSS' ? 0.5 : 0), voices: vs };
    });
    return r;
  }

  function encodeWav(f32) {
    var n = f32.length, buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf), i;
    function str(off, s) { for (var k = 0; k < s.length; k++) dv.setUint8(off + k, s.charCodeAt(k)); }
    str(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); str(8, 'WAVE');
    str(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, SR, true); dv.setUint32(28, SR * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    str(36, 'data'); dv.setUint32(40, n * 2, true);
    for (i = 0; i < n; i++) {
      var s = f32[i]; s = s < -1 ? -1 : s > 1 ? 1 : s;
      dv.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buf;
  }

  function keyOf(name, arg) {
    if (name === 'hit') {
      var c = arg || 0, i = Math.floor(c / 12);
      return 'hit' + Math.max(0, Math.min(HIT_STEPS - 1, i));
    }
    if (name === 'roast') return 'roast_' + (arg || 'B');
    return name;
  }

  // ---------------- 引擎 1：HTML5 <audio>（网页 / 微信内置浏览器首选）----------------
  function htmlEngine() {
    var R = null, urls = {}, pools = {}, unlockTries = 0;
    var supported = (typeof Audio !== 'undefined');

    function ensure() { if (!R) R = recipes(); return R; }
    function urlOf(key) {
      if (urls[key]) return urls[key];
      var rec = ensure()[key] || ensure().tap;
      var pcm = render(rec.voices, rec.dur);
      var wav = encodeWav(pcm);
      var u;
      try {
        u = (root.URL && root.URL.createObjectURL)
          ? root.URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }))
          : ('data:audio/wav;base64,' + btoa(String.fromCharCode.apply(null, new Uint8Array(wav))));
      } catch (e) { return null; }
      urls[key] = u;
      return u;
    }
    function play(name, arg, vol) {
      if (!supported) return;
      var key = keyOf(name, arg);
      var u = urlOf(key); if (!u) return;
      var pool = pools[key] || (pools[key] = []);
      var el = null;
      for (var i = 0; i < pool.length; i++) { if (pool[i].paused || pool[i].ended) { el = pool[i]; break; } }
      if (!el) {
        if (pool.length < 4) { try { el = new Audio(); } catch (e) { return; } el.src = u; pool.push(el); }
        else { el = pool.shift(); pool.push(el); }
      }
      try {
        el.volume = vol == null ? 0.9 : vol;
        el.playbackRate = 0.94 + Math.random() * 0.12;   // 每次略微变调，避免复读机感
        if (el.currentTime) el.currentTime = 0;
        var pr = el.play();
        if (pr && pr.catch) pr.catch(function () { });
      } catch (e) { }
    }

    return {
      supported: supported,
      unlock: function () {
        // 前几次触摸都尝试解锁：部分内核第一次 play() 会被打断
        if (!supported || unlockTries > 4) return;
        unlockTries++;
        try {
          var a = new Audio();
          a.src = urlOf('__silence');
          a.volume = 0;
          var p = a.play();
          if (p && p.catch) p.catch(function () { });
        } catch (e) { }
        try { urlOf('hit0'); urlOf('crit'); } catch (e) { }   // 预热，保证第一拳不延迟
      },
      hit: function (combo) { play('hit', combo); },
      crit: function () { play('crit'); },
      coin: function () { play('coin'); },
      miss: function () { play('miss'); },
      ult: function () { play('ult'); },
      clear: function () { play('clear'); },
      roast: function (g) { play('roast', g); },
      buy: function () { play('buy'); },
      tap: function () { play('tap'); },
      taunt: function () { play('taunt'); }
    };
  }

  // ---------------- 引擎 2：WebAudio（微信小游戏 / 老浏览器兜底）----------------
  function webEngine(getAC) {
    var R = null, bufs = {}, master = null, masterFor = null;
    function ensure() { if (!R) R = recipes(); return R; }
    function ac() {
      var a = getAC ? getAC() : null;
      if (!a) return null;
      if (masterFor !== a) {
        try {
          master = a.createGain(); master.gain.value = 0.85; master.connect(a.destination); masterFor = a;
        } catch (e) { return null; }
      }
      return a;
    }
    function bufOf(a, key) {
      if (bufs[key]) return bufs[key];
      var rec = ensure()[key] || ensure().tap;
      var pcm = render(rec.voices, rec.dur);
      var b;
      try {
        b = a.createBuffer(1, pcm.length, SR);
        if (b.copyToChannel) b.copyToChannel(pcm, 0); else b.getChannelData(0).set(pcm);
      } catch (e) { return null; }
      bufs[key] = b;
      return b;
    }
    function play(name, arg) {
      var a = ac(); if (!a) return;
      try {
        var s = a.createBufferSource();
        s.buffer = bufOf(a, keyOf(name, arg));
        if (!s.buffer) return;
        s.playbackRate.value = 0.94 + Math.random() * 0.12;
        s.connect(master); s.start();
      } catch (e) { }
    }
    return {
      supported: true,
      unlock: function () {
        var a = ac(); if (!a) return;
        try { if (a.state === 'suspended' && a.resume) a.resume(); } catch (e) { }
      },
      hit: function (combo) { play('hit', combo); },
      crit: function () { play('crit'); },
      coin: function () { play('coin'); },
      miss: function () { play('miss'); },
      ult: function () { play('ult'); },
      clear: function () { play('clear'); },
      roast: function (g) { play('roast', g); },
      buy: function () { play('buy'); },
      tap: function () { play('tap'); },
      taunt: function () { play('taunt'); }
    };
  }

  var lib = { create: webEngine, createHTML: htmlEngine, render: render, recipes: recipes, encodeWav: encodeWav, SR: SR };
  if (typeof module === 'object' && module.exports) module.exports = lib;
  root.BSLib = root.BSLib || {};
  root.BSLib.audio = lib;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));
