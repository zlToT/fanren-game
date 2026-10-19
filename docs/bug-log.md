# Bug 记录（玩家自查发现）

> 这里只记**用户自己玩游戏/看代码发现的问题**，不是我（AI）自己发现的。
> 以后每遇到一个新的，就往上面追加一条，按时间倒序（最新的在最上面）。
> 每条格式：**现象 → 根因 → 修复点**，方便以后复盘。

---

## 2026-10-19 AI 攻略助手流式响应有数据但界面空白，且历史越刷越多

**现象**：点发送后控制台一直打印"收到片段: 'xxx'"，SSE 流正常返回了，但聊天弹窗里消息列表空空如也；刷新几次后历史记录里还攒了一大堆重复的"用户问一句 + bot 空回复"。
**根因**：页面初始化历史消息时，先从 localStorage 读出 history（已达 20 条上限），然后 forEach 调用 `appendMsg()` 逐条渲染。但 `appendMsg` 内部又会 `history.push()`，导致 history 瞬间翻倍到 40 条。每次 appendMsg 都触发 `history.length > MAX_HISTORY`，执行 `shift() + removeChild(msgList.firstChild)`——刚 appendChild 进去的消息，立刻又被当"最老的一条"删了。新消息同理：`appendMsg('user', text)` 加进去就被删，`appendMsg('bot', '')` 的 botDiv 也被从 DOM 里踢出去了，之后 `botDiv.textContent += piece` 只是在内存里改一个脱离文档树的节点，界面当然看不见。而且每次刷新都重复一遍 push 流程，localStorage 里的历史越攒越脏。
**修复**：① 历史初始化和新增操作彻底分开，初始化直接渲染 DOM、不碰 history 数组；② 干脆不写 localStorage，历史纯内存存，刷新游戏自动重置——攻略助手本来就是单局辅助，不需要跨刷新保留对话。
**教训**：一个函数如果有"副作用"（push 进数组、写 localStorage），就不能拿来做"纯渲染"。初始化渲染和新增操作应该分开两个函数。另外，对话历史这种临时状态，没必要持久化到 localStorage，内存存着就行，刷新重置反而是最干净的方案。

---

## 2026-10-18 噬金虫冷却被多虫共享，二段伤害经常打不出

**现象**：虫子数量一多，二段（飞行擦碰）伤害就几乎不掉血，看起来"经常打不出来"。
**根因**：之前用 `e.bugHitT` 挂在敌人身上当冷却时间戳，所有虫子都写同一个字段。A 虫打了怪把 `bugHitT` 设成 500ms，B 虫 500ms 内再碰到，读到的还是 A 虫留下的冷却，直接跳过。虫子越多互相"背刺"越严重。
**修复**：每个 Bug 实例分配自增 `this.id`，冷却改成 `e.bugCD[this.id]` 按虫子 id 分开记。一段/二段都改。
**教训**：共享冷却状态如果挂在受害者身上，一定要带上"来源 id"做 key，不能直接一个字段。

---

## 2026-10-18 噬金虫进化后二段碰撞判定没放大 + 高速穿透

**现象**：进化后虫体从 36px 变 72px，但二段碰撞还是按 `e.r + 8` 算，虫子从怪身上飞过去都不判定。
**根因**：① 判定半径没跟视觉尺寸同步；② 虫子 3.6px/帧高速飞行，单帧位置采样会"穿过"敌人判定圆。
**修复**：① 判定半径按进化状态取 bugR=18/36；② 改成线段-圆相交检测（记录上一帧位置，算线段到圆心最短距离）。

---

## 2026-10-18 GM levelUp 不加 playerAtk

**现象**：用 GM 面板升了几十级，`game.playerAtk` 还是 10。
**根因**：`ui.js` 里 `DBG.levelUp(n)` 只 `game.lv++` 和乘 expNeed，没调用 `calcLevelUpBonus()`。
**修复**：循环里补上 `game.playerAtk += b.atk; game.maxHp += b.hp; game.hp += b.hp;`。
**教训**：升级加属性的逻辑有两个入口（主循环 while 循环 + GM 命令），改一处时必须 grep 另一处。

