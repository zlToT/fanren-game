// ============================================================
// projectiles.js — 敌方弹幕与技能投射物
// 普通子弹、血云雾、冲击波、追踪紫魔球、血魔刃（CrescentBlade）、
// 霆雷（LightningBolt）、五色神光（FullBeam）、法则锁链（GoldenChain）、
// 魔魂火浪（FireWave）、魔化巨手（GiantHand）。
// ============================================================

import * as PIXI from 'pixi.js';
import { app, game } from './state.js';
import { MAX_BULLETS, BULLET_LIFE } from './config.js';
import { boss3_giantHand } from './calculate.js';
import { burst, shake, playerHurt } from './fx.js';
import { playHitSound, playSound } from './audio.js';
import { addPlayerBuff } from './buff.js';

// ===== 子弹对象池 =====
const _projectilePool = [];
const MAX_PROJ_POOL = 100;

export class Projectile {
  constructor() {
    this.g = new PIXI.Graphics();
    app.stage.addChild(this.g);
  }
  init(x, y, angle, dmg, color = 0xff44aa, big = 1, speed = 3.2) {
    this.g.clear();
    const s = big;
    this.g.beginFill(color);
    this.g.drawPolygon([0, -7 * s, 5 * s, 0, 0, 7 * s, -5 * s, 0]);
    this.g.endFill();
    this.g.beginFill(0xffffff);
    this.g.drawCircle(0, 0, 2 * s);
    this.g.endFill();
    this.g.position.set(x, y);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.dmg = dmg;
    this.life = BULLET_LIFE;
    this.big = big;
  }
  update() {
    this.g.x += this.vx; this.g.y += this.vy;
    this.life--;
    const d = Math.hypot(this.g.x - game.player.x, this.g.y - game.player.y);
    if (d < 14 + 6 * this.big) {
      playerHurt(this.dmg);
      burst(this.g.x, this.g.y, 0xff66cc, 4);
      this.release();
      return false;
    }
    if (this.g.x < -80 || this.g.x > app.screen.width + 80 || this.g.y < -80 || this.g.y > app.screen.height + 80) { this.release(); return false; }
    if (this.life <= 0) { this.release(); return false; }
    return true;
  }
  release() {
    if (_projectilePool.length < MAX_PROJ_POOL) {
      app.stage.removeChild(this.g);
      _projectilePool.push(this);
    } else {
      app.stage.removeChild(this.g);
      this.g.destroy();
    }
  }
}

// 创建子弹的工厂函数（从池里取）
export function createProjectile(x, y, angle, dmg, color, big, speed) {
  let p;
  if (_projectilePool.length > 0) {
    p = _projectilePool.pop();
    app.stage.addChild(p.g);
  } else {
    p = new Projectile();
  }
  p.init(x, y, angle, dmg, color, big, speed);
  return p;
}

export class BloodCloud {
  constructor(x, y, dmg = 6) {
    this.g = new PIXI.Graphics();
    this.g.beginFill(0xdd2233, 0.55);
    this.g.drawCircle(0, 8, 60); this.g.drawCircle(-50, -10, 42); this.g.drawCircle(50, -10, 42);
    this.g.drawCircle(-22, -38, 36); this.g.drawCircle(28, -38, 36);
    this.g.endFill();
    this.g.beginFill(0xff5566, 0.4);
    this.g.drawCircle(-16, -16, 22); this.g.drawCircle(22, 8, 18);
    this.g.endFill();
    this.g.position.set(x, y);
    this.x = x; this.y = y;
    this.dmg = dmg;
    this.life = 480; this.hitTimer = 0;
    app.stage.addChild(this.g);
  }
  update() {
    this.life--;
    const dx = game.player.x - this.x, dy = game.player.y - this.y, d = Math.hypot(dx, dy) || 1;
    this.x += dx / d * 1.54; this.y += dy / d * 1.54;
    this.g.position.set(this.x, this.y);
    this.g.alpha = 0.6 + 0.3 * Math.sin(this.life * 0.1);
    this.hitTimer--;
    if (d < 140 && this.hitTimer <= 0) {
      this.hitTimer = 18; // 0.3s 触发一次
      playerHurt(this.dmg, true);
    }
    if (this.life <= 0) { this.destroy(); return false; }
    return true;
  }
  destroy() { app.stage.removeChild(this.g); }
}

