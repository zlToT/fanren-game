# 凡人·秘境苟道 — 代码规范

> 本规范约束所有对本项目的代码修改。项目采用 Vite + ES Modules + PIXI.js 7.4.2 架构。

---

## 1. 项目结构

```
fanren-game/
├── index.html          # 入口 HTML
├── package.json
├── vite.config.js
├── js/
│   ├── main.js         # 主循环、游戏状态初始化
│   ├── state.js        # 全局单例（app, game, curLevel, audioCtx 等）
│   ├── config.js       # 配置表（ENEMY_STATS, LEVELS, WEAPON_DEFS, PASSIVE_DEFS）
│   ├── player.js       # Player 类（移动、计时器、视觉同步）
│   ├── input.js        # 键盘事件、瞬身、剑式、辟邪神雷
│   ├── enemy.js        # Enemy 类、敌人对象池、生成波次、掉落物
│   ├── projectiles.js  # 敌方弹幕与技能投射物（含子弹对象池）
│   ├── weapons.js      # 玩家武器（飞剑、噬金虫、摄魂幡、九霄神雷）
│   ├── fx.js           # 粒子、伤害数字、爆裂、震屏、统一受伤接口
│   ├── buff.js         # Buff 系统（BUFF_DEFS + API + 图标渲染）
│   ├── audio.js        # BGM/音效加载与播放
│   ├── ui.js           # DOM UI 面板、升级弹窗、GM 面板
│   └── fsm/            # 状态机系统
│       ├── FSM.js
│       ├── State.js
│       └── states/
│           ├── common.js    # 普通怪状态（Chase/Sway/Ranged/Charge）
│           ├── elite.js      # 精英怪状态
│           └── boss/         # Boss 状态（待拆分）
├── docs/               # 设计文档
├── .claude/            # AI 助手配置（CLAUDE.md 常驻规则 + skills/）
│   ├── CLAUDE.md       # 每次开工前必读，记录项目硬性约束
│   ├── settings.json   # Claude Code 项目设置
│   └── skills/         # AI 技能（fanren-build / fanren-code-review）
├── skills/             # （旧）AI 技能定义，已迁移到 .claude/skills/
├── audio/              # 音频资源
└── public/             # 静态资源
```

## 2. 编码风格

1. **语言与注释**：中文注释，每个 js 文件顶部用 `// ===== 分区标题 =====` 说明文件作用；关键机制用 `// ★` 标注。
2. **命名**：
   - 常量表：全大写蛇形（`SWORD_MAX`、`ENEMY_STATS`）
   - 全局单例：小写（`game`、`app`、`ui`）
   - 类：大驼峰（`Enemy`、`Projectile`、`BloodCloud`）
   - 函数：小驼峰动词开头（`spawnPickup`、`tryDash`）
   - 敌人/武器/技能 key：中文串字面量（`'青元剑诀'`），与配置表严格一致
3. **数值约定**：距离=px，速度=px/frame，时间=ms（`dt` 经 `Math.min(50, ...)` 钳制）。冷却一律 `xxxCD` / `xxxTimer` 字段，减法式倒数。
4. **模块导入**：使用 ES Modules `import/export`，禁止全局变量挂 window（调试用 `window.DBG`）。
5. **伤害入口统一**：
   - 敌人受伤：`e.hurt(dmg, color, big)`
   - 玩家受伤：`playerHurt(dmg, ignoreHitInvuln)`（fx.js）
   - 瞬身无敌（dashInvuln buff）挡所有伤害；怪物触碰有自身 600ms 冷却；Boss 技能用 `playerHurt(dmg, true)` 忽略触碰冷却

## 3. 数据结构规范

### 3.1 配置表（唯一数据源）

```js
// config.js
const LEVELS = [{ id, name, bossType, bossName, bossDesc, dur, bossAt,
  map, weapons: [...中文key], evolve: bool, hpMul, expMul,
  early/mid/late: { enemyType: weight, ... } }]

const ENEMY_STATS = { type: { name, hp, spd, r, dmg, color, exp,
  behavior, faction: 'mo'|'xian'|'beast', ... 可选字段 } }

const WEAPON_DEFS = { '中文名': { desc, maxLv, onLevel(lv, g),
  evolution: { requires, name, desc, apply(g) } } }

const PASSIVE_DEFS = { '中文名': { maxLv, desc, apply(lv, g) } }
```

