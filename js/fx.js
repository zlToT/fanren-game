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

export class Particle {
  constructor() {
    this.g = new PIXI.Graphics();
    app.stage.addChild(this.g);
  }
  init(x, y, color) {
    this.g.clear();
    this.g.beginFill(color); this.g.drawCircle(0, 0, 3); this.g.endFill();
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
  for (let i = 0; i < n; i++) {
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
