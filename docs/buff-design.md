# Buff 系统设计方案

## 设计目标

- 统一管理所有增益/减益效果：Buff 可以挂在任何实体上（玩家/小怪/Boss）
- 双向施加：怪物给玩家挂 debuff，玩家给怪物挂 debuff
- 数据驱动：Buff 定义放配置表，效果通过 hooks 应用，新增 Buff 零成本
- 图标显示：玩家头顶显示完整图标，小怪显示缩小版图标（scale 0.5）
- 兼容现有逻辑：分步迁移，不一次性改崩

---

## 核心结构

```
js/
├── buff.js          — Buff 系统核心（配置表 + API + 图标渲染）
├── calculate.js      — Buff 加成常量（伤害倍率、血量倍率）
```

---

## 1. 核心概念：施法方 vs 作用方

**需要区分。** Buff 实例记录 `source`（施法方），用途：


| 场景                  | 示例                               |
| --------------------- | ---------------------------------- |
| 伤害来源追踪          | 中毒掉血要记录谁上的毒（击杀计数） |
| 施法方增益联动        | 吸血 buff：目标掉血时回血给施法方  |
| Buff 强度随施法方成长 | 玩家等级越高，给怪上的 debuff 越痛 |
| 驱散/免疫             | 某些 Boss 免疫玩家上的特定 debuff  |

当前阶段 `source` 先存引用（玩家对象或 Enemy 实例），不用额外封装，够用就行。

---

## 2. 数据结构

### 2.1 Buff 配置表 BUFF_DEFS

与 WEAPON_DEFS 同级，放在 buff.js 顶部：

```js
const BUFF_DEFS = {
  // ═══ 玩家身上的 Buff ═══
  dashInvuln: {
    name: '瞬身无敌', kind: 'buff', color: 0xffdd66,
    maxStacks: 1, showIcon: true,
    onApply(target) {}, onExpire(target) {}, onTick(target, dt) {},
    drawIcon(g) { /* 黄色圆环 + 闪电折线 */ }
  },
  // 注：GM 无敌也是用 dashInvuln（永久），不再单独有 god buff

  // ═══ 玩家身上的 Debuff（怪物施加） ═══
  waterPrison: {
    name: '水牢', kind: 'debuff', color: 0x44aaff,
    maxStacks: 1, showIcon: true,
    onApply(target) {},
    onExpire(target) {},
    onTick(target, dt) {},
    drawIcon(g) { /* 蓝色圆 + 波浪纹 */ }
  },
  chainLock: {
    name: '法则锁链', kind: 'debuff', color: 0xffd700,
    maxStacks: 1, showIcon: true,
    onApply(target) {}, onExpire(target) {}, onTick(target, dt) {},
    drawIcon(g) { /* 金色方框 + 对角线 */ }
  },

  // ═══ 敌人身上的 Buff（Boss 给自己怪上的） ═══
  enemyBuffDmg: {
    name: '迷魂强化', kind: 'buff', color: 0xcc44aa,
    maxStacks: 1, showIcon: true,  // 小怪也显示图标（缩小一半）
    onApply(target) { target.dmgBuff = BUFF_CHARM_DMG_MUL; target.gfx.tint = 0xcc88ff; },
    onExpire(target) { target.dmgBuff = 1; target.gfx.tint = 0xFFFFFF; },
    drawIcon(g) { /* 紫色圆框 + 紫色血滴 */ }
  },
  enemyBuffRed: {
    name: '血祭强化', kind: 'buff', color: 0xff4444,
    maxStacks: 1, showIcon: true,
    onApply(target) { target.dmgBuff = BUFF_BLOOD_DMG_MUL; target.gfx.tint = 0xff6666; },
    onExpire(target) { target.dmgBuff = 1; target.gfx.tint = 0xFFFFFF; },
    drawIcon(g) { /* 红色圆框 + 红色血滴 */ }
  },

  // ═══ 敌人身上的 Debuff（玩家施加，预留） ═══
  poison: {
    name: '中毒', kind: 'debuff', color: 0x66dd44,
    maxStacks: 5, showIcon: false,
    onApply(target) {}, onExpire(target) {},
    onTick(target, dt) { target.hurt(5 * dt / 1000); },
    drawIcon(g) { /* 绿色骷髅 */ }
  },
  freeze: {
    name: '冰冻', kind: 'debuff', color: 0x88ccff,
    maxStacks: 1, showIcon: true,
    onApply(target) { target.frozen = true; target.gfx.tint = 0x88ccff; },
    onExpire(target) { target.frozen = false; target.gfx.tint = 0xffffff; },
    drawIcon(g) { /* 蓝色圆框 + 白色六瓣雪花 */ }
  },

  // ═══ 预留扩展 ═══
  haste: { name: '迅捷', kind: 'buff', color: 0x88ff88, maxStacks: 1, showIcon: true },
};
```

