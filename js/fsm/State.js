// ============================================================
// fsm/State.js — 状态基类
// 每个状态实现 enter/update/exit，onEvent 给 buff 系统挂钩子
// ============================================================

export class State {
  constructor(entity) {
    this.e = entity;
  }
  enter() {}
  update(dt) {}
  exit() {}
  onEvent(name, data) {}
}
