// ============================================================
// background.js — 背景渲染
// 在 <canvas id="firefly-bg"> 上绘制地图主题（草地/暗渊/虚空/仙庭）、
// 岩石、雾效，作为游戏底层背景。
// ============================================================

import { THEMES } from './config.js';

const bgCanvas = document.getElementById('firefly-bg');
const bgCtx = bgCanvas.getContext('2d');
let groundTile = null, rocks = [], mists = [], curTheme = 'grass';

export function setTheme(t) { curTheme = t; }

export function resizeBg() {
  bgCanvas.width = innerWidth; bgCanvas.height = innerHeight;
  buildGround(); buildRocks(); buildMist();
}

function buildGround() {
  const T = THEMES[curTheme];
  const W = bgCanvas.width, H = bgCanvas.height;
  groundTile = document.createElement('canvas');
  groundTile.width = W; groundTile.height = H;
  const c = groundTile.getContext('2d');
  c.fillStyle = T.base; c.fillRect(0, 0, W, H);
  const patches = Math.floor(W * H / 26000);
  for (let i = 0; i < patches; i++) {
    const x = Math.random() * W, y = Math.random() * H;
    const r = 30 + Math.random() * 90;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, T.patch[Math.floor(Math.random() * T.patch.length)]);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  }
  if (T.hasGrass) {
    const tufts = Math.floor(W * H / 2600);
    c.strokeStyle = T.tuft; c.lineWidth = 1.2;
    for (let i = 0; i < tufts; i++) {
      const x = Math.random() * W, y = Math.random() * H;
      const n = 2 + Math.floor(Math.random() * 3);
      for (let j = 0; j < n; j++) {
        const ox = (Math.random() - 0.5) * 5;
        c.beginPath();
        c.moveTo(x + ox, y);
        c.lineTo(x + ox + (Math.random() - 0.5) * 4, y - 4 - Math.random() * 5);
        c.stroke();
      }
    }
  }
  if (curTheme === 'heaven') {
    for (let i = 0; i < 14; i++) {
      const x = Math.random() * W, y = Math.random() * H, rw = 40 + Math.random() * 90;
      c.fillStyle = 'rgba(255,250,220,0.08)';
      c.beginPath(); c.ellipse(x, y, rw, rw * 0.3, 0, 0, Math.PI * 2); c.fill();
    }
  }
  if (curTheme === 'void') {
    for (let i = 0; i < 120; i++) {
      c.fillStyle = `rgba(200,210,255,${0.2 + Math.random() * 0.5})`;
      c.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
    }
  }
}

function buildRocks() {
  const T = THEMES[curTheme];
  const W = bgCanvas.width, H = bgCanvas.height;
  rocks = [];
  const count = Math.floor(W * H / T.rockN);
  for (let i = 0; i < count; i++) {
    rocks.push({ x: Math.random() * W, y: Math.random() * H, r: 4 + Math.random() * 12, shade: Math.random(), rot: Math.random() * Math.PI, seed: Math.random() * 100 });
  }
}

function drawRock(r) {
  const T = THEMES[curTheme];
  const c = bgCtx;
  c.save(); c.translate(r.x, r.y); c.rotate(r.rot);
  c.beginPath(); c.ellipse(2, 2, r.r * 1.1, r.r * 0.75, 0, 0, Math.PI * 2);
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.fill();
  const pts = [];
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2;
    const rr = r.r * (0.78 + Math.sin(r.seed + i * 2.3) * 0.22);
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  c.beginPath();
  pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]));
  c.closePath();
  const g = T.rockBase + r.shade * 55;
  c.fillStyle = `rgb(${g},${g + 4},${g + 10})`; c.fill();
  c.strokeStyle = 'rgba(10,10,15,0.5)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(pts[0][0] * 0.7, pts[0][1] * 0.7); c.lineTo(pts[3][0] * 0.4, pts[3][1] * 0.4); c.stroke();
  c.beginPath(); c.moveTo(pts[1][0], pts[1][1]); c.lineTo(pts[2][0], pts[2][1]); c.lineTo(pts[3][0] * 0.3, pts[3][1] * 0.3); c.closePath();
  c.fillStyle = 'rgba(230,235,240,0.15)'; c.fill();
  c.restore();
}

function buildMist() {
  const T = THEMES[curTheme];
  const W = bgCanvas.width, H = bgCanvas.height;
  mists = [];
  for (let i = 0; i < 10; i++) {
    mists.push({ x: Math.random() * W, y: Math.random() * H, r: 120 + Math.random() * 180, vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.12, alpha: 0.04 + Math.random() * 0.05 });
  }
}

function drawScene() {
  const c = bgCtx, W = bgCanvas.width, H = bgCanvas.height;
  const T = THEMES[curTheme];
  c.drawImage(groundTile, 0, 0);
  rocks.forEach(drawRock);
  mists.forEach(m => {
    m.x += m.vx; m.y += m.vy;
    if (m.x < -m.r) m.x = W + m.r;
    if (m.x > W + m.r) m.x = -m.r;
    if (m.y < -m.r) m.y = H + m.r;
    if (m.y > H + m.r) m.y = -m.r;
    const g = c.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
    g.addColorStop(0, `rgba(${T.mist},${m.alpha})`);
    g.addColorStop(1, `rgba(${T.mist},0)`);
    c.fillStyle = g;
    c.beginPath(); c.arc(m.x, m.y, m.r, 0, Math.PI * 2); c.fill();
  });
  requestAnimationFrame(drawScene);
}

export function initBackground() {
  resizeBg();
  drawScene();
  addEventListener('resize', resizeBg);
}
