// ============================================================
// fsm/states/common.js — 小怪通用状态
// Chase / Sway / Ranged / Charge
// ============================================================

import { State } from '../State.js';
import { game, app } from '../../state.js';
import { MAX_BULLETS } from '../../config.js';
import { createProjectile } from '../../projectiles.js';
import { burst } from '../../fx.js';

export class Chase extends State {
  update(dt) {
    const e = this.e;
    e.moveToward(game.player.x, game.player.y, e.spd);
  }
}

export class Sway extends State {
  enter() { this.e.swayPhase = Math.random() * Math.PI * 2; }
  update(dt) {
    const e = this.e;
    e.swayPhase += 0.06;
    const px = game.player.x, py = game.player.y;
    const dx = px - e.x, dy = py - e.y, dd = Math.hypot(dx, dy) || 1;
    const nx = dx / dd, ny = dy / dd;
    const pxn = -ny, pyn = nx;
    const sway = Math.sin(e.swayPhase) * 0.8;
    e.x += (nx + pxn * sway) * e.spd;
    e.y += (ny + pyn * sway) * e.spd;
    e.anim += 0.15;
  }
}

export class Ranged extends State {
  update(dt) {
    const e = this.e;
    const px = game.player.x, py = game.player.y;
    const d = Math.hypot(px - e.x, py - e.y);
    if (d > e.def.keepDist + 30) e.moveToward(px, py, e.spd);
    else if (d < e.def.keepDist - 40) e.moveToward(px, py, -e.spd * 0.7);
    e.shootTimer -= dt;
    if (e.shootTimer <= 0 && d < app.screen.width * 0.7) {
      e.shootTimer = e.def.shootCD;
      if (game.projectiles.length < MAX_BULLETS) {
        const ang = Math.atan2(py - e.y, px - e.x);
        game.projectiles.push(createProjectile(e.x, e.y, ang, e.dmg * 3, 0xffaa22));
        burst(e.x, e.y, 0xff66cc, 3);
      }
    }
  }
}

export class Charge extends State {
  update(dt) {
    const e = this.e;
    const px = game.player.x, py = game.player.y;
    const d = Math.hypot(px - e.x, py - e.y);
    e.chargeTimer -= dt;
    if (e.charging) {
      e.x += Math.cos(e.chargeAngle) * e.spd * 4.5;
      e.y += Math.sin(e.chargeAngle) * e.spd * 4.5;
      e.chargeCount--;
      if (e.chargeCount <= 0) e.charging = false;
    } else if (e.chargeTimer <= 0 && d < 300) {
      e.chargeTimer = e.def.chargeCD;
      e.charging = true; e.chargeCount = 40;
      e.chargeAngle = Math.atan2(py - e.y, px - e.x);
    } else {
      e.moveToward(px, py, e.spd);
    }
  }
}

export class CloneShoot extends State {
  update(dt) {
    const e = this.e;
    const px = game.player.x, py = game.player.y;
    const d = Math.hypot(px - e.x, py - e.y);
    if (d > 200) e.moveToward(px, py, e.spd);
    else if (d < 120) e.moveToward(px, py, -e.spd * 0.6);
    e.shootTimer -= dt;
    if (e.shootTimer <= 0) {
      e.shootTimer = 1500;
      const ang = Math.atan2(py - e.y, px - e.x);
      if (game.projectiles.length < MAX_BULLETS)
        game.projectiles.push(createProjectile(e.x, e.y, ang, e.dmg * 3, 0xcc44aa));
      burst(e.x, e.y, 0xcc44aa, 3);
    }
  }
}
