// ============================================================
// enemy.js — 敌人
// Enemy 类（普通怪/精英怪/Boss），AI 行为树（chase/sway/ranged/
// charge/各 Boss 阶段技能），生成波次（getWave/pickType）、
// 特殊精英（makeSpecialElite）、掉落物。
// ============================================================

import * as PIXI from 'pixi.js';
import { app, game, curLevel, IMG_TEX } from './state.js';
import { ENEMY_STATS, MAX_BULLETS, ELITE_BEHAVIORS, LEVELS_BOSS_DMG_ADD } from './config.js';
import { playSound, playHitSound } from './audio.js';
import { burst, showDamage, shake, playerHurt } from './fx.js';
import { isMobile } from './touch.js';
import { createProjectile, BloodCloud, Shockwave, HomingOrb, CrescentBlade, GiantHand, GoldenChain, FireWave } from './projectiles.js';
import { findEnemyInRange } from './weapons.js';
import { toast, showSkillInfo } from './ui.js';
import { drawEnemyBuffIcon } from './buff.js';
import { calcMonsterTouchDmg, calcMonsterBulletDmg, BOSS_CLONE_MUL, boss1_bloodCloud, boss2_auraDps, boss2_bloodBlade, boss2_soulFire, boss5_goldenChain, boss5_xianDomain, boss4_waterOrb, boss4_waterPrison, boss3_bullet, eliteTank_deathExplosion } from './calculate.js';
import { boss3_homingOrb, boss3_giantHand } from './calculate.js';
import { FSM } from './fsm/FSM.js';
import { Chase, Sway, Ranged, Charge, CloneShoot } from './fsm/states/common.js';
import { EliteBrute, EliteCharge, EliteTank, EliteShooter } from './fsm/states/elite.js';
import {
  skill_moxiBlade, skill_charm, skill_bloodFrenzy, skill_fiveLights, skill_thunderP,
  skill_bloodSeal, skill_featherBlade, skill_soulFire, skill_magicTide, skill_crossWater,
  teleportAway, triggerBloodSacrifice, summonClone, telegraphZone
} from './skills.js';

// ★ behavior → State 类映射
const BEHAVIOR_STATES = {
  'chase': Chase,
  'sway': Sway,
  'ranged': Ranged,
  'charge': Charge,
  'clone_shoot': CloneShoot,
  'elite_brute': EliteBrute,
  'elite_charge': EliteCharge,
  'elite_tank': EliteTank,
  'elite_shooter': EliteShooter,
};

// ===== 敌人对象池 =====
const _enemyPool = [];
const MAX_ENEMY_POOL = 100;

// ===== 经验球对象池 =====
const _orbPool = [];
const MAX_ORB_POOL = 200;

export class Enemy {
  constructor() {
    // 基础 PIXI 对象只创建一次（池化复用）
    this.gfx = new PIXI.Graphics();
    this.hpBar = new PIXI.Graphics();
    app.stage.addChild(this.gfx);
    app.stage.addChild(this.hpBar);
    this.nameText = null;
    this.fsm = new FSM(this);
  }

  // ★ 从池里取出后初始化
  init(type = "normal", isElite = false) {
    this.type = type;
    this.dead = false;
    const s = ENEMY_STATS[type];
    this.isElite = !!isElite;
    this.isBoss = !!s.bname && !isElite;
    // waveScale：开局 ×1，后期 ×1.5（前期平滑，后期略硬）
    const waveScale = this.isBoss ? 1 : (1 + (1 - game.time / curLevel.dur) * 0.5);
    // ★ 时间成长：每分钟 +10% HP（按已经过的时间算）
    const elapsedMin = (curLevel.dur - game.time) / 60;
    const timeScale = this.isBoss ? 1 : (1 + 0.10 * elapsedMin);
    this.hp = s.hp * waveScale * timeScale * (this.isBoss ? 1 : curLevel.hpMul * 1.5);
    this.maxHp = this.hp;
    this.spd = s.spd;
    this.r = s.r * (this.isBoss ? 1 : 1.3);
    this.color = s.color;
    this.dmg = s.dmg;
    this.expVal = s.exp;
    this.behavior = s.behavior;
    this.def = s;
    this.faction = s.faction;
    this.shootTimer = (s.shootCD || 0) * Math.random();
    this.chargeTimer = (s.chargeCD || 0) * Math.random();
    this.skillTimer = 4000 + Math.random() * 2000;
    this.skill2Timer = 7000;
    this.touchTimer = 0;
    this.charging = false;
    this.chargeAngle = 0;
    this.chargeCount = 0;
    this.swayPhase = Math.random() * Math.PI * 2;
    this.anim = Math.random() * Math.PI * 2;
    this.dmgBuff = 1;
    this.buffTimer = 0;
    this.auraOn = false;
    // 随机出生位置
    if (isMobile()) {
      // ★ 手机端：刷在屏幕边缘外（考虑镜头偏移），再走进来
      const sw = app.screen.width, sh = app.screen.height;
      const camX = game.camX || 0, camY = game.camY || 0;
      const side = Math.floor(Math.random() * 4);
      if (side === 0) { this.x = camX + Math.random() * sw; this.y = camY - 30; }
      else if (side === 1) { this.x = camX + sw + 30; this.y = camY + Math.random() * sh; }
      else if (side === 2) { this.x = camX + Math.random() * sw; this.y = camY + sh + 30; }
      else { this.x = camX - 30; this.y = camY + Math.random() * sh; }
    } else {
      // PC 端：从屏幕边缘生成
      const side = Math.floor(Math.random() * 4);
      if (side === 0) { this.x = Math.random() * app.screen.width; this.y = -30; }
      else if (side === 1) { this.x = app.screen.width + 30; this.y = Math.random() * app.screen.height; }
      else if (side === 2) { this.x = Math.random() * app.screen.width; this.y = app.screen.height + 30; }
      else { this.x = -30; this.y = Math.random() * app.screen.height; }
    }
    // 重绘画 body
    if (this._isSpriteGfx) {
      // 之前用的是 Sprite（Boss 图片），换回 Graphics
      app.stage.removeChild(this.gfx);
      this.gfx = new PIXI.Graphics();
      app.stage.addChild(this.gfx);
      this._isSpriteGfx = false;
    }
    this.gfx.clear();
    this.drawBody();
    this.gfx.position.set(this.x, this.y);
    this.gfx.visible = true;
    // Boss 图片替换
    if (/^boss[1-5]$/.test(type) && !isElite && IMG_TEX[type]) {
      app.stage.removeChild(this.gfx);
      this.gfx = new PIXI.Sprite(IMG_TEX[type]);
      this.gfx.anchor.set(0.5);
      this.gfx.width = this.gfx.height = this.r * 4.2;
      this.gfx.position.set(this.x, this.y);
      app.stage.addChild(this.gfx);
      this._isSpriteGfx = true;
    }
    // ★ 视觉半高：Boss 贴图边长 r*4.2 → 半高 r*2.1；普通怪 Graphics 半径即 r
    //   血条 / buff 图标 / 名字都贴这个顶边排，调 r 时自动跟着怪物体型走
    this.visualHalfH = this._isSpriteGfx ? this.r * 2.1 : this.r;
    // 血条
    this.hpBar.clear();
    this.hpBar.visible = true;
    // Boss 名字
    if (this.nameText) {
      this.nameText.visible = false;
    }
    if (s.bname && this.isBoss) {
      if (!this.nameText) {
        this.nameText = new PIXI.Text('', { fontFamily: 'Arial', fontSize: 14, fill: 0xff8899, stroke: 0x000000, strokeThickness: 4, fontWeight: 'bold' });
        this.nameText.anchor.set(0.5);
        app.stage.addChild(this.nameText);
      }
      this.nameText.text = s.bname;
      this.nameText.visible = true;
      this.nameText.position.set(this.x, this.y - this.visualHalfH - 34);
    }
    // 重置 FSM
    this.fsm.state = null;
    const StateClass = BEHAVIOR_STATES[this.behavior];
    if (StateClass) this.fsm.setState(StateClass);
    return this;
  }

