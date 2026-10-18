# 游戏开发规范与性能优化指南

> 面向 PIXI.js 2D 割草游戏的开发实践，总结常用手段和性能优化方向。

---

## 一、性能优化核心原则

### 1.1 减少 GC（垃圾回收）

浏览器 GC 卡顿是 2D 游戏掉帧的头号原因。每帧产生大量临时对象会导致 GC 频繁触发，表现为"偶尔卡一下"。

**手段**：
- **对象池**：所有频繁创建/销毁的实体（敌人、子弹、粒子、伤害数字、经验球）必须池化复用
- **避免每帧 new**：循环内禁止 `new Array()`、`new Object()`、`{}` 字面量
- **复用向量计算**：碰撞检测用临时变量，不要创建新对象

### 1.2 减少绘制调用（Draw Call）

PIXI.js 每帧渲染需要遍历显示列表，节点越多越慢。

**手段**：
- **合批渲染**：相同纹理的精灵合并为 Container，减少切换
- **遮挡剔除**：屏幕外的对象不渲染（`visible = false`）
- **避免每帧重建 Graphics**：Graphics 只在初始化时绘制，后续只改 position/rotation/alpha

### 1.3 减少 DOM 操作

DOM 操作比 Canvas 绘制慢 10-100 倍。

**手段**：
- **只在状态变化时更新 DOM**：不要每帧 `element.style.display = ...`
- **缓存 DOM 引用**：`document.getElementById()` 只在初始化时调用一次
- **批量更新**：UI 数据收集到一个对象，帧末统一赋值

---

## 二、对象池系统

### 2.1 为什么需要

割草游戏每秒创建/销毁数百个实体：
- 敌人死亡 → 创建经验球、粒子、伤害数字
- 子弹飞行 → 每帧 update
- 技能释放 → 大量特效

如果每个都 `new` + `destroy`，GC 压力巨大，怪物多了就卡。

### 2.2 实现模式

```js
// 池数组
const _pool = [];
const MAX_POOL = 200;

// 工厂函数：从池取，没有就 new
function createXxx(...) {
  let obj;
  if (_pool.length > 0) {
    obj = _pool.pop();
    obj.init(...args);  // 重置状态
  } else {
    obj = new Xxx();    // 池空了才创建新的
    obj.init(...args);
  }
  return obj;
}

// 归还函数
function releaseXxx(obj) {
  obj.gfx.visible = false;  // 隐藏，不销毁
  if (_pool.length < MAX_POOL) {
    _pool.push(obj);
  }
}
```

### 2.3 池容量参考

| 实体类型 | 建议池容量 | 原因 |
|---------|-----------|------|
| 敌人 | 100-200 | 同屏最多 50-100 个 |
| 子弹/弹幕 | 100-200 | 技能释放时瞬间产生大量 |
| 粒子 | 200-300 | 爆炸/死亡时产生 10-30 个 |
| 伤害数字 | 100-200 | 每次攻击产生一个 |
| 经验球 | 200-300 | 敌人死亡掉落 |

### 2.4 分帧预热

进游戏时不要一次性创建所有池对象，分帧创建：

```js
let _warmupCount = 0;
function tickPoolWarmup() {
  if (_warmupCount >= 100) return;
  for (let i = 0; i < 5 && _warmupCount < 100; i++) {
    _pool.push(new Xxx());
    _warmupCount++;
  }
}
// 主循环每帧调用 tickPoolWarmup()
```

---

## 三、分帧加载与按需加载

### 3.1 资源加载

- **首屏只加载必要资源**：关卡 1 的音频、图片先加载
- **异步加载后续资源**：进入下一关前预加载
- **加载进度条**：资源未加载完时显示加载界面

### 3.2 逻辑分帧

大数据集初始化时，不要一帧做完，分到多帧：

```js
// 不好：一帧创建 100 个敌人
for (let i = 0; i < 100; i++) spawnEnemy('normal');

// 好：分 20 帧，每帧 5 个
let spawnQueue = [];
function tickSpawn() {
  for (let i = 0; i < 5 && spawnQueue.length > 0; i++) {
    game.enemies.push(spawnEnemy(spawnQueue.pop()));
  }
}
```

### 3.3 按需计算

- **碰撞检测只对活跃对象**：死亡的敌人跳过碰撞
- **远离玩家的敌人 AI 降频**：超过屏幕范围的敌人每 2 帧更新一次
- **特效生命周期管理**：粒子寿命到了立刻回收

---

## 四、渲染优化

### 4.1 PIXI.js 最佳实践

- **用 Sprite 代替 Graphics**：Graphics 每帧重绘开销大，静态图形用 Sprite + Texture
- **Container 分组**：玩家、敌人、子弹、特效各放一个 Container，方便整体控制
- **alpha 渐变避免频繁设置**：透明度动画用 tween 库或固定帧率更新

