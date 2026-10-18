// ============================================================
// pool.js — 对象池系统
// 避免频繁 new/销毁 导致 GC 压力大，割草游戏必备。
// 用法：const particlePool = new Pool(() => new Particle(), obj => obj.reset());
//   获取：const p = particlePool.get();
//   归还：particlePool.release(p);
// ============================================================

export class Pool {
  /**
   * @param {Function} factory 创建新对象的工厂函数
   * @param {Function} [reset] 归还时重置对象状态的函数
   * @param {number} [maxSize=200] 池最大容量，超过直接丢弃
   */
  constructor(factory, reset, maxSize = 200) {
    this.factory = factory;
    this.reset = reset || (() => {});
    this.maxSize = maxSize;
    this._pool = [];
  }

  /** 从池里取一个对象，池空了就 new 一个 */
  get() {
    if (this._pool.length > 0) {
      return this._pool.pop();
    }
    return this.factory();
  }

  /** 归还对象到池里（先重置状态） */
  release(obj) {
    if (this._pool.length >= this.maxSize) return;
    this.reset(obj);
    this._pool.push(obj);
  }

  /** 清空池 */
  clear() {
    this._pool.length = 0;
  }

  /** 当前池大小 */
  get size() {
    return this._pool.length;
  }
}

// ===== 全局池实例 =====
import * as PIXI from 'pixi.js';
import { app, game } from './state.js';

// 粒子池（最频繁创建）
export const particlePool = new Pool(
  () => {
    const g = new PIXI.Graphics();
    app.stage.addChild(g);
    return { g, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, color: 0xffffff, size: 2 };
  },
  (p) => { p.life = 0; p.g.clear(); app.stage.removeChild(p.g); },
  300
);

// 伤害数字池
export const damageTextPool = new Pool(
  () => {
    const t = new PIXI.Text('', { fontFamily: 'Microsoft YaHei', fontSize: 14, fill: '#fff', stroke: '#000', strokeThickness: 3 });
    app.stage.addChild(t);
    return { t, x: 0, y: 0, life: 0, vy: -1.5 };
  },
  (d) => { d.life = 0; app.stage.removeChild(d.t); },
  200
);
