# 凡人·秘境苟道

> 一款基于《凡人修仙传》世界观的放置生存 Roguelite 割草游戏。
> 你是一名初入仙途的小修，在血色禁地、坠魔谷、幽冥暗渊等秘境中求生，一路斩妖除魔，最终直面九天仙庭的真仙。

---

## 项目信息

- **开发模式**：AI 辅助工作流（Claude Code / Codex + 人工架构决策）
- **技术栈**：JavaScript / Pixi.js 7.4 / Web Audio API / Vite 8 ES Modules
- **架构**：多文件模块化（config / state / player / weapons / enemy / projectiles / skills / fx / ui / audio / background / calculate / main）
- **音效**：程序合成音效（Web Audio API）+ 文件 BGM（Ogg）
- **平台**：桌面浏览器（PC 键盘操作）

---

## 操作方式


| 按键              | 功能                                                                      |
| ----------------- | ------------------------------------------------------------------------- |
| **WASD / 方向键** | 移动                                                                      |
| **空格**          | 瞬身闪避（无敌 2 秒，CD 8 秒，受冷却缩减影响）                            |
| **Q**             | 切换剑式（护身 / 追击 / 分组追击）                                        |
| **E**             | 释放辟邪神雷（需雷源充满 100%，清屏弹幕 + 范围雷击 + 金色扩散圈二段伤害） |

---

## 武器系统

每把武器最高 5 级，满级后可触发进化（需指定被动条件）。

### 青元剑诀

- **初始**：8 把飞剑环绕护身，自动索敌追击
- **升级**：每级 +7 把飞剑、+5 伤害、+2 护身半径
- **剑式**（Q 键切换）：
  - 🛡 **护身**：飞剑环绕身周，近战防御
  - ⚔️ **追击**：飞剑自动追踪最近敌人
  - 🗡 **分组追击**：半屏分组追击多个目标
- **进化 → 青元剑阵**：飞剑增至 72 把，伤害 ×1.6，护身半径扩大

### 噬金虫

- **初始**：1 只噬金虫全屏追噬
- **升级**：每级 +1 只，接触敌人造成伤害；飞行途中碰到其他敌人造成半伤害
- **进化 → 噬金虫海**：虫群显露真身（去压暗 + 放大 100%），吞噬伤害翻倍

### 九霄神雷

- **初始**：每 5 秒轰击半屏敌群，对魔修 +25% 额外伤害，优先攻击 Boss
- **升级**：3 级解锁 2 处落雷，5 级 3 处落雷每处 3 道雷，范围 100×100px
- **进化 → 九霄神雷·寂灭**：3 处落雷每处 3 道，范围 150×150px，伤害翻倍

### 摄魂幡

- **初始**：1 个魂魄环绕身周，接触造成伤害
- **升级**：每级 +1 个魂魄、+8 伤害、+5 环绕半径
- **进化 → 百鬼夜行**：双环环绕（内圈 10 个 + 外圈 5 个），体型放大 2 倍，速度 ×2.5

---

## 被动技能


| 被动     | 满级 | 效果                                            |
| -------- | ---- | ----------------------------------------------- |
| 移速提升 | 5 级 | 每级 +0.5 移动速度                              |
| 生命上限 | 5 级 | 每级 +100 上限并回复 50                         |
| 伤害提升 | 5 级 | 每级 +15% 所有伤害                              |
| 冷却缩减 | 5 级 | 每级 -10% 冷却（飞剑 / 神雷 / 瞬身 / 辟邪神雷） |
| 飞剑暴击 | 3 级 | 每级 +15% 飞剑暴击率（初始 10%），暴击飘字红色放大 |
| 飞剑暴伤 | 3 级 | 每级 +15% 飞剑暴击伤害（初始 130%） |
| 飞剑冰冻 | 3 级 | 每级 +10% 飞剑冰冻概率，命中冰冻 1 秒（蓝色 ❄️ buff） |

---

## 特殊技能

### 辟邪神雷（E 键）

- **充能方式**：初始满，25 秒充满
- **效果**：
  1. 清空全屏敌方弹幕与血云雾
  2. 240px 范围内造成范围伤害（魔修 +50%，紫色大字飘字）
  3. 金色扩散圈从玩家位置向外扩散，0.4 秒后对全屏敌人造成二段伤害（一段的 50%）
