// ============================================================
// config.js — 静态配置表
// 关卡定义（LEVELS）、地图主题（THEMES）、武器定义（WEAPON_DEFS）、
// 被动技能（PASSIVE_DEFS）、怪物属性（ENEMY_STATS）、常量。
// 数值平衡调整请优先改本文件，伤害公式见 calculate.js。
// ============================================================

// ===== 关卡配置表 =====
// 设计原则：
//   - 每关 4 个普通怪，early/mid/late 全阶段刷（权重 25 左右，均等）
//   - 精英怪只在 mid/late 刷，权重百分比见各关注释；early 不出精英
//   - 目标等级 = dur(分钟) + 2（例：13 分钟 → lv15）
//   - 波次切换：early→mid (45%)、mid→late (78%)，切换时屏幕中央有 banner 提示
export const LEVELS = [
  {
    id: 1, name: '第一关 · 血色禁地',
    bossType: 'boss1', bossName: '王婵', bossDesc: '近战魔修 · 血云雾追踪',
    dur: 780, bossAt: 660, map: 'grass',
    weapons: ['青元剑诀', '摄魂幡'], evolve: false,
    hpMul: 1.0, expMul: 0.6, boostHigh: false,
    targetLv: 15, // 13min + 2
    monsters: ['normal', 'fast', 'moxiu', 'shooter', 'elite'],
    // 普通：normal / fast / moxiu / shooter；精英：elite
    early: { normal: 25, fast: 25, moxiu: 25, shooter: 25 },
    mid:   { normal: 22, fast: 23, moxiu: 22, shooter: 23, elite: 10 }, // 精英 10%
    late:  { normal: 20, fast: 20, moxiu: 20, shooter: 20, elite: 20 }, // 精英 20%
  },
  {
    id: 2, name: '第二关 · 坠魔谷',
    bossType: 'boss2', bossName: '古魔', bossDesc: '近战魔修 · 魔气领域 / 血魔刃',
    dur: 960, bossAt: 840, map: 'fall',
    weapons: ['青元剑诀', '摄魂幡', '九霄神雷'], evolve: false,
    hpMul: 1.05, expMul: 0.6, boostHigh: false,
    targetLv: 18, // 16min + 2
    monsters: ['fast', 'moxiu', 'shooter', 'tank', 'elite', 'elite_brute'],
    // 普通：fast / moxiu / shooter / tank；精英：elite / elite_brute
    early: { fast: 25, moxiu: 25, shooter: 25, tank: 25 },
    mid:   { fast: 22, moxiu: 22, shooter: 22, tank: 22, elite: 6, elite_brute: 6 }, // 精英 12%
    late:  { fast: 20, moxiu: 20, shooter: 20, tank: 20, elite: 10, elite_brute: 10 }, // 精英 22%
  },
  {
    id: 3, name: '第三关 · 幽冥暗渊',
    bossType: 'boss3', bossName: '元刹圣祖', bossDesc: '远程魔修 · 迷魂幻惑 / 魔化巨手',
    dur: 1140, bossAt: 990, map: 'dark',
    weapons: ['青元剑诀', '摄魂幡', '九霄神雷', '噬金虫'], evolve: true,
    hpMul: 1.1, expMul: 1.1, boostHigh: true,
    targetLv: 21, // 19min + 2
    monsters: ['moxiu', 'shooter', 'tank', 'mini', 'elite', 'elite_brute', 'elite_charge'],
    // 普通：moxiu / shooter / tank / mini；精英：elite / elite_brute / elite_charge
    early: { moxiu: 25, shooter: 25, tank: 25, mini: 25 },
    mid:   { moxiu: 22, shooter: 22, tank: 22, mini: 22, elite: 4, elite_brute: 4, elite_charge: 4 }, // 精英 14%
    late:  { moxiu: 19, shooter: 19, tank: 19, mini: 19, elite: 8, elite_brute: 8, elite_charge: 8 }, // 精英 24%
  },
  {
    id: 4, name: '第四关 · 虚空雷狱',
    bossType: 'boss4', bossName: '鱼店长', bossDesc: '雷法魔修 · 霆雷 / 五色神光',
    dur: 1320, bossAt: 1170, map: 'void',
    weapons: ['青元剑诀', '摄魂幡', '九霄神雷', '噬金虫'], evolve: true,
    hpMul: 1.15, expMul: 1.45, boostHigh: true,
    targetLv: 24, // 22min + 2
    monsters: ['shooter', 'tank', 'mini', 'splitter', 'elite', 'elite_brute', 'elite_charge', 'elite_tank'],
    // 普通：shooter / tank / mini / splitter；精英：elite / elite_brute / elite_charge / elite_tank
    early: { shooter: 25, tank: 25, mini: 25, splitter: 25 },
    mid:   { shooter: 21, tank: 21, mini: 21, splitter: 21, elite: 4, elite_brute: 4, elite_charge: 4, elite_tank: 4 }, // 精英 16%
    late:  { shooter: 18, tank: 18, mini: 18, splitter: 18, elite: 7, elite_brute: 7, elite_charge: 7, elite_tank: 7 }, // 精英 26%
  },
  {
    id: 5, name: '第五关 · 九天仙庭',
    bossType: 'boss5', bossName: '真仙马良', bossDesc: '真仙 · 真仙灵域 / 万灵血玺 / 血祭之力',
    dur: 1500, bossAt: 1320, map: 'heaven',
    weapons: ['青元剑诀', '摄魂幡', '九霄神雷', '噬金虫'], evolve: true,
    hpMul: 1.2, expMul: 1.95, boostHigh: true,
    targetLv: 27, // 25min + 2
    monsters: ['tank', 'mini', 'splitter', 'charger', 'elite', 'elite_brute', 'elite_charge', 'elite_tank', 'elite_shooter'],
    // 普通：tank / mini / splitter / charger；精英：全部 5 种
    early: { tank: 25, mini: 25, splitter: 25, charger: 25 },
    mid:   { tank: 20, mini: 20, splitter: 20, charger: 20, elite: 4, elite_brute: 4, elite_charge: 4, elite_tank: 4, elite_shooter: 4 }, // 精英 18%
    late:  { tank: 18, mini: 18, splitter: 18, charger: 18, elite: 5, elite_brute: 5, elite_charge: 5, elite_tank: 5, elite_shooter: 5 }, // 精英 28%
  },
];

