// ============================================================
// buff.js — Buff 系统
// 统一管理所有增益/减益效果，支持双向施加（怪→玩家、玩家→怪）
// 图标只显示在玩家和 Boss 头顶，小怪只生效效果不显示图标。
// ============================================================

import * as PIXI from 'pixi.js';
import { app, game } from './state.js';
import { playerHurt } from './fx.js';
import { BUFF_CHARM_DMG_MUL, BUFF_BLOOD_DMG_MUL } from './calculate.js';

// ===== Buff 配置表 =====
export const BUFF_DEFS = {
  // ═══ 玩家身上的 Buff ═══
  dashInvuln: {
    name: '瞬身无敌', kind: 'buff', color: 0xffdd66,
    maxStacks: 1, showIcon: true,
    onApply(target) {}, onExpire(target) {}, onTick(target, dt) {},
    drawIcon(g) {
      g.lineStyle(2, 0xffdd66, 1);
      g.drawCircle(0, 0, 10);
      g.lineStyle(0);
      g.beginFill(0xffffff);
      g.moveTo(2, -8); g.lineTo(-3, 0); g.lineTo(0, 0); g.lineTo(-2, 8); g.lineTo(3, 0); g.lineTo(0, 0);
      g.endFill();
    }
  },

  // ═══ 玩家身上的 Debuff（怪物施加） ═══
  waterPrison: {
    name: '水牢', kind: 'debuff', color: 0x44aaff,
    maxStacks: 1, showIcon: true,
    onApply(target) {},
    onExpire(target) {},
    onTick(target, dt) {},
    drawIcon(g) {
      g.lineStyle(2, 0x44aaff, 1);
      g.drawCircle(0, 0, 10);
      g.lineStyle(0);
      g.beginFill(0x44aaff, 0.4);
      g.drawCircle(0, 0, 10);
      g.endFill();
      g.lineStyle(1.5, 0xffffff, 0.8);
      g.moveTo(-6, -3); g.quadraticCurveTo(-3, -5, 0, -3); g.quadraticCurveTo(3, -1, 6, -3);
      g.moveTo(-6, 0); g.quadraticCurveTo(-3, -2, 0, 0); g.quadraticCurveTo(3, 2, 6, 0);
      g.moveTo(-6, 3); g.quadraticCurveTo(-3, 1, 0, 3); g.quadraticCurveTo(3, 5, 6, 3);
    }
  },
  chainLock: {
    name: '法则锁链', kind: 'debuff', color: 0xffd700,
    maxStacks: 1, showIcon: true,
    onApply(target) {}, onExpire(target) {}, onTick(target, dt) {},
    drawIcon(g) {
      g.lineStyle(2, 0xffd700, 1);
      g.drawRect(-9, -9, 18, 18);
      g.moveTo(-9, -9); g.lineTo(9, 9);
      g.moveTo(9, -9); g.lineTo(-9, 9);
    }
  },

  // ═══ 敌人身上的 Buff（Boss 给怪上的） ═══
  enemyBuffDmg: {
    name: '迷魂强化', kind: 'buff', color: 0xcc44aa,
    maxStacks: 1, showIcon: true,
    onApply(target) { target.dmgBuff = BUFF_CHARM_DMG_MUL; target.gfx.tint = 0xcc88ff; },
    onExpire(target) { target.dmgBuff = 1; target.gfx.tint = 0xFFFFFF; },
    drawIcon(g) {
      g.lineStyle(1.5, 0xcc44aa, 1);
      g.drawCircle(0, 0, 8);
      g.lineStyle(0);
      g.beginFill(0xcc44aa, 0.3);
      g.drawCircle(0, 0, 8);
      g.endFill();
      // 紫色血滴
      g.beginFill(0xcc44aa);
      g.moveTo(0, -4); g.quadraticCurveTo(3, 0, 2, 3); g.quadraticCurveTo(1, 5, 0, 5);
      g.quadraticCurveTo(-1, 5, -2, 3); g.quadraticCurveTo(-3, 0, 0, -4);
      g.endFill();
    }
  },
  enemyBuffRed: {
    name: '血祭强化', kind: 'buff', color: 0xff4444,
    maxStacks: 1, showIcon: true,
    onApply(target) { target.dmgBuff = BUFF_BLOOD_DMG_MUL; target.gfx.tint = 0xff6666; },
    onExpire(target) { target.dmgBuff = 1; target.gfx.tint = 0xFFFFFF; },
    drawIcon(g) {
      g.lineStyle(1.5, 0xff4444, 1);
      g.drawCircle(0, 0, 8);
      g.lineStyle(0);
      g.beginFill(0xff4444, 0.3);
      g.drawCircle(0, 0, 8);
      g.endFill();
      // 红色血滴
      g.beginFill(0xff4444);
      g.moveTo(0, -4); g.quadraticCurveTo(3, 0, 2, 3); g.quadraticCurveTo(1, 5, 0, 5);
      g.quadraticCurveTo(-1, 5, -2, 3); g.quadraticCurveTo(-3, 0, 0, -4);
      g.endFill();
    }
  },

  // ═══ 敌人身上的 Debuff（玩家施加，预留） ═══
  poison: {
    name: '中毒', kind: 'debuff', color: 0x66dd44,
    maxStacks: 5, showIcon: false,
    onApply(target) {}, onExpire(target) {},
    onTick(target, dt) { target.hurt(4 * dt / 1000); },
    drawIcon(g) {
      g.beginFill(0x66dd44); g.drawCircle(0, 0, 8); g.endFill();
      g.beginFill(0x000000); g.drawCircle(-2, -1, 1); g.drawCircle(2, -1, 1); g.endFill();
    }
  },
  freeze: {
    name: '冰冻', kind: 'debuff', color: 0x88ccff,
    maxStacks: 1, showIcon: true,
    onApply(target) {
      target.frozen = true;
      if (target.gfx) target.gfx.tint = 0x88ccff;
    },
    onExpire(target) {
      target.frozen = false;
      if (target.gfx) target.gfx.tint = 0xffffff;
    },
    drawIcon(g) {
      g.lineStyle(2, 0x88ccff, 1);
      g.drawCircle(0, 0, 9);
      g.lineStyle(0);
      g.beginFill(0x88ccff, 0.3);
      g.drawCircle(0, 0, 9);
      g.endFill();
      // ❄️ 六瓣雪花
      g.lineStyle(1.5, 0xffffff, 1);
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        g.moveTo(0, 0);
        g.lineTo(Math.cos(a) * 5, Math.sin(a) * 5);
      }
      g.lineStyle(0);
    }
  },
};

