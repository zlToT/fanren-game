// ============================================================
// player.js — 玩家类
// 玩家实体：移动、方向动画、计时器（瞬身/雷源）、
// 水牢锁定、视觉表现（playerGfx/dashRing/stealthRing）。
// ============================================================

import { app, game, keys, playerGfx, playerDir, charTex, charReady, dashRing, stealthRing, setPlayerDirState, mxGlobal, myGlobal } from './state.js';
import { hasBuff } from './buff.js';
import * as PIXI from 'pixi.js';

export class Player {
  constructor() {
    this.animT = 0;
    this.hpBar = null; // 延迟创建，等 app.stage 就绪
  }

  update(dt, mx, my, m) {
    // 水牢锁定
    if (game.waterPrison) {
      const wd = game.waterPrison;
      const pd = Math.hypot(game.player.x - wd.x, game.player.y - wd.y);
      if (pd > wd.r) {
        const ang = Math.atan2(game.player.y - wd.y, game.player.x - wd.x);
        game.player.x = wd.x + Math.cos(ang) * wd.r;
        game.player.y = wd.y + Math.sin(ang) * wd.r;
      }
    }

    // 法则锁链：不能移动
    const locked = hasBuff(game, 'chainLock');

    // 移动：瞬身优先（chainLock 时连瞬身也禁止）
    if (!locked && game.dashTime > 0) {
      game.dashTime -= dt;
      game.player.x += game.dashDirX * 14;
      game.player.y += game.dashDirY * 14;
    } else if (!locked) {
      const spd = game.player.speed;
      game.player.x += mx * spd;
      game.player.y += my * spd;
    }

    // 边界
    game.player.x = Math.max(20, Math.min(app.screen.width - 20, game.player.x));
    game.player.y = Math.max(20, Math.min(app.screen.height - 20, game.player.y));

    // 位置同步到 PIXI
    playerGfx.position.set(game.player.x, game.player.y);

    // 方向动画
    if (m > 0.1) {
      this.animT += dt;
      if (charReady && playerGfx._spr) {
        let dir = playerDir;
        if (Math.abs(mx) > Math.abs(my)) dir = mx > 0 ? 'right' : 'left';
        else dir = my > 0 ? 'down' : 'up';
        if (dir !== playerDir) {
          setPlayerDirState(dir);
          playerGfx._spr.texture = charTex[dir];
          playerGfx._spr.anchor.set(0.5);
        }
      }
    }

    // 计时器
    if (game.dashCD > 0) game.dashCD -= dt;
    if (game.thunderCD > 0) game.thunderCD -= dt;
    game.thunderCharge = game.thunderCD > 0 ? game.thunderCharge : Math.min(100, game.thunderCharge + dt * 100 / 50000);
    if (game.hitFlash > 0) game.hitFlash -= dt / 300;
    document.getElementById('damageFlash').style.opacity = game.hitFlash > 0 ? 0.8 : 0;

    // 无敌圈（瞬身/GM无敌 全程显示）
    dashRing.visible = hasBuff(game, 'dashInvuln');
    dashRing.position.set(game.player.x, game.player.y);
    if (stealthRing) {
      stealthRing.visible = game.stealth || game.forceStealth;
      stealthRing.position.set(game.player.x, game.player.y);
    }

    // ★ 玩家头顶绿色血条（人物上方，buff图标下方）
    if (!this.hpBar && app.stage) {
      this.hpBar = new PIXI.Graphics();
      app.stage.addChild(this.hpBar);
    }
    if (this.hpBar) {
      const bw = 36, bh = 4;
      const bx = game.player.x - bw / 2;
      const by = game.player.y - 28;
      this.hpBar.clear();
      this.hpBar.beginFill(0x000000, 0.6);
      this.hpBar.drawRect(bx - 1, by - 1, bw + 2, bh + 2);
      this.hpBar.endFill();
      this.hpBar.beginFill(0x22aa33);
      this.hpBar.drawRect(bx, by, bw * Math.max(0, game.hp / game.maxHp), bh);
      this.hpBar.endFill();
    }
  }

  reset() {
    game.player.x = app.screen.width / 2;
    game.player.y = app.screen.height / 2;
    playerGfx.position.set(game.player.x, game.player.y);
    playerGfx.visible = true;
  }
}

export const player = new Player();
