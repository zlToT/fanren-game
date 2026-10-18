// ============================================================
// weapons.js — 玩家武器
// 飞剑（Sword：护身/追击/分组三种剑式）、噬金虫（Bug）、
// 九霄神雷（Lightning 落雷）、摄魂幡（Orbit 环绕魂魄）。
// 含目标查找工具 findEnemyInRange / findRandomEnemy。
// ============================================================

import * as PIXI from 'pixi.js';
import { app, game, IMG_TEX, mxGlobal, myGlobal } from './state.js';
import { SWORD_MAX, STANCE_NAMES } from './config.js';
import { calcBugDmg, calcLightningDmg, calcSwordDmg, calcOrbitDmg } from './calculate.js';
import { burst, showDamage } from './fx.js';
import { addEnemyBuff } from './buff.js';

export function getArcCount() {
  const n = game.swordCount;
  if (n >= 72) return 4;
  if (n >= 37) return 3;
  if (n >= 18) return 2;
  return 1;
}

export function slotPos(sword) {
  const A = getArcCount();
  const total = Math.max(1, game.swordCount);
  const arc = Math.min(A - 1, Math.floor(sword.idx * A / total));
  sword.arcIdx = arc;
  const radius = game.swordRadius + arc * 20;
  const frac = (sword.idx + 0.5) / total;
  const ang = game.arcRot + frac * Math.PI * 2;
  return { x: game.player.x + Math.cos(ang) * radius, y: game.player.y + Math.sin(ang) * radius, ang, radius };
}

