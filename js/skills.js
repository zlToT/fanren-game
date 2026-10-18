// ============================================================
// skills.js — Boss 技能系统
// 预警打击（telegraphStrike）、预警区域（telegraphZone）、
// 血魔刃/迷魂幻惑/血祭之力/五色神光/霆雷/万灵血玺/
// 水牢/魔潮狂涌/血祭（triggerBloodSacrifice）/魔影分身（summonClone）等。
// ============================================================

import * as PIXI from 'pixi.js';
import { app, game, curLevel } from './state.js';
import { burst, showDamage, shake, playerHurt } from './fx.js';
import { playSound, playHitSound } from './audio.js';
import { CrescentBlade, FullBeam, LightningBolt, HomingOrb, createProjectile, Shockwave, GoldenChain, FireWave, GiantHand } from './projectiles.js';
import { toast, showSkillInfo } from './ui.js';
import { spawnEnemy } from './enemy.js';
import { CloneShoot } from './fsm/states/common.js';
import { boss1_featherBlade, boss4_fiveLights, boss4_thunderPillar, boss5_bloodSeal, boss2_bloodBlade, BUFF_CHARM_HP_MUL } from './calculate.js';
import { addEnemyBuff, addPlayerBuff } from './buff.js';

export function telegraphStrike(x, y, radius, color, delay, dmg, square) {
  const warn = new PIXI.Graphics();
  warn.lineStyle(3, color, 0.9);
  warn.beginFill(color, 0.15);
  if (square) warn.drawRect(x - radius, y - radius, radius * 2, radius * 2);
  else warn.drawCircle(x, y, radius);
  warn.endFill();
  warn.alpha = 0.5;
  app.stage.addChild(warn);
  let t = 0;
  const iv = setInterval(() => {
    if (game.over) { clearInterval(iv); app.stage.removeChild(warn); return; }
    t += 40;
    warn.alpha = 0.3 + 0.4 * Math.abs(Math.sin(t * 0.02));
    if (t >= delay) {
      clearInterval(iv);
      app.stage.removeChild(warn);
      burst(x, y, color, 14);
      playSound('explode');
      if (square) {
        const blk = new PIXI.Graphics();
        blk.beginFill(color, 0.85); blk.drawRect(-radius, -radius, radius * 2, radius * 2); blk.endFill();
        blk.position.set(x, y);
        app.stage.addChild(blk);
        let bl = 60;
        const bf = setInterval(() => {
          bl--; blk.alpha = bl / 60 * 0.85;
          if (bl <= 0) { clearInterval(bf); app.stage.removeChild(blk); }
        }, 30);
      }
      if (Math.hypot(game.player.x - x, game.player.y - y) < radius + 8) {
        playerHurt(dmg, true);
      }
    }
  }, 40);
}

export function telegraphZone(x, y, radius, color, delay, tickDps, duration) {
  const warn = new PIXI.Graphics();
  warn.lineStyle(3, color, 0.9);
  warn.beginFill(color, 0.15); warn.drawCircle(x, y, radius); warn.endFill();
  warn.alpha = 0.5;
  app.stage.addChild(warn);
  game.waterPrison = { x, y, r: radius, until: performance.now() + delay + duration };
  addPlayerBuff('waterPrison', delay + duration);
  let t = 0;
  let nextTick = delay + 500;
  const iv = setInterval(() => {
    if (game.over) { clearInterval(iv); app.stage.removeChild(warn); return; }
    t += 40;
    warn.alpha = 0.3 + 0.4 * Math.abs(Math.sin(t * 0.02));
    if (t >= delay && t >= nextTick) {
      nextTick += 500;
      if (Math.hypot(game.player.x - x, game.player.y - y) < radius) {
        playerHurt(tickDps);
      }
    }
    if (t >= delay + duration) {
      clearInterval(iv);
      app.stage.removeChild(warn);
      game.waterPrison = null;
    }
  }, 40);
}

export function skill_moxiBlade(bx, by, bossDmg = 90) {
  showSkillInfo('血魔刃', '古魔斩出多道血色剑气！');
  playSound('warn');
  const px = game.player.x, py = game.player.y;
  game.blades.push(new CrescentBlade(bx, by, Math.atan2(py - by, px - bx), 0xff2244, 2.45, 9, boss2_bloodBlade(bossDmg)));
  const corners = [[-100, -100], [app.screen.width + 100, -100], [-100, app.screen.height + 100], [app.screen.width + 100, app.screen.height + 100]];
  corners.forEach(([sx, sy]) => {
    game.blades.push(new CrescentBlade(sx, sy, Math.atan2(py - sy, px - sx), 0xff2244, 2.45, 9, boss2_bloodBlade(bossDmg)));
  });
}