export class Shockwave {
  constructor(x, y, color = 0xcc3322, maxR = 280, dmg = 18) {
    this.g = new PIXI.Graphics();
    this.g.position.set(x, y);
    this.r = 10; this.maxR = maxR; this.dmg = dmg; this.hitDone = false;
    app.stage.addChild(this.g);
  }
  update(dt) {
    this.r += 5.5;
    this.g.clear();
    this.g.lineStyle(6, 0xff5544, 0.9); this.g.drawCircle(0, 0, this.r);
    this.g.lineStyle(3, 0xffaa66, 0.7); this.g.drawCircle(0, 0, this.r - 10);
    this.g.alpha = Math.max(0, 1 - this.r / this.maxR);
    const pd = Math.hypot(game.player.x - this.g.x, game.player.y - this.g.y);
    if (!this.hitDone && pd < this.r) {
      this.hitDone = true; playerHurt(this.dmg);
    }
    if (this.r > this.maxR) { app.stage.removeChild(this.g); return false; }
    return true;
  }
}

export class HomingOrb {
  constructor(x, y, color = 0xcc44ff, dmg = 12, spd = 2.8, life = 600, r = 12) {
    this.g = new PIXI.Graphics();
    this.g.beginFill(color); this.g.drawCircle(0, 0, r); this.g.endFill();
    this.g.beginFill(0xffffff, 0.6); this.g.drawCircle(-r * 0.25, -r * 0.25, r * 0.3); this.g.endFill();
    this.g.position.set(x, y);
    this.dmg = dmg; this.spd = spd; this.life = life; this.r = r;
    app.stage.addChild(this.g);
  }
  update(dt) {
    this.life -= dt;
    const dx = game.player.x - this.g.x, dy = game.player.y - this.g.y;
    const d = Math.hypot(dx, dy) || 1;
    this.g.x += dx / d * this.spd; this.g.y += dy / d * this.spd;
    if (Math.hypot(game.player.x - this.g.x, game.player.y - this.g.y) < this.r + 6) {
      playerHurt(this.dmg);
      app.stage.removeChild(this.g); return false;
    }
    if (this.life <= 0) { app.stage.removeChild(this.g); return false; }
    return true;
  }
}

export class CrescentBlade {
  constructor(x, y, angle, color = 0x222222, size = 1.5, spd = 6, dmg = 18) {
    this.g = new PIXI.Graphics();
    const s = size;
    this.g.beginFill(color, 0.95);
    this.g.drawRect(-6 * s, -50 * s, 12 * s, 90 * s);
    this.g.drawPolygon([-6 * s, -50 * s, 6 * s, -50 * s, 0, -64 * s]);
    this.g.endFill();
    this.g.beginFill(0x888888, 0.9);
    this.g.drawRect(-10 * s, 40 * s, 20 * s, 6 * s);
    this.g.endFill();
    this.g.rotation = angle + Math.PI / 2;
    this.g.position.set(x, y);
    this.vx = Math.cos(angle) * spd; this.vy = Math.sin(angle) * spd;
    this.dmg = dmg; this.life = 1800; this.size = size; this.hit = false;
    app.stage.addChild(this.g);
  }
  update(dt) {
    this.life -= dt;
    this.g.x += this.vx; this.g.y += this.vy;
    if (!this.hit && Math.hypot(game.player.x - this.g.x, game.player.y - this.g.y) < 30 * this.size) {
      this.hit = true; playerHurt(this.dmg, true);
    }
    if (this.life <= 0 || this.g.x < -100 || this.g.x > app.screen.width + 100 || this.g.y < -100 || this.g.y > app.screen.height + 100) {
      app.stage.removeChild(this.g); return false;
    }
    return true;
  }
}

