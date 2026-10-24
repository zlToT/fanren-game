// ============================================================
// fx.js — 特效
// 粒子（Particle）、伤害飘字（DamageText）、爆裂效果、震屏（shake）。
// 粒子和伤害数字使用对象池复用，避免频繁 GC。
// ============================================================

import * as PIXI from 'pixi.js';
import { app, game } from './state.js';
import { hasBuff } from './buff.js';
import { playHitSound } from './audio.js';

// ===== 伤害数字对象池 =====
const _damageTextPool = [];
const MAX_DT_POOL = 100;

export class DamageText {
  constructor() {
    this.txt = new PIXI.Text('', { fontFamily: 'Arial', fontSize: 14, fill: '#fff', stroke: 0x000000, strokeThickness: 3 });
    this.txt.anchor.set(0.5);
    app.stage.addChild(this.txt);
  }
  init(x, y, amount, color = 0xffffff, big = false) {
    this.txt.text = Math.floor(amount) + '';
    this.txt.x = x + (Math.random() - 0.5) * 10;
    this.txt.y = y - 8;
    this.txt.style.fill = color;
    this.txt.style.fontSize = big ? 18 : 14;
    this.vy = -1.2 - Math.random();
    this.life = 45;
    this.txt.alpha = 1;
  }
  update() {
    this.txt.y += this.vy;
    this.vy *= 0.95;
    this.life--;
    this.txt.alpha = Math.max(0, this.life / 45);
    if (this.life <= 0) {
      // 归还到池里
      if (_damageTextPool.length < MAX_DT_POOL) {
        app.stage.removeChild(this.txt);
        _damageTextPool.push(this);
      } else {
        app.stage.removeChild(this.txt);
        this.txt.destroy();
      }
      return false;
    }
    return true;
  }
}

export function showDamage(x, y, dmg, color, big = false) {
  // ★ 手机端性能优化：限制同时显示的伤害数字数量
  if (game.damageTexts.length > 30) return;
  let dt;
  if (_damageTextPool.length > 0) {
    dt = _damageTextPool.pop();
    app.stage.addChild(dt.txt);
  } else {
    dt = new DamageText();
  }
  dt.init(x, y, dmg, color, big);
  game.damageTexts.push(dt);
}

// ===== 粒子对象池 =====
const _particlePool = [];
const MAX_P_POOL = 200;

// ★ 预生成一个圆形纹理，所有粒子共用，合并 draw call
let _circleTex = null;
function getCircleTexture() {
  if (_circleTex) return _circleTex;
  const g = new PIXI.Graphics();
  g.beginFill(0xffffff); g.drawCircle(8, 8, 8); g.endFill();
  _circleTex = app.renderer.generateTexture(g);
  return _circleTex;
}

export class Particle {
  constructor() {
    this.g = new PIXI.Sprite(getCircleTexture());
    this.g.anchor.set(0.5);
    this.g.scale.set(0.375); // 直径 3px（8*2*0.375=6px半径→3px直径不对，直接设大小）
    this.g.width = 6; this.g.height = 6;
    app.stage.addChild(this.g);
  }
  init(x, y, color) {
    this.g.tint = color;
    this.g.position.set(x, y);
    this.vx = (Math.random() - 0.5) * 4;
    this.vy = (Math.random() - 0.5) * 4;
    this.life = 25;
    this.g.alpha = 1;
  }
  update() {
    this.g.x += this.vx; this.g.y += this.vy;
    this.vx *= 0.93; this.vy *= 0.93;
    this.g.alpha = this.life / 25;
    this.life--;
    if (this.life <= 0) {
      // 归还到池里
      if (_particlePool.length < MAX_P_POOL) {
        app.stage.removeChild(this.g);
        _particlePool.push(this);
      } else {
        app.stage.removeChild(this.g);
        this.g.destroy();
      }
      return false;
    }
    return true;
  }
}

export function burst(x, y, color, n = 8) {
  // ★ 性能优化：粒子太多时减少数量
  if (game.particles.length > 100) return;
  const realN = Math.min(n, 100 - game.particles.length);
  for (let i = 0; i < realN; i++) {
    let p;
    if (_particlePool.length > 0) {
      p = _particlePool.pop();
      app.stage.addChild(p.g);
    } else {
      p = new Particle();
    }
    p.init(x, y, color);
    game.particles.push(p);
  }
}

