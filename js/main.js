// ============================================================
// main.js — 入口与主循环
// PIXI 启动、纹理加载、选关菜单、initGame 初始化、
// requestAnimationFrame 主循环（移动/武器/敌人/弹幕/掉落/升级/Boss生成）、
// HUD 渲染（血条/雷条/Boss血条）。
// ============================================================

import * as PIXI from 'pixi.js';
import { app, setApp, game, gameStarted, setGameStarted, curLevel, setCurLevel, IMG_TEX, setIMG_READY, IMG_READY, keys, playerGfx, setPlayerGfx, playerHpBar, setPlayerHpBar, dashRing, setDashRing, stealthRing, setStealthRing, charTex, setCharTex, charReady, setCharReady, playerDir, setPlayerDirState, ui, setUI, mxGlobal, myGlobal, setMove, audioCtx, audioBuffers } from './state.js';
import { LEVELS, THEMES, STANCE_NAMES } from './config.js';
import { initAudio, playSound, playFile, playBgm, playLevelBgm, tryStartBGM } from './audio.js';
import { initBackground, setTheme, resizeBg } from './background.js';
import { initBgImage, setBgTheme, showMenuBg } from './bg-image.js';
import { burst, updateShake } from './fx.js';
import { Sword, Bug, Lightning, Orbit, updateArcTriggers, findRandomEnemy } from './weapons.js';
import { spawnEnemy, releaseOrb, startPoolWarmup, tickPoolWarmup, makeSpecialElite, pickType, getWave } from './enemy.js';
import { BloodCloud, Shockwave, HomingOrb, CrescentBlade, LightningBolt, FullBeam, GoldenChain, FireWave, GiantHand } from './projectiles.js';
import { toast, showUpgrade, getUpgradePool, getEvolutionOptions, autoUpgrade, endScreen, setupDBG, showSkillInfo } from './ui.js';
import { tryDash, cycleStance, castThunder, initInput } from './input.js';
import { initAIAssistant } from './ai-assistant.js';
import { player } from './player.js';
import { calcLevelUpBonus, calcNextExpNeed, PLAYER_BASE_ATK, calcHealAmount } from './calculate.js';
import { updateBuffs, drawPlayerBuffBar, initBuffs, hasBuff } from './buff.js';

let playerAnimT = 0; // 保留兼容，实际动画在 player.js
let dashCd = null, thunderCd = null;

