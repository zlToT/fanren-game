// ============================================================
// bg-image.js — 图片背景层
// 层叠顺序：#firefly-bg (z:1) < bg-image (z:1.5) < #gameCanvas (z:2)
// 图片放在 public/imgs/bg/ 下，按主题命名
// ============================================================

const BG_MAP = {
  menu: './imgs/bg/menu.jpg',
  grass: './imgs/bg/grass.jpg',
  fall: './imgs/bg/fall.jpg',
  dark: './imgs/bg/dark.jpg',
  void: './imgs/bg/void.jpg',
  heaven: './imgs/bg/heaven.jpg',
};

let bgDiv = null;
const preloaded = {};

function ensureDiv() {
  if (bgDiv) return bgDiv;
  bgDiv = document.createElement('div');
  bgDiv.id = 'bg-image';
  bgDiv.style.cssText = `
    position: fixed; inset: 0; z-index: 1.5;
    background-size: cover; background-position: center;
    background-repeat: no-repeat;
    transition: opacity 0.4s ease;
    opacity: 0; pointer-events: none;
  `;
  // 插在 #firefly-bg 后面、#gameCanvas 前面
  const firefly = document.getElementById('firefly-bg');
  firefly.parentNode.insertBefore(bgDiv, firefly.nextSibling);
  return bgDiv;
}

// 预加载所有背景图
function preloadAll() {
  Object.entries(BG_MAP).forEach(([k, src]) => {
    const img = new Image();
    img.onload = () => { preloaded[k] = true; };
    img.src = src;
  });
}

// 切换到指定主题背景
export function setBgTheme(theme) {
  const div = ensureDiv();
  const src = BG_MAP[theme];
  if (!src) return;

  const apply = () => {
    div.style.backgroundImage = `url('${src}')`;
    div.style.opacity = '1';
  };

  if (preloaded[theme]) {
    apply();
  } else {
    const img = new Image();
    img.onload = () => { preloaded[theme] = true; apply(); };
    img.src = src;
  }
}

export function showMenuBg() {
  setBgTheme('menu');
}

export function hideBgImage() {
  if (bgDiv) bgDiv.style.opacity = '0';
}

export function initBgImage() {
  ensureDiv();
  preloadAll();
  // 隐藏原来的 canvas 背景，用图片替代
  const firefly = document.getElementById('firefly-bg');
  if (firefly) firefly.style.display = 'none';
}
