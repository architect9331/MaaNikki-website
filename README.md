# MaaNikki 官网

官网地址：https://maanikki.cn，静态页面由 GitHub Pages 托管，DNS 由 Cloudflare 管理。软件与文档原文维护在 [MaaNikki](https://github.com/architect9331/MaaNikki)。

```powershell
npm ci
$env:MAANIKKI_SOURCE_DIR = 'F:/MaaNikki'
npm run build
python -m http.server 4173 --directory dist
```

使用 `.node-version` 指定的 Node.js 版本。构建输出在 `dist/`。`src/` 维护主页（`home.html`、`styles.css`、`app.js`、`icons.svg`），`build.mjs` 组装页面；标题字体由 `@fontsource` 自托管，按需加载；用户手册从软件仓库的 `docs/manual.md` 生成，界面截图沿用 `docs/images/`，图标沿用 `resource/icon.png`。可设置 `MAANIKKI_SOURCE_DIR` 指向软件仓库，或将其克隆到本目录的 `.upstream/`。

推送官网改动会自动部署。软件仓库更新手册、截图、图标，或软件构建完成后，通过仅限本仓库的部署密钥更新 `upstream.json`，触发官网部署。该文件记录软件提交和发行版，构建按提交读取手册与素材。可手动运行软件仓库的 `Sync website` 或本仓库的 `Deploy website`。

页面打开时尝试查询 GitHub 获取最新运行包，支持项目使用的预发布版本，失败时沿用下载快照或发行版列表入口。网站代码沿用 AGPL-3.0-only，见 `LICENSE`；素材来源见软件仓库的 `THIRD_PARTY_NOTICES.md`。

域名使用 GitHub Pages 官方 A / AAAA 记录，`www` 指向 `architect9331.github.io`，保持 DNS only，由 GitHub Pages 提供 HTTPS。