let _booted = false;
let _lastDashActive = false;
async function boot() {
  if (_booted) return;
  let app;
  try {
    app = new PIXI.Application({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundAlpha: 0,
      antialias: true,
      forceCanvas: false,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      powerPreference: 'low-power',
    });
    // ★ 手动 resize（防抖），避免 resizeTo:window 在 F12 时画布变 0 导致 WebGL 崩
    let _resizeT;
    window.addEventListener('resize', () => {
      clearTimeout(_resizeT);
      _resizeT = setTimeout(() => {
        const w = Math.max(100, window.innerWidth);
        const h = Math.max(100, window.innerHeight);
        app.renderer.resize(w, h);
      }, 200);
    });
  } catch (e) {
    console.error('PIXI boot failed:', e);
    document.body.insertAdjacentHTML('beforeend', '<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#c33;color:#fff;padding:20px;border-radius:8px;z-index:9999">WebGL 初始化失败，请刷新页面重试</div>');
    return;
  }
  _booted = true;
  app.view.addEventListener('webglcontextlost', (e) => { e.preventDefault(); console.warn('WebGL context lost'); });
  app.view.addEventListener('webglcontextrestored', () => { console.warn('WebGL context restored'); });
  setApp(app);
  document.getElementById('gameCanvas').appendChild(app.view);
  app.view.style.position = 'fixed';
  app.view.style.zIndex = 2;

  ui.hp = document.getElementById('hpBar');
  ui.exp = document.getElementById('expBar');
  ui.thunder = document.getElementById('thunderBar');
  ui.hpTxt = document.getElementById('hpTxt');
  ui.expTxt = document.getElementById('expTxt');
  ui.thunderTxt = document.getElementById('thunderTxt');
  ui.uiStats = document.getElementById('uiStats');
  ui.panel = document.getElementById('upgradePanel');
  ui.opts = document.getElementById('upgradePanel');
  ui.menu = document.getElementById('menu');
  ui.menuList = document.getElementById('levelBox');
  ui.statsPanel = document.getElementById('statsPanel');
  setUI(ui);

  dashCd = document.querySelector('#btnDash .cd');
  thunderCd = document.querySelector('#btnThunder .cd');

  const pg = new PIXI.Container();
  const body = new PIXI.Graphics();
  body.beginFill(0x4aa8ff); body.drawRoundedRect(-10, -12, 20, 24, 6); body.endFill();
  body.beginFill(0xffffff); body.drawCircle(0, -16, 8); body.endFill();
  pg.addChild(body);
  pg.visible = false;
  app.stage.addChild(pg);
  setPlayerGfx(pg);

  const phb = new PIXI.Graphics();
  app.stage.addChild(phb);
  setPlayerHpBar(phb);

  const bossHpText = new PIXI.Text('', { fontFamily: 'Arial', fontSize: 12, fill: 0xffffff });
  bossHpText.anchor.set(0.5, 0);
  app.stage.addChild(bossHpText);
  game.bossHpText = bossHpText;

  const dr = new PIXI.Graphics();
  dr.lineStyle(3, 0xffd766, 0.9);
  dr.drawCircle(0, 0, 20);
  dr.visible = false;
  app.stage.addChild(dr);
  setDashRing(dr);

  const sr = new PIXI.Graphics();
  sr.lineStyle(2, 0x88ccff, 0.6);
  sr.drawCircle(0, 0, 24);
  sr.visible = false;
  app.stage.addChild(sr);
  setStealthRing(sr);

  // Load character textures
  try {
    await Promise.all([
      PIXI.Assets.load('./imgs/char_down.png').then(t => charTex.down = t),
      PIXI.Assets.load('./imgs/char_up.png').then(t => charTex.up = t),
      PIXI.Assets.load('./imgs/char_left.png').then(t => charTex.left = t),
      PIXI.Assets.load('./imgs/char_right.png').then(t => charTex.right = t),
    ]);
    setCharTex(charTex);
    setCharReady(true);
    pg.removeChildren();
    const spr = new PIXI.Sprite(charTex.down);
    spr.anchor.set(0.5);
    spr.width = 40; spr.height = 40;
    pg.addChild(spr);
    pg._spr = spr;
  } catch (e) { }

  // Load weapon/boss textures
  try {
    IMG_TEX.sword = await PIXI.Assets.load('./imgs/sword.png');
  } catch (e) { }
  try {
    IMG_TEX.bug = await PIXI.Assets.load('./imgs/bug.png');
  } catch (e) { }
  for (let i = 1; i <= 5; i++) {
    try { IMG_TEX['boss' + i] = await PIXI.Assets.load('./imgs/boss' + i + '.png'); } catch (e) { }
  }
  setIMG_READY(true);

  initAudio();
  initBackground();
  initBgImage();
  showMenuBg();
  setupDBG();
  initInput();
  initAIAssistant();
  buildMenu();

  const btnBack = document.getElementById('btnBack');
  if (btnBack) btnBack.onclick = () => { sessionStorage.removeItem('fanren_level'); location.reload(); };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      for (const k in keys) keys[k] = false;
      if (audioCtx) audioCtx.suspend();
    } else {
      if (audioCtx) audioCtx.resume();
    }
  });

  loop(16.7);
}