export class LightningBolt {
  constructor(tx, ty, w = 40, dmg = 22) {
    this.g = new PIXI.Graphics();
    this.tx = tx; this.ty = ty; this.w = w; this.dmg = dmg;
    this.warnT = 800; this.struck = false; this.flashT = 300; this.hitDone = false;
    app.stage.addChild(this.g);
  }
  update(dt) {
    if (!this.struck) {
      this.g.clear();
      this.g.lineStyle(3, 0xcc66ff, 0.8);
      this.g.beginFill(0xcc66ff, 0.15); this.g.drawCircle(this.tx, this.ty, this.w); this.g.endFill();
      this.warnT -= dt;
      if (this.warnT <= 0) { this.struck = true; playSound('thunder'); shake(300); }
      return true;
    }
    this.g.clear();
    let lx = this.tx + (Math.random() - 0.5) * this.w, ly = -20;
    this.g.lineStyle(5, 0xffffff, 1);
    this.g.moveTo(lx, ly);
    for (let i = 0; i < 8; i++) { ly += (this.ty + 20) / 8; lx += (Math.random() - 0.5) * 30; this.g.lineTo(lx, ly); }
    this.g.lineStyle(12, 0x9933ff, 0.8);
    this.g.drawCircle(this.tx, this.ty, this.w);
    if (!this.hitDone && Math.hypot(game.player.x - this.tx, game.player.y - this.ty) < this.w) {
      this.hitDone = true; playerHurt(this.dmg, true);
    }
    this.flashT -= dt;
    if (this.flashT <= 0) { app.stage.removeChild(this.g); return false; }
    return true;
  }
}

export class FullBeam {
  constructor(angle, w = 60, dmg = 25) {
    this.g = new PIXI.Graphics();
    this.angle = angle; this.w = w; this.dmg = dmg;
    this.cx = game.player.x; this.cy = game.player.y;
    this.warnT = 900; this.firing = false; this.fireT = 300; this.hitDone = false;
    app.stage.addChild(this.g);
  }
  update(dt) {
    this.g.clear();
    if (!this.firing) {
      this.g.lineStyle(2, 0xffffff, 0.5);
      const len = Math.max(app.screen.width, app.screen.height);
      this.g.moveTo(this.cx - Math.cos(this.angle) * len, this.cy - Math.sin(this.angle) * len);
      this.g.lineTo(this.cx + Math.cos(this.angle) * len, this.cy + Math.sin(this.angle) * len);
      this.warnT -= dt;
      if (this.warnT <= 0) { this.firing = true; playSound('warn'); shake(200); }
    } else {
      const len = Math.max(app.screen.width, app.screen.height);
      const colors = [0xffff00, 0x00ff00, 0x00ffff, 0x0088ff, 0xcc00ff];
      const perpX = -Math.sin(this.angle), perpY = Math.cos(this.angle);
      colors.forEach((c, i) => {
        const offset = (i - 2) * (this.w / colors.length);
        const ox = perpX * offset, oy = perpY * offset;
        this.g.lineStyle(this.w / colors.length, c, 0.9);
        this.g.moveTo(this.cx + ox - Math.cos(this.angle) * len, this.cy + oy - Math.sin(this.angle) * len);
        this.g.lineTo(this.cx + ox + Math.cos(this.angle) * len, this.cy + oy + Math.sin(this.angle) * len);
      });
      if (!this.hitDone) {
        const dx = Math.cos(this.angle), dy = Math.sin(this.angle);
        const px = game.player.x - this.cx, py = game.player.y - this.cy;
        const proj = px * dx + py * dy;
        const perp = Math.abs(px * dy - py * dx);
        if (perp < this.w / 2 && proj > -len && proj < len) {
          this.hitDone = true; playerHurt(this.dmg, true);
        }
      }
      this.fireT -= dt;
      if (this.fireT <= 0) { app.stage.removeChild(this.g); return false; }
    }
    return true;
  }
}