---

## 2026-10-18 calcBugDmg / calcLightningDmg 第一个参数传错

**现象**：升级噬金虫/九霄神雷，伤害不涨。
**根因**：调用时传的是 `game.bugDmg` / `game.lightningDmg`（旧的全局 dmg 字段），不是武器等级 `game.weapons['噬金虫'].level`。
**修复**：改成传 level；同时把 `game.swordDmg/bugDmg/lightningDmg/orbitDmg` 四个旧属性全删了。
**教训**：重构伤害公式时，旧的"全局 dmg 字段"要么全删，要么在 calc 函数里拒收，不能留着让人误用。

---

## 2026-10-18 摄魂幡每帧都在扣血

**现象**：幡擦到怪怪就每秒几十次掉血，伤害数字爆炸。
**根因**：main.js 主循环里每帧都 `e.hurt(orbitTick * 0.05)`。
**修复**：改成 300ms tick 一次，每个幡独立 `hitTimer`。

---

## 2026-10-18 多个幡碰到同一个怪只算一次伤害

**现象**：幡数量上去后，伤害没有按幡数叠加。
**根因**：循环里 `break` 了，一个幡结算完就跳出。
**修复**：删掉 `break`，每个幡独立结算自己的那一份。

---

## 2026-10-18 辟邪神雷二段没判断魔修阵营

**现象**：二段（扩散圈）打到魔修没吃 +25% 加成。
**根因**：`calcThunderRingDmg` 当时没接 isMo 参数。
**修复**：函数加 `isMo` 入参，input.js 里逐怪调用时传。

---

## 2026-10-18 enemy.hurt 里重复乘 game.dmgMul

**现象**：伤害数字偏大。
**根因**：`calcXxxDmg` 内部已经乘过 `dmgMul`，`enemy.hurt` 里又乘了一次。
**修复**：用户自己把 hurt 里的 `const real = dmg * game.dmgMul;` 改成 `const real = dmg;`。
**教训**：dmgMul 这种全局乘区只能在 calc 函数里乘一次，hurt 只负责扣血和飘数字。

---

## 2026-10-18 玩家升级 playerAtk 不涨

**现象**：升到 31 级，`game.playerAtk` 还是 10。
**根因**：`initGame` 里没把 playerAtk 重置回 `PLAYER_BASE_ATK`，且早期升级循环里漏加。
**修复**：initGame 里 `game.playerAtk = PLAYER_BASE_ATK`；升级 while 循环里 `game.playerAtk += bonus.atk`。

---

## 2026-10-18 精英怪借 Boss 模板刷，数值全错

**现象**：特殊精英（狂战士/突阵/守卫/弩手）刷出来 hp/dmg 都是 Boss 级别的。
**根因**：`makeSpecialElite()` 是 spawn 一个 boss1-5 再改 behavior，相当于让小怪穿 Boss 的皮。
**修复**：四个精英直接写进 `ENEMY_STATS`，makeSpecialElite 直接 spawn 对应 type，不再借 Boss 模板。
**教训**：新怪型一律先进 ENEMY_STATS 表，不要在逻辑里事后 spd *= 0.6 / r *= 1.3 这种补丁。

---

## 2026-10-18 摄魂幡没有自己的类，碰撞逻辑散在 main.js

**现象**：摄魂幡只有 Graphics 绘制，碰撞伤害写在 main.js 主循环里，跟飞剑/虫子的结构不一致。
**修复**：把碰撞逻辑搬进 `Orbit.update(dt)`，每个幡自带 `hitTimer`，main.js 里那段全局循环删掉。
**教训**：每种武器都应该是 weapons.js 里一个独立类，update 自己管伤害和冷却，main.js 只负责调用 `x.update(dt)`。
