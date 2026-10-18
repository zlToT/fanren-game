// ============================================================
// fsm/states/elite.js — 特殊精英怪状态
// brute / charge / tank / shooter
// ============================================================

import { State } from '../State.js';
import { game, app } from '../../state.js';
import { MAX_BULLETS } from '../../config.js';
import { createProjectile } from '../../projectiles.js';
import { burst } from '../../fx.js';

export class EliteBrute extends State {
  update(dt) {
    this.e.moveToward(game.player.x, game.player.y, this.e.spd);
  }
}

export class EliteCharge extends State {
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
    } else if (e.chargeTimer <= 0 && d < 360) {
      e.chargeTimer = e.def.chargeCD || 2600;
      e.charging = true; e.chargeCount = 45;
      e.chargeAngle = Math.atan2(py - e.y, px - e.x);
    } else {
      e.moveToward(px, py, e.spd);
    }
  }
}

export class EliteTank extends State {
  update(dt) {
    this.e.moveToward(game.player.x, game.player.y, this.e.spd);
  }
}

export class EliteShooter extends State {
  update(dt) {
    const e = this.e;
    const px = game.player.x, py = game.player.y;
    const d = Math.hypot(px - e.x, py - e.y);
    if (d > e.def.keepDist + 30 || e.def.keepDist === undefined) e.moveToward(px, py, e.spd);
    else if (d < 160) e.moveToward(px, py, -e.spd * 0.7);
    e.shootTimer -= dt;
    if (e.shootTimer <= 0 && d < app.screen.width * 0.8) {
      e.shootTimer = 1300;
      const ang = Math.atan2(py - e.y, px - e.x);
      if (game.projectiles.length < MAX_BULLETS)
        game.projectiles.push(createProjectile(e.x, e.y, ang, e.dmg * 3, 0xff66cc));
      burst(e.x, e.y, 0xff66cc, 3);
    }
  }
}