**规则**：
- 新增内容只改配置表 + 少量 switch 分支，禁止散落硬编码
- `behavior` 字符串必须在 FSM State 映射中有对应 case
- 武器数值变更必须通过 `onLevel` 回调写回 `game`

### 3.2 游戏状态（全局单例 `game`）

```js
game = {
  hp, maxHp, lv, exp, expNeed, time, over, win, paused,
  player: { x, y, speed },
  // 武器字段：swords[], bugCount, lightningXxx, orbits[] ...
  // 实体池：enemies, orbs, pickups, projectiles, damageTexts, particles
  // Boss特效池：clouds, shockwaves, homingOrbs, blades, bolts, beams,
  //            firewaves, chains, hands
  weapons: {}, passives: {},
  debug: { god, showHitbox, silent, noSpawn },
}
```

### 3.3 实体类接口

```js
class Xxx {
  constructor()      // 创建基础 PIXI 对象（池化时只创建一次）
  init(...args)      // 从池取出后初始化状态
  update(dt)         // 返回 false = 已自我移除/归还
  release()          // 归还到对象池
}
```

## 4. 对象池规范

所有频繁创建/销毁的实体必须走对象池：

| 实体 | 池文件 | 池容量 | 工厂函数 |
|------|--------|--------|----------|
| 敌人 Enemy | enemy.js | 100 | `spawnEnemy(type, isElite)` |
| 经验球 Orb | enemy.js | 200 | `createOrb(x, y, val)` |
| 敌方子弹 Projectile | projectiles.js | 100 | `createProjectile(...)` |
| 粒子 Particle | fx.js | 200 | `burst(x, y, color, n)` |
| 伤害数字 DamageText | fx.js | 100 | `showDamage(x, y, dmg, color)` |

**规则**：
- 实体死亡时调用 `release()` 归还池里，不真正销毁 PIXI.Graphics
- 池满后才真正 `destroy()`
- 进游戏时分帧预热池（每帧 5 个，不卡）

## 5. 接口/扩展规范

| 需求 | 做法 |
|------|------|
| 新小怪 | `ENEMY_STATS` 加表项 + `Enemy.drawBody` 加 case + FSM State 映射加 case |
| 新 Boss | 复制 boss 行为模板：三技能槽 + p2/p3 阶段 + 顶部血条自动生效 |
| 新 Boss 技能 | 独立 `skill_xxx(boss)` 函数 + `showSkillInfo()` + `playSound('warn')` |
| 新武器 | `WEAPON_DEFS` 加表项；升级面板自动生成 |
| 新关卡 | `LEVELS` 加一条 |
| 调试 | 挂到 `window.DBG`，面板按钮在 `debugPanel` HTML 中注册 |

## 6. 禁止事项

- ❌ 在主循环中直接操作 DOM（只在状态变化时更新）
- ❌ 无预警的全屏/AOE 伤害
- ❌ 玩家受击跳过 dashInvuln buff 判定
- ❌ 修改已有关卡数值平衡除非明确要求
- ❌ 引入新的运行时库
- ❌ 自动执行 `npm run build`（只在用户明确要求时执行）
- ❌ 自动同步到主站（必须经用户确认）

## 7. 修改完代码后的自检

1. **语法校验**：目视检查括号/引号闭合
2. **不自动 build**：日常用 `npm run dev` 热更新
3. **功能回归**：用户测试报错必须定位到具体文件和行号修复
4. **部署**：构建产物复制到主站必须经用户确认

## 8. .claude 目录

`.claude/` 是 AI 助手（Claude Code）的项目配置目录，**每次开工前必须先读 `.claude/CLAUDE.md`**。

- `CLAUDE.md`：常驻规则，记录项目硬性约束（不自动 build、不自动部署、伤害公式集中在 calculate.js 等）
- `settings.json`：Claude Code 项目级设置
- `skills/`：AI 技能，每个技能一个子目录，含 `SKILL.md`
  - `fanren-build`：dev 端口 5199 / build / 部署流程
  - `fanren-code-review`：按 code-standards.md 扫描 js/ 输出违规报告