### 4.2 视效优化

- **屏幕震动**：用 Container.position 偏移，不要移动每个对象
- **闪烁效果**：用 alpha 在 0.3-1 之间切换，不要每帧重建 Graphics
- **预警区域**：静态 Graphics 只画一次，脉冲效果用 alpha 正弦变化

---

## 五、主循环优化

### 5.1 帧时间管理

```js
// 钳制 dt，防止切后台回来后跳帧
const dt = Math.min(50, ticker.deltaMS);
```

### 5.2 更新顺序

```
1. 输入处理
2. Buff 更新（倒计时）
3. 玩家更新
4. 武器更新
5. 敌人更新（含 AI）
6. 子弹/特效更新
7. 碰撞检测
8. 清理死亡对象
9. UI 更新（只在状态变化时）
```

### 5.3 暂停逻辑

- **升级弹窗暂停**：`game.paused = true` 时跳过所有 update
- **剧情冻结**：`freezeUntil` 时间内只渲染不更新
- **挂机暂停**：长时间无输入自动暂停，节省资源

---

## 六、内存管理

### 6.1 泄漏检查

- 每个实体必须有 `destroy()` / `release()`
- `setInterval` / `setTimeout` 必须有清理逻辑
- 事件监听器要解绑

### 6.2 事件监听管理

**原则：谁绑定谁解绑，组件销毁时必须移除所有事件监听。**

```js
// ❌ 不好：只绑定不解绑，弹窗重复打开会叠加监听
document.getElementById('okBtn').onclick = () => { closePanel(); };

// ✅ 好：关闭弹窗时同时移除
function openPanel() {
  document.getElementById('okBtn').onclick = onOkClick;
}
function closePanel() {
  document.getElementById('okBtn').onclick = null;  // 解绑
}

// ✅ 好：addEventListener 必须配对 removeEventListener
const onKeyDown = (e) => { /* ... */ };
window.addEventListener('keydown', onKeyDown);
// 组件销毁时：
window.removeEventListener('keydown', onKeyDown);
```

**常见泄漏场景**：
- 弹窗反复打开/关闭，按钮事件重复绑定 → 点一次触发多次
- 关卡切换后旧关卡的键盘监听还在
- PIXI 的 `app.ticker.add()` 回调忘记 `remove()`

### 6.3 定时器管理

**原则：所有 `setInterval` / `setTimeout` 必须可清理，游戏结束/关卡切换时全部清除。**

```js
// ❌ 不好：无法清理，游戏结束后还在跑
setInterval(() => { /* 水牢掉血 */ }, 500);

// ✅ 好：保存 id，用完清除
const iv = setInterval(() => {
  // ...逻辑
  if (game.over) {
    clearInterval(iv);  // 游戏结束时清除
    return;
  }
}, 500);

// ✅ 好：游戏全局清理
game.intervals = [];
function setGameInterval(fn, ms) {
  const id = setInterval(fn, ms);
  game.intervals.push(id);
  return id;
}
// 游戏结束时统一清理
function clearAllTimers() {
  game.intervals.forEach(id => clearInterval(id));
  game.intervals = [];
}
```

**常见泄漏场景**：
- Boss 技能的 `setInterval` 在 Boss 死亡后还在跑
- 水牢/锁链的持续伤害定时器在玩家离开后不停止
- 剧情冻结的 `setTimeout` 在游戏结束后才触发

### 6.4 数组清理

```js
// 好：filter 一次性清理
game.enemies = game.enemies.filter(e => !e.dead);

// 不好：splice 频繁移动数组
for (let i = game.enemies.length - 1; i >= 0; i--) {
  if (game.enemies[i].dead) game.enemies.splice(i, 1);
}
```

---

## 七、常见性能问题排查

| 症状 | 可能原因 | 排查方向 |
|------|---------|---------|
| 怪物多了就卡 | 没有对象池，GC 压力大 | 检查是否每帧 new 大量对象 |
| 偶尔卡一下 | GC 触发 | 检查循环内是否有临时对象创建 |
| 进游戏白屏/卡顿 | 一次性初始化太多 | 加分帧预热 |
| BGM 不播放 | 音频加载失败/未重试 | 加重试机制，播放成功才算开始 |
| 调整窗口后白屏 | resize 事件死循环 | 检查 resize 处理逻辑 |
| 升级弹窗点不动 | 事件监听重复绑定 | 检查弹窗关闭逻辑 |

---

## 八、开发流程规范

1. **改代码前先读 RULES**：`docs/code-standards.md`
2. **不自动 build**：日常用 `npm run dev` 热更新
3. **不自动部署**：构建产物复制到主站必须经用户确认
4. **改完自检**：语法检查 + 功能验证，不允许"我觉得应该没问题"
5. **报错定位**：用户反馈报错必须找到具体文件和行号修复