export const THEMES = {
  grass: { base: '#14371f', patch: ['rgba(10,42,20,0.5)', 'rgba(24,62,34,0.5)', 'rgba(30,72,40,0.45)', 'rgba(72,62,38,0.35)'], tuft: 'rgba(48,105,58,0.55)', rockBase: 95, mist: '150,230,190', hasGrass: true, rockN: 38000 },
  fall: { base: '#2a1812', patch: ['rgba(60,20,12,0.55)', 'rgba(40,26,14,0.5)', 'rgba(70,30,18,0.4)', 'rgba(20,10,8,0.5)'], tuft: 'rgba(90,50,30,0.4)', rockBase: 70, mist: '200,90,60', hasGrass: false, rockN: 24000 },
  dark: { base: '#0c0a18', patch: ['rgba(30,15,50,0.5)', 'rgba(18,10,34,0.55)', 'rgba(50,20,70,0.35)', 'rgba(5,3,10,0.6)'], tuft: 'rgba(80,60,130,0.3)', rockBase: 45, mist: '130,80,220', hasGrass: false, rockN: 30000 },
  void: { base: '#181a20', patch: ['rgba(40,44,55,0.5)', 'rgba(25,28,36,0.55)', 'rgba(60,66,80,0.35)', 'rgba(10,12,16,0.6)'], tuft: 'rgba(100,110,130,0.25)', rockBase: 80, mist: '140,150,180', hasGrass: false, rockN: 34000 },
  heaven: { base: '#3a3428', patch: ['rgba(90,80,55,0.45)', 'rgba(120,110,75,0.4)', 'rgba(70,62,42,0.5)', 'rgba(160,150,110,0.3)'], tuft: 'rgba(200,185,130,0.4)', rockBase: 150, mist: '255,235,170', hasGrass: true, rockN: 30000 },
};

export const SWORD_MAX = 72;
export const STANCES = ['orbit', 'seek', 'group'];
export const STANCE_NAMES = { orbit: '🛡 剑式·护身', seek: '⚔️ 剑式·追击', group: '🗡 剑式·分组追击' };