  // ★ 归还到池里
  release() {
    this.dead = true;
    this.gfx.visible = false;
    this.hpBar.visible = false;
    if (this.nameText) this.nameText.visible = false;
    if (this.auraGfx) { app.stage.removeChild(this.auraGfx); this.auraGfx = null; this.auraOn = false; }
    if (this.charmAuraGfx) { app.stage.removeChild(this.charmAuraGfx); this.charmAuraGfx = null; }
    // ★ 清理挂在敌人身上的 buff 图标（防止死亡后图标残留）
    if (this.buffs) {
      for (const b of this.buffs) {
        if (b.iconGfx && b.iconGfx.parent) b.iconGfx.parent.removeChild(b.iconGfx);
      }
      this.buffs = [];
    }
    this.frozen = false;
    if (_enemyPool.length < MAX_ENEMY_POOL) {
      _enemyPool.push(this);
    }
  }
  drawBody() {
    const g = this.gfx, R = this.r; g.clear();
    switch (this.type) {
      case 'normal': {
        g.beginFill(this.color); g.drawEllipse(0, 0, R * 1.1, R * 0.8); g.endFill();
        g.beginFill(0x551111); g.drawCircle(R * 0.7, -R * 0.2, R * 0.45); g.endFill();
        g.beginFill(0xffee88); g.drawCircle(R * 0.85, -R * 0.35, 1.5); g.endFill();
        g.lineStyle(2, 0x883333, 1);
        for (let i = -1; i <= 1; i++) {
          g.moveTo(i * R * 0.5, -R * 0.7); g.lineTo(i * R * 0.5 - 3, -R * 1.2);
          g.moveTo(i * R * 0.5, R * 0.6); g.lineTo(i * R * 0.5 - 3, R * 1.1);
        }
        g.lineStyle(0); break;
      }
      case 'fast': {
        g.beginFill(this.color);
        g.drawPolygon([0, -R * 0.6, R * 1.8, -R * 1.4, R * 1.2, 0, R * 1.6, R * 1.0, 0, R * 0.5, -R * 1.6, R * 1.0, -R * 1.2, 0, -R * 1.8, -R * 1.4]);
        g.endFill();
        g.beginFill(0x330066); g.drawCircle(0, 0, R * 0.55); g.endFill();
        g.beginFill(0xff4444); g.drawCircle(-2, -1, 1.3); g.drawCircle(2, -1, 1.3); g.endFill();
        break;
      }
      case 'shooter': {
        g.beginFill(this.color); g.drawEllipse(R * 0.3, 0, R, R * 0.65); g.endFill();
        g.beginFill(this.color); g.drawCircle(-R * 0.9, 0, R * 0.5); g.endFill();
        g.lineStyle(2, 0xffffff, 0.9);
        g.moveTo(-R * 1.1, -R * 0.4); g.lineTo(-R * 0.95, -R * 1.2); g.lineTo(-R * 0.7, -R * 0.45);
        g.moveTo(-R * 0.7, -R * 0.4); g.lineTo(-R * 0.55, -R * 1.15); g.lineTo(-R * 0.4, -R * 0.42);
        g.lineStyle(0);
        g.beginFill(0xffdddd);
        g.drawPolygon([R * 1.1, 0, R * 1.9, -R * 0.7, R * 1.7, 0, R * 1.9, R * 0.7]);
        g.endFill();
        g.beginFill(0x662244); g.drawCircle(-R * 1.0, -R * 0.1, 1.5); g.endFill();
        break;
      }
      case 'tank': {
        g.beginFill(this.color); g.drawRect(-R * 0.85, -R * 0.85, R * 1.7, R * 1.7); g.endFill();
        g.beginFill(0x666688); g.drawRect(-R * 0.85, -R * 0.85, R * 1.7, R * 0.5); g.endFill();
        g.lineStyle(2, 0x444466, 1);
        g.moveTo(-R * 0.4, -R * 0.3); g.lineTo(-R * 0.1, R * 0.1); g.lineTo(-R * 0.3, R * 0.5);
        g.moveTo(R * 0.2, -R * 0.5); g.lineTo(R * 0.4, -R * 0.1);
        g.lineStyle(0);
        g.beginFill(0xffcc44); g.drawCircle(-R * 0.3, -R * 0.2, 2.5); g.drawCircle(R * 0.3, -R * 0.2, 2.5); g.endFill();
        break;
      }
      case 'splitter': {
        g.beginFill(this.color);
        g.drawPolygon([-R, R * 0.5, -R * 0.8, -R * 0.4, -R * 0.3, -R, R * 0.3, -R, R * 0.8, -R * 0.4, R, R * 0.5, R * 0.5, R, -R * 0.5, R]);
        g.endFill();
        g.beginFill(0xffffff, 0.7); g.drawCircle(-R * 0.35, -R * 0.4, R * 0.2); g.endFill();
        g.beginFill(0x224422); g.drawCircle(-R * 0.25, 0, 1.8); g.drawCircle(R * 0.25, 0, 1.8); g.endFill();
        break;
      }
      case 'mini': {
        g.beginFill(this.color); g.drawEllipse(0, R * 0.15, R, R * 0.75); g.endFill();
        g.beginFill(0xffffff, 0.7); g.drawCircle(-R * 0.3, -R * 0.2, R * 0.22); g.endFill();
        break;
      }
      case 'charger': {
        g.beginFill(this.color); g.drawEllipse(0, 0, R * 1.15, R * 0.85); g.endFill();
        g.lineStyle(2, 0x993300, 1);
        for (let i = 0; i < 4; i++) { g.moveTo(-R * 0.6 + i * R * 0.35, -R * 0.7); g.lineTo(-R * 0.7 + i * R * 0.35, -R * 1.15); }
        g.lineStyle(0);
        g.beginFill(0xffaa66); g.drawCircle(R * 0.95, 0, R * 0.45); g.endFill();
        g.beginFill(0xffccdd); g.drawEllipse(R * 1.25, R * 0.1, R * 0.22, R * 0.15); g.endFill();
        g.lineStyle(2, 0xffffff, 1);
        g.moveTo(R * 1.05, R * 0.3); g.lineTo(R * 1.2, R * 0.55);
        g.moveTo(R * 1.3, R * 0.3); g.lineTo(R * 1.25, R * 0.55);
        g.lineStyle(0);
        g.beginFill(0x331100); g.drawCircle(R * 0.95, -R * 0.2, 1.5); g.endFill();
        break;
      }
      case 'elite':
      case 'elite_brute':
      case 'elite_charge':
      case 'elite_tank':
      case 'elite_shooter': {
        g.beginFill(0x883311);
        g.drawPolygon([-R * 0.6, -R * 0.6, -R * 1.6, R * 0.8, -R * 0.3, R * 0.6]);
        g.drawPolygon([R * 0.6, -R * 0.6, R * 1.6, R * 0.8, R * 0.3, R * 0.6]);
        g.endFill();
        g.beginFill(this.color); g.drawCircle(0, 0, R * 0.85); g.endFill();
        g.lineStyle(3, 0xffffff, 1);
        g.moveTo(-R * 0.4, -R * 0.6); g.lineTo(-R * 0.75, -R * 1.35);
        g.moveTo(R * 0.4, -R * 0.6); g.lineTo(R * 0.75, -R * 1.35);
        g.lineStyle(0);
        g.beginFill(0xff2222); g.drawCircle(-R * 0.3, -R * 0.1, 2.5); g.drawCircle(R * 0.3, -R * 0.1, 2.5); g.endFill();
        g.lineStyle(3, 0xffee88, 0.9); g.drawCircle(0, 0, R * 1.15); g.lineStyle(0);
        break;
      }
      case 'moxiu': {
        g.beginFill(0x1a1020);
        g.drawPolygon([0, -R * 0.9, R * 0.85, R, -R * 0.85, R]);
        g.endFill();
        g.beginFill(0x2a1830);
        g.drawPolygon([0, -R * 0.9, R * 0.5, -R * 0.1, -R * 0.5, -R * 0.1]);
        g.endFill();
        g.beginFill(0xd8ccb8); g.drawCircle(0, -R * 0.55, R * 0.38); g.endFill();
        g.beginFill(0xff2222); g.drawCircle(-R * 0.15, -R * 0.6, 1.8); g.drawCircle(R * 0.15, -R * 0.6, 1.8); g.endFill();
        g.lineStyle(2, 0x883344, 0.9);
        g.moveTo(-R * 0.7, R * 0.2); g.lineTo(-R * 1.1, R * 0.6);
        g.moveTo(R * 0.7, R * 0.2); g.lineTo(R * 1.1, R * 0.6);
        g.lineStyle(0); break;
      }
      case 'boss1': {
        g.beginFill(0x881122);
        g.drawPolygon([0, -R, R * 0.95, R, -R * 0.95, R]);
        g.endFill();
        g.beginFill(this.color);
        g.drawPolygon([0, -R, R * 0.55, -R * 0.1, -R * 0.55, -R * 0.1]);
        g.endFill();
        g.beginFill(0xe8d8c8); g.drawCircle(0, -R * 0.65, R * 0.4); g.endFill();
        g.beginFill(0x301010); g.drawCircle(-R * 0.35, -R * 0.95, R * 0.18); g.drawCircle(R * 0.35, -R * 0.95, R * 0.18); g.endFill();
        g.beginFill(0xff2244); g.drawCircle(-R * 0.15, -R * 0.68, 2); g.drawCircle(R * 0.15, -R * 0.68, 2); g.endFill();
        g.lineStyle(3, 0xff4455, 0.7); g.drawCircle(0, 0, R * 1.2); g.lineStyle(0);
        break;
      }
      case 'boss2': {
        g.beginFill(0x331111);
        g.drawRect(-R * 0.9, -R * 0.5, R * 1.8, R * 1.4);
        g.endFill();
        g.beginFill(this.color);
        g.drawCircle(0, -R * 0.8, R * 0.55);
        g.endFill();
        g.lineStyle(4, 0x220a0a, 1);
        g.moveTo(-R * 0.9, -R * 0.3); g.lineTo(-R * 1.4, R * 0.4);
        g.moveTo(R * 0.9, -R * 0.3); g.lineTo(R * 1.4, R * 0.4);
        g.lineStyle(0);
        g.beginFill(0x110505);
        g.drawPolygon([-R * 0.9, -R * 0.4, -R * 1.6, -R * 0.7, -R * 1.0, -R * 0.1]);
        g.drawPolygon([R * 0.9, -R * 0.4, R * 1.6, -R * 0.7, R * 1.0, -R * 0.1]);
        g.endFill();
        g.beginFill(0xffcc22); g.drawCircle(-R * 0.2, -R * 0.85, 2.5); g.drawCircle(R * 0.2, -R * 0.85, 2.5); g.endFill();
        g.beginFill(0x550a0a); g.drawCircle(0, R * 0.5, R * 0.5); g.endFill();
        break;
      }
      case 'boss3': {
        g.beginFill(0x2a1040);
        g.drawPolygon([0, -R, R * 1.15, R * 1.1, 0, R * 0.6, -R * 1.15, R * 1.1]);
        g.endFill();
        g.beginFill(this.color);
        g.drawPolygon([0, -R, R * 0.5, 0, -R * 0.5, 0]);
        g.endFill();
        g.beginFill(0xe0d0f0); g.drawCircle(0, -R * 0.7, R * 0.38); g.endFill();
        g.beginFill(0x180828);
        g.drawEllipse(-R * 0.55, -R * 1.0, R * 0.2, R * 0.45);
        g.drawEllipse(R * 0.55, -R * 1.0, R * 0.2, R * 0.45);
        g.endFill();
        g.beginFill(0xcc44ff); g.drawCircle(-R * 0.14, -R * 0.72, 2); g.drawCircle(R * 0.14, -R * 0.72, 2); g.endFill();
        g.lineStyle(2, 0xbb66ff, 0.8);
        g.drawCircle(0, 0, R * 1.3); g.lineStyle(0);
        break;
      }
      case 'boss4': {
        g.beginFill(0x1a2a4a);
        g.drawRect(-R * 0.75, -R * 0.4, R * 1.5, R * 1.3);
        g.endFill();
        g.beginFill(this.color);
        g.drawPolygon([-R * 0.75, -R * 0.4, R * 0.75, -R * 0.4, R * 0.55, R * 0.9, -R * 0.55, R * 0.9]);
        g.endFill();
        g.beginFill(0x88bbdd); g.drawCircle(0, -R * 0.75, R * 0.45); g.endFill();
        g.beginFill(0x0a1a30);
        g.drawPolygon([-R * 0.5, -R * 1.0, 0, -R * 1.35, R * 0.5, -R * 1.0]);
        g.endFill();
        g.beginFill(0x66ddff); g.drawCircle(-R * 0.17, -R * 0.78, 2); g.drawCircle(R * 0.17, -R * 0.78, 2); g.endFill();
        g.lineStyle(2, 0x99ccff, 0.9);
        g.moveTo(-R * 0.3, 0); g.lineTo(0, R * 0.25); g.lineTo(-R * 0.15, R * 0.5); g.lineTo(R * 0.2, R * 0.8);
        g.lineStyle(0); break;
      }
      case 'boss5': {
        g.beginFill(0xc8a030);
        g.drawPolygon([0, -R, R * 1.1, R * 1.1, 0, R * 0.65, -R * 1.1, R * 1.1]);
        g.endFill();
        g.beginFill(0xe8d090);
        g.drawPolygon([0, -R, R * 0.55, 0, -R * 0.55, 0]);
        g.endFill();
        g.beginFill(0xf5ecd8); g.drawCircle(0, -R * 0.7, R * 0.4); g.endFill();
        g.lineStyle(3, 0x8a6a20, 1);
        g.moveTo(-R * 0.4, -R * 1.0); g.lineTo(-R * 0.55, -R * 1.45);
        g.moveTo(R * 0.4, -R * 1.0); g.lineTo(R * 0.55, -R * 1.45);
        g.lineStyle(0);
        g.beginFill(0xd4a017); g.drawCircle(-R * 0.15, -R * 0.72, 2.2); g.drawCircle(R * 0.15, -R * 0.72, 2.2); g.endFill();
        g.lineStyle(3, 0xffe9a8, 0.9);
        g.drawCircle(0, 0, R * 1.35); g.lineStyle(0);
        g.beginFill(0xffe9a8, 0.25); g.drawCircle(0, R * 0.3, R * 0.4); g.endFill();
        break;
      }
    }
  }
  hurt(dmg, color, big = false) {
    if (this.dead) return;
    let real = dmg;
    if (this.isBoss) {
      real *= LEVELS_BOSS_DMG_ADD[game.levelIdx || 0]
    }

    this.hp -= real;
    game.dmgDealt += real;
    showDamage(this.x, this.y, real, color, big);
    this._hpBarTimer = 999; // ★ 受伤后立刻刷新血条，不等节流
    const dx = this.x - game.player.x, dy = this.y - game.player.y;
    const d = Math.hypot(dx, dy) || 1;
    const kb = (this.isBoss || this.type === 'tank') ? 0 : 3; // ★ Boss 不受击退
    this.x += dx / d * kb;
    this.y += dy / d * kb;
    if (this.hp <= 0) this.destroy();
  }
  moveToward(tx, ty, speed) {
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy) || 1;
    this.x += dx / d * speed;
    this.y += dy / d * speed;
    this.anim += 0.1;
  }
  update(dt) {
    if (this.dead) return;
    // ★ 冰冻：跳过移动和 AI（buff 系统的 onApply/onExpire 维护 this.frozen）
    if (this.frozen) {
      this.render();
      return;
    }
    if (!game.stealth && !game.forceStealth) {
      const px = game.player.x, py = game.player.y;
      const d = Math.hypot(px - this.x, py - this.y);
      // ★ FSM：小怪走状态机，Boss 走 updateBossAI
      if (this.isBoss && /^boss[1-5]$/.test(this.type)) {
        this.updateBossAI(dt, px, py, d);
      } else if (this.fsm && this.fsm.current) {
        this.fsm.update(dt);
      } else {
        // fallback：默认追击
        this.moveToward(px, py, this.spd);
      }
      if (this.auraOn && this.auraGfx) {
        // ★ aura 节流：position 每帧跟随，内容 0.3 秒重绘一次
        this.auraGfx.position.set(this.x, this.y);
        this._auraTimer = (this._auraTimer || 0) + dt;
        if (this._auraTimer >= 300) {
          this._auraTimer = 0;
          this.auraGfx.clear();
          const c = this.behavior === 'boss5' ? 0xffd700 : 0x881111;
          this.auraGfx.beginFill(c, 0.15);
          this.auraGfx.drawCircle(0, 0, 220);
          this.auraGfx.endFill();
          this.auraGfx.lineStyle(2, c, 0.6);
          this.auraGfx.drawCircle(0, 0, 220);
        }
        // aura tick 掉血：0.3s 一次
        this.auraHitTimer = (this.auraHitTimer || 0) - dt;
        if (d < 220 && this.auraHitTimer <= 0) {
          this.auraHitTimer = 300;
          let auraDmg;
          if (this.behavior === 'boss2') auraDmg = boss2_auraDps(this.dmg);
          else if (this.behavior === 'boss5') auraDmg = boss5_xianDomain(this.dmg);
          else auraDmg = 5;
          playerHurt(auraDmg, true);
          game.hitFlash = 0.8;
        }
        if (this.behavior === 'boss2') {
          this.auraMobTimer = (this.auraMobTimer || 0) - dt;
          if (this.auraMobTimer <= 0) {
            this.auraMobTimer = 4500;
            const souls = game.enemies.filter(e => !e.dead && e.isSoulMob).length;
            if (souls < 3) {
              const m = spawnEnemy('mini'); m.isSoulMob = true;
              m.x = this.x + (Math.random() - 0.5) * 160; m.y = this.y + (Math.random() - 0.5) * 160;
              game.enemies.push(m);
            }
          }
        }
      }
      // ★ 迷魂强化紫圈跟随 + 定时消失
      if (this.charmAuraGfx) {
        if (this.charmAuraT > 0) {
          this.charmAuraT -= dt;
          this.charmAuraGfx.clear();
          this.charmAuraGfx.beginFill(0xcc44aa, 0.15);
          this.charmAuraGfx.drawCircle(this.x, this.y, 260);
          this.charmAuraGfx.endFill();
          this.charmAuraGfx.lineStyle(2, 0xcc44aa, 0.6);
          this.charmAuraGfx.drawCircle(this.x, this.y, 260);
        } else {
          app.stage.removeChild(this.charmAuraGfx);
          this.charmAuraGfx = null;
        }
      }
      this.touchTimer -= dt;
      const touchDmg = calcMonsterTouchDmg(this.dmg, this.dmgBuff, this.cloneBuff || 1);
      if (d < this.r + 20 && this.touchTimer <= 0) {
        this.touchTimer = 600; // 怪物自身攻击间隔：打你一下后0.6秒内不能再打你
        playerHurt(touchDmg);
      }
    }
    this.render();
  }
  // ★ 渲染：gfx 位置 / 名字 / buff 图标 / 血条（冰冻时也要跑，保持血条跟怪一体）
  render() {
    this.gfx.position.set(this.x, this.y);
    if (this.nameText) this.nameText.position.set(this.x, this.y - this.visualHalfH - 22);

    // ★ 血条节流：position 每帧跟随，内容每 0.3 秒才重绘
    const barOffsetY = -this.visualHalfH - 8;
    this.hpBar.position.set(this.x, this.y);

    this._hpBarTimer = (this._hpBarTimer || 0) + 16.7;
    if (this._hpBarTimer < 300 && this._hpDrawn) return;
    this._hpBarTimer = 0;
    this._hpDrawn = true;

    // ★ 绘制敌人 buff 图标
    if (this.buffs && this.buffs.length > 0) drawEnemyBuffIcon(this);
    this.hpBar.clear();
    if (game.debug.showHitbox) {
      this.hpBar.lineStyle(1, 0x00ff00, 0.5);
      this.hpBar.drawCircle(0, 0, this.r);
    }
    if (this.hp < this.maxHp) {
      const w = this.isBoss ? this.r * 3 : this.r * 2;
      this.hpBar.beginFill(0x000000, 0.6);
      this.hpBar.drawRect(-w / 2, barOffsetY, w, 3);
      this.hpBar.endFill();
      this.hpBar.beginFill(0xff3333);
      this.hpBar.drawRect(-w / 2, barOffsetY, w * Math.max(0, this.hp / this.maxHp), 3);
      this.hpBar.endFill();
    }
    if (this.charging) {
      this.hpBar.lineStyle(2, 0xff4400, 0.7);
      this.hpBar.drawCircle(0, 0, this.r + 4);
    }
  }
  // ★ Boss AI（从 update 抽出，后续可拆成 FSM 各阶段 State）
  updateBossAI(dt, px, py, d) {
    switch (this.behavior) {
      case 'boss1': {
        if (this.lunge && this.lunge > 0) {
          this.lunge -= dt;
          const ang = Math.atan2(py - this.y, px - this.x);
          this.x += Math.cos(ang) * 8; this.y += Math.sin(ang) * 8;
          burst(this.x, this.y, 0xff4466, 2);
        } else this.moveToward(px, py, this.spd);
        this.skill3Timer = (this.skill3Timer || 5000) - dt;
        if (this.skill3Timer <= 0) {
          this.skill3Timer = 6000;
          this.lunge = 400;
          showSkillInfo('血影突进', '王婵血影冲向你！');
          playSound('dash');
        }
        if (!this.isClone && !this.p2 && this.hp < this.maxHp * 0.6) {
          this.p2 = true;
          showSkillInfo('魔影分身', '王婵召唤残影分身，本体伤害提升！');
          playSound('warn');
          summonClone(this);
        }
        this.skillTimer -= dt;
        if (this.skillTimer <= 0) {
          this.skillTimer = 6000;
          showSkillInfo('血云雾', '一朵血色红云追踪而来！');
          playSound('warn');
          game.clouds.push(new BloodCloud(this.x, this.y, boss1_bloodCloud(this.dmg)));
        }
        this.skill2Timer -= dt;
        if (this.skill2Timer <= 0) { this.skill2Timer = 5500; skill_featherBlade(this.x, this.y, this.dmg); }
        this.cloneBuff = (this.cloneRef && !this.cloneRef.dead) ? BOSS_CLONE_MUL : 1;
        break;
      }
      case 'boss2': {
        this.moveToward(px, py, this.spd);
        this.skill3Timer = (this.skill3Timer || 6000) - dt;
        if (this.skill3Timer <= 0) {
          this.skill3Timer = 7000;
          skill_moxiBlade(this.x, this.y, this.dmg);
        }
        if (!this.auraOn && this.hp < this.maxHp * 0.5) {
          this.auraOn = true;
          showSkillInfo('魔气领域', '古魔展开暗红领域，持续滋生魔魂小怪！');
          playSound('warn');
          this.auraGfx = new PIXI.Graphics();
          app.stage.addChild(this.auraGfx);
          this.auraMobTimer = 0;
        }
        this.skill2Timer -= dt;
        if (this.skill2Timer <= 0) { this.skill2Timer = 6500; skill_soulFire(this.x, this.y, boss2_soulFire(this.dmg)); }
        break;
      }
      case 'boss3': {
        if (d > 260) this.moveToward(px, py, this.spd);
        else if (d < 160) this.moveToward(px, py, -this.spd * 0.6);
        this.skill3Timer = (this.skill3Timer || 6000) - dt;
        if (this.skill3Timer <= 0) {
          this.skill3Timer = 8000;
          showSkillInfo('追踪魔球', '元刹圣祖瞬移并召唤追踪魔球！');
          playSound('dash');
          burst(this.x, this.y, 0xcc66ff, 10);
          const ang = Math.atan2(py - this.y, px - this.x) + Math.PI;
          this.x = px + Math.cos(ang) * 200;
          this.y = py + Math.sin(ang) * 200;
          burst(this.x, this.y, 0xcc66ff, 10);
          for (let i = 0; i < 3; i++) {
            const a = Math.random() * Math.PI * 2;
            const sx = game.player.x + Math.cos(a) * 300;
            const sy = game.player.y + Math.sin(a) * 300;
            game.homingOrbs.push(new HomingOrb(sx, sy, 0xcc66ff, 12, 3.5, 2100, boss3_homingOrb(this.dmg)));
          }
        }
        this.shootTimer -= dt;
        if (this.shootTimer <= 0) {
          this.shootTimer = 1600;
          const ang = Math.atan2(py - this.y, px - this.x);
          if (game.projectiles.length < MAX_BULLETS)
            game.projectiles.push(createProjectile(this.x, this.y, ang, boss3_bullet(this.dmg), 0xcc66ff, true, 2.5));
        }
        this.skillTimer -= dt;
        if (this.skillTimer <= 0) { this.skillTimer = 9000; skill_charm(this); }
        this.skill2Timer -= dt;
        if (this.skill2Timer <= 0) {
          this.skill2Timer = 9000;
          showSkillInfo('魔化巨手', '黑色巨手拍下！');
          playSound('warn');
          game.hands.push(new GiantHand(px, py, boss3_giantHand(this.dmg)));
        }
        if (!this.p2 && this.hp < this.maxHp * 0.55) { this.p2 = true; skill_magicTide(this.x, this.y); }
        if (this.p2) {
          this.skill4Timer = (this.skill4Timer || 8000) - dt;
          if (this.skill4Timer <= 0) { this.skill4Timer = 8000; skill_magicTide(this.x, this.y); }
        }
        break;
      }
      case 'boss4': {
        if (d > 240) this.moveToward(px, py, this.spd);
        else if (d < 150) this.moveToward(px, py, -this.spd * 0.6);
        this.skill3Timer = (this.skill3Timer || 5000) - dt;
        if (this.skill3Timer <= 0) {
          this.skill3Timer = 6000;
          game.homingOrbs.push(new HomingOrb(this.x, this.y, 0x44aaff, 14, 2.4, 600, boss4_waterOrb(this.dmg)));
        }
        this.shootTimer -= dt;
        if (this.shootTimer <= 0) { this.shootTimer = 1400; skill_crossWater(this.x, this.y); }
        this.skillTimer -= dt;
        if (this.skillTimer <= 0) { this.skillTimer = 5000; skill_thunderP(this.x, this.y, this.dmg); }
        this.skill2Timer -= dt;
        if (this.skill2Timer <= 0) { this.skill2Timer = 9000; skill_fiveLights(this.x, this.y, this.dmg); }
        if (!this.p2 && this.hp < this.maxHp * 0.5) {
          this.p2 = true;
          showSkillInfo('水遁', '鱼店长水遁换位！');
          playSound('warn');
          teleportAway(this);
        }
        if (this.p2) {
          this.skill4Timer = (this.skill4Timer || 7000) - dt;
          if (this.skill4Timer <= 0) { this.skill4Timer = 7000; teleportAway(this); }
          this.skill5Timer = (this.skill5Timer || 10000) - dt;
          if (this.skill5Timer <= 0) {
            this.skill5Timer = 10000;
            showSkillInfo('水牢结界', '脚下水牢，被困住持续掉血！');
            playSound('warn');
            telegraphZone(px, py, 160, 0x44aaff, 800, boss4_waterPrison(this.dmg), 3000);
          }
        }
        break;
      }
      case 'boss5': {
        if (!this.p3 && this.hp < this.maxHp * 0.3) {
          this.p3 = true;
          showSkillInfo('魔光反噬', '仙符耗尽，天外魔头反噬！');
          playSound('boss');
        }
        if (this.p3 && !this.bottleUsed) {
          this.selfTimer = (this.selfTimer || 1200) - dt;
          if (this.selfTimer <= 0) {
            this.selfTimer = 1200;
            this.hp -= this.maxHp * 0.015;
          }
        }
        if (!this.auraOn && this.hp < this.maxHp * 0.6) {
          this.auraOn = true;
          showSkillInfo('真仙灵域', '马良展开金色仙域！');
          playSound('warn');
          this.auraGfx = new PIXI.Graphics();
          app.stage.addChild(this.auraGfx);
        }
        this.moveToward(px, py, this.spd);
        const sealCD = this.hp < this.maxHp * 0.3 ? 3200 : (this.hp < this.maxHp * 0.6 ? 3800 : 4500);
        const bloodCD = this.hp < this.maxHp * 0.3 ? 8000 : (this.hp < this.maxHp * 0.6 ? 9000 : 11000);
        this.skillTimer -= dt;
        if (this.skillTimer <= 0) { this.skillTimer = sealCD; skill_bloodSeal(this.dmg); }
        this.skill2Timer -= dt;
        if (this.skill2Timer <= 0) { this.skill2Timer = bloodCD; skill_bloodFrenzy(this); }
        if (this.hp > this.maxHp * 0.6) {
          this.skill3Timer = (this.skill3Timer || 13000) - dt;
          if (this.skill3Timer <= 0) {
            this.skill3Timer = 13000;
            // ★ 限制召唤数量，防止敌人无限攒导致闪退
            if (game.enemies.length >= 60) break;
            const giants = game.enemies.filter(e => !e.dead && e.isBloodGiant).length;
            if (giants < 2) {
              const g = spawnEnemy('tank'); g.isBloodGiant = true; g.r = 30;
              g.gfx.clear();
              g.gfx.beginFill(0xffffff, 0.95); g.gfx.drawCircle(0, 0, 24); g.gfx.endFill();
              g.gfx.beginFill(0xff3344, 0.9); g.gfx.drawCircle(-14, -16, 8); g.gfx.drawCircle(14, -16, 8); g.gfx.endFill();
              g.gfx.beginFill(0x222222, 0.9); g.gfx.drawEllipse(-8, -4, 5, 7); g.gfx.drawEllipse(8, -4, 5, 7); g.gfx.endFill();
              g.gfx.beginFill(0xff3344, 0.9); g.gfx.drawCircle(0, 6, 4); g.gfx.endFill();
              game.enemies.push(g);
              toast('🐼 召唤血灵熊猫！');
            }
          }
        }
        if (this.auraOn && this.hp > this.maxHp * 0.3) {
          this.skill4Timer = (this.skill4Timer || 6000) - dt;
          if (this.skill4Timer <= 0) {
            this.skill4Timer = 6000;
            showSkillInfo('法则锁链', '金色锁链大范围锁定你！');
            playSound('warn');
            game.chains.push(new GoldenChain(game.player.x, game.player.y, 110, boss5_goldenChain(this.dmg)));
          }
        }
        if (!this.bottleUsed && this.hp < this.maxHp * 0.15) {
          this.bottleUsed = true;
          triggerBloodSacrifice(this);
        }
        break;
      }
    }
  }
  destroy(noDrop) {
    this.dead = true;
    if (this.auraGfx) { app.stage.removeChild(this.auraGfx); this.auraGfx = null; this.auraOn = false; }
    if (this.charmAuraGfx) { app.stage.removeChild(this.charmAuraGfx); this.charmAuraGfx = null; }
    if (!noDrop) {
      playSound('mdie');
      burst(this.x, this.y, this.color, this.isBoss ? 30 : 6);
      game.kills++;
      if (game.thunderCD <= 0) game.thunderCharge = Math.min(100, game.thunderCharge + (this.isBoss ? 40 : 3));
      if (this.behavior === 'elite_tank') {
        burst(this.x, this.y, 0xff8844, 26);
        playSound('explode');
        const pd = Math.hypot(game.player.x - this.x, game.player.y - this.y);
        if (pd < 100) playerHurt(eliteTank_deathExplosion(this.dmg), true);
      }
      dropLoot(this);
      const n = this.isBoss ? 14 : (this.isSpecialElite ? 8 : (this.type === 'elite' ? 4 : (this.type === 'tank' ? 2 : 1)));
      for (let i = 0; i < n; i++) {
        const ox = this.x + (Math.random() - 0.5) * 30, oy = this.y + (Math.random() - 0.5) * 30;
        game.orbs.push(createOrb(ox, oy, this.expVal / n * 0.5 * curLevel.expMul));
      }
      if (this.def.split && !noDrop) {
        for (let i = 0; i < this.def.split; i++) {
          const m = spawnEnemy('mini');
          m.x = this.x + (Math.random() - 0.5) * 30;
          m.y = this.y + (Math.random() - 0.5) * 30;
          game.enemies.push(m);
        }
      }
      if (this.isBoss) toast(`💀 ${this.def.bname} 已陨落！`);
    }
    // ★ 归还到池里（不是真正销毁）
    this.release();
  }
}

