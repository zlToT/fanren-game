// ============================================================
// fsm/FSM.js — 状态机管理器
// setState 自动调旧状态 exit + 新状态 enter
// sendEvent 转发事件给当前状态（buff 系统用）
// ============================================================

import { State } from './State.js';

export class FSM {
  constructor(entity) {
    this.e = entity;
    this.current = null;
    this.currentName = '';
  }

  setState(StateClass, data = {}) {
    if (this.current) this.current.exit();
    this.current = new StateClass(this.e, data);
    this.currentName = StateClass.name;
    this.current.enter();
  }

  update(dt) {
    if (this.current) this.current.update(dt);
  }

  sendEvent(name, data) {
    if (this.current) this.current.onEvent(name, data);
  }
}