function buildMenu() {
  ui.menuList.innerHTML = '';
  LEVELS.forEach((lv, idx) => {
    const b = document.createElement('button');
    b.className = 'level-btn';
    b.innerHTML = `<div class="lv-name">${lv.name}</div>
      <div class="lv-info">⏱ 时长 ${Math.floor(lv.dur / 60)} 分钟 ｜ ⚔ 首领 <span class="lv-boss">${lv.bossName}</span>：${lv.bossDesc}</div>
      <div class="lv-info">🎁 武器：${lv.weapons.join(' / ')}${lv.evolve ? ' ｜ ✨ 可进化' : ''}</div>`;
    b.onclick = () => startLevel(idx);
    ui.menuList.appendChild(b);
  });
}

function startLevel(idx) {
  setCurLevel(LEVELS[idx]);
  sessionStorage.setItem('fanren_level', idx);
  ui.menu.style.display = 'none';
  ['ui', 'statsPanel', 'tip'].forEach(id => document.getElementById(id).style.display = 'block');
  document.getElementById('btnBack').style.display = 'block';
  document.getElementById('debugBtn').style.display = 'block';
  document.getElementById('btnDash').style.display = 'block';
  document.getElementById('btnStance').style.display = 'block';
  document.getElementById('btnThunder').style.display = 'block';
  setTheme(curLevel.map);
  setBgTheme(curLevel.map);
  resizeBg();
  initGame();
  setGameStarted(true);
  toast(`⚔ 进入【${curLevel.name}】`);
  tryStartBGM();
  _bgmStarted = true;
  playLevelBgm();
}

function initGame() {
  game.time = curLevel.dur;
  game.hp = 300; game.maxHp = 300;
  game.lv = 1; game.exp = 0; game.expNeed = 150;
  game.playerAtk = PLAYER_BASE_ATK;
  game.kills = 0; game.dmgDealt = 0;
  game.paused = false; game.over = false; game.win = false;
  game.enemies = []; game.orbs = []; game.pickups = [];
  game.projectiles = []; game.damageTexts = []; game.particles = [];
  game.clouds = []; game.shockwaves = []; game.homingOrbs = []; game.blades = []; game.bolts = []; game.beams = []; game.firewaves = []; game.chains = []; game.hands = [];
  game.swords = []; game.bugs = []; game.lightnings = []; game.orbits = [];
  game.weapons = {}; game.passives = {};
  game.swordStance = 'orbit';
  game.stealth = false; game.forceStealth = false; game.idlePause = false;
  game.dmgMul = 1; game.cdMul = 1; game.invulnTimer = 0;
  game.swordCritChance = 0.1; game.swordCritMul = 1.3; game.swordFreezeChance = 0;
  game.dashCD = 0; game.dashTime = 0; game.dashInvuln = 0; game.dashBuffer = 0;
  game.thunderCharge = 100; game.thunderCD = 0;
  game.bossSpawned = false;
  game.realBoss = null;
  game.freezeUntil = 0; game.freezeMessage = '';
  // ★ 启动对象池分帧预热
  startPoolWarmup();
  game.waterPrison = null;
  initBuffs();
  game.swordCount = 0; game.swordRadius = 64;
  game.bugCount = 0; game.bugEvolved = false;
  game.lightningLocs = 1; game.lightningBolts = 1; game.lightningRadius = 50;
  game.orbitCount = 0; game.orbitRadius = 60; game.orbitSpeed = 0.04; game.orbitAngle = 0; game.orbitOuter = 0; game.orbitSize = 1;
  game.orbs.range = 140;

  game.weapons['青元剑诀'] = { level: 1, evolved: false };
  const wd = game.weapons['青元剑诀'];
  wd.onLevel = () => { };
  game.swordCount = 8; game.swordRadius = 66;
  for (let i = 0; i < game.swordCount; i++) game.swords.push(new Sword(i));

  player.reset();

  if (bgmStarted()) playLevelBgm();
}

let _bgmStarted = false;
function bgmStarted() { return _bgmStarted; }

function loop(dt) {
  requestAnimationFrame(() => loop(16.7));
  if (!gameStarted) return;
  try {
    _loopBody(dt);
  } catch (e) {
    console.error('[loop]', e);
  }
}