**Buff 加成常量（在 calculate.js 中）：**


| 常量                 | 值  | 说明             |
| -------------------- | --- | ---------------- |
| `BUFF_CHARM_DMG_MUL` | 2   | 迷魂强化伤害倍率 |
| `BUFF_CHARM_HP_MUL`  | 1.5 | 迷魂强化血量倍率 |
| `BUFF_BLOOD_DMG_MUL` | 2   | 血祭强化伤害倍率 |

### 2.2 运行时实例

```js
// 挂在任何实体上（game.player 或 Enemy 实例）
entity.buffs = [
  {
    key: 'waterPrison',     // BUFF_DEFS 的 key
    remain: 3000,           // 剩余毫秒
    duration: 3000,          // 总时长
    stacks: 1,               // 叠层数
    source: bossInstance,    // 施法方（谁上的这个 buff）
    iconGfx: null,           // 图标 DisplayObject
  }
];
```

---

## 3. 核心 API

```js
// ===== 通用 Buff（任何实体都能挂） =====
addBuff(entity, key, dur, source = null, stacks = 1)
  // entity: 目标实体（game.player 或 Enemy 实例）
  // key: BUFF_DEFS 的 key
  // dur: 持续毫秒
  // source: 施法方引用
  // 同 key 刷新时长 + 叠层；调 onApply；如果 showIcon 则创建图标

removeBuff(entity, key)
  // 调 onExpire；销毁图标；从数组移除

hasBuff(entity, key) => bool
getBuff(entity, key) => obj | null

// ===== 便捷封装 =====
addPlayerBuff(key, dur, source, stacks)   // = addBuff(game.player, key, ...)
addEnemyBuff(enemy, key, dur, source)      // = addBuff(enemy, key, ...)

// ===== 主循环 =====
updateBuffs(dt)
  // 遍历 game.buffs + 所有敌人的 buffs
  // 倒计时 + onTick + 到期自动 removeBuff

// ===== 受击判定统一封装 =====
isPlayerInvulnerable() => bool
  // 只查 dashInvuln buff（GM 无敌也是用这个）

// ===== 敌人 buff 图标渲染 =====
drawEnemyBuffIcon(enemy)
  // 在敌人头顶上方绘制 buff 图标（scale 0.5）
```

---

## 4. 图标显示规则


| 实体类型 | 是否显示图标        | 说明                |
| -------- | ------------------- | ------------------- |
| 玩家     | ✅ 显示（完整尺寸） | 头顶上方横向排列    |
| Boss     | ✅ 显示（完整尺寸） | 头顶血条旁边        |
| 普通小怪 | ✅ 显示（缩小一半） | 头顶上方，scale 0.5 |
| 精英怪   | ✅ 显示（缩小一半） | 同上                |

**判断逻辑**：BUFF_DEFS[key].showIcon 为 true 时才创建图标。小怪图标通过 `drawEnemyBuffIcon()` 绘制，位置在 `enemy.y - enemy.r - 24`（不挡血条）。

---

## 5. 双向施加场景

### 5.1 怪物 → 玩家（Debuff）


| Buff        | 施加者            | 效果                      | 持续时间 |
| ----------- | ----------------- | ------------------------- | -------- |
| waterPrison | 鱼店长（Boss4）   | 被困在水牢区域 + 持续掉血 | 3 秒     |
| chainLock   | 真仙马良（Boss5） | 不能移动                  | 3 秒     |

### 5.2 怪物 → 小怪（Buff）


| Buff                     | 施加者            | 效果                                        | 持续时间 |
| ------------------------ | ----------------- | ------------------------------------------- | -------- |
| enemyBuffDmg（迷魂强化） | 元刹圣祖（Boss3） | 小怪伤害 ×2，血量 ×1.5（首次），紫色 tint | 8 秒     |
| enemyBuffRed（血祭强化） | 真仙马良（Boss5） | 小怪伤害 ×2，红色 tint                     | 10 秒    |

### 5.3 玩家 → 怪物（Debuff）


| Buff           | 施加方式                          | 效果                                |
| -------------- | --------------------------------- | ----------------------------------- |
| poison（预留） | 辟邪神雷附加                      | 持续掉血，叠层                      |
| freeze         | 被动「飞剑冰冻」飞剑命中概率冻结（每级+7%，上限 21%） | 怪物冻结 1 秒，不动不攻击，染蓝；重复触发刷新时间 |

