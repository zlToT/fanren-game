# fanren-game — 项目协作说明

《凡人修仙传》吸血鬼幸存者 like H5 小游戏。本文件是 agent 在本仓库工作时必须遵守的常驻规则。

## 工程概况

- 技术栈：**Vite 8 + PIXI.js 7.4.2 + 原生 ES Modules**，纯前端无后端
- 源码目录：`js/`（按模块拆分：main / enemy / weapons / projectiles / skills / input / ui / fx / buff / fsm/）
- 配置表：`js/config.js`（关卡、怪物、武器、被动）
- 伤害公式统一入口：`js/calculate.js`
- 资源：`imgs/`、`audio/` 根目录（Vite 自动拷贝到 dist）
- 主站嵌入目录：`../zlToT.github.io-site/public/games/fanren/`

## 开工前必读（按任务类型）

动手改代码前，**先读对应文档**，不要凭印象写：

| 任务类型 | 必读文件 |
|---|---|
| 任何 `js/` 代码改动 | `docs/code-standards.md`、`docs/game-dev-standards.md` |
| 涉及 FSM / 敌人 AI | `docs/fsm-design.md` |
| 涉及 buff / 迷魂 / 血祭 | `docs/buff-design.md` |
| 涉及数值平衡（伤害/血量/经验） | `js/config.js` + `js/calculate.js`，改完在这两个文件内闭环，不要把数值硬编码到逻辑里 |
| 构建 / 打包 / 部署 | `.claude/skills/fanren_build_skill/SKILL.md` |
| 代码审查 / 自查 | `.claude/skills/fanren_code_review_skill/SKILL.md` |
| 用户自查发现的 bug | `docs/bug-log.md` —— 每修一个新的就追加一条，按"现象→根因→修复"三段写 |

## Skill 索引

本仓库的项目级 skills 都放在 `.claude/skills/` 下，每个目录一个 `SKILL.md`：

- `fanren_build_skill/` — 本地 dev / build / preview / 手动部署流程
- `fanren_code_review_skill/` — 对象池 / 事件监听 / 定时器 / DOM / 内存泄漏 检查清单

触发条件在每个 SKILL.md 顶部 frontmatter 的 `description` 里。任务匹配时先 Read 对应 SKILL.md，再按里面的步骤执行。

## 硬性约束

1. **未经用户明确指示，不要 `git commit`**；改完由用户验证后再提交。
2. **不要自动 `npm run deploy`**，也不要把 `dist/` 复制到 `../zlToT.github.io-site/public/games/fanren/`，部署由用户手动执行。
3. 日常调试用 `npm run dev`（端口 5199）；**build 只在用户明确说要发布时跑**。
4. 不要改 `vite.config.js` 的 `base: './'`。
5. PIXI.js 用 npm 安装（`pixi.js@7.4.2`），禁止改回 CDN。
6. 新增图片/音频放 `imgs/`、`audio/` 根目录。
7. 数值调整优先改 `js/config.js`（静态表）和 `js/calculate.js`（公式），不要散落到业务逻辑里。
8. 玩家受伤走 `playerHurt()`，敌人受伤走 `e.hurt()`，禁止直接改 `game.hp` / `e.hp`。
9. 敌人 / 子弹 / 经验球必须走对象池工厂（`spawnEnemy` / `createProjectile` / `createOrb`），禁止裸 `new`。

## 交付前自检

- 改完跑一次 `npm run build`，必须出现 `✓ built in xxxms` 且无红色 error。
- 涉及伤害数值时，手算一遍关键数字（小怪碰伤、Boss 技能 tick）是否符合预期。
- 不要顺手"优化"用户没让动的文件。
