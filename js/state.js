// ============================================================
// state.js — 共享可变状态
// 存放全局 game 对象、PIXI app、玩家位置、输入按键、
// 纹理缓存、音频缓冲区等跨模块共享的可变引用。
// 各模块通过 import { game, app, ... } 引用，避免循环依赖。
// ============================================================
import { PLAYER_BASE_ATK } from './calculate.js';
export let app = null;
export let gameStarted = false;
export let curLevel = null;
export const game = {
  // ===== 玩家核心属性 =====
  hp: 150,              // 当前血量
  maxHp: 150,           // 血量上限
  lv: 1,                // 玩家等级
  exp: 0,               // 当前经验
  expNeed: 150,         // 升级所需经验
  playerAtk: PLAYER_BASE_ATK, // 玩家攻击力（每级 +2，初始 10）

  // ===== 时间 / 游戏状态 =====
  time: 0,              // 本局已进行秒数
  over: false,          // 游戏结束
  win: false,           // 是否通关
  paused: false,        // 是否暂停（升级弹窗/Boss 出场）
  idleTime: 0,          // 站桩时长（挂机检测）
  kills: 0,             // 击杀数
  dmgDealt: 0,          // 总伤害统计

  // ===== 玩家位置与移动 =====
  player: { x: 0, y: 0, speed: 2.6 }, // 玩家坐标 + 基础移速
  idleTime: 0,
  stealth: false,       // 隐身中（技能）
  forceStealth: false, // GM 强制隐身
  idlePause: false,    // 挂机暂停

  // ===== 全局乘区 =====
  dmgMul: 1,            // 全局伤害倍率（被动"伤害提升"叠加）
  cdMul: 1,             // 全局冷却倍率（被动"冷却缩减"叠加）
  invulnTimer: 0,       // 残留：旧的全局无敌时间（已弃用）

  // ===== 瞬身（Q 技能）=====
  dashCD: 0,           // 瞬身剩余 CD
  dashCDMax: 8000,     // 瞬身 CD 上限
  dashBuffer: 0,        // 输入缓冲
  dashTime: 0,         // 瞬身进行中剩余 ms
  dashInvuln: 0,       // 瞬身无敌剩余 ms
  dashDirX: 0, dashDirY: 1, // 瞬身方向

  // ===== 辟邪神雷（E 技能）=====
  thunderCharge: 0,    // 蓄力值 0~100
  thunderCD: 0,        // 技能剩余 CD

  // ===== 青元剑诀（飞剑）=====
  swords: [],           // 飞剑实例数组
  swordCount: 0,        // 飞剑数量
  swordRadius: 64,     // 环绕半径
  swordStance: 'orbit', // 剑式：orbit/seek/group
  arcRot: 0,           // 环绕旋转角
  arcCD: [],           // 各剑组追击冷却
  swordCritChance: 0.1,   // 飞剑暴击率（被动）
  swordCritMul: 1.3,      // 飞剑暴伤倍率（被动）
  swordFreezeChance: 0,   // 飞剑冰冻概率（被动）

  // ===== 噬金虫 =====
  bugs: [],             // 虫子实例数组
  bugCount: 0,          // 虫子数量
  bugEvolved: false,    // 是否进化（噬金虫海）

  // ===== 九霄神雷 =====
  lightningLocs: 1,    // 落雷点数
  lightningBolts: 1,    // 每处落雷道数
  lightningRadius: 50,  // 落雷半径
  lightningCD: 0,       // 被动加成后的 CD
  lightningTimer: 0,    // 下次落雷倒计时
  lightnings: [],       // 正在渲染的落雷实例

  // ===== 摄魂幡（环绕）=====
  orbitCount: 0,        // 内圈幡数
  orbitRadius: 60,      // 环绕半径
  orbitSpeed: 0.04,     // 环绕角速度
  orbitAngle: 0,        // 当前环绕角
  orbits: [],           // 幡实例数组
  orbitOuter: 0,        // 外圈幡数（进化后）
  orbitSize: 1,         // 幡体型倍数（进化后）

  // ===== 实体数组 =====
  enemies: [],          // 敌人
  orbs: [],             // 经验球
  pickups: [],          // 掉落道具
  projectiles: [],      // 敌方弹幕
  damageTexts: [],      // 飘字
  particles: [],        // 粒子
  fxSprites: [],        // 序列帧特效
  clouds: [],           // Boss1 血云雾
  shockwaves: [],       // Boss2 冲击波
  homingOrbs: [],       // Boss3 追踪魔球
  blades: [],           // Boss1 飞剑
  bolts: [],            // Boss4 光柱
  beams: [],            // Boss4 光束
  firewaves: [],        // Boss4 火浪
  chains: [],           // Boss5 锁链
  hands: [],            // Boss3 巨手

  // ===== 玩家成长 =====
  weapons: {},          // { 武器名: { level, evolved } }
  passives: {},         // { 被动名: level }

  // ===== 刷怪控制 =====
  enemyTimer: 0,       // 下次刷怪倒计时
  hitFlash: 0,          // 受击闪屏强度
  bossSpawned: false,   // Boss 是否已刷
  bossSpawnTime: 0,     // Boss 出场时刻（秒），用于 1 分钟后停刷小怪

  // ===== 调试 =====
  debug: { showHitbox: false, silent: false, noSpawn: false },

  // ===== Boss 技能状态 =====
  freezeUntil: 0,       // 旧：冻结时间戳
  freezeMessage: '',   // 旧：冻结提示文案
  realBoss: null,       // 当前 Boss 实例
  waterPrison: null,   // 水牢区域引用
};
game.orbs.range = 140;
window.game = game

export const keys = {};
export const IMG_TEX = {};
export let IMG_READY = false;
export function setIMG_READY(v) { IMG_READY = v; }

export let audioCtx = null;
export function setAudioCtx(c) { audioCtx = c; }
export const audioBuffers = {};

export let mxGlobal = 0, myGlobal = 0;
export function setMove(mx, my) { mxGlobal = mx; myGlobal = my; }

export let playerGfx = null;
export function setPlayerGfx(s) { playerGfx = s; }
export let playerHpBar = null;
export function setPlayerHpBar(g) { playerHpBar = g; }
export let dashRing = null;
export function setDashRing(g) { dashRing = g; }
export let stealthRing = null;
export function setStealthRing(g) { stealthRing = g; }
export let charTex = {};
export function setCharTex(c) { charTex = c; }
export let charReady = false;
export function setCharReady(v) { charReady = v; }
export let playerDir = 'down';
export function setPlayerDirState(v) { playerDir = v; }

export let ui = {};
export function setUI(u) { ui = u; }

export function setApp(a) { app = a; }
export function setGameStarted(v) { gameStarted = v; }
export function setCurLevel(l) { curLevel = l; }
