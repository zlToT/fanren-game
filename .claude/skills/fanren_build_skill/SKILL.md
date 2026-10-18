---
name: fanren-build
description: 小游戏《凡人修仙传》fanren-game（Vite + PIXI.js 7.4.2）的本地构建与 GitHub Pages 部署流程。
---

## 项目信息

- 游戏：《凡人修仙传》吸血鬼幸存者like网页游戏
- 技术栈：**Vite 8 + PIXI.js 7.4.2 + ES Modules**（纯前端，无后端）
- 工程根目录：`D:\Work\site\fanren-game`
- Node.js：本地已安装，npm 可用
- GitHub 仓库：`https://github.com/zlToT/fanren-game`
- 线上地址：**https://zltot.github.io/fanren-game/**

---

## 一、开发模式（日常调试）

```powershell
cd "D:\Work\site\fanren-game"
npm run dev
```

- 默认端口 **5199**（vite.config.js 中配置）
- 浏览器打开 `http://localhost:5199`
- 修改源码自动热更新，无需手动刷新
- **禁止**在开发模式下跑 build，build 只在准备发布时执行

## 二、构建（产出 dist/）

```powershell
cd "D:\Work\site\fanren-game"
npm run build
```

- 产物输出到 `dist/`，约 0.2 秒完成
- `base: './'` 相对路径，可直接嵌入任意子目录
- 构建成功标志：终端显示 `✓ built in xxxms`，无红色 error

## 三、本地预览构建产物

```powershell
cd "D:\Work\site\fanren-game"
npm run preview
```

- Vite preview 起静态服务器，验证 dist 产物能否正常运行
- 不要直接双击 `dist/index.html`，file:// 协议会导致模块加载失败

## 四、部署到 GitHub Pages（手动）

```powershell
# 1. 推源码到 main
cd "D:\Work\site\fanren-game"
git add .
git commit -m "描述改动"
git push origin main

# 2. 推 dist 到 gh-pages
cd "D:\Work\site\fanren-game\dist"
git add -A
git commit -m "deploy"
git push -f origin gh-pages
```

- 等 1 分钟，访问 https://zltot.github.io/fanren-game/
- 如果有缓存问题，Ctrl+Shift+R 硬刷新

## 五、硬性约束

1. **不要每次改完代码都跑 build**——build 只在用户明确要求发布/出包时执行；日常调试用 `npm run dev` 热更新
2. 不要修改 `vite.config.js` 的 `base: './'`，改了会破坏子路径部署
3. `dist/` 目录已在 .gitignore 中，不随源码入库
4. 新增图片/音频资源放在 `public/imgs/` 和 `public/audio/` 根目录，Vite 会自动拷贝到 dist
5. PIXI.js 通过 npm 安装（`pixi.js@7.4.2`），**禁止**改回 CDN 引入
6. **不要自动同步到 zlToT.github.io-site**——现在独立部署到 fanren-game 自己的 Pages

## 六、常见问题

- **`PIXI is not defined`**：检查每个 JS 文件是否都 `import * as PIXI from 'pixi.js'`
- **`import not found`**：检查文件路径大小写和扩展名
- **图片/音频 404**：确认资源在 `public/imgs/` 或 `public/audio/` 根目录，构建后 dist 里有对应文件
- **WebGL 渲染失败**：浏览器需支持 WebGL，F12 拉大窗口可能触发 context lost，刷新即可
- **Pages 部署后白屏**：硬刷新清缓存；确认 gh-pages 分支已推最新 dist
