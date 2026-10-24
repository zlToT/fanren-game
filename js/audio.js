// ============================================================
// audio.js — 音频系统
// 加载音频文件（BGM/音效）、播放合成音效（hit/levelup/boss等）、
// BGM 切换（关卡bg_1~5 / 战斗bg_boss）。
// ============================================================

import { audioCtx, setAudioCtx, audioBuffers, curLevel } from './state.js';

const AUDIO_FILES = {
  bg1: './audio/bg_1.mp3', bg2: './audio/bg_2.mp3', bg3: './audio/bg_3.mp3',
  bg4: './audio/bg_4.mp3', bg5: './audio/bg_5.mp3', bgBoss: './audio/bg_boss.mp3',
  over: './audio/over.mp3', uplv: './audio/uplv.mp3', hit: './audio/hit.mp3'
};

function getAudioCtx() {
  if (!audioCtx) {
    setAudioCtx(new (window.AudioContext || window.webkitAudioContext)());
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

export function initAudio() {
  for (const k in AUDIO_FILES) {
    fetch(AUDIO_FILES[k]).then(r => r.arrayBuffer())
      .then(buf => getAudioCtx().decodeAudioData(buf))
      .then(decoded => audioBuffers[k] = decoded)
      .catch(() => { });
  }
}

const _lastPlay = {};
export function playSound(type) {
  try {
    const now = performance.now();
    if (now - (_lastPlay[type] || 0) < 60) return;
    _lastPlay[type] = now;
    getAudioCtx();
    const S = {
      hit: { f: 220, f2: 70, dur: 0.15, wave: 'square', vol: 0.12 },
      levelup: { f: 523, f2: 1568, dur: 0.45, wave: 'sine', vol: 0.15 },
      boss: { f: 110, f2: 35, dur: 1.3, wave: 'sawtooth', vol: 0.2 },
      explode: { f: 160, f2: 40, dur: 0.35, wave: 'sawtooth', vol: 0.15 },
      thunder: { f: 80, f2: 1200, dur: 0.5, wave: 'sawtooth', vol: 0.22 },
      pickup: { f: 700, f2: 1400, dur: 0.09, wave: 'sine', vol: 0.07 },
      warn: { f: 880, f2: 440, dur: 0.25, wave: 'square', vol: 0.1 },
      shoot: { f: 500, f2: 300, dur: 0.06, wave: 'square', vol: 0.04 },
      dash: { f: 900, f2: 200, dur: 0.12, wave: 'sine', vol: 0.1 },
      mdie: { f: 300, f2: 60, dur: 0.18, wave: 'sawtooth', vol: 0.09 },
    }[type];
    if (!S) return;
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = S.wave;
    o.frequency.setValueAtTime(S.f, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, S.f2), t + S.dur);
    g.gain.setValueAtTime(S.vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + S.dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t); o.stop(t + S.dur);
  } catch (e) { }
}

const _lastFile = {};
export function playFile(name, loop = false, vol = 0.5) {
  try {
    getAudioCtx();
    const buf = audioBuffers[name];
    if (!buf) return;
    if (name === 'bgm') { if (window._bgmSrc) return; }
    else {
      const now = performance.now();
      if (now - (_lastFile[name] || 0) < 80) return;
      _lastFile[name] = now;
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buf; src.loop = loop;
    const g = audioCtx.createGain(); g.gain.value = vol;
    src.connect(g); g.connect(audioCtx.destination);
    src.start();
    if (name === 'bgm') window._bgmSrc = src;
  } catch (e) { }
}

let _lastHitSfx = 0;
export function playHitSound() {
  const now = performance.now();
  if (now - _lastHitSfx < 400) return;
  _lastHitSfx = now;
  playFile('hit', false, 0.6);
}

let currentBgm = null;
export function playBgm(name) {
  if (currentBgm === name) return;
  currentBgm = name;
  if (window._bgmSrc) { try { window._bgmSrc.stop(); } catch (e) { } window._bgmSrc = null; }
  if (!audioBuffers[name] || !audioCtx) return;
  const src = audioCtx.createBufferSource();
  src.buffer = audioBuffers[name]; src.loop = true;
  const g = audioCtx.createGain(); g.gain.value = 0.35;
  src.connect(g); g.connect(audioCtx.destination);
  src.start();
  window._bgmSrc = src;
}

export function playLevelBgm() {
  const idx = curLevel ? curLevel.bossType.replace('boss', '') : 1;
  playBgm('bg' + idx);
}

let bgmStarted = false;
export function tryStartBGM() {
  if (bgmStarted) return;
  getAudioCtx();
  // 等音频缓冲加载完成再播，最多重试 50 次（10秒）
  const tryPlay = (retries = 50) => {
    const idx = curLevel ? curLevel.bossType.replace('boss', '') : 1;
    if (audioBuffers['bg' + idx]) {
      playBgm('bg' + idx);
      bgmStarted = true;  // 播放成功才算开始
      return;
    }
    if (retries > 0) setTimeout(() => tryPlay(retries - 1), 200);
    // 重试耗尽，重置标记，下次进关卡再试
  };
  tryPlay();
}