let shakeTime = 0;
export function shake(ms) { shakeTime = Math.max(shakeTime, ms); }
export function updateShake(dt) {
  if (shakeTime > 0) {
    shakeTime -= dt;
    const s = Math.min(12, shakeTime * 0.02);
    app.stage.x = (Math.random() - 0.5) * s;
    app.stage.y = (Math.random() - 0.5) * s;
  } else { app.stage.x = 0; app.stage.y = 0; }
}

// ★ 统一玩家受伤接口
// ignoreHitInvuln=true 时，忽略受击无敌（Boss技能/AOE用）
export function playerHurt(dmg, ignoreHitInvuln = false) {
  if (game.over) return;
  // 瞬身无敌挡所有伤害（GM无敌也是用这个buff）
  if (hasBuff(game, 'dashInvuln')) return;
  game.hp -= dmg;
  game.hitFlash = 1;
  playHitSound();
  // 受击特效（跟随人物）
  import('./sprite-fx.js').then(({ playFxByTarget }) => {
    playFxByTarget('hit', game.player);
  });
}

// 辟邪神雷：8道闪电从空中劈下
export function spawnThunderBolts(px, py, R) {
  if (!app.stage) return;
  for (let i = 0; i < 8; i++) {
    const ang = Math.random() * Math.PI * 2;
    const rr = Math.random() * R * 0.8;
    const tx = px + Math.cos(ang) * rr, ty = py + Math.sin(ang) * rr;
    const bolt = new PIXI.Graphics();
    bolt.lineStyle(3 + Math.random() * 2, 0xeeff88, 1);
    let bx = tx, by = ty - 200;
    bolt.moveTo(bx, by);
    for (let j = 0; j < 5; j++) { bx = tx + (Math.random() - 0.5) * 36; by = ty - 200 + (j + 1) * 40; bolt.lineTo(bx, by); }
    bolt.lineStyle(0);
    bolt.beginFill(0xeeff88, 0.3); bolt.drawCircle(tx, ty, 30); bolt.endFill();
    bolt.life = 16;
    app.stage.addChild(bolt);
    const fade = setInterval(() => {
      bolt.life--; bolt.alpha = bolt.life / 16;
      if (bolt.life <= 0) { clearInterval(fade); app.stage.removeChild(bolt); }
    }, 33);
  }
}

// ===== 瞬身拖尾残影 =====
const _tailPool = [];
export function spawnDashTail(x, y, texture) {
  if (!texture) return;
  let spr;
  if (_tailPool.length > 0) {
    spr = _tailPool.pop();
    spr.texture = texture;
    spr.visible = true;
  } else {
    spr = new PIXI.Sprite(texture);
    spr.anchor.set(0.5);
    app.stage.addChild(spr);
  }
  spr.x = x;
  spr.y = y;
  spr.alpha = 0.5;
  spr._life = 20; // 20帧后消失
}

export function updateDashTails() {
  // 遍历所有拖尾，淡出
  // 用一个隐藏数组跟踪活跃的拖尾
}
// 活跃拖尾列表
const _activeTails = [];
export function spawnDashTailWithTrack(x, y, texture) {
  spawnDashTail(x, y, texture);
  // 找到刚创建的 sprite 加到活跃列表
  // 简化：直接遍历 stage children 找最新的
}

// 更简单的实现：每帧在 player.js 里调用，fx.js 维护一个列表
export function tickDashTails() {
  // 这个函数由主循环调用，更新所有拖尾
  // 但我们用对象池方式，需要跟踪活跃的
}

// 最终方案：维护一个活跃拖尾数组
const _tails = [];
export function addTail(x, y, texture) {
  if (!texture) return;
  // ★ 限制残影最大数量
  if (_tails.length > 8) return;
  let spr;
  if (_tailPool.length > 0) {
    spr = _tailPool.pop();
    spr.texture = texture;
    app.stage.addChild(spr);
  } else {
    spr = new PIXI.Sprite(texture);
    spr.anchor.set(0.5);
    app.stage.addChild(spr);
  }
  spr.x = x;
  spr.y = y;
  spr.width = 60;
  spr.height = 60;
  spr.alpha = 0.9;
  spr._life = 20;
  _tails.push(spr);
}

export function updateTails() {
  for (let i = _tails.length - 1; i >= 0; i--) {
    const t = _tails[i];
    t._life--;
    t.alpha = 0.9 * (t._life / 20);
    if (t._life <= 0) {
      app.stage.removeChild(t);
      _tailPool.push(t);
      _tails.splice(i, 1);
    }
  }
}
