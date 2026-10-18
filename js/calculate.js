// ============================================================
// calculate.js — 伤害计算统一入口
// 所有怪物伤害、玩家武器伤害、Boss技能伤害、buff加成、升级加成
// 全部集中在此文件，方便数值调整和平衡测试。
// ============================================================

// ===== Buff 加成常量 =====
// 迷魂强化：小怪伤害倍率（元刹圣祖施加）
export const BUFF_CHARM_DMG_MUL = 2;
// 迷魂强化：小怪血量倍率（首次强化时增加）
export const BUFF_CHARM_HP_MUL = 1.5;
// 血祭强化：小怪伤害倍率（真仙马良施加）
export const BUFF_BLOOD_DMG_MUL = 2;
// 怪物近身攻击基础倍率（baseDmg × 此值 = 实际伤害；配置表 dmg 已含 25x，此处为 1）
export const MONSTER_TOUCH_MUL = 1;
// Boss 分身伤害倍率（王婵分身）
export const BOSS_CLONE_MUL = 1.5;
// 魔修阵营伤害加成（玩家对魔修额外伤害）
export const FACTION_MO_DMG_BONUS = 1.50;
// 玩家基础攻击力
export const PLAYER_BASE_ATK = 30;
// 玩家每级攻击力加成
export const PLAYER_LEVEL_UP_ATK = 10;
// 玩家每级血量加成
export const PLAYER_LEVEL_UP_HP = 30;
// 经验需求成长率（每级 × 此值）
export const EXP_NEED_GROWTH = 1.3;

// ===== 玩家武器伤害计算 =====

/**
 * 青元剑诀（飞剑）伤害
 * @param {number} lv - 武器等级 1~5
 * @param {number} playerAtk - 玩家攻击力
 * @param {boolean} isEvolved - 是否已进化
 * @param {number} dmgMul - 全局伤害倍率（被动叠加）
 * @param {number} critChance - 飞剑暴击率（0~1，被动"飞剑暴击"提供）
 * @param {number} critMul - 飞剑暴击伤害倍率（被动"飞剑暴伤"提供，默认 1.3）
 * @returns {[number, boolean]} [单次飞剑伤害, 是否暴击]
 */
export function calcSwordDmg(lv, playerAtk, isEvolved, dmgMul, critChance = 0, critMul = 1.3) {
  let dmg = 10 + lv * 5; // 基础伤害
  if (isEvolved) dmg *= 1.6; // 进化加成

  let total = (dmg + playerAtk) * dmgMul;

  // 是否暴击
  let isCrit = false;
  if (critChance > 0 && Math.random() < critChance) {
    isCrit = true;
    total *= critMul;
  }

  return [total, isCrit];
}

/**
 * 噬金虫伤害
 * @param {number} lv - 武器等级 1~5
 * @param {number} playerAtk - 玩家攻击力
 * @param {boolean} isEvolved - 是否已进化
 * @param {number} dmgMul - 全局伤害倍率
 * @param {boolean} isCollision - 是否飞行途中碰撞（半伤）
 * @returns {number} 噬金虫单次伤害
 */
export function calcBugDmg(lv, playerAtk, isEvolved, dmgMul, isCollision = false) {
  let dmg = 50 + lv * 10; // 基础伤害
  if (isEvolved) dmg *= 2; // 进化翻倍

  let total = dmg + playerAtk;
  if (isCollision) total *= 0.5; // 碰撞半伤
  // console.log('噬金虫伤害', lv, playerAtk, isEvolved, dmgMul, isCollision, total * dmgMul)
  return total * dmgMul;
}

/**
 * 九霄神雷伤害
 * @param {number} lv - 武器等级 1~5
 * @param {number} playerAtk - 玩家攻击力
 * @param {boolean} isEvolved - 是否已进化
 * @param {boolean} isMo - 是否魔修阵营（+25%伤害）
 * @param {number} dmgMul - 全局伤害倍率
 * @returns {number} 单道神雷伤害
 */
export function calcLightningDmg(lv, playerAtk, isEvolved, isMo, dmgMul) {
  let dmg = (30 + lv * 12) * 3; // 基础伤害（×3）
  if (isEvolved) dmg *= 2; // 进化翻倍
  let total = dmg + playerAtk * 2; // 附加玩家攻击力×1.5
  if (isMo) total *= FACTION_MO_DMG_BONUS; // 魔修加成
  // console.log('九霄神雷伤害', lv, playerAtk, isEvolved, isMo, dmgMul, total * dmgMul)
  return total * dmgMul;
}