function _loopBody(dt) {

  // Freeze (blood sacrifice / boss death)
  if (performance.now() < game.freezeUntil) {
    updateShake(dt);
    if (game.freezeMessage) {
      document.getElementById('tip').textContent = game.freezeMessage;
    }
    renderHUD();
    return;
  }
  document.getElementById('tip').textContent = '';

  if (game.paused || game.over) { renderHUD(); return; }

  // Idle pause
  let mx = 0, my = 0;
  if (keys['ArrowUp'] || keys['KeyW']) my -= 1;
  if (keys['ArrowDown'] || keys['KeyS']) my += 1;
  if (keys['ArrowLeft'] || keys['KeyA']) mx -= 1;
  if (keys['ArrowRight'] || keys['KeyD']) mx += 1;
  const moving = keys['ArrowUp'] || keys['KeyW'] || keys['ArrowDown'] || keys['KeyS'] ||
    keys['ArrowLeft'] || keys['KeyA'] || keys['ArrowRight'] || keys['KeyD'];
  if (moving) { game.idleTime = 0; game.idlePause = false; }
  else { game.idleTime += dt; if (game.idleTime > 7000 && !game.idlePause) { game.idlePause = true; game.paused = true; ui.panel.style.display = 'block'; ui.opts.innerHTML = '<h3>⏸ 静坐悟道</h3><p style="margin:12px 0;color:#bcd">你已经静立许久，继续修行？</p><button class="upgrade-btn" id="idleResumeBtn" style="text-align:center">继续前行</button>'; document.getElementById('idleResumeBtn').onclick = () => { game.paused = false; game.idlePause = false; game.idleTime = 0; ui.panel.style.display = 'none'; }; renderHUD(); return; } }

  setMove(mx, my);
  const m = Math.hypot(mx, my);
  if (m > 0) { mx /= m; my /= m; }

  // ★ 更新所有 buff
  updateBuffs(dt);
  // ★ 对象池分帧预热
  tickPoolWarmup();

  // ★ 玩家移动/计时器/视觉同步（统一走 Player 类）
  player.update(dt, mx, my, m);
  drawPlayerBuffBar();
  const _dashActive = hasBuff(game, 'dashInvuln');
  if (_lastDashActive !== _dashActive) {
    _lastDashActive = _dashActive;
    document.getElementById('dashBadge').style.display = _dashActive ? 'block' : 'none';
  }

  // Arc rotation（原版：移动时阵面转向移动方向，静止时缓慢自转）
  const isMoving = (Math.hypot(mxGlobal, myGlobal) > 0.1) || game.dashTime > 0;
  if (game.swordCount > 0) {
    if (isMoving) {
      const moveAngle = Math.atan2(myGlobal, mxGlobal);
      let diff = ((moveAngle - game.arcRot) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      game.arcRot += diff * 0.12;
    } else {
      game.arcRot += 0.02;
    }
  }
  while (game.swords.length < game.swordCount) game.swords.push(new Sword(game.swords.length));
  while (game.swords.length > game.swordCount) game.swords.pop().destroy();

  // Update weapons
  game.swords.forEach(s => s.update(dt));
  updateArcTriggers();

  // 噬金虫数量同步
  while (game.bugs.length < game.bugCount) game.bugs.push(new Bug());
  if (game.bugs.length > game.bugCount) game.bugs.length = game.bugCount;

  // 摄魂幡数量同步（内圈+外圈）
  const innerTarget = game.orbitCount;
  const outerTarget = game.orbitOuter || 0;
  let innerCount = 0, outerCount = 0;
  for (const o of game.orbits) { if (o.isOuter) outerCount++; else innerCount++; }
  while (innerCount < innerTarget) { game.orbits.push(new Orbit(innerCount++, false)); }
  while (outerCount < outerTarget) { game.orbits.push(new Orbit(outerCount++, true)); }
  game.orbits = game.orbits.filter(o => (o.isOuter ? outerTarget > 0 : innerTarget > 0));

  game.bugs.forEach(b => b.update());
  game.lightnings = game.lightnings.filter(l => l.update());
  game.orbits.forEach(o => o.update(dt));
  game.orbitAngle += game.orbitSpeed * (game.orbitCount > 0 ? 1 : 0);

  // Enemy lightning CD
  if (game.weapons['九霄神雷']) {
    game.lightningTimer -= dt;
    if (game.lightningTimer <= 0) {
      game.lightningTimer = 5000 * game.cdMul; // ★ 初始CD 8s→5s
      const alive = game.enemies.filter(e => !e.dead);
      if (alive.length > 0) {
        // ★ 优先攻击 Boss
        const boss = alive.find(e => e.isBoss);
        for (let i = 0; i < game.lightningLocs; i++) {
          const t = boss || alive[Math.floor(Math.random() * alive.length)];
          game.lightnings.push(new Lightning(t.x, t.y, game.lightningRadius, game.lightningBolts));
        }
        playSound('thunder');
      }
    }
  }

  // Update enemies
  game.enemies.forEach(e => e.update(dt));
  game.enemies = game.enemies.filter(e => !e.dead);

  // Update projectiles
  game.projectiles = game.projectiles.filter(p => p.update(dt));
  game.clouds = game.clouds.filter(c => c.update(dt));
  game.shockwaves = game.shockwaves.filter(s => s.update(dt));
  game.homingOrbs = game.homingOrbs.filter(o => o.update(dt));
  game.blades = game.blades.filter(b => b.update(dt));
  game.bolts = game.bolts.filter(b => b.update(dt));
  game.beams = game.beams.filter(b => b.update(dt));
  game.firewaves = game.firewaves.filter(f => f.update(dt));
  game.chains = game.chains.filter(c => c.update(dt));
  game.hands = game.hands.filter(h => h.update(dt));

  // Particles & damage
  game.particles = game.particles.filter(p => p.update());
  game.damageTexts = game.damageTexts.filter(d => d.update());

  // Pickups
  game.orbs = game.orbs.filter(o => {
    o.life--;
    // 出生延迟：先在原地停留0.5秒
    if (o.spawnDelay > 0) {
      o.spawnDelay--;
      return true;
    }
    // 延迟结束后第一次触发：传送到玩家周围100-200距离
    if (!o.teleported) {
      o.teleported = true;
      const ang = Math.random() * Math.PI * 2;
      const dist = 100 + Math.random() * 100;
      o.x = game.player.x + Math.cos(ang) * dist;
      o.y = game.player.y + Math.sin(ang) * dist;
    }
    const d = Math.hypot(game.player.x - o.x, game.player.y - o.y);
    // 加速飞向玩家：0.20插值比玩家移动快
    o.x += (game.player.x - o.x) * 0.20;
    o.y += (game.player.y - o.y) * 0.20;
    if (d < 16) {
      game.exp += o.val;
      playSound('pickup');
      releaseOrb(o);
      return false;
    }
    if (o.life <= 0) { releaseOrb(o); return false; }
    o.g.position.set(o.x, o.y);
    return true;
  });
  game.pickups = game.pickups.filter(p => {
    p.life--;
    if (p.life <= 0) { app.stage.removeChild(p.g); return false; }
    p.g.alpha = 0.6 + 0.4 * Math.sin(performance.now() * 0.008);
    const d = Math.hypot(game.player.x - p.x, game.player.y - p.y);
    if (d < 150) { p.x += (game.player.x - p.x) * 0.2; p.y += (game.player.y - p.y) * 0.2; }
    if (d < 16) {
      const heal = calcHealAmount(curLevel?.dur || 780, game.time);
      game.hp = Math.min(game.maxHp, game.hp + heal);
      toast(`💚 +${heal} 生命`);
      app.stage.removeChild(p.g);
      return false;
    }
    p.g.position.set(p.x, p.y);
    return true;
  });

  // Spawn enemies
  if (!game.debug.noSpawn) {
    // ★ Boss 登场 1 分钟后不再刷普通小怪
    const bossOver = game.time < 60; // 最后一分钟不刷小怪
    const wave = getWave();
    // ★ 波次切换 banner
    if (wave.phase !== game._lastPhase) {
      game._lastPhase = wave.phase;
      const names = { early: '初期 · 小怪试探', mid: '中期 · 精英现身', late: '后期 · 群敌围攻' };
      toast(`【${names[wave.phase] || wave.phase}】`);
    }
    if (!bossOver) {
      game.enemyTimer -= dt;
      if (game.enemyTimer <= 0 && game.enemies.length < wave.max) {
        game.enemyTimer = wave.rate;
        const type = pickType(wave.weights);
        // 精英同屏最多 10 个
        if (type === 'elite' || type.startsWith('elite_')) {
          const eliteCount = game.enemies.filter(e => !e.dead && (e.type === 'elite' || e.type?.startsWith('elite_') || e.isSpecialElite)).length;
          if (eliteCount >= 15) return;
        }
        game.enemies.push(spawnEnemy(type));
      }
    }
    // Special elites 只在 mid/late 刷（已过 22% 之后）
    if (game.time < curLevel.dur * 0.78 && Math.random() < 0.002) {
      const eliteCount = game.enemies.filter(e => !e.dead && (e.type === 'elite' || e.type?.startsWith('elite_') || e.isSpecialElite)).length;
      if (eliteCount < 15) game.enemies.push(makeSpecialElite());
    }
  }

  // Level up
  while (game.exp >= game.expNeed) {
    game.exp -= game.expNeed;
    game.lv++;
    game.expNeed = calcNextExpNeed(game.expNeed);
    const bonus = calcLevelUpBonus(game.lv);
    console.log('[levelup] lv', game.lv, 'playerAtk', game.playerAtk, '->', game.playerAtk + bonus.atk, 'bonus', bonus);
    game.playerAtk += bonus.atk; // 攻击力+2
    game.maxHp += bonus.hp; game.hp += bonus.hp; // 血量+10
    playSound('levelup');
    game.upgradePending = (game.upgradePending || 0) + 1;
    if (!game.paused) {
      if (game.debug.silent) autoUpgrade();
      else {
        const pool = getUpgradePool();
        if (pool.length > 0) setTimeout(() => showUpgrade(pool), 200);
        else autoUpgrade();
      }
    }
  }

  // Boss spawn（倒计时 game.time 降到 dur - bossAt 时）
  if (!game.bossSpawned && game.time <= curLevel.dur - curLevel.bossAt) {
    game.bossSpawned = true;
    game.bossSpawnTime = game.time;
    const rb = spawnEnemy(curLevel.bossType);
    game.realBoss = rb;
    game.enemies.push(rb);
    // 2 special elites
    for (let i = 0; i < 2; i++) game.enemies.push(makeSpecialElite());
    playBgm('bgBoss');
    toast(`⚠ ${curLevel.bossName} 现身！`);
    playSound('boss');
    // ★ Boss 登场右侧提示
    showSkillInfo(curLevel.bossName, curLevel.bossDesc);
  }

  // Time
  game.time -= dt / 1000;

  updateShake(dt);
  renderHUD();
}

function renderHUD() {
  ui.hp.style.width = Math.max(0, game.hp / game.maxHp * 100) + '%';
  ui.exp.style.width = Math.min(100, game.exp / game.expNeed * 100) + '%';
  ui.thunder.style.width = game.thunderCharge + '%';
  const mm = Math.floor(Math.max(0, game.time) / 60);
  const ss = Math.floor(Math.max(0, game.time)) % 60;
  if (ui.hpTxt) ui.hpTxt.textContent = `血量 ${Math.ceil(game.hp)}/${game.maxHp}`;
  if (ui.expTxt) ui.expTxt.textContent = `等级 ${game.lv} · 经验`;
  if (ui.thunderTxt) ui.thunderTxt.textContent = `雷源 ${Math.floor(game.thunderCharge)}%${game.thunderCD > 0 ? `（CD ${(game.thunderCD/1000).toFixed(1)}s）` : ''}`;
  ui.uiStats.innerHTML = `${curLevel.name} ｜ ⏱ ${mm}:${ss.toString().padStart(2, '0')} ｜ 击杀 ${game.kills} ｜ 总伤害 ${Math.floor(game.dmgDealt)}<br>${STANCE_NAMES[game.swordStance]}`;

  if (dashCd) dashCd.style.height = (game.dashCD > 0 ? Math.min(100, game.dashCD / (game.dashCDMax || 8000) * 100) : 0) + '%';
  if (thunderCd) thunderCd.style.height = (game.thunderCD > 0 ? Math.min(100, game.thunderCD / 10000 * 100) : Math.max(0, 100 - game.thunderCharge)) + '%';

  // Stats panel
  let sp = `<div style="color:#ffd766">${curLevel.name}</div>`;
  for (const w in game.weapons) {
    const wd = game.weapons[w];
    const max = WEAPON_DEFS_MAX_LV[w] || 5;
    const tag = wd.level >= max ? '<span style="color:#ffd700">(Max)</span>' : '';
    sp += `${wd.evolved ? '<span style="color:#f08cf0">★</span>' : ''}${w} Lv${wd.level}${tag}<br>`;
  }
  ui.statsPanel.innerHTML = sp;

  // Boss HP bar
  const boss = game.enemies.find(e => e.isBoss && !e.dead);
  if (boss) {
    const w = app.screen.width * 0.6, x0 = (app.screen.width - w) / 2, y0 = 14;
    playerHpBar.beginFill(0x000000, 0.7); playerHpBar.drawRect(x0 - 2, y0 - 2, w + 4, 16); playerHpBar.endFill();
    playerHpBar.beginFill(0x550000); playerHpBar.drawRect(x0, y0, w, 12); playerHpBar.endFill();
    playerHpBar.beginFill(0xff2244); playerHpBar.drawRect(x0, y0, w * Math.max(0, boss.hp / boss.maxHp), 12); playerHpBar.endFill();
    game.bossHpText.visible = true;
    game.bossHpText.position.set(app.screen.width / 2, y0 + 16);
    game.bossHpText.text = `${curLevel.bossName}  ${Math.ceil(boss.hp)} / ${boss.maxHp}`;
  } else {
    playerHpBar.clear();
    game.bossHpText.visible = false;
  }

  // Win/lose
  if (game.hp <= 0 && !game.over) {
    game.over = true; game.win = false;
    playSound('boss');
    endScreen(`败于【${curLevel.name}】`, `首领 ${curLevel.bossName} ｜ 等级 ${game.lv} ｜ 击杀 ${game.kills} ｜ 总伤害 ${Math.floor(game.dmgDealt)}`);
  }
  if (game.realBoss && game.realBoss.dead && !game.over) {
    game.realBoss = null;
    game.over = true; game.win = true;
    endScreen(`🏆 击杀成功！`, `试炼通关 ｜ 等级 ${game.lv} ｜ 击杀 ${game.kills} ｜ 总伤害 ${Math.floor(game.dmgDealt)}`);
  }
  // 时间到了 Boss 还没死 → 失败
  if (game.time <= 0 && !game.over && game.bossSpawned && game.realBoss && !game.realBoss.dead) {
    game.over = true; game.win = false;
    endScreen(`⏰ 时间耗尽`, `首领 ${curLevel.bossName} 仍存活 ｜ 等级 ${game.lv} ｜ 击杀 ${game.kills} ｜ 总伤害 ${Math.floor(game.dmgDealt)}`);
  }
}

const WEAPON_DEFS_MAX_LV = { '青元剑诀': 5, '噬金虫': 5, '九霄神雷': 5, '摄魂幡': 5 };

boot();