export function skill_charm(boss) {
  showSkillInfo('迷魂幻惑', '元刹圣祖蛊惑周围魔物，其伤害与血量暴增！');
  playSound('warn');
  // ★ 脚下紫色圈圈范围（参考古魔魔气领域）
  if (!boss.charmAuraGfx) {
    boss.charmAuraGfx = new PIXI.Graphics();
    app.stage.addChild(boss.charmAuraGfx);
  }
  boss.charmAuraGfx.clear();
  boss.charmAuraGfx.beginFill(0xcc44aa, 0.15);
  boss.charmAuraGfx.drawCircle(boss.x, boss.y, 260);
  boss.charmAuraGfx.endFill();
  boss.charmAuraGfx.lineStyle(2, 0xcc44aa, 0.6);
  boss.charmAuraGfx.drawCircle(boss.x, boss.y, 260);
  boss.charmAuraT = 8000; // 持续8秒后消失

  let n = 0;
  game.enemies.forEach(e => {
    if (e.dead || e.isBoss) return;
    if (Math.hypot(e.x - boss.x, e.y - boss.y) < 260) {
      addEnemyBuff(e, 'enemyBuffDmg', 8000, boss);
      // ★ 强化小怪血量（仅首次强化时加）
      if (!e.charmed) {
        e.charmed = true;
        e.maxHp = Math.floor(e.maxHp * BUFF_CHARM_HP_MUL);
        e.hp = e.maxHp;
      }
      n++;
    }
  });
  if (n > 0) toast(`😵 ${n} 只魔物被幻惑强化！`);
}

export function skill_bloodFrenzy(boss) {
  showSkillInfo('血祭之力', '真仙马良血祭众魔，魔物伤害大增！');
  playSound('warn');
  let n = 0;
  game.enemies.forEach(e => {
    if (e.dead || e.isBoss) return;
    if (Math.hypot(e.x - boss.x, e.y - boss.y) < 300) {
      addEnemyBuff(e, 'enemyBuffRed', 10000, boss);
      n++;
    }
  });
  if (n > 0) toast(`🩸 ${n} 只魔物被血祭强化！`);
}

export function skill_fiveLights(bx, by, bossDmg = 100) {
  showSkillInfo('五色神光', '鱼店长展开五色神光激光！快离开那条线！');
  playSound('warn');
  const ang = Math.atan2(game.player.y - by, game.player.x - bx);
  game.beams.push(new FullBeam(ang, 225, boss4_fiveLights(bossDmg)));
}

export function skill_thunderP(bx, by, bossDmg = 100) {
  showSkillInfo('霆雷', '鱼店长引动紫色雷霆轰击你的位置！');
  playSound('warn');
  game.bolts.push(new LightningBolt(game.player.x, game.player.y, 80, boss4_thunderPillar(bossDmg)));
}

export function skill_bloodSeal(bossDmg = 120) {
  showSkillInfo('万灵血玺', '天空降下血印方玺，注意红色预警区域！');
  playSound('warn');
  const positions = [];
  for (let i = 0; i < 3; i++) {
    let px, py, ok = false;
    for (let tries = 0; tries < 20 && !ok; tries++) {
      px = game.player.x + (Math.random() - 0.5) * 300;
      py = game.player.y + (Math.random() - 0.5) * 300;
      ok = positions.every(p => Math.hypot(p.x - px, p.y - py) > 130);
    }
    positions.push({ x: px, y: py });
    telegraphStrike(px, py, 100, 0xdd2233, 900, boss5_bloodSeal(bossDmg), true);
  }
}

export function skill_featherBlade(bx, by, bossDmg = 80) {
  showSkillInfo('幻魔飞剑', '黑色飞剑来袭！');
  playSound('warn');
  const base = Math.atan2(game.player.y - by, game.player.x - bx);
  // 预警：800ms 红色箭头提示方向
  const warn = new PIXI.Graphics();
  warn.lineStyle(5, 0xff4444, 0.7);
  warn.moveTo(bx, by);
  warn.lineTo(bx + Math.cos(base) * 300, by + Math.sin(base) * 300);
  warn.moveTo(bx + Math.cos(base) * 240 - Math.sin(base) * 20, by + Math.sin(base) * 240 + Math.cos(base) * 20);
  warn.lineTo(bx + Math.cos(base) * 300, by + Math.sin(base) * 300);
  warn.lineTo(bx + Math.cos(base) * 240 + Math.sin(base) * 20, by + Math.sin(base) * 240 - Math.cos(base) * 20);
  app.stage.addChild(warn);
  let warnT = 800;
  const warnIv = setInterval(() => {
    warnT -= 40;
    warn.alpha = 0.4 + 0.4 * Math.sin(warnT * 0.03);
    if (warnT <= 0) {
      clearInterval(warnIv);
      app.stage.removeChild(warn);
      // 预警结束，发射飞剑（速度降低50%：spd 8→4）
      for (let i = 0; i < 5; i++)
        game.blades.push(new CrescentBlade(bx, by, base + (i - 2) * 0.16, 0x222222, 3.0, 4, boss1_featherBlade(bossDmg)));
    }
  }, 40);
}