/**
 * 摄魂幡（环绕）伤害
 * @param {number} lv - 武器等级 1~5
 * @param {number} playerAtk - 玩家攻击力
 * @param {boolean} isEvolved - 是否已进化
 * @param {number} dmgMul - 全局伤害倍率
 * @returns {number} 摄魂幡单次伤害
 */
export function calcOrbitDmg(lv, playerAtk, isEvolved, dmgMul) {
  let dmg = 15 + lv * 15; // 基础伤害（环绕 dps 偏弱，提一档）
  if (isEvolved) dmg *= 1.5; // 进化加成
  // console.log('摄魂幡（环绕）伤害', lv, playerAtk, isEvolved, dmgMul, (dmg + playerAtk * 0.5) * dmgMul)
  return (dmg + playerAtk * 0.5) * dmgMul;
}

/**
 * 辟邪神雷（E技能）一段伤害（中心范围）
 * @param {number} playerAtk - 玩家攻击力
 * @param {boolean} isMo - 是否魔修阵营
 * @param {number} dmgMul - 全局伤害倍率
 * @returns {number} 一段伤害
 */
export function calcThunderBoltDmg(playerAtk, isMo, dmgMul) {
  const base = 200; // 基础伤害
  let total = base + playerAtk * 5; // 附加玩家攻击力×5
  if (isMo) total *= FACTION_MO_DMG_BONUS;
  // console.log('辟邪神雷（E技能）一段伤害（中心范围）', playerAtk, isMo, dmgMul, total * dmgMul)
  return total * dmgMul;
}

/**
 * 辟邪神雷（E技能）二段伤害（全屏扩散圈）
 * @param {number} playerAtk - 玩家攻击力
 * @param {boolean} isMo - 是否魔修阵营
 * @param {number} dmgMul - 全局伤害倍率
 * @returns {number} 二段伤害
 */
export function calcThunderRingDmg(playerAtk, isMo, dmgMul) {
  const base = 200;
  let total = (base + playerAtk * 5) * 0.5; // 一段的50%
  if (isMo) total *= FACTION_MO_DMG_BONUS;
  // console.log('辟邪神雷（E技能）二段伤害（全屏扩散圈）', playerAtk, isMo, dmgMul, total * dmgMul)
  return total * dmgMul;
}

// ===== 怪物伤害计算 =====

/**
 * 怪物近身攻击伤害（碰到玩家）
 * @param {number} baseDmg - 怪物基础攻击力（ENEMY_STATS 中的 dmg）
 * @param {number} dmgBuff - buff 加成倍率（默认1）
 * @param {number} cloneBuff - Boss分身倍率（默认1）
 * @returns {number} 实际伤害
 */
export function calcMonsterTouchDmg(baseDmg, dmgBuff = 1, cloneBuff = 1) {
  return baseDmg * MONSTER_TOUCH_MUL * dmgBuff * cloneBuff;
}

/**
 * 怪物远程弹幕伤害
 * @param {number} baseDmg - 弹幕基础伤害
 * @param {number} dmgBuff - buff 加成倍率
 * @returns {number} 实际伤害
 */
export function calcMonsterBulletDmg(baseDmg, dmgBuff = 1) {
  return baseDmg * dmgBuff;
}

// ===== Boss 技能伤害计算 =====
// 参数统一传 Boss 基础攻击力（this.dmg）

// --- Boss1 王婵 ---

// 血云雾
export function boss1_bloodCloud(bossAtk) {
  return bossAtk * 0.15;
}

// 幻魔飞剑
export function boss1_featherBlade(bossAtk) {
  return bossAtk * 0.8;
}

// --- Boss2 古魔 ---
// 魔气领域（持续掉血 + 滋生小怪，半血永久开启）
export function boss2_auraDps(bossAtk) {
  return bossAtk * 0.15;
}

// 血魔刃（四道方向斩击）
export function boss2_bloodBlade(bossAtk) {
  return bossAtk * 0.8;
}

// 魔魂火浪
export function boss2_soulFire(bossAtk) {
  return bossAtk * 1;
}

// --- Boss3 元刹圣祖 ---
// 追踪魔球
export function boss3_homingOrb(bossAtk) {
  return bossAtk * 0.8;
}

// 魔化巨手
export function boss3_giantHand(bossAtk) {
  return bossAtk;
}

// 元刹圣祖普通弹
export function boss3_bullet(bossAtk) {
  return bossAtk * 0.8;
}

// --- Boss4 鱼店长 ---
// 鱼店长水弹
export function boss4_waterOrb(bossAtk) {
  return bossAtk * 0.5;
}