export const WEAPON_DEFS = {
  '青元剑诀': {
    desc: '飞剑自动索敌，Q键切换剑式', maxLv: 5,
    onLevel: (lv, g) => { g.swordCount = Math.min(SWORD_MAX, 8 + (lv - 1) * 7); g.swordRadius = 64 + lv * 2; },
    evolution: { requires: '伤害提升', name: '青元剑阵', desc: '飞剑增至72把、伤害大增', apply: (g) => { g.swordCount = SWORD_MAX; g.swordRadius = 78; } }
  },
  '噬金虫': {
    desc: '灵虫全屏追噬，接触造成伤害', maxLv: 5,
    onLevel: (lv, g) => { g.bugCount = lv; g.bugEvolved = false; },
    evolution: { requires: '生命上限', name: '噬金虫海', desc: '虫群显露真身、吞噬伤害翻倍', apply: (g) => { g.bugEvolved = true; g.bugs.forEach(b => b.applySkin && b.applySkin()); } }
  },
  '九霄神雷': {
    desc: '定期神雷轰击半屏敌群，对魔修+25%', maxLv: 5, cooldownBase: 8000,
    onLevel: (lv, g) => { g.lightningLocs = lv >= 5 ? 3 : (lv >= 3 ? 2 : 1); g.lightningBolts = lv >= 5 ? 3 : 1; g.lightningRadius = 100; if (!g.lightningCD) g.lightningCD = 8000; },
    evolution: { requires: '伤害提升', name: '九霄神雷·寂灭', desc: '3处落雷每处3道，范围200*200', apply: (g) => { g.lightningLocs = 3; g.lightningBolts = 3; g.lightningRadius = 150; g.lightningCD = 8000; } }
  },
  '摄魂幡': {
    desc: '魂魄环绕，接触造成伤害', maxLv: 5,
    onLevel: (lv, g) => { g.orbitCount = lv; g.orbitRadius = 55 + lv * 5; },
    evolution: { requires: '移速提升', name: '百鬼夜行', desc: '双环环绕：内圈10个外圈5个，体型放大2倍', apply: (g) => { g.orbitCount = 10; g.orbitOuter = 5; g.orbitSize = 3; g.orbitSpeed *= 2.5; g.orbits.forEach(o => o.redraw && o.redraw()); } }
  },
};

export const PASSIVE_DEFS = {
  '移速提升': { maxLv: 5, desc: '每级+0.5移动速度', apply: (lv, g) => { g.player.speed += 0.5; } },
  '生命上限': { maxLv: 5, desc: '每级+50上限并回复50', apply: (lv, g) => { g.maxHp += 100; g.hp = Math.min(g.hp + 50, g.maxHp); } },
  '伤害提升': { maxLv: 5, desc: '每级+15%所有伤害', apply: (lv, g) => { g.dmgMul += 0.15; } },
  '冷却缩减': { maxLv: 5, desc: '每级-10%冷却（含飞剑/神雷/瞬身）', apply: (lv, g) => { g.cdMul *= 0.9; } },
  '飞剑暴击': { maxLv: 3, desc: '每级+15%飞剑暴击率（初始10%）', apply: (lv, g) => { g.swordCritChance = lv * 0.15; } },
  '飞剑暴伤': { maxLv: 3, desc: '每级+15%飞剑暴击伤害（初始130%）', apply: (lv, g) => { g.swordCritMul = 1.3 + lv * 0.15; } },
  '飞剑冰冻': { maxLv: 3, desc: '每级+10%飞剑冰冻概率（初始0%），命中冰冻敌人1秒', apply: (lv, g) => { g.swordFreezeChance = lv * 0.10; } },
};

