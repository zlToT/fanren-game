// ============================================================
// ui.js — 界面与交互
// Toast 提示、技能播报、升级面板（showUpgrade/applyUpgrade/
// getUpgradePool）、结算屏（endScreen）、GM 调试对象（window.DBG）。
// ============================================================

import { app, game, curLevel, ui, keys } from './state.js';
import { WEAPON_DEFS, PASSIVE_DEFS, ENEMY_STATS, STANCE_NAMES, STANCES } from './config.js';
import { playSound } from './audio.js';
import { spawnEnemy, spawnPickup } from './enemy.js';
import { hasBuff, addPlayerBuff, removeBuff } from './buff.js';
import { calcLevelUpBonus, calcHealAmount } from './calculate.js';
import { GAME_STATUS_LATE } from './const.js'

let toastTimer = null;

// ★ 进化模式开关状态（模块级，不随 GM 面板刷新重置）
let evolveMode = false;
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.opacity = 1;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.style.opacity = 0, 1800);
}

export function showSkillInfo(name, desc) {
  const el = document.getElementById('skillInfo');
  el.innerHTML = `<div class="sk-name">⚡ ${name}</div>${desc}`;
  el.style.opacity = 1;
  clearTimeout(showSkillInfo._t);
  showSkillInfo._t = setTimeout(() => el.style.opacity = 0, 2200);
}

export function showUpgrade(options) {
  game.paused = true;
  ui.panel.style.display = 'block';
  ui.opts.innerHTML = '<h3>✨ 突破！选择一项修行</h3>';
  options.forEach(o => {
    const b = document.createElement('button');
    b.className = 'upgrade-btn';
    if (o.kind === 'evolution') b.classList.add('evolution-btn');
    b.innerHTML = `<b>${o.icon || ''} ${o.name}</b><span class="desc">${o.desc}</span>`;
    b.onclick = () => applyUpgrade(o, options);
    ui.opts.appendChild(b);
  });
}

export function applyUpgrade(o, allOptions) {
  playSound('levelup');
  if (o.kind === 'weapon') {
    const w = game.weapons[o.name];
    const wd = WEAPON_DEFS[o.name];
    if (!w) {
      game.weapons[o.name] = { level: 1, evolved: false };
      wd.onLevel(1, game);
      if (o.name === '噬金虫') { for (let i = 0; i < 1; i++) import('./weapons.js').then(m => game.bugs.push(new m.Bug())); }
      if (o.name === '摄魂幡') { for (let i = 0; i < 1; i++) import('./weapons.js').then(m => game.orbits.push(new m.Orbit(i))); }
    } else if (!w.evolved) {
      w.level++;
      wd.onLevel(w.level, game);
      if (o.name === '青元剑诀') syncSwords();
      if (o.name === '噬金虫') import('./weapons.js').then(m => game.bugs.push(new m.Bug()));
      if (o.name === '摄魂幡') { import('./weapons.js').then(m => { game.orbits.forEach(o2 => o2.destroy()); game.orbits = []; for (let i = 0; i < game.orbitCount; i++) game.orbits.push(new m.Orbit(i, false)); }); }
    }
  } else if (o.kind === 'passive') {
    game.passives[o.name] = (game.passives[o.name] || 0) + 1;
    PASSIVE_DEFS[o.name].apply(game.passives[o.name], game);
  } else if (o.kind === 'evolution') {
    const w = game.weapons[o.weapon];
    if (w && !w.evolved) {
      w.evolved = true;
      WEAPON_DEFS[o.weapon].evolution.apply(game);
      if (o.weapon === '青元剑诀') syncSwords();
      if (o.weapon === '噬金虫') game.bugs.forEach(b => b.applySkin());
      if (o.weapon === '摄魂幡') import('./weapons.js').then(m => { game.orbits.forEach(o2 => o2.destroy()); game.orbits = []; for (let i = 0; i < game.orbitCount; i++) game.orbits.push(new m.Orbit(i, false)); for (let i = 0; i < (game.orbitOuter || 0); i++) game.orbits.push(new m.Orbit(i, true)); });
    }
  } else if (o.kind === 'heal') {
    const heal = calcHealAmount(curLevel?.dur || 780, game.time);
    game.hp = Math.min(game.maxHp, game.hp + heal);
    toast(`💊 +${heal} 气血`);
  }
  ui.panel.style.display = 'none';
  game.paused = false;
  game.upgradePending = (game.upgradePending || 0) - 1;
  if (game.upgradePending > 0 && !game.over) {
    if (game.debug.silent) autoUpgrade();
    else setTimeout(() => showUpgrade(getUpgradePool()), 350);
  }
}

function syncSwords() {
  import('./weapons.js').then(m => {
    game.swords.forEach(s => s.destroy());
    game.swords = [];
    for (let i = 0; i < game.swordCount; i++) game.swords.push(new m.Sword(i));
  });
}

