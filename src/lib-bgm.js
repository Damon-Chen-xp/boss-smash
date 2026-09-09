/* 暴打老板 · BGM 引擎
   做法：纯 JS 离线合成 PCM → 编码 WAV → HTML5 <audio loop> 循环播放（微信 / iOS 静音键都能响）
   依赖 lib-audio.js 的 encodeWav + SR。零音频文件、零网络请求。
   三段循环：menu（轻松）/ battle（紧张）/ boss（压迫）。 */
(function (root) {
  'use strict';

  var A = root.BSLib.audio;
  var SR = A.SR;

  function fmidi(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // 在三和弦基础上加八度，音色更丰满
  function triad(root, minor) {
    return [root, root + (minor ? 3 : 4), root + 7, root + 12];
  }

  function addTone(out, freq, t0, dur, type, vol, decay) {
    var start = Math.floor(t0 * SR), len = Math.floor(dur * SR);
    if (start < 0) { len += start; start = 0; }
    if (len <= 0 || start >= out.length) return;
    if (start + len > out.length) len = out.length - start;
    var atk = Math.floor(0.004 * SR);
    var ph = 0, i, w;
    for (i = 0; i < len; i++) {
      var t = i / SR;
      if (type === 'square') w = ph < 0.5 ? 1 : -1;
      else if (type === 'saw') w = 2 * ph - 1;
      else if (type === 'triangle') w = 4 * Math.abs(ph - 0.5) - 1;
      else w = Math.sin(2 * Math.PI * ph);
      var env = Math.exp(-t / decay) * Math.min(1, i / atk);
      out[start + i] += w * env * vol;
      ph += freq / SR; if (ph >= 1) ph -= 1;
    }
  }
  function addKick(out, t0, vol) {
    var start = Math.floor(t0 * SR), len = Math.floor(0.11 * SR), ph = 0, i;
    if (start >= out.length) return;
    for (i = 0; i < len && start + i < out.length; i++) {
      var t = i / SR;
      var f = 95 * Math.exp(-t * 26) + 44;
      ph += f / SR;
      out[start + i] += Math.sin(2 * Math.PI * ph) * Math.exp(-t * 20) * vol;
    }
  }
  function addHat(out, t0, vol) {
    var start = Math.floor(t0 * SR), len = Math.floor(0.035 * SR), i;
    if (start >= out.length) return;
    for (i = 0; i < len && start + i < out.length; i++) {
      out[start + i] += (Math.random() * 2 - 1) * Math.exp(-i / (0.007 * SR)) * vol;
    }
  }

  // 一小节 = 4 拍；beatsPerBar 恒为 4
  function compose(kind) {
    var bpm = kind === 'menu' ? 128 : kind === 'battle' ? 156 : 170;
    var beat = 60 / bpm;
    var bars = 4;
    var total = bars * 4 * beat;
    var n = Math.floor(total * SR);
    var out = new Float32Array(n);

    // 和弦根音（midi），每小节一个
    var roots;
    if (kind === 'menu') roots = [60, 53, 57, 55];        // C F Am G
    else if (kind === 'battle') roots = [57, 53, 60, 55]; // Am F C G
    else roots = [57, 52, 53, 52];                         // Am E F E

    var minor = kind === 'menu' ? [false, false, true, false]
      : kind === 'battle' ? [true, false, false, false]
        : [true, false, false, false];

    for (var bar = 0; bar < bars; bar++) {
      var t0 = bar * 4 * beat;
      var root = roots[bar];
      var chords = triad(root, minor[bar]);

      // 贝斯：每拍一个根音（低两个八度，方波）
      for (var b = 0; b < 4; b++) {
        var bassF = fmidi(root - 24);
        addTone(out, bassF, t0 + b * beat, beat * 0.92, 'triangle', kind === 'boss' ? 0.30 : 0.24, beat * 1.1);
      }

      // 和弦垫：每小节铺满，柔和三角波
      for (var c = 0; c < chords.length; c++) {
        addTone(out, fmidi(chords[c]), t0, beat * 4, 'triangle', 0.10, beat * 3.2);
      }

      // 琶音：16 分音符（每拍 4 个）
      var arpN = kind === 'battle' || kind === 'boss' ? 4 : 3;
      for (var a = 0; a < 16; a++) {
        var note = chords[a % arpN];
        var at = t0 + a * (beat / 4);
        var avol = kind === 'boss' ? 0.10 : kind === 'battle' ? 0.09 : 0.08;
        addTone(out, fmidi(note + 12), at, beat / 4, 'square', avol, 0.12);
      }

      // 鼓：每拍 kick，反拍 hat
      for (var d = 0; d < 4; d++) {
        addKick(out, t0 + d * beat, kind === 'boss' ? 0.42 : 0.34);
        addHat(out, t0 + d * beat + beat / 2, 0.14);
        if (kind === 'battle' || kind === 'boss') {
          addHat(out, t0 + d * beat + beat * 0.25, 0.07);
          addHat(out, t0 + d * beat + beat * 0.75, 0.07);
        }
      }
    }

    // 末尾淡出，让 loop 衔接在静音点
    var tail = Math.floor(0.25 * SR);
    for (var m = n - tail; m < n; m++) out[m] *= (n - m) / tail;
    for (var k = 0; k < n; k++) out[k] = Math.tanh(out[k] * 1.1) * 0.8;
    return out;
  }

  function create(getAC) {
    if (getAC) return webBgm(getAC);
    var R = null, urls = {}, cur = null, curKind = null, muted = false;
    var supported = (typeof Audio !== 'undefined');

    function ensure() {
      if (!R) {
        R = {};
        ['menu', 'battle', 'boss'].forEach(function (k) {
          var pcm = compose(k);
          var wav = A.encodeWav(pcm);
          try {
            R[k] = (root.URL && root.URL.createObjectURL)
              ? root.URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }))
              : ('data:audio/wav;base64,' + btoa(String.fromCharCode.apply(null, new Uint8Array(wav))));
          } catch (e) { R[k] = null; }
        });
      }
      return R;
    }

    function play(kind) {
      curKind = kind;
      if (!supported) return;
      if (!kind || kind === 'none') { stop(); return; }
      if (muted) { stop(); return; }
      var u = ensure()[kind];
      if (!u) return;
      if (cur && cur.src === u) return;   // 已在播同一段
      stop();
      try {
        cur = new Audio();
        cur.loop = true;
        cur.volume = kind === 'menu' ? 0.5 : 0.6;
        cur.src = u;
        var p = cur.play();
        if (p && p.catch) p.catch(function () { });
      } catch (e) { }
    }
    function stop() {
      if (cur) { try { cur.pause(); cur.currentTime = 0; } catch (e) { } cur = null; }
    }
    function setMuted(m) {
      muted = m;
      if (m) stop();
      else if (curKind) play(curKind);
    }

    return {
      play: play, stop: stop, setMuted: setMuted,
      unlock: function () { if (curKind && curKind !== 'none') play(curKind); }
    };
  }

  // WebAudio 循环引擎（微信小游戏：wx.createWebAudioContext）
  function webBgm(getAC) {
    var bufs = {}, cur = null, curKind = null, master = null, masterFor = null;
    function ac() {
      var a = getAC ? getAC() : null;
      if (!a) return null;
      if (masterFor !== a) {
        try { master = a.createGain(); master.gain.value = 0.9; master.connect(a.destination); masterFor = a; } catch (e) { return null; }
      }
      return a;
    }
    function buf(kind) {
      if (bufs[kind]) return bufs[kind];
      var a = ac(); if (!a) return null;
      try {
        var pcm = compose(kind);
        var b = a.createBuffer(1, pcm.length, SR);
        if (b.copyToChannel) b.copyToChannel(pcm, 0); else b.getChannelData(0).set(pcm);
        bufs[kind] = b; return b;
      } catch (e) { return null; }
    }
    function play(kind) {
      curKind = kind;
      stop();
      if (!kind || kind === 'none') return;
      var a = ac(); if (!a) return;
      var b = buf(kind); if (!b) return;
      try {
        cur = a.createBufferSource();
        cur.buffer = b;
        cur.loop = true;
        cur.connect(master);
        cur.start();
      } catch (e) { }
    }
    function stop() {
      if (cur) { try { cur.stop(); } catch (e) { } cur = null; }
    }
    return {
      play: play, stop: stop,
      unlock: function () {
        var a = ac(); if (!a) return;
        try { if (a.state === 'suspended' && a.resume) a.resume(); } catch (e) { }
      }
    };
  }

  var lib = { create: create, compose: compose };
  if (typeof module === 'object' && module.exports) module.exports = lib;
  root.BSLib = root.BSLib || {};
  root.BSLib.bgm = lib;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));