// ===== 怪物属性配置表 =====
// 字段：name=显示名称, hp=血量, spd=速度, r=碰撞半径, dmg=基础攻击力
//       color=颜色, exp=经验, behavior=AI类型, faction=阵营(beast/mo/xian)魔修小怪（玩家对其+25%伤害）
// ===== 怪物属性配置表 =====
// 字段：name=显示名称, hp=血量, spd=速度, r=碰撞半径, dmg=基础攻击力
//       color=颜色, exp=经验, behavior=AI类型, faction=阵营(beast/mo/xian)
// 强度由弱到强排序（按关卡出场顺序轮换）：
//   normal < fast < moxiu < shooter < mini < tank < splitter < charger
export const ENEMY_STATS = {
  // 普通小怪（按强度递增）
  normal:    { name: '妖虫',     hp: 140, spd: 0.8, r: 12, dmg: 15, color: 0xff6666, exp: 15, behavior: 'chase',  faction: 'beast' },
  fast:      { name: '魔蝠',     hp: 130, spd: 1.7, r: 9,  dmg: 12, color: 0xcc66ff, exp: 20, behavior: 'sway',   faction: 'mo' },
  moxiu:     { name: '魔修',     hp: 245, spd: 1.0, r: 20, dmg: 18, color: 0x883355, exp: 30, behavior: 'chase',  faction: 'mo' },
  shooter:   { name: '妖狐',     hp: 280, spd: 0.6, r: 11, dmg: 15, color: 0xff99cc, exp: 40, behavior: 'ranged', shootCD: 1800, keepDist: 220, faction: 'beast' },
  mini:      { name: '小史莱姆', hp: 105, spd: 1.2, r: 8,  dmg: 5,  color: 0x99eeaa, exp: 15, behavior: 'chase',  faction: 'beast' },
  tank:      { name: '石傀',     hp: 560, spd: 0.4, r: 22, dmg: 25, color: 0xaaaacc, exp: 120, behavior: 'chase', faction: 'beast' },
  splitter:  { name: '史莱姆',   hp: 350, spd: 0.7, r: 13, dmg: 18, color: 0x66dd88, exp: 100, behavior: 'chase',  split: 2, faction: 'beast' },
  charger:   { name: '赤鬃猪',   hp: 455, spd: 0.6, r: 15, dmg: 22, color: 0xff8844, exp: 180, behavior: 'charge',  chargeCD: 3000, faction: 'beast' },

  // 精英怪（isElite=true，共 5 种：1 常驻精英 + 4 特殊精英）
  elite:         { name: '妖将',     hp: 1050, spd: 0.6, r: 17, dmg: 30, color: 0xffaa22, exp: 150, behavior: 'ranged',       shootCD: 1400, keepDist: 180, faction: 'beast', isElite: true },
  elite_brute:   { name: '魔兵狂战士', hp: 1540, spd: 1.3, r: 17, dmg: 40, color: 0xff4444, exp: 250, behavior: 'elite_brute',  faction: 'mo', isElite: true },
  elite_charge:  { name: '魔骑突阵',   hp: 1260, spd: 0.9, r: 15, dmg: 35, color: 0xff8844, exp: 250, behavior: 'elite_charge', chargeCD: 2600, faction: 'mo', isElite: true },
  elite_tank:    { name: '魔甲守卫',   hp: 2800, spd: 0.25, r: 23, dmg: 40, color: 0x8888aa, exp: 400, behavior: 'elite_tank',   faction: 'mo', isElite: true },
  elite_shooter: { name: '魔弩手',     hp: 1120, spd: 0.7, r: 14, dmg: 50, color: 0xcc66ff, exp: 250, behavior: 'elite_shooter', shootCD: 1300, keepDist: 220, faction: 'mo', isElite: true },

  // ===== Boss =====
  boss1: { name: '王婵', hp: 50000, spd: 0.85, r: 25, dmg: 100, color: 0xcc3355, exp: 500,  behavior: 'boss1', faction: 'mo',   bname: '王婵' },
  boss2: { name: '古魔', hp: 80000, spd: 0.75, r: 26, dmg: 120, color: 0x771122, exp: 800,  behavior: 'boss2', faction: 'mo',   bname: '古魔' },
  boss3: { name: '元刹圣祖', hp: 150000, spd: 0.8, r: 25, dmg: 140, color: 0x552277, exp: 1500, behavior: 'boss3', faction: 'mo', bname: '元刹圣祖' },
  boss4: { name: '鱼店长', hp: 200000, spd: 1, r: 24, dmg: 170, color: 0x3366aa, exp: 2500, behavior: 'boss4', faction: 'mo', bname: '鱼店长' },
  boss5: { name: '真仙马良', hp: 2500000, spd: 1.2, r: 32, dmg: 200, color: 0xd0a030, exp: 4000, behavior: 'boss5', faction: 'xian', bname: '真仙马良' },
};


// ===== 弹幕/对象池常量 =====
// 同屏弹幕上限
export const MAX_BULLETS = 200;
// 弹幕存活帧数（180帧≈3秒）
export const BULLET_LIFE = 180;
// 精英怪行为列表
export const ELITE_BEHAVIORS = ['elite_brute', 'elite_charge', 'elite_tank', 'elite_shooter'];