---

## 6. 现有逻辑迁移对照（已完成）


| 旧逻辑                                 | 现在                                                             |
| -------------------------------------- | ---------------------------------------------------------------- |
| `game.invulnTimer > 0`（全局受击无敌） | 已删除。改为每只怪自己的`touchTimer = 600ms`（怪物自身攻击间隔） |
| `game.debug.god`                       | 已删除。GM 无敌直接加`dashInvuln` 永久 buff                      |
| `game.waterPrison`                     | `hasBuff(game.player, 'waterPrison')`                            |
| 敌人`e.dmgBuff` / `e.buffTimer`        | `addEnemyBuff(e, 'enemyBuffDmg', 8000, source)`                  |
| 敌人`e.cloneBuff`                      | `addEnemyBuff(e, 'enemyBuffRed', dur, source)`                   |
| 受击判定                               | `playerHurt()` 统一入口，内部查 `hasBuff(game, 'dashInvuln')`    |

### 受击判定（当前实现）

```js
// fx.js
export function playerHurt(dmg, ignoreHitInvuln = false) {
  if (game.over) return;
  // 瞬身无敌挡所有伤害（GM 无敌也是这个 buff）
  if (hasBuff(game, 'dashInvuln')) return;
  game.hp -= dmg;
  game.hitFlash = 1;
  playHitSound();
}
```

**设计说明**：

- 不再有全局"受击无敌时间"
- 每只怪自己有 `touchTimer = 600ms`，打你一下后这只怪 0.6 秒内不能再打你
- Boss 技能用 `playerHurt(dmg, true)` 调用，不受怪物触碰冷却限制
- 瞬身无敌（dashInvuln buff）挡所有伤害

---

## 7. UI 图标栏

### 7.1 玩家图标栏

位置：玩家头顶上方（y - 50），横向排列，最多 8 格

```
  [⚡无敌][💧水牢][⛓锁链]
  ── 玩家血条 ──
     玩家
```

### 7.2 敌人图标栏

位置：敌人头顶上方（y - r - 24），缩小一半（scale 0.5）

### 7.3 图标绘制规范（PIXI.Graphics）


| Buff     | 图形方案                     |
| -------- | ---------------------------- |
| 瞬身无敌 | 黄色方框 + 内部白色闪电折线 |
| 水牢     | 蓝色方框 + 三道波浪纹       |
| 法则锁链 | 金色方框 + 对角线            |
| 迷魂强化 | 紫色圆框 + 紫色血滴          |
| 血祭强化 | 红色圆框 + 红色血滴          |
| 冰冻     | 蓝色圆框 + 白色六瓣雪花      |

视觉规范：

- 底板：`rgba(0,0,0,0.6)` 圆角矩形 + buff 色 1px 描边
- Debuff 用红描边区分
- 剩余时间：图标底部细进度条，宽度按 remain/duration 比例收缩

### 7.4 动效

- 出现：scale 0→1 弹性（0.2s）
- 即将消失（<1s）：图标 alpha 闪烁
- 消失：缩小淡出

---

## 8. 主循环接入点

```js
// main.js loop 开头
updateBuffs(dt);
```

updateBuffs 内部：

1. 遍历 `game.player.buffs` → 倒计时 + onTick
2. 遍历 `game.enemies` → 每个敌人的 `e.buffs` → 倒计时 + onTick
3. 到期的 buff 调 onExpire + removeBuff

---

## 9. 已完成状态


| 步骤 | 内容                                          | 状态      |
| ---- | --------------------------------------------- | --------- |
| 1    | 新建 buff.js：BUFF_DEFS + 核心 API            | ✅        |
| 2    | 迁移 invulnTimer → dashInvuln buff           | ✅        |
| 3    | 迁移 waterPrison / chainLock 为 debuff        | ✅        |
| 4    | 实现玩家图标栏 UI                             | ✅        |
| 5    | 迁移敌人 dmgBuff/buffTimer → enemy buff      | ✅        |
| 6    | Boss 头顶图标栏                               | ✅        |
| 7    | 删除 god buff，GM 无敌统一用 dashInvuln       | ✅        |
| 8    | 删除全局 invulnTimer，改为怪物自身 touchTimer | ✅        |
| 9    | 小怪 buff 图标显示（缩小一半）                | ✅        |
| 10   | buff 加成常量迁移到 calculate.js              | ✅        |
| 11   | poison 预留；freeze 已实现（飞剑冰冻被动触发，1s 冻结，蓝圈雪花图标） | ✅ freeze / ⏳ poison |