export class Sword {
  constructor(idx) {
    this.idx = idx;
    this.x = game.player.x; this.y = game.player.y;
    this.state = 'home'; this.target = null; this.hitCD = 0;
    if (IMG_TEX.sword) {
      this.fx = new PIXI.Sprite(IMG_TEX.sword);
      this.fx.anchor.set(0.5);
      this.fx.width = 42; this.fx.height = 42; this.fx.tint = 0xffffff;
    } else {
      this.fx = new PIXI.Graphics();
      this.fx.beginFill(0x7cf0ff);
      this.fx.drawPolygon([-13, 0, -4, -3, 13, 0, -4, 3]);
      this.fx.endFill();
      this.fx.beginFill(0xffffff);
      this.fx.drawPolygon([3, 0, 13, 0, 4, -1.5, 4, 1.5]);
      this.fx.endFill();
    }
    app.stage.addChild(this.fx);
  }
  destroy() { app.stage.removeChild(this.fx); }
  tryHit(e, mul = 1) {
    if (this.hitCD > 0) return false;
    if (Math.hypot(e.x - this.x, e.y - this.y) < e.r + 12) {
      const sw = game.weapons['青元剑诀'] || { level: 1, evolved: false };
      const [dmg, isCrit] = calcSwordDmg(
        sw.level, game.playerAtk, sw.evolved, game.dmgMul,
        game.swordCritChance || 0, game.swordCritMul || 1.3
      );
      // 暴击红字放大；普通剑伤青色
      e.hurt(dmg * mul, isCrit ? 0xff3333 : 0x8fe8d0, isCrit);
      // 冰冻判定
      const freezeCh = game.swordFreezeChance || 0;
      if (freezeCh > 0 && Math.random() < freezeCh && !e.isBoss) {
        addEnemyBuff(e, 'freeze', 1000, this);
      }
      this.hitCD = 1000 * game.cdMul;
      burst(this.x, this.y, isCrit ? 0xff3333 : 0x8fe8d0, isCrit ? 5 : 3);
      return true;
    }
    return false;
  }
  flyTo(tx, ty, spd) {
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
    if (d > 1) {
      this.x += dx / d * Math.min(d, spd);
      this.y += dy / d * Math.min(d, spd);
      this.fx.rotation = Math.atan2(dy, dx);
    }
    return d;
  }
  update(dt) {
    if (this.hitCD > 0) this.hitCD -= dt;
    const px = game.player.x, py = game.player.y;
    const slot = slotPos(this);
    if (this.rot === undefined) this.rot = slot.ang + Math.PI / 2;
    const isMoving = (Math.hypot(mxGlobal, myGlobal) > 0.1) || game.dashTime > 0;
    const targetRot = isMoving ? game.arcRot : (slot.ang + Math.PI / 2);
    let rdiff = ((targetRot - this.rot) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    this.rot += rdiff * (isMoving ? 0.35 : 0.15);
    this.fx.rotation = this.rot;
    if (this.fx instanceof PIXI.Sprite) this.fx.tint = (this.state === 'out') ? 0xffd24a : 0xffffff;

    if (game.swordStance === 'orbit') {
      if (this.state === 'home') {
        this.x += (slot.x - this.x) * 0.3;
        this.y += (slot.y - this.y) * 0.3;
      } else if (this.state === 'out') {
        const t = this.target;
        if (!t || t.dead) { this.state = 'return'; }
        else {
          const d = this.flyTo(t.x, t.y, 8);
          if (this.tryHit(t, 1)) this.state = 'return';
          if (d < 4) this.state = 'return';
        }
      } else {
        const d = this.flyTo(slot.x, slot.y, 7);
        if (d < 6) { this.state = 'home'; this.target = null; }
      }
    } else if (game.swordStance === 'seek') {
      if (this.state === 'home') {
        this.x += (slot.x - this.x) * 0.3;
        this.y += (slot.y - this.y) * 0.3;
        if (Math.hypot(this.x - slot.x, this.y - slot.y) < 10 && this.hitCD <= 0) {
          const t = findEnemyInRange(app.screen.height * 0.66, game.player.x, game.player.y, true);
          if (t) { this.target = t; this.state = 'out'; }
        }
      } else if (this.state === 'out') {
        const t = this.target;
        if (!t || t.dead) { this.state = 'return'; }
        else {
          this.flyTo(t.x, t.y, 8);
          if (this.tryHit(t, 1)) this.state = 'return';
        }
      } else {
        const d = this.flyTo(slot.x, slot.y, 7);
        if (d < 6) { this.state = 'home'; this.target = null; }
      }
    } else {
      if (this.state === 'home') {
        this.x += (slot.x - this.x) * 0.3;
        this.y += (slot.y - this.y) * 0.3;
      } else if (this.state === 'out') {
        const t = this.target;
        if (!t || t.dead) { this.state = 'return'; }
        else {
          this.flyTo(t.x, t.y, 8);
          if (this.tryHit(t, 1.2)) this.state = 'return';
        }
      } else {
        const d = this.flyTo(slot.x, slot.y, 7);
        if (d < 6) { this.state = 'home'; this.target = null; }
      }
    }
    this.fx.position.set(this.x, this.y);
    this.fx.alpha = this.hitCD > 600 ? 0.55 : 1;
  }
}

export function updateArcTriggers() {
  const A = getArcCount();
  while (game.arcCD.length < A) game.arcCD.push(0);
  game.arcCD.length = A;
  for (let a = 0; a < A; a++) if (game.arcCD[a] > 0) game.arcCD[a] -= 16.7;
  const px = game.player.x, py = game.player.y;
  const arcSwords = a => game.swords.filter(s => s.arcIdx === a);
  const arcReady = a => arcSwords(a).every(s => s.state === 'home');
  if (game.swordStance === 'orbit') {
    for (const e of game.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - px, e.y - py);
      if (d > game.swordRadius + 70) continue;
      const eAng = Math.atan2(e.y - py, e.x - px);
      let bestArc = 0, bestDiff = Infinity;
      for (let a = 0; a < A; a++) {
        const s0 = arcSwords(a)[0];
        if (!s0) continue;
        const slotA = slotPos(s0).ang;
        let diff = Math.abs(((slotA - eAng) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
        if (diff < bestDiff) { bestDiff = diff; bestArc = a; }
      }
      if (game.arcCD[bestArc] <= 0 && arcReady(bestArc)) {
        game.arcCD[bestArc] = 1300;
        arcSwords(bestArc).forEach(s => { s.state = 'out'; s.target = e; });
      }
      break;
    }
  } else if (game.swordStance === 'group') {
    for (let a = 0; a < A; a++) {
      if (game.arcCD[a] > 0) continue;
      const t = findEnemyInRange(app.screen.width * 0.5, px, py, false);
      if (t) {
        game.arcCD[a] = 1600;
        arcSwords(a).forEach(s => { s.state = 'out'; s.target = t; });
      }
      break;
    }
  }
}

export function findEnemyInRange(range, x, y, random = false) {
  const pool = game.enemies.filter(e => !e.dead && Math.hypot(e.x - x, e.y - y) <= range);
  if (pool.length === 0) return null;
  if (!random) {
    let best = null, bd = Infinity;
    pool.forEach(e => {
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bd) { bd = d; best = e; }
    });
    return best;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export function findRandomEnemy() {
  const alive = game.enemies.filter(e => !e.dead);
  if (alive.length === 0) return null;
  return alive[Math.floor(Math.random() * alive.length)];
}

let _bugSeq = 0;
export class Bug {
  constructor() {
    this.id = ++_bugSeq;
    this.tar = null;
    if (IMG_TEX.bug) this.gfx = new PIXI.Sprite(IMG_TEX.bug);
    else {
      this.gfx = new PIXI.Sprite(PIXI.Texture.WHITE);
      this.gfx.alpha = 0;
    }
    this.gfx.anchor.set(0.5);
    this.applySkin();
    app.stage.addChild(this.gfx);
  }
  applySkin() {
    if (this.gfx instanceof PIXI.Sprite) {
      if (game.bugEvolved) { this.gfx.width = 72; this.gfx.height = 72; this.gfx.tint = 0xffffff; this.gfx.alpha = 1; }
      else { this.gfx.width = 36; this.gfx.height = 36; this.gfx.tint = 0x999999; this.gfx.alpha = 1; }
    }
  }
  destroy() { app.stage.removeChild(this.gfx); }
  update() {
    if (!this.tar || this.tar.dead) {
      this.tar = findRandomEnemy();
      if (!this.tar) {
        if (this.idleAngle === undefined) {
          this.idleAngle = Math.random() * Math.PI * 2;
          this.idleR = 300 + Math.random() * 100;
        }
        this.idleAngle += 0.02;
        const tx = game.player.x + Math.cos(this.idleAngle) * this.idleR;
        const ty = game.player.y + Math.sin(this.idleAngle) * this.idleR;
        const dx = tx - this.gfx.x, dy = ty - this.gfx.y;
        const d = Math.hypot(dx, dy);
        if (d > 3) { this.gfx.x += dx / d * 4; this.gfx.y += dy / d * 4; }
        return;
      }
    }
    const dx = this.tar.x - this.gfx.x, dy = this.tar.y - this.gfx.y, dist = Math.hypot(dx, dy);
    if (dist > 10) {
      const px = this.gfx.x, py = this.gfx.y;
      this.gfx.x += dx / dist * 7.2;
      this.gfx.y += dy / dist * 7.2;
      // ★ 飞行途中碰到其他敌人也造成一半伤害（线段-圆相交检测，防止高速穿透）
      const bugLv = (game.weapons['噬金虫'] && game.weapons['噬金虫'].level) || 1;
      const bugR = game.bugEvolved ? 36 : 18;
      for (const e of game.enemies) {
        if (e.dead || e === this.tar) continue;
        // 线段 (px,py)->(this.gfx.x,this.gfx.y) 到圆心 e 的最短距离 < e.r + bugR 即判定碰撞
        const ex = e.x, ey = e.y;
        const sx = this.gfx.x - px, sy = this.gfx.y - py;
        const t = Math.max(0, Math.min(1, ((ex - px) * sx + (ey - py) * sy) / (sx * sx + sy * sy || 1)));
        const cx = px + t * sx, cy = py + t * sy;
        if (Math.hypot(ex - cx, ey - cy) < e.r + bugR) {
          e.bugCD = e.bugCD || {};
          e.bugCD[this.id] = (e.bugCD[this.id] || 0) - 16.7;
          if (e.bugCD[this.id] <= 0) {
            e.hurt(calcBugDmg(bugLv, game.playerAtk, game.bugEvolved, game.dmgMul, true), 0xffcc44);
            e.bugCD[this.id] = 200;
          }
        }
      }
    } else {
      this.tar.bugCD = this.tar.bugCD || {};
      this.tar.bugCD[this.id] = (this.tar.bugCD[this.id] || 0) - 16.7;
      if (this.tar.bugCD[this.id] <= 0) {
        const bugLv = (game.weapons['噬金虫'] && game.weapons['噬金虫'].level) || 1;
        this.tar.hurt(calcBugDmg(bugLv, game.playerAtk, game.bugEvolved, game.dmgMul, false), 0xff3333, true);
        this.tar.bugCD[this.id] = 200;
      }
      this.tar = null;
    }
  }
}

export class Lightning {
  constructor(x, y, radius = 50, bolts = 1) {
    this.g = new PIXI.Graphics();
    this.g.beginFill(0xeeff88, 0.25);
    this.g.drawRect(x - radius, y - radius, radius * 2, radius * 2);
    this.g.endFill();
    this.g.lineStyle(2, 0xeeff88, 0.8);
    this.g.drawRect(x - radius, y - radius, radius * 2, radius * 2);
    for (let b = 0; b < bolts; b++) {
      const ox = (Math.random() - 0.5) * radius * 1.2;
      let bx = x + ox, by = y - 160;
      this.g.moveTo(bx, by);
      for (let i = 0; i < 6; i++) {
        bx = x + ox + (Math.random() - 0.5) * 26; by = y - 160 + (i + 1) * 26.6;
        this.g.lineTo(bx, by);
      }
      this.g.lineTo(x + ox, y);
    }
    this.g.lineStyle(0);
    this.life = 14;
    app.stage.addChild(this.g);
    game.enemies.forEach(e => {
      if (e.dead) return;
      if (Math.abs(e.x - x) <= radius && Math.abs(e.y - y) <= radius) {
        const isMo = (e.def.faction === 'mo');
        const lt = game.weapons['九霄神雷'] || { level: 1, evolved: false };
        e.hurt(calcLightningDmg(lt.level, game.playerAtk, lt.evolved, isMo, game.dmgMul), isMo ? 0xcc66ff : 0xeeff88, isMo);
      }
    });
    burst(x, y, 0xeeff88, 8);
  }
  update() {
    this.life--;
    this.g.alpha = this.life / 14;
    if (this.life <= 0) { app.stage.removeChild(this.g); return false; }
    return true;
  }
}

export class Orbit {
  constructor(idx, isOuter = false) {
    this.isOuter = isOuter;
    this.g = new PIXI.Graphics();
    this.redraw();
    this.idx = idx;
    this.hitTimer = 0;
    app.stage.addChild(this.g);
  }
  redraw() {
    this.g.clear();
    const sz = (game.orbitSize || 1);
    this.g.beginFill(this.isOuter ? 0x8866dd : 0xb08cff, 0.85);
    this.g.drawCircle(0, 0, 7 * sz);
    this.g.endFill();
    this.g.beginFill(0xffffff, 0.9);
    this.g.drawCircle(-2 * sz, -2 * sz, 2 * sz);
    this.g.endFill();
  }
  update(dt = 16.7) {
    const total = this.isOuter ? (game.orbitOuter || 0) : game.orbitCount;
    const a = game.orbitAngle + this.idx * (Math.PI * 2 / Math.max(1, total));
    const r = this.isOuter ? game.orbitRadius + 40 : game.orbitRadius;
    this.g.position.set(game.player.x + Math.cos(a) * r, game.player.y + Math.sin(a) * r);
    // ★ 碰撞伤害：每个幡独立 300ms 冷却
    this.hitTimer -= dt;
    if (this.hitTimer > 0) return;
    const od = game.weapons['摄魂幡'] || { level: 1, evolved: false };
    const dmg = calcOrbitDmg(od.level, game.playerAtk, od.evolved, game.dmgMul);
    for (const e of game.enemies) {
      if (e.dead) continue;
      if (Math.hypot(this.g.x - e.x, this.g.y - e.y) < e.r + 8) {
        e.hurt(dmg, 0xb08cff);
        this.hitTimer = 300;
      }
    }
  }
  destroy() { app.stage.removeChild(this.g); }
}