// ===== 运行时存储 =====
// game.playerBuffs: 玩家身上的 buff 数组
// entity.buffs: 敌人身上的 buff 数组（每个 Enemy 实例自带）

// ===== 核心 API =====

// 给实体挂 buff
export function addBuff(entity, key, dur, source = null, stacks = 1) {
  const def = BUFF_DEFS[key];
  if (!def) { console.warn('[buff] 未知 buff:', key); return; }

  // 初始化 buffs 数组
  if (!entity.buffs) entity.buffs = [];

  // 检查是否已有同 key buff
  let existing = entity.buffs.find(b => b.key === key);
  if (existing) {
    // 刷新时长 + 叠层
    existing.remain = Math.max(existing.remain, dur);
    existing.duration = dur;
    existing.stacks = Math.min((existing.stacks || 1) + (stacks - 1), def.maxStacks);
    return existing;
  }

  // 新建 buff 实例
  const buff = {
    key,
    remain: dur,
    duration: dur,
    stacks: stacks || 1,
    source: source,
    iconGfx: null,
  };

  // 如果需要显示图标，创建图标 Gfx
  if (def.showIcon) {
    buff.iconGfx = createIconGfx(def);
  }

  entity.buffs.push(buff);

  // 调用 onApply
  if (def.onApply) def.onApply(entity, buff);

  return buff;
}

// 移除 buff
export function removeBuff(entity, key) {
  if (!entity.buffs) return;
  const idx = entity.buffs.findIndex(b => b.key === key);
  if (idx < 0) return;

  const buff = entity.buffs[idx];
  const def = BUFF_DEFS[key];

  // 调用 onExpire
  if (def && def.onExpire) def.onExpire(entity, buff);

  // 销毁图标
  if (buff.iconGfx && buff.iconGfx.parent) {
    buff.iconGfx.parent.removeChild(buff.iconGfx);
  }

  entity.buffs.splice(idx, 1);
}

// 查询是否有 buff
export function hasBuff(entity, key) {
  if (!entity || !entity.buffs) return false;
  return entity.buffs.some(b => b.key === key);
}

// 获取 buff 实例
export function getBuff(entity, key) {
  if (!entity || !entity.buffs) return null;
  return entity.buffs.find(b => b.key === key) || null;
}

// 便捷封装：玩家 buff
export function addPlayerBuff(key, dur, source = null, stacks = 1) {
  return addBuff(game, key, dur, source, stacks);
}

// 便捷封装：敌人 buff
export function addEnemyBuff(enemy, key, dur, source = null, stacks = 1) {
  return addBuff(enemy, key, dur, source, stacks);
}

// 主循环更新：倒计时 + onTick + 到期移除
export function updateBuffs(dt) {
  // 更新玩家 buff
  if (!game.buffs) game.buffs = [];
  tickBuffs(game, dt);

  // 更新所有敌人的 buff
  for (const e of game.enemies) {
    if (e.buffs && e.buffs.length > 0) {
      tickBuffs(e, dt);
    }
  }
}