- **冷却**：10 秒 × 冷却缩减系数，CD 期间雷源冻结不充能
- **伤害公式**：`(200 + 玩家攻击力×5) × 全局伤害倍率`

---

## 关卡与 Boss

### 第一关 · 血色禁地

- **Boss**：王婵（近战魔修）
- **技能**：血云雾追踪（减速 30%）、幻魔飞剑弹幕（预警 + 减速 50%）、魔影分身（半血解锁，可击杀分身）
- **时长**：13 分钟，第 11 分钟 Boss 出现

### 第二关 · 坠魔谷

- **Boss**：古魔（近战重装魔头）
- **技能**：血魔刃（四道方向斩击）、魔魂火浪、魔气领域（持续掉血 + 滋生小怪，半血永久开启）
- **时长**：16 分钟，第 14 分钟 Boss 出现

### 第三关 · 幽冥暗渊

- **Boss**：元刹圣祖（远程拉扯型上古魔祖）
- **技能**：迷魂幻惑（脚下紫色领域，强化小怪 ×2 伤害 ×1.5 血量）、魔化巨手（预警 1 秒后拍下大范围高伤）、魔潮狂涌（半血解锁，环形弹幕）
- **时长**：19 分钟，第 16:30 Boss 出现，解锁武器进化

### 第四关 · 虚空雷狱

- **Boss**：鱼店长（远程法师，水雷双属性）
- **技能**：十字水弹、霆雷（紫色雷霆预警后劈下）、五色神光（全屏五色激光）、水遁瞬移、水牢结界（限制移动，半血解锁）
- **时长**：22 分钟，第 19:30 Boss 出现

### 第五关 · 九天仙庭（最终关）

- **Boss**：真仙马良（法则型三阶段 Boss）
- **P1 位面压制**：万灵血玺（血色印记落下）、血祭之力（强化小怪 ×2 伤害）、召唤血灵巨人
- **P2 仙符解封**（60% 血量）：展开真仙灵域（持续掉血），法则锁链（金色矩形范围，3 秒禁锢）
- **P3 魔光反噬**（30% 血量）：自损血量但攻击频率提升，盗天瓶回血（15% 时回 50% 血一次）
- **时长**：25 分钟，第 22:00 Boss 出现

---

## 怪物图鉴


| 怪物   | 特点                         |
| ------ | ---------------------------- |
| 妖虫   | 基础近战小怪                 |
| 魔蝠   | 快速摇摆飞行                 |
| 妖狐   | 远程射手，保持距离发射弹幕   |
| 石傀   | 高血量肉盾                   |
| 史莱姆 | 死亡分裂为小史莱姆           |
| 赤鬃猪 | 冲锋攻击                     |
| 妖将   | 精英远程怪                   |
| 魔修   | 魔修阵营，受辟邪神雷额外伤害 |

**特殊精英怪**：游戏时长过半后随机刷新，包括肉盾型（死亡爆炸）、冲锋型、射手型，血量和伤害远超普通小怪。

---

## GM 调试面板

游戏内按 `~` 或点击 GM 按钮打开调试面板，支持：

- 上帝模式（dashInvuln buff）/ 静默升级 / 不刷怪
- 回满血 / 血上限 +500
- 直接升级指定武器 / 被动
- 直接刷新 Boss / 指定精英怪
- 雷源充满 / 时间跳转

---

## 技术架构

### 状态机系统（FSM）

敌人 AI 采用有限状态机（FSM）驱动，替代手写 switch-case：

```
js/fsm/
├── FSM.js           — 状态机基类（setState / update）
├── State.js         — 状态基类（enter / exit / update）
└── states/
    ├── common.js    — 普通怪：Chase / Sway / Ranged / Charge / CloneShoot
    ├── elite.js      — 精英怪：EliteBrute / EliteCharge / EliteTank / EliteShooter
    └── boss/        — Boss 状态（待拆分独立 State）
```

