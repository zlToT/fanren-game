# FSM 状态机设计方案

## 设计目标
- 统一小怪/Boss的行为管理，替代现在的 switch-case
- 为后续 buff 系统预留挂载点（buff 修改状态参数、触发状态切换）
- 轻量实现，不引入外部库

---

## 核心结构

```
js/fsm/
├── State.js          — 状态基类（enter/update/exit）
├── FSM.js            — 状态机管理器（setState/update）
├── states/
│   ├── Idle.js       — 待机（出生短暂停留）
│   ├── Chase.js      — 追击玩家
│   ├── Sway.js       — 摇摆飞行（魔蝠）
│   ├── Ranged.js     — 远程保持距离射击
│   ├── Charge.js     — 冲锋（赤鬃猪）
│   ├── Split.js      — 分裂死亡（史莱姆）
│   └── boss/
│       ├── BossP1.js — Boss 第一阶段（基类，含普攻+技能计时器）
│       ├── BossP2.js — Boss 第二阶段（半血解锁新技能）
│       └── BossP3.js — Boss 第三阶段（仅马良）
```

---

## State 基类

```js
// js/fsm/State.js
export class State {
  constructor(entity) { this.e = entity; }
  enter() {}    // 进入状态时调用一次（播放动画/重置计时器）
  update(dt) {} // 每帧调用（移动/攻击/检测转移条件）
  exit() {}     // 离开状态时调用一次（清理临时特效）
  onEvent(name, data) {} // buff 系统事件钩子
}
```

---

## FSM 管理器

```js
// js/fsm/FSM.js
import { Idle } from './states/Idle.js';

export class FSM {
  constructor(entity) {
    this.e = entity;
    this.current = null;
    this.prevState = null;
  }

  setState(StateClass, data = {}) {
    if (this.current) this.current.exit();
    this.prevState = this.current;
    this.current = new StateClass(this.e, data);
    this.current.enter();
  }

  update(dt) {
    if (this.current) this.current.update(dt);
  }

  sendEvent(name, data) {
    if (this.current) this.current.onEvent(name, data);
  }
}
```

---

## 小怪状态示例

```js
// js/fsm/states/Chase.js
import { State } from '../State.js';

export class Chase extends State {
  enter() {}
  update(dt) {
    const e = this.e;
    const dx = game.player.x - e.x, dy = game.player.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d > 0) { e.x += dx / d * e.spd; e.y += dy / d * e.spd; }
  }
}
```

```js
// js/fsm/states/Ranged.js
import { State } from '../State.js';

export class Ranged extends State {
  enter() { this.shootT = 1000; }
  update(dt) {
    const e = this.e;
    const dx = game.player.x - e.x, dy = game.player.y - e.y;
    const d = Math.hypot(dx, dy);
    // 保持距离：太远靠近，太远离
    if (d > e.def.keepDist) { e.x += dx / d * e.spd; e.y += dy / d * e.spd; }
    else if (d < e.def.keepDist - 60) { e.x -= dx / d * e.spd; e.y -= dy / d * e.spd; }
    // 射击
    this.shootT -= dt;
    if (this.shootT <= 0) {
      this.shootT = e.def.shootCD;
      e.fireProjectile();
    }
  }
}
```

---

## Boss 状态示例

```js
// js/fsm/states/boss/BossP1.js
import { State } from '../../State.js';

export class BossP1 extends State {
  enter() {
    this.skillT = 3000;   // 主技能冷却
    this.skill2T = 6000;  // 副技能冷却
  }
  update(dt) {
    const e = this.e;
    // 基础追击
    const dx = game.player.x - e.x, dy = game.player.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d > 0) { e.x += dx / d * e.spd; e.y += dy / d * e.spd; }

    // 技能计时
    this.skillT -= dt;
    if (this.skillT <= 0) { e.castPrimarySkill(); this.skillT = e.skillCD; }
    this.skill2T -= dt;
    if (this.skill2T <= 0) { e.castSecondarySkill(); this.skill2T = e.skill2CD; }

    // 阶段转移：血量到阈值 → 切换 P2
    if (e.hp < e.maxHp * e.p2Threshold) {
      e.fsm.setState(BossP2);
    }
  }
}
```

每个 Boss 只需要在配置里定义：
```js
boss1: { ..., p2Threshold: 0.6, skills: ['bloodCloud', 'phantomSword'], p2Skills: ['clone'] }
```

---

## Buff 系统挂载点

FSM 的 `onEvent` 是 buff 系统的钩子：

```js
// 未来 buff 示例：狂暴（攻击力+50%，移速+30%）
export class RageBuff {
  apply(enemy) {
    enemy.dmg *= 1.5;
    enemy.spd *= 1.3;
    enemy.fsm.sendEvent('buff:rage');  // 通知状态机
  }
}
```

State 里监听 buff 事件：
```js
class BossP1 extends State {
  onEvent(name, data) {
    if (name === 'buff:rage') {
      this.skillT *= 0.7;  // 狂暴时技能冷却缩短
    }
  }
}
```

---

## 改造步骤

1. **第一步**：建 `js/fsm/` 目录，写 State / FSM 基类
2. **第二步**：把现有 4 种小怪 behavior 各写成一个 State 类（逻辑直接搬过来）
3. **第三步**：Enemy 类加 `this.fsm = new FSM(this)`，constructor 里根据 behavior 初始化对应 State
4. **第四步**：Boss 的 p2 布尔标记改成 `fsm.setState(BossP2)`，p3 同理
5. **第五步**：验证所有小怪/Boss 行为与原版一致

---

## 收益

| 现在 | FSM 后 |
|------|--------|
| switch-case 里堆逻辑 | 每个状态一个文件，职责清晰 |
| p2 布尔 + if 判断阶段 | setState() 显式切换 |
| buff 要改全局数值 | buff 通过 sendEvent 通知状态，状态可动态调整参数 |
| 加新敌人要改大 switch | 新建 State 类 + 配置注册即可 |