// 水牢结界 tick
export function boss4_waterPrison(bossAtk) {
  return bossAtk * 0.2;
}

// 五色神光
export function boss4_fiveLights(bossAtk) {
  return bossAtk * 1;
}

// 霆雷
export function boss4_thunderPillar(bossAtk) {
  return bossAtk * 0.7;
}

// --- Boss5 真仙马良 ---
// 万灵血玺
export function boss5_bloodSeal(bossAtk) {
  return bossAtk * 0.7;
}

// 法则锁链
export function boss5_goldenChain(bossAtk) {
  return bossAtk * 1;
}

// 真仙灵域（P2 展开，持续掉血）
export function boss5_xianDomain(bossAtk) {
  return bossAtk * 0.2;
}

// ===== 其他硬编码伤害 =====
export function eliteTank_deathExplosion(dmg) { return dmg; } // 精英坦克死亡爆炸

// 血包回复量：前期 20 / 中期 30 / 后期 50
export function calcHealAmount(dur, time) {
  const elapsed = dur - time; // 已过时间（秒）
  const ratio = elapsed / dur;
  if (ratio < 0.4) return 20;
  if (ratio < 0.75) return 30;
  return 50;
}

// ===== 升级加成计算 =====

/**
 * 玩家升级属性加成
 * @param {number} lv - 当前等级
 * @returns {{ atk: number, hp: number }} 本次升级获得的攻击力和血量
 */
export function calcLevelUpBonus(lv) {
  return {
    atk: PLAYER_LEVEL_UP_ATK,  // 每级攻击力 +10
    hp: PLAYER_LEVEL_UP_HP,     // 每级血量 +30
  };
}

/**
 * 经验需求计算
 * @param {number} currentExpNeed - 当前等级所需经验
 * @returns {number} 下一级所需经验
 */
export function calcNextExpNeed(currentExpNeed) {
  return Math.floor(currentExpNeed * EXP_NEED_GROWTH);
}

// ===== 关卡产出估算（供策划/GM 参考，不参与运行时） =====

// 粗估量级（按当前权重）：

// - L1 ~550 怪 / ~1.5w 经验 / ≈ lv14
// - L2 ~800 怪 / ~2.5w / ≈ lv18
// - L3 ~1100 怪 / ~4w / ≈ lv22
// - L4 ~1300 怪 / ~5.5w / ≈ lv26
// - L5 ~1600 怪 / ~8w / ≈ lv30

/**
 * 估算某一关能刷多少怪 / 多少经验 / 升到几级。
 * 波次划分见 enemy.js getWave()：0~45% early / 45~78% mid / 78%~结束 late。
 * Boss 登场 60 秒后不再刷小怪（main.js 主循环）。
 * @param {object} levelDef - LEVELS 里的一关配置
 * @param {object} enemyStats - ENEMY_STATS
 * @returns {{enemies:number, exp:number, estLevel:number}}
 */
export function calcLevelEstimate(levelDef, enemyStats) {
  const dur = levelDef.dur;
  const bossAt = levelDef.bossAt;
  const tEarlyEnd = Math.min(dur * 0.45, bossAt);
  const tMidEnd = Math.min(dur * 0.78, bossAt);
  const tLateEnd = Math.min(bossAt, dur);
  const windows = [
    { from: 0, to: tEarlyEnd, weights: levelDef.early, rate: 0.8 },
    { from: tEarlyEnd, to: tMidEnd, weights: levelDef.mid, rate: 0.5 },
    { from: tMidEnd, to: tLateEnd, weights: levelDef.late, rate: 0.35 },
  ];
  let totalEnemies = 0, totalExp = 0;
  for (const w of windows) {
    const durS = Math.max(0, w.to - w.from);
    if (durS <= 0 || !w.weights) continue;
    const n = Math.floor(durS / w.rate);
    let sumW = 0, sumExp = 0;
    for (const k in w.weights) {
      sumW += w.weights[k];
      sumExp += (enemyStats[k]?.exp || 0) * w.weights[k];
    }
    const avgExp = sumW > 0 ? sumExp / sumW : 0;
    totalEnemies += n;
    totalExp += n * avgExp * (levelDef.expMul || 1);
  }
  // 反推等级
  let lv = 1, need = 150, remain = totalExp;
  while (remain >= need && lv < 60) {
    remain -= need;
    lv++;
    need = calcNextExpNeed(need);
  }
  return { enemies: totalEnemies, exp: Math.floor(totalExp), estLevel: lv };
}
