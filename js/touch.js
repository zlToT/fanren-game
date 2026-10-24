// ============================================================
// touch.js — 手机端虚拟摇杆
// 点屏幕任意非按钮处 → 弹出摇杆，拖动控制移动，松手消失。
// ============================================================

import { game } from './state.js';

let _joystick = null;
let _touchId = null;
let _originX = 0, _originY = 0;
const _RADIUS = 55;

export function isMobile() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function _removeDOM() {
  if (_joystick) { _joystick.remove(); _joystick = null; }
}

function _create(x, y, id) {
  _removeDOM();
  const el = document.createElement('div');
  el.style.cssText = `
    position: fixed; left: ${x - _RADIUS}px; top: ${y - _RADIUS}px;
    width: ${_RADIUS * 2}px; height: ${_RADIUS * 2}px;
    border: 2px solid rgba(140, 240, 170, 0.5); border-radius: 50%;
    background: rgba(20, 60, 40, 0.3); pointer-events: none; z-index: 7;
  `;
  const knob = document.createElement('div');
  knob.style.cssText = `
    position: absolute; left: 50%; top: 50%; width: 38px; height: 38px;
    margin: -19px 0 0 -19px; background: rgba(140, 240, 170, 0.6);
    border-radius: 50%; box-shadow: 0 0 12px rgba(140, 240, 170, 0.4);
  `;
  el.appendChild(knob);
  document.body.appendChild(el);
  _joystick = el;
  _originX = x;
  _originY = y;
  _touchId = id;
}

function _destroy() {
  _removeDOM();
  _touchId = null;
  game.touchMoveX = 0;
  game.touchMoveY = 0;
}

function _update(dx, dy) {
  if (!_joystick) return;
  const knob = _joystick.firstChild;
  const maxR = _RADIUS - 19;
  const dist = Math.hypot(dx, dy);
  if (dist > maxR) { dx = dx / dist * maxR; dy = dy / dist * maxR; }
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  game.touchMoveX = dist > 5 ? dx / maxR : 0;
  game.touchMoveY = dist > 5 ? dy / maxR : 0;
}

// 判断触摸点是否在按钮/面板上
function _isOnUI(target) {
  return target.closest('button') || target.closest('.m-btn') ||
    target.closest('#btnBack') || target.closest('#debugBtn') ||
    target.closest('#upgradePanel') || target.closest('#menu') ||
    target.closest('#debugPanel');
}

export function initTouch() {
  if (!isMobile()) return;
  game.touchMoveX = 0;
  game.touchMoveY = 0;

  document.addEventListener('touchstart', (e) => {
    // 菜单页/升级面板上不创建摇杆
    if (_isOnUI(e.target)) return;
    const t = e.changedTouches[0];
    // 新触摸直接接管（不管之前有没有摇杆）
    _create(t.clientX, t.clientY, t.identifier);
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (_touchId === null) return;
    for (const t of e.changedTouches) {
      if (t.identifier === _touchId) {
        _update(t.clientX - _originX, t.clientY - _originY);
      }
    }
  }, { passive: true });

  const _end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === _touchId) _destroy();
    }
  };
  document.addEventListener('touchend', _end, { passive: true });
  document.addEventListener('touchcancel', _end, { passive: true });
}

export function getTouchMove() {
  return { x: game.touchMoveX || 0, y: game.touchMoveY || 0 };
}
