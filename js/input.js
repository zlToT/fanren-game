// ============================================================
// input.js — 玩家输入
// 键盘/按钮事件绑定，瞬身闪避（tryDash）、剑式切换（cycleStance）、
// 辟邪神雷释放（castThunder）。
// ============================================================

import * as PIXI from 'pixi.js';
import { app, game, gameStarted, keys, mxGlobal, myGlobal, setMove } from './state.js';
import { playSound } from './audio.js';
import { toast } from './ui.js';
import { calcThunderBoltDmg, calcThunderRingDmg } from './calculate.js';
import { STANCES, STANCE_NAMES } from './config.js';
import { shake, spawnThunderBolts } from './fx.js';

export function tryDash() {
  if (game.dashCD > 0 || game.paused) return;
  // 法则锁链定身时禁止瞬身
  import('./buff.js').then(m => {
    if (m.hasBuff(game, 'chainLock')) { toast('被法则锁链定身！'); return; }
    game.dashCDMax = 8000 * game.cdMul;
    game.dashCD = game.dashCDMax;
    game.dashTime = 190;
    game.invulnTimer = Math.max(game.invulnTimer, 2000);
    m.addPlayerBuff('dashInvuln', 2000);
    if (mxGlobal !== 0 || myGlobal !== 0) {
      const m2 = Math.hypot(mxGlobal, myGlobal);
      game.dashDirX = mxGlobal / m2; game.dashDirY = myGlobal / m2;
    }
    playSound('dash');
  });
}

export function cycleStance() {
  const i = STANCES.indexOf(game.swordStance);
  game.swordStance = STANCES[(i + 1) % STANCES.length];
  toast(STANCE_NAMES[game.swordStance]);
}

export function castThunder() {
  if (!gameStarted || game.over || game.paused || !app.stage) return;
  if (game.thunderCD > 0) {
    toast(`神雷冷却中 ${(game.thunderCD / 1000).toFixed(1)}s`);
    return;
  }
  if (game.thunderCharge < 100) {
    toast('雷源不足！击杀敌人积攒雷源');
    return;
  }
  game.thunderCharge = 0;
  game.thunderCD = 10000 * game.cdMul;
  const px = game.player.x, py = game.player.y;
  const R = 240;
  playSound('thunder');
  // 震屏 + 白闪
  if (typeof shake === 'function') shake(600);
  game.hitFlash = 0.6;
  toast('⚡ 辟邪神雷！万邪辟易！');
  // 清屏弹幕/血云
  game.projectiles.forEach(p => { if (p.release) p.release(); });
  game.projectiles = [];
  game.clouds.forEach(c => { if (c.destroy) c.destroy(); });
  game.clouds = [];
  // ★ 一段伤害：240px范围内，逐怪判断魔修
  game.enemies.forEach(e => {
    if (e.dead) return;
    if (Math.hypot(e.x - px, e.y - py) < R) {
      const isMo = e.def && e.def.faction === 'mo';
      e.hurt(calcThunderBoltDmg(game.playerAtk, isMo, game.dmgMul), isMo ? 0xcc66ff : 0xeeff88, isMo);
    }
  });
  // 8道闪电视觉（从空中劈下）
  spawnThunderBolts(px, py, R);
  // ★ 二段伤害：金色扩散圈，全屏
  const ring = new PIXI.Graphics();
  ring.position.set(px, py);
  app.stage.addChild(ring);
  let ringR = 10;
  const ringMaxR = Math.max(app.screen.width, app.screen.height);
  const ringTick = () => {
    ringR += 12;
    ring.clear();
    ring.lineStyle(8, 0xffdd44, 0.9); ring.drawCircle(0, 0, ringR);
    ring.lineStyle(4, 0xffffff, 0.7); ring.drawCircle(0, 0, ringR - 12);
    ring.alpha = Math.max(0, 1 - ringR / ringMaxR);
    if (ringR >= ringMaxR) { app.stage.removeChild(ring); return; }
    requestAnimationFrame(ringTick);
  };
  ringTick();
  // 延迟0.4秒后对全屏敌人造成二段伤害，逐怪判断魔修
  setTimeout(() => {
    game.enemies.forEach(e => {
      if (e.dead) return;
      const isMo = e.def && e.def.faction === 'mo';
      e.hurt(calcThunderRingDmg(game.playerAtk, isMo, game.dmgMul), isMo ? 0xcc66ff : 0xffdd44, isMo);
    });
  }, 400);
}

export function initInput() {
  addEventListener('keydown', e => {
    if (game.over) return;
    if (game.__aiFocus) return; // AI 输入框聚焦时屏蔽
    keys[e.code] = true;
    if (e.code === 'Space') { tryDash(); e.preventDefault(); }
    if (e.code === 'KeyQ') cycleStance();
    if (e.code === 'KeyE') castThunder();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  document.getElementById('btnDash').addEventListener('click', e => { e.preventDefault(); tryDash(); });
  document.getElementById('btnStance').addEventListener('click', e => { e.preventDefault(); cycleStance(); });
  document.getElementById('btnThunder').addEventListener('click', e => { e.preventDefault(); castThunder(); });
}