- 每种行为对应一个 State 类，`enter()` 进入时初始化，`update(dt)` 每帧执行
- 状态切换由 FSM 统一管理，避免状态混乱
- Boss 多阶段（P1/P2/P3）通过血量阈值触发状态切换

### Buff 系统

统一管理所有增益/减益效果，数据驱动：

- **配置表**：`BUFF_DEFS` 定义所有 buff（名称、颜色、图标、hooks）
- **核心 API**：`addBuff` / `removeBuff` / `hasBuff` / `updateBuffs`
- **双向施加**：怪物→玩家（水牢/锁链），怪物→小怪（迷魂/血祭强化）
- **图标显示**：玩家头顶显示完整图标，小怪显示缩小版（scale 0.5）
- **当前 buff**：瞬身无敌（dashInvuln）、水牢（waterPrison）、法则锁链（chainLock）、迷魂强化、血祭强化

详见 [docs/buff-design.md](docs/buff-design.md)

### 对象池系统

割草游戏每秒创建/销毁数百个实体，全部走对象池复用，避免 GC 卡顿：


| 实体          | 池容量 | 工厂函数                       |
| ------------- | ------ | ------------------------------ |
| 敌人 Enemy    | 100    | `spawnEnemy(type, isElite)`    |
| 经验球 Orb    | 200    | `createOrb(x, y, val)`         |
| 敌方子弹      | 100    | `createProjectile(...)`        |
| 粒子 Particle | 200    | `burst(x, y, color, n)`        |
| 伤害数字      | 100    | `showDamage(x, y, dmg, color)` |

- 实体死亡时隐藏 PIXI 对象并归还池里，不真正销毁
- 进游戏时分帧预热（每帧 5 个，~0.3 秒完成），不卡
- 池满后才真正 destroy

### 伤害系统统一接口

所有伤害公式集中在 `calculate.js`，方便数值平衡调整：

```js
// 玩家武器伤害
calcSwordDmg(lv, playerAtk, isEvolved, dmgMul)
calcBugDmg(lv, playerAtk, isEvolved, dmgMul, isCollision)
calcLightningDmg(lv, playerAtk, isEvolved, isMo, dmgMul)
calcOrbitDmg(lv, playerAtk, isEvolved, dmgMul)
calcThunderBoltDmg(playerAtk, isMo, dmgMul)  // 辟邪神雷一段
calcThunderRingDmg(playerAtk, dmgMul)         // 辟邪神雷二段

// 怪物伤害
calcMonsterTouchDmg(baseDmg, dmgBuff, cloneBuff)

// Boss 技能伤害（第一个参数传 bossAtk）
boss1_bloodCloud(bossAtk)        // 血云雾
boss1_featherBlade(bossAtk)      // 幻魔飞剑
boss2_auraDps(bossAtk)           // 魔气领域
boss2_bloodBlade(bossAtk)        // 血魔刃
boss2_soulFire(bossAtk)          // 魔魂火浪
boss3_homingOrb(bossAtk)         // 追踪魔球
boss3_giantHand(bossAtk)         // 魔化巨手
boss3_bullet(bossAtk)            // 元刹普通弹
boss4_waterOrb(bossAtk)          // 水弹
boss4_waterPrison(bossAtk)       // 水牢 tick
boss4_fiveLights(bossAtk)        // 五色神光
boss4_thunderPillar(bossAtk)     // 霆雷
boss5_bloodSeal(bossAtk)         // 万灵血玺
boss5_goldenChain(bossAtk)       // 法则锁链
boss5_xianDomain(bossAtk)        // 真仙灵域

// 升级加成
calcLevelUpBonus(lv) => { atk: 10, hp: 30 }
calcNextExpNeed(currentExpNeed) => 下一级经验需求
```

### 性能优化手段

- **减少 GC**：所有频繁创建的实体走对象池，避免每帧 new
- **减少 DOM 操作**：主循环里只在状态变化时更新 DOM
- **分帧加载**：对象池预热分帧创建，不一次性卡死
- **按需加载**：音频文件异步加载，重试机制保证 BGM 播放
- **数组清理**：用 `filter(update)` 一次性清理，不用 splice

详见 [docs/game-dev-standards.md](docs/game-dev-standards.md) 和 [docs/code-standards.md](docs/code-standards.md)