export function getUpgradePool() {
  const opts = [];
  // ★ 进化选项：随机最多1个
  const evoOpts = getEvolutionOptions();
  if (evoOpts.length > 0) {
    opts.push(evoOpts[Math.floor(Math.random() * evoOpts.length)]);
  }
  // 武器升级（满级的不出现）
  for (const w in WEAPON_DEFS) {
    if (curLevel.weapons.includes(w) || game.weapons[w]) {
      const wd = game.weapons[w];
      const lv = wd ? wd.level : 0;
      if (lv < WEAPON_DEFS[w].maxLv) {
        opts.push({ kind: 'weapon', name: w, desc: `当前 Lv.${lv} → Lv.${lv + 1}`, icon: '⚔️' });
      }
    }
  }
  // 被动
  for (const p in PASSIVE_DEFS) {
    const cur = game.passives[p] || 0;
    if (cur < PASSIVE_DEFS[p].maxLv) opts.push({ kind: 'passive', name: p, desc: PASSIVE_DEFS[p].desc + `（当前 Lv.${cur}）`, icon: '🌀' });
  }
  // 疗伤丹
  opts.push({ kind: 'heal', name: '疗伤丹', desc: '回复50点气血', icon: '💊' });
  // 进化选项固定排最前，其余洗牌，有进化的就是5个，无则4个
  const evo = opts.filter(o => o.kind === 'evolution');
  const rest = shuffle(opts.filter(o => o.kind !== 'evolution'));
  return evo.concat([...rest].slice(0, 4))
  // return [...evo, ...rest].slice(0, 5);
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function getEvolutionOptions() {
  const opts = [];
  if (!curLevel.evolve) return opts;
  // 增加限制，后期刷
  if (game._lastPhase != GAME_STATUS_LATE) return []
  // 增加限制，50%概率出现
  if (Math.random() < 0.5) return []
  for (const w in game.weapons) {
    const wd = game.weapons[w];
    if (wd.evolved) continue;
    if (wd.level >= WEAPON_DEFS[w].maxLv && WEAPON_DEFS[w].evolution) {
      opts.push({ kind: 'evolution', weapon: w, name: `★ 进化·${WEAPON_DEFS[w].evolution.name}`, desc: WEAPON_DEFS[w].evolution.desc, icon: '✨' });
    }
  }
  return opts;
}

export function autoUpgrade() {
  const pool = getUpgradePool();
  if (pool.length > 0) applyUpgrade(pool[0], pool);
}

export function endScreen(title, sub) {
  ui.panel.style.display = 'block';
  ui.opts.innerHTML = `
    <h3 style="color:${game.win ? '#8cf0aa' : '#ff6677'};margin-bottom:12px">${title}</h3>
    <p style="color:#bcd;margin-bottom:16px">${sub}</p>
    <button class="upgrade-btn" style="text-align:center" onclick="sessionStorage.removeItem('fanren_level');location.reload()">返回选关</button>`;
}

export function setupDBG() {
  window.DBG = {
    heal() { game.hp = game.maxHp; toast('🛠 回满血'); },
    fullHpBoost() { game.maxHp += 500; game.hp = game.maxHp; toast('🛠 血上限+500'); },
    toggleGod() {
      const b = document.getElementById('dbtnGod');
      const _godOn = !hasBuff(game, 'dashInvuln');
      if (_godOn) {
        addPlayerBuff('dashInvuln', 999999);
        if (b) { b.innerText = '无敌:开'; b.classList.add('godOn'); }
        document.getElementById('godBadge').style.display = 'block';
      } else {
        removeBuff(game, 'dashInvuln');
        if (b) { b.innerText = '无敌:关'; b.classList.remove('godOn'); }
        document.getElementById('godBadge').style.display = 'none';
      }
    },
    toggleStealth() { game.forceStealth = !game.forceStealth; toast('🛠 隐匿:' + (game.forceStealth ? '开' : '关')); },
    toggleSilent() {
      game.debug.silent = !game.debug.silent;
      const b = document.getElementById('dbtnSilent');
      if (b) { b.innerText = '静默升级:' + (game.debug.silent ? '开' : '关'); b.classList.toggle('godOn', game.debug.silent); }
    },
    toggleNoSpawn() {
      game.debug.noSpawn = !game.debug.noSpawn;
      const b = document.getElementById('dbtnNoSpawn');
      if (b) { b.innerText = '冻结刷怪:' + (game.debug.noSpawn ? '开' : '关'); b.classList.toggle('godOn', game.debug.noSpawn); }
      toast('🛠 普通刷怪已' + (game.debug.noSpawn ? '冻结' : '恢复'));
    },
    spawnPickup() { spawnPickup(game.player.x + (Math.random() - 0.5) * 80, game.player.y + (Math.random() - 0.5) * 80); },
    chargeThunder() { game.thunderCharge = 100; },
    giveExp(n) { game.exp += n; if (game.exp >= game.expNeed) { game.debug.silent ? autoUpgrade() : showUpgrade(getUpgradePool()); } },
    levelUp(n = 1) { for (let i = 0; i < n; i++) { game.lv++; game.expNeed = Math.floor(game.expNeed * 1.35); const b = calcLevelUpBonus(game.lv); game.playerAtk += b.atk; game.maxHp += b.hp; game.hp += b.hp; } toast(`🛠 升到 ${game.lv} 级，攻击力 ${game.playerAtk}`); game.debug.silent ? autoUpgrade() : showUpgrade(getUpgradePool()); },
    addWeapon(name) {
      if (!curLevel.weapons.includes(name)) { toast(`🛠 本关未解锁 ${name}`); return; }
      if (!(name in game.weapons)) { game.weapons[name] = { level: 0, evolved: false }; if (name === '九霄神雷') game.lightningTimer = 120; }
      const w = game.weapons[name];
      if (w.level < WEAPON_DEFS[name].maxLv) { w.level++; WEAPON_DEFS[name].onLevel(w.level, game); }
      window.DBG.refreshList();
    },
    evolveWeapon(name) {
      if (!curLevel.evolve) { toast('🛠 本关不可进化'); return; }
      if (name in game.weapons) {
        game.weapons[name].level = WEAPON_DEFS[name].maxLv;
        WEAPON_DEFS[name].onLevel(game.weapons[name].level, game);
        if (!game.weapons[name].evolved) { game.weapons[name].evolved = true; WEAPON_DEFS[name].evolution.apply(game); }
      }
      window.DBG.refreshList();
    },
    addPassive(name) {
      const cur = game.passives[name] || 0;
      if (cur < PASSIVE_DEFS[name].maxLv) { game.passives[name] = cur + 1; PASSIVE_DEFS[name].apply(game.passives[name], game); }
      window.DBG.refreshList();
    },
    spawn(type) {
      const n = Math.max(1, Math.min(100, parseInt(document.getElementById('dbgN').value) || 10));
      for (let i = 0; i < n; i++) game.enemies.push(spawnEnemy(type));
    },
    spawnMixed() {
      const n = Math.max(1, Math.min(100, parseInt(document.getElementById('dbgN').value) || 10));
      const types = ['normal', 'fast', 'shooter', 'tank', 'splitter', 'charger', 'moxiu'];
      for (let i = 0; i < n; i++) game.enemies.push(spawnEnemy(types[Math.floor(Math.random() * types.length)]));
    },
    spawnBoss() { game.enemies.push(spawnEnemy(curLevel.bossType)); game.bossSpawned = true; },
    killAll() { game.enemies.forEach(e => { if (!e.dead) e.destroy(); }); game.enemies = game.enemies.filter(e => !e.dead); },
    clearEnemies() { game.enemies.forEach(e => { if (!e.dead) e.destroy(true); }); game.enemies = game.enemies.filter(e => !e.dead); },
    clearOrbs() { game.orbs.forEach(o => app.stage.removeChild(o.g)); game.orbs = []; },
    clearBullets() { game.projectiles.forEach(p => p.destroy()); game.projectiles = []; },
    addTime(sec) { game.time = Math.max(1, game.time + sec); },
    toBoss() { game.time = curLevel.dur - curLevel.bossAt; game.bossSpawned = false; },
    setTime(sec) { game.time = sec; },
    showHitbox() { game.debug.showHitbox = !game.debug.showHitbox; },
    refreshList() {
      if (!curLevel) return;
      const wDiv = document.getElementById('dbgWeapons');
      // ★ 进化模式开关（手机端代替 Shift）
      const evBtn = document.getElementById('dbtnEvolveMode');
      if (evBtn) {
        evBtn.innerText = `进化模式:${evolveMode ? '开' : '关'}`;
        evBtn.style.background = evolveMode ? '#a06bff' : '#6b3fa0';
        evBtn.onclick = () => {
          evolveMode = !evolveMode;
          evBtn.innerText = `进化模式:${evolveMode ? '开' : '关'}`;
          evBtn.style.background = evolveMode ? '#a06bff' : '#6b3fa0';
        };
      }

      if (wDiv) {
        wDiv.innerHTML = '';
        for (const name of curLevel.weapons) {
          const lv = game.weapons[name] ? game.weapons[name].level : 0;
          const max = WEAPON_DEFS[name].maxLv;
          const b = document.createElement('span'); b.className = 'dbtn';
          b.innerText = `${name}(${lv}${lv >= max ? ' Max' : ''})`;
          b.onclick = (ev) => {
            if (ev.shiftKey || evolveMode) {
              window.DBG.evolveWeapon(name);
            } else {
              window.DBG.addWeapon(name);
            }
          };
          wDiv.appendChild(b);
        }
      }
      const pDiv = document.getElementById('dbgPassives');
      if (pDiv) {
        pDiv.innerHTML = '';
        for (const name in PASSIVE_DEFS) {
          const lv = game.passives[name] || 0;
          const b = document.createElement('span'); b.className = 'dbtn';
          b.innerText = `${name}(${lv})`;
          b.onclick = () => window.DBG.addPassive(name);
          pDiv.appendChild(b);
        }
      }
      const eDiv = document.getElementById('dbgEnemies');
      if (eDiv && !eDiv.dataset.built) {
        for (const t in ENEMY_STATS) {
          const b = document.createElement('span'); b.className = 'dbtn';
          b.innerText = ENEMY_STATS[t].name;
          b.onclick = () => window.DBG.spawn(t);
          eDiv.appendChild(b);
        }
        eDiv.dataset.built = '1';
      }
    },
  };

  // GM面板HTML（对齐原版）
  const panel = document.getElementById('debugPanel');
  if (panel) {
    panel.innerHTML = `
      <h4>📊 状态</h4>
      <div class="row">
        <span class="dbtn" id="dbtnGod">无敌:关</span>
        <span class="dbtn" onclick="DBG.heal()">回满血</span>
        <span class="dbtn" onclick="DBG.fullHpBoost()">+500血上限</span>
        <span class="dbtn" onclick="DBG.toggleStealth()">永久隐匿</span>
        <span class="dbtn" id="dbtnSilent">静默升级:关</span>
      </div>
      <div class="row">
        <span class="dbtn" onclick="DBG.spawnPickup()">掉血包</span>
        <span class="dbtn" onclick="DBG.chargeThunder()">雷源充满</span>
      </div>
      <h4>📈 等级/经验</h4>
      <div class="row">
        <span class="dbtn" onclick="DBG.giveExp(100)">+100经验</span>
        <span class="dbtn" onclick="DBG.giveExp(500)">+500经验</span>
        <span class="dbtn" onclick="DBG.levelUp()">升1级</span>
        <span class="dbtn" onclick="DBG.levelUp(5)">连升5级</span>
      </div>
      <h4>⚔️ 武器（Shift+点击=满级+进化）</h4>
      <div class="row">
        <span class="dbtn" id="dbtnEvolveMode" style="background:#6b3fa0">进化模式:关</span>
      </div>
      <div class="row" id="dbgWeapons"></div>
      <h4>🧬 被动</h4>
      <div class="row" id="dbgPassives"></div>
      <h4>👹 刷怪</h4>
      <div class="row"><span class="dbtn" id="dbtnNoSpawn">冻结刷怪:关</span></div>
      <div class="row">数量<input id="dbgN" type="number" value="1" min="1" max="100"></div>
      <div class="row" id="dbgEnemies"></div>
      <div class="row">
        <span class="dbtn" onclick="DBG.spawnMixed()">混合刷怪</span>
        <span class="dbtn" onclick="DBG.spawnBoss()">刷本关Boss</span>
        <span class="dbtn" onclick="DBG.killAll()">秒杀全场</span>
        <span class="dbtn" onclick="DBG.clearEnemies()">清怪(无掉落)</span>
        <span class="dbtn" onclick="DBG.clearOrbs()">清经验球</span>
        <span class="dbtn" onclick="DBG.clearBullets()">清弹幕</span>
      </div>
      <h4>⏱ 时间</h4>
      <div class="row">
        <span class="dbtn" onclick="DBG.addTime(60)">+1分钟</span>
        <span class="dbtn" onclick="DBG.addTime(-60)">-1分钟</span>
        <span class="dbtn" onclick="DBG.toBoss()">跳到Boss战</span>
        <span class="dbtn" onclick="DBG.setTime(5)">跳到结束</span>
      </div>
    `;
    document.getElementById('dbtnGod').onclick = () => window.DBG.toggleGod();
    document.getElementById('dbtnStealth') && (document.getElementById('dbtnStealth').onclick = () => window.DBG.toggleStealth());
    document.getElementById('dbtnSilent').onclick = () => window.DBG.toggleSilent();
    document.getElementById('dbtnNoSpawn').onclick = () => window.DBG.toggleNoSpawn();
    window.DBG.refreshList();
  }
  const btn = document.getElementById('debugBtn');
  if (btn && panel) btn.onclick = () => { panel.style.display = panel.style.display === 'block' ? 'none' : 'block'; window.DBG.refreshList(); };
  addEventListener('keydown', e => { if (e.key === '`' && panel) { panel.style.display = panel.style.display === 'block' ? 'none' : 'block'; window.DBG.refreshList(); } });
}