// ★ 从池里取一个敌人（没有就 new）
export function spawnEnemy(type, isElite = false) {
  let e;
  if (_enemyPool.length > 0) {
    e = _enemyPool.pop();
  } else {
    e = new Enemy();
  }
  return e.init(type, isElite);
}

// ★ 经验球工厂函数（从池里取）
export function createOrb(x, y, val) {
  let orb;
  if (_orbPool.length > 0) {
    orb = _orbPool.pop();
    orb.g.visible = true;
  } else {
    const g = new PIXI.Graphics();
    g.beginFill(0x55aa77); g.drawCircle(0, 0, 4); g.endFill();
    g.beginFill(0x88cc99, 0.5); g.drawCircle(0, 0, 2); g.endFill();
    app.stage.addChild(g);
    orb = { g, x: 0, y: 0, life: 900, val: 0, spawnDelay: 60, teleported: false };
  }
  orb.x = x;
  orb.y = y;
  orb.val = val;
  orb.life = 900;
  orb.spawnDelay = 60; // 1秒后传送
  orb.teleported = false;
  orb.g.position.set(x, y);
  return orb;
}

// ★ 经验球归还池
export function releaseOrb(orb) {
  orb.g.visible = false;
  if (_orbPool.length < MAX_ORB_POOL) {
    _orbPool.push(orb);
  }
}