function tickBuffs(entity, dt) {
  if (!entity.buffs) return;
  // 从后往前遍历，方便删除
  for (let i = entity.buffs.length - 1; i >= 0; i--) {
    const buff = entity.buffs[i];
    const def = BUFF_DEFS[buff.key];
    if (!def) { entity.buffs.splice(i, 1); continue; }

    buff.remain -= dt;

    // 调用 onTick
    if (def.onTick) def.onTick(entity, dt, buff);

    // 到期移除（永久 buff 除外）
    if (buff.remain <= 0 && !def.permanent) {
      if (def.onExpire) def.onExpire(entity, buff);
      if (buff.iconGfx && buff.iconGfx.parent) {
        buff.iconGfx.parent.removeChild(buff.iconGfx);
      }
      entity.buffs.splice(i, 1);
    }
  }
}

// ===== 受击判定统一封装 =====
export function isPlayerInvulnerable() {
  return hasBuff(game, 'dashInvuln');
}

// ===== 图标渲染 =====

// 创建单个图标 Gfx
function createIconGfx(def) {
  const container = new PIXI.Container();

  // 底板
  const bg = new PIXI.Graphics();
  bg.beginFill(0x000000, 0.6);
  bg.lineStyle(1, def.kind === 'debuff' ? 0xff4444 : def.color, 1);
  bg.drawRoundedRect(-14, -14, 28, 28, 4);
  bg.endFill();
  container.addChild(bg);

  // 图标内容
  const icon = new PIXI.Graphics();
  def.drawIcon(icon);
  container.addChild(icon);

  // 叠层数
  if (def.maxStacks > 1) {
    const stackText = new PIXI.Text('×1', {
      fontFamily: 'Arial', fontSize: 10, fill: 0xffffff,
      stroke: 0x000000, strokeThickness: 2
    });
    stackText.position.set(8, 6);
    container.addChild(stackText);
  }

  container.alpha = 1;
  return container;
}

// 绘制玩家头顶 buff 图标栏
export function drawPlayerBuffBar() {
  if (!game.buffs || game.buffs.length === 0) return;

  const px = game.player.x;
  const py = game.player.y - 50;

  let offsetX = 0;
  for (const buff of game.buffs) {
    const def = BUFF_DEFS[buff.key];
    if (!def || !def.showIcon || !buff.iconGfx) continue;

    const g = buff.iconGfx;
    g.position.set(px + offsetX, py);

    // 剩余时间进度条
    const ratio = Math.max(0, buff.remain / buff.duration);
    // 即将消失闪烁
    if (buff.remain < 1000) {
      g.alpha = 0.5 + Math.sin(performance.now() / 80) * 0.5;
    } else {
      g.alpha = 1;
    }

    // 叠层数更新
    if (def.maxStacks > 1) {
      const stackText = g.children[2];
      if (stackText) stackText.text = '×' + buff.stacks;
    }

    // 添加到 stage（如果还没加）
    if (!g.parent) app.stage.addChild(g);

    offsetX += 32;
  }
}

// 清除所有 buff 图标（场景切换时调用）
export function clearBuffIcons() {
  if (game.buffs) {
    for (const buff of game.buffs) {
      if (buff.iconGfx && buff.iconGfx.parent) {
        buff.iconGfx.parent.removeChild(buff.iconGfx);
      }
    }
  }
  // 清除所有敌人的 buff 图标
  if (game.enemies) {
    for (const e of game.enemies) {
      if (e.buffs) {
        for (const buff of e.buffs) {
          if (buff.iconGfx && buff.iconGfx.parent) {
            buff.iconGfx.parent.removeChild(buff.iconGfx);
          }
        }
      }
    }
  }
}

// 绘制敌人身上的 buff 图标（大小为正常一半，位于头顶上方，不挡血条）
export function drawEnemyBuffIcon(enemy) {
  if (!enemy.buffs || enemy.buffs.length === 0) return;
  // ★ 贴怪物视觉顶边排：Boss 贴图半高 visualHalfH=r*2.1，普通怪=r
  //   顺序：怪头 → 血条(+8) → buff 图标(+22) → 名字(+34)
  const halfH = enemy.visualHalfH || enemy.r;
  const ey = enemy.y - halfH - 22;
  let offsetX = 0;
  for (const buff of enemy.buffs) {
    const def = BUFF_DEFS[buff.key];
    if (!def || !def.showIcon || !buff.iconGfx) continue;
    const g = buff.iconGfx;
    g.scale.set(0.5); // 缩小一半
    g.position.set(enemy.x + offsetX, ey);
    if (!g.parent) app.stage.addChild(g);
    offsetX += 14; // 缩小后间距也减半
  }
}

// 初始化/重置玩家 buff 系统
export function initBuffs() {
  game.buffs = [];
}