export class GoldenChain {
  constructor(x, y, size = 110, dmg = 28) {
    this.g = new PIXI.Graphics();
    this.x = x; this.y = y; this.size = size; this.dmg = dmg;
    this.warnT = 700; this.struck = false; this.hitDone = false;
    app.stage.addChild(this.g);
  }
  update(dt) {
    this.g.clear();
    if (!this.struck) {
      this.g.lineStyle(3, 0xffd700, 0.8);
      this.g.beginFill(0xffd700, 0.1);
      this.g.drawRect(this.x - this.size, this.y - this.size, this.size * 2, this.size * 2);
      this.g.endFill();
      this.g.moveTo(this.x - this.size, this.y - this.size);
      this.g.lineTo(this.x + this.size, this.y + this.size);
      this.g.moveTo(this.x + this.size, this.y - this.size);
      this.g.lineTo(this.x - this.size, this.y + this.size);
      this.warnT -= dt;
      if (this.warnT <= 0) {
        this.struck = true; playSound('explode');
      }
      return true;
    }
    this.g.lineStyle(6, 0xffd700, 0.9);
    this.g.beginFill(0xffd700, 0.3);
    this.g.drawRect(this.x - this.size, this.y - this.size, this.size * 2, this.size * 2);
    this.g.endFill();
    this.g.moveTo(this.x - this.size, this.y - this.size);
    this.g.lineTo(this.x + this.size, this.y + this.size);
    this.g.moveTo(this.x + this.size, this.y - this.size);
    this.g.lineTo(this.x - this.size, this.y + this.size);
    if (!this.hitDone && Math.abs(game.player.x - this.x) < this.size && Math.abs(game.player.y - this.y) < this.size) {
      this.hitDone = true; playerHurt(this.dmg, true);
      addPlayerBuff('chainLock', 3000);
    }
    // chainLock buff 由 player.js 统一处理定身，这里不再手动拉位置（否则会瞬移）
    this.warnT = (this.warnT || 0) - dt;
    if (this.warnT < -400) { app.stage.removeChild(this.g); return false; }
    return true;
  }
}

export class FireWave {
  constructor(x, y, angle, dmg = 50) {
    this.g = new PIXI.Graphics();
    this.x = x; this.y = y; this.angle = angle; this.dist = 0; this.dmg = dmg;
    this.hitDone = false;
    app.stage.addChild(this.g);
  }
  update(dt) {
    this.dist += 5.4;
    this.g.clear();
    const cx = this.x + Math.cos(this.angle) * this.dist;
    const cy = this.y + Math.sin(this.angle) * this.dist;
    this.g.lineStyle(30, 0xff4400, 0.7);
    this.g.beginFill(0xff8800, 0.4);
    this.g.drawEllipse(cx, cy, 80, 40, this.angle);
    this.g.endFill();
    this.g.lineStyle(15, 0xffaa00, 0.6);
    this.g.drawEllipse(cx, cy, 60, 28, this.angle);
    if (!this.hitDone && Math.hypot(game.player.x - cx, game.player.y - cy) < 70) {
      this.hitDone = true;
      playerHurt(this.dmg, true);
    }
    if (this.dist > 1200) { app.stage.removeChild(this.g); return false; }
    return true;
  }
}

export class GiantHand {
  constructor(tx, ty, dmg = 100) {
    this.tx = tx; this.ty = ty; this.dmg = dmg;
    this.g = new PIXI.Graphics();
    this.g.scale.set(5, 5);
    this.g.lineStyle(3, 0x110018, 0.9);
    this.g.beginFill(0x1a0a28, 0.9);
    this.g.drawRoundedRect(-22, -18, 44, 40, 10);
    this.g.endFill();
    this.g.beginFill(0x2a1440, 0.95);
    for (let i = 0; i < 5; i++) {
      const fx = -18 + i * 9;
      this.g.drawRoundedRect(fx, -34 - (i === 0 || i === 4 ? 4 : 0), 7, 22, 3);
    }
    this.g.endFill();
    this.g.position.set(tx, ty - 160);
    this.g.alpha = 0.85;
    this.phase = 'warn'; this.timer = 800;
    app.stage.addChild(this.g);
  }
  update(dt) {
    this.timer -= dt;
    if (this.phase === 'warn') {
      this.g.alpha = 0.5 + 0.4 * Math.sin(this.timer * 0.02);
      if (this.timer <= 0) { this.phase = 'slam'; this.timer = 200; playSound('explode'); shake(300); }
    } else if (this.phase === 'slam') {
      this.g.y += 25;
      this.g.alpha = 1;
      if (this.g.y >= this.ty) {
        this.g.y = this.ty;
        burst(this.tx, this.ty, 0x331155, 16);
        if (Math.hypot(game.player.x - this.tx, game.player.y - this.ty) < 200) {
          playerHurt(this.dmg, true);
        }
        this.phase = 'fade'; this.timer = 300;
      }
    } else {
      this.g.alpha = Math.max(0, this.timer / 300);
      if (this.timer <= 0) { app.stage.removeChild(this.g); return false; }
    }
    return true;
  }
}