// ★ 分帧预热对象池（进游戏时调用，每帧创建几个，不卡）
let _warmupStarted = false;
let _warmupCount = 0;
export function startPoolWarmup() {
  if (_warmupStarted) return;
  _warmupStarted = true;
  _warmupCount = 0;
}

// 每帧调用一次，预热池
export function tickPoolWarmup() {
  if (!_warmupStarted) return;
  if (_warmupCount >= 100) return;
  // 每帧创建 5 个敌人到池里（不可见）
  for (let i = 0; i < 5 && _warmupCount < 100; i++) {
    const e = new Enemy();
    e.gfx.visible = false;
    e.hpBar.visible = false;
    _enemyPool.push(e);
    _warmupCount++;
  }
}

function dropLoot(e) {
  if (e.isBoss) {
    spawnPickup(e.x - 20, e.y); spawnPickup(e.x + 20, e.y); spawnPickup(e.x, e.y);
    return;
  }
  if (e.isSpecialElite || e.type === 'elite') {
    spawnPickup(e.x - 10, e.y); spawnPickup(e.x + 10, e.y);
    return;
  }
  if (Math.random() < 0.06) spawnPickup(e.x, e.y);
}

export function spawnPickup(x, y) {
  const g = new PIXI.Graphics();
  g.beginFill(0xff4466); g.drawRoundedRect(-9, -9, 18, 18, 4); g.endFill();
  g.lineStyle(3, 0xffffff, 1);
  g.moveTo(-5, 0); g.lineTo(5, 0); g.moveTo(0, -5); g.lineTo(0, 5);
  g.position.set(x, y);
  app.stage.addChild(g);
  game.pickups.push({ g, x, y, type: 'heal', life: 1200 });
}

export function makeSpecialElite() {
  // ★ 从当前关卡配置的精英权重里取，不硬编码池
  const pool = [];
  for (const t in curLevel.late) {
    if (t.startsWith('elite')) pool.push(t);
  }
  if (pool.length === 0) return null;
  const type = pool[Math.floor(Math.random() * pool.length)];
  const e = spawnEnemy(type, true);
  e.shootTimer = (1500 + Math.random() * 1000);
  e.chargeTimer = (2000 + Math.random() * 1500);
  return e;
}

export function pickType(weights) {
  let total = 0;
  for (const t in weights) total += weights[t];
  let r = Math.random() * total;
  for (const t in weights) { r -= weights[t]; if (r <= 0) return t; }
  return 'normal';
}

export function getWave() {
  // game.time 是倒计时，p = 已经过去的时间比例
  const p = 1 - game.time / curLevel.dur;
  if (p < 0.22) return { phase: 'early', weights: curLevel.early, rate: 800, max: 15 };
  if (p < 0.55) return { phase: 'mid', weights: curLevel.mid, rate: 500, max: 30 };
  return { phase: 'late', weights: curLevel.late, rate: 350, max: 50 };
}
