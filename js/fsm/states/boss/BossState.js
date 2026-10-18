// ============================================================
// fsm/states/boss/BossState.js — Boss 基类状态
// 处理阶段转移（p2/p3），具体技能逻辑委托给 Enemy 方法
// ============================================================

import { State } from '../../State.js';

export class BossP1State extends State {
  enter() {}
  update(dt) {
    this.e.updateBossAI(dt);
    // 阶段转移检测由各 Boss 子类或 Enemy.updateBossAI 内部处理
  }
}

export class BossP2State extends State {
  enter() {}
  update(dt) {
    this.e.updateBossAI(dt);
  }
}

export class BossP3State extends State {
  enter() {}
  update(dt) {
    this.e.updateBossAI(dt);
  }
}
