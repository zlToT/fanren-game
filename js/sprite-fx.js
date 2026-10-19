// ============================================================
// sprite-fx.js — 序列帧动画特效系统
// 用法：
//   1. 把特效序列帧图放到 public/imgs/fx/ 下
//   2. 用 loadFxSpritesheet() 预加载
//   3. 调用 playFx(name, x, y) 在指定位置播放
// ============================================================

import * as PIXI from 'pixi.js';
import { app, game } from './state.js';

const fxTextures = {};
const _fxPool = [];
const MAX_FX_POOL = 50;

// 预加载特效精灵图
// config: { name: { src: 'imgs/fx/boom.png', frames: 8, w: 64, h: 64, frameTime: 0.1 } }
export function loadFxSpritesheet(config) {
  Object.entries(config).forEach(([name, cfg]) => {
    const img = new Image();
    img.onload = () => {
      const baseTex = PIXI.Texture.from(img);
      const frames = [];
      for (let i = 0; i < cfg.frames; i++) {
        const tex = new PIXI.Texture(baseTex.baseTexture, new PIXI.Rectangle(i * cfg.w, 0, cfg.w, cfg.h));
        frames.push(tex);
      }
      // frameTime 每帧秒数 → animationSpeed（PIXI 默认 1 = 60fps）
      const speed = 1 / (60 * cfg.frameTime);
      fxTextures[name] = { frames, speed, scale: cfg.scale || 1 };
    };
    img.src = cfg.src;
  });
}

// 在指定位置播放特效，返回 sprite，支持 onComplete 回调
export function playFx(name, x, y, scale = 1, onComplete = null) {
  const cfg = fxTextures[name];
  if (!cfg) return null;

  let sprite;
  if (_fxPool.length > 0) {
    sprite = _fxPool.pop();
    sprite.textures = cfg.frames;
    sprite.animationSpeed = cfg.speed;
    sprite.scale.set(scale * cfg.scale);
    app.stage.addChild(sprite);
  } else {
    sprite = new PIXI.AnimatedSprite(cfg.frames);
    sprite.animationSpeed = cfg.speed;
    sprite.scale.set(scale * cfg.scale);
    sprite.anchor.set(0.5);
    sprite.loop = false;
    app.stage.addChild(sprite);
  }

  sprite.x = x;
  sprite.y = y;
  sprite.alpha = 1;
  sprite.followTarget = null;
  sprite.gotoAndPlay(0);

  // 完成回调：播完触发，然后回收
  sprite.onComplete = () => {
    app.stage.removeChild(sprite);
    if (_fxPool.length < MAX_FX_POOL) _fxPool.push(sprite);
    if (onComplete) onComplete();
  };

  game.fxSprites.push(sprite);
  return sprite;
}

// 跟随目标播放特效（挂在人物身上，随人物移动）
// target = { x, y } 对象，每帧自动同步位置
export function playFxByTarget(name, target, scale = 1, onComplete = null) {
  const s = playFx(name, target.x, target.y, scale, onComplete);
  if (s) s.followTarget = target;
  return s;
}

// 每帧更新（从主循环调用）
export function updateFxSprites() {
  for (const s of game.fxSprites) {
    if (s.followTarget) {
      s.x = s.followTarget.x;
      s.y = s.followTarget.y;
    }
  }
  game.fxSprites = game.fxSprites.filter(s => s.parent !== null);
}