export function skill_soulFire(bx, by, dmg = 50) {
  const ang = Math.atan2(game.player.y - by, game.player.x - bx);
  game.firewaves.push(new FireWave(bx, by, ang, dmg));
  game.firewaves.push(new FireWave(bx, by, ang + 0.3, dmg));
}

export function skill_magicTide(bx, by) {
  showSkillInfo('魔潮狂涌', '环形魔弹覆盖全场！');
  playSound('warn');
  for (let i = 0; i < 12; i++) game.projectiles.push(createProjectile(bx, by, i / 12 * Math.PI * 2, 12, 0xcc66ff, 1.5));
}

export function skill_crossWater(bx, by) {
  for (let i = 0; i < 4; i++) game.projectiles.push(createProjectile(bx, by, i * Math.PI / 2, 10, 0x44aaff, 1.4));
}

export function teleportAway(boss) {
  burst(boss.x, boss.y, 0x66aaff, 12);
  const ang = Math.random() * Math.PI * 2;
  const dist = 250 + Math.random() * 100;
  boss.x = game.player.x + Math.cos(ang) * dist;
  boss.y = game.player.y + Math.sin(ang) * dist;
  boss.x = Math.max(40, Math.min(app.screen.width - 40, boss.x));
  boss.y = Math.max(40, Math.min(app.screen.height - 40, boss.y));
  if (boss.gfx) boss.gfx.position.set(boss.x, boss.y);
  burst(boss.x, boss.y, 0x66aaff, 12);
}

export function triggerBloodSacrifice(boss) {
  game.freezeUntil = performance.now() + 5000;
  game.freezeMessage = '👁 血祭·天道轮回';
  showSkillInfo('血祭', '天道睁眼，万物寂灭！');
  try { for (let i = 0; i < 5; i++) setTimeout(() => playSound('warn'), i * 1000); } catch (e) { }
  const overlay = new PIXI.Graphics();
  overlay.beginFill(0x000000, 0.7); overlay.drawRect(0, 0, app.screen.width, app.screen.height); overlay.endFill();
  app.stage.addChild(overlay);
  const eye = new PIXI.Graphics();
  app.stage.addChild(eye);
  const cx = app.screen.width / 2, cy = app.screen.height / 2;
  const screenW = app.screen.width;
  const t0 = performance.now();
  const drawEye = () => {
    const el = performance.now() - t0;
    eye.clear();
    const blinkPhase = (el % 1667) / 1667;
    const close = blinkPhase < 0.15 ? (0.15 - blinkPhase) / 0.15 : (blinkPhase > 0.85 ? (blinkPhase - 0.85) / 0.15 : 0);
    const h = Math.max(4, 80 * (1 - close));
    eye.lineStyle(8, 0xffffff, 0.9);
    eye.drawEllipse(cx, cy, screenW * 0.45, h);
    eye.beginFill(0xcc2233, 0.9); eye.drawCircle(cx, cy, 50); eye.endFill();
    eye.beginFill(0x000000, 0.9); eye.drawCircle(cx, cy, 22); eye.endFill();
    if (el < 5000) requestAnimationFrame(drawEye);
    else {
      app.stage.removeChild(eye); app.stage.removeChild(overlay);
      game.enemies.forEach(e => { if (!e.dead && e.isBloodMob) e.destroy(); });
      game.enemies = game.enemies.filter(e => !e.dead);
      boss.hp = Math.max(boss.hp, boss.maxHp * 0.5);
      toast('👁 血祭结束，马良恢复50%血量！');
    }
  };
  drawEye();
  for (let i = 0; i < 100; i++) {
    setTimeout(() => {
      const e = spawnEnemy('moxiu');
      e.isBloodMob = true;
      e.gfx.tint = 0xff3344;
      e.x = Math.random() * app.screen.width;
      e.y = Math.random() * app.screen.height;
      e.gfx.position.set(e.x, e.y);
      game.enemies.push(e);
    }, i * 30);
  }
}

export function summonClone(boss) {
  const c = spawnEnemy('boss1');
  c.isBoss = false;
  c.isClone = true;
  c.behavior = 'clone_shoot';
  // ★ 重新初始化 FSM
  c.fsm.setState(CloneShoot);
  if (c.nameText) { app.stage.removeChild(c.nameText); c.nameText = null; }
  c.dmg *= 0.5;
  c.hp = c.maxHp = c.maxHp * 0.5;
  c.gfx.tint = 0xff7777;
  const ang = Math.random() * Math.PI * 2;
  c.x = boss.x + Math.cos(ang) * 90;
  c.y = boss.y + Math.sin(ang) * 90;
  c.gfx.position.set(c.x, c.y);
  game.enemies.push(c);
  boss.cloneRef = c;
  toast('👥 王婵召唤魔影分身！');
}
