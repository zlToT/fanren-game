---
name: fanren-code-review
description: 检查凡人修仙传割草游戏（fanren-game）的代码是否符合开发规范。读取 docs/code-standards.md 和 docs/game-dev-standards.md，扫描 js/ 目录下所有代码，报告违规项。
---

## 用途

对 `D:\Work\site\fanren-game\js\` 目录下的所有 JS 文件做代码规范检查，输出违规报告。

## 执行流程

### 第一步：读取规范文档

先读取以下两个文件作为检查依据：
- `D:\Work\site\fanren-game\docs\code-standards.md` — 项目代码规范
- `D:\Work\site\fanren-game\docs\game-dev-standards.md` — 游戏开发规范与性能优化

### 第二步：扫描所有 JS 文件

遍历 `js/` 目录下所有 `.js` 文件，逐一检查以下项目。

### 第三步：输出报告格式

按严重程度分级输出：

```
# 代码规范检查报告

## 🔴 严重（会导致 bug / 内存泄漏）
- [文件:行号] 问题描述

## 🟡 警告（性能隐患 / 不规范）
- [文件:行号] 问题描述

## 🟢 通过
- 检查项通过列表

## 总结
- 严重：X 项
- 警告：X 项
- 通过：X 项
```

---

## 检查清单

### A. 对象池检查

| 检查项 | 违规模式 | 级别 |
|--------|---------|------|
| 敌人是否走 `spawnEnemy()` | 直接 `new Enemy(...)` | 🔴 |
| 经验球是否走 `createOrb()` | 直接 `game.orbs.push({ g: new PIXI.Graphics()... })` | 🔴 |
| 子弹是否走 `createProjectile()` | 直接 `new Projectile(...)` | 🔴 |
| 粒子是否走池化 | `new Particle(...)` 直接 new | 🟡 |
| 伤害数字是否走池化 | `new DamageText(...)` 直接 new | 🟡 |
| 实体死亡是否调用 `release()` | 直接 `app.stage.removeChild()` 不归还池 | 🔴 |

### B. 事件监听检查

| 检查项 | 违规模式 | 级别 |
|--------|---------|------|
| `addEventListener` 是否有对应 `removeEventListener` | 只绑定不解绑 | 🔴 |
| 弹窗按钮事件是否在关闭时解绑 | 弹窗反复打开后按钮触发多次 | 🔴 |
| `window.onkeydown` / `window.onkeyup` 是否在关卡切换时清理 | 切关后旧监听还在 | 🟡 |
| PIXI `ticker.add()` 是否有 `ticker.remove()` | 忘记移除 ticker 回调 | 🔴 |

### C. 定时器检查

| 检查项 | 违规模式 | 级别 |
|--------|---------|------|
| `setInterval` 是否保存 id 并可清理 | 裸 `setInterval(() => {...}, 500)` 无 id | 🔴 |
| 游戏结束时是否清除所有定时器 | 无统一清理逻辑 | 🟡 |
| Boss 技能定时器在 Boss 死亡后是否停止 | 水牢/锁链掉血在 Boss 死后还在跑 | 🔴 |

### D. DOM 操作检查

| 检查项 | 违规模式 | 级别 |
|--------|---------|------|
| 主循环里是否每帧操作 DOM | `document.getElementById(...)` 在 loop 里直接调用 | 🔴 |
| style.display 是否每帧赋值 | 不判断状态变化就设置 | 🟡 |
| DOM 引用是否缓存 | 每帧都 `getElementById` | 🟡 |

### E. 伤害接口检查

| 检查项 | 违规模式 | 级别 |
|--------|---------|------|
| 玩家受伤是否走 `playerHurt()` | 直接 `game.hp -= dmg` | 🔴 |
| 敌人受伤是否走 `e.hurt()` | 直接 `e.hp -= dmg` | 🟡 |
| 是否有旧的 `game.invulnTimer` 残留 | 代码里还有全局无敌时间判定 | 🟡 |

### F. 内存泄漏检查

| 检查项 | 违规模式 | 级别 |
|--------|---------|------|
| `new PIXI.Graphics()` 创建后是否有对应清理 | 创建了但 destroy 路径不完整 | 🔴 |
| `new PIXI.Text()` 是否在实体回收时隐藏/清理 | 名字文字、血条忘记处理 | 🟡 |
| `filter` 清理数组是否正确 | 用 splice 频繁移动数组 | 🟡 |

### G. 代码风格检查

| 检查项 | 违规模式 | 级别 |
|--------|---------|------|
| 每个 JS 文件顶部是否有分区注释 | 文件开头无 `// =====` 说明 | 🟡 |
| 配置表是否硬编码散落各处 | 数值直接写在逻辑代码里 | 🟡 |
| 是否有 `let` 全局可变状态 | 用全局 let 而不是挂 game | 🟡 |

---

## 输出要求

1. 每条违规必须标注**具体文件和行号**
2. 严重问题（🔴）必须给出修复建议
3. 如果某项检查通过，在「通过」区列出
4. 最后给出总结：是否可以继续开发，还是必须先修严重问题
