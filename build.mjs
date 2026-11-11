import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const root = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(process.env.MAANIKKI_SOURCE_DIR || path.join(root, ".upstream"));
const output = path.join(root, "dist");
const repo = "https://github.com/architect9331/MaaNikki";
const releasesUrl = `${repo}/releases`;
const assetPattern = /^MaaNikki-v.+-win-x86_64\.zip$/;
const qqGroup = "654174255";
const qqLink = "https://qm.qq.com/q/JFXWGzWruM";

const escapeHtml = (value) =>
  String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, "assets"), { recursive: true });
await mkdir(path.join(output, "manual"), { recursive: true });
await mkdir(path.join(output, "fonts"), { recursive: true });

// ---- Fonts: self-hosted because Google Fonts is unreliable for much of the audience.
// Unicode-range slices mean a page downloads only the glyph files it actually uses.
const fontSheets = [
  ["noto-serif-sc", "600.css"],
  ["cormorant-garamond", "latin-500.css"],
  ["cormorant-garamond", "latin-500-italic.css"],
];
let fontCss = "";
for (const [family, sheet] of fontSheets) {
  const directory = path.join(root, "node_modules", "@fontsource", family);
  const css = await readFile(path.join(directory, sheet), "utf8");
  for (const [, file] of css.matchAll(/url\(\.\/files\/([^)]+\.woff2)\)/g)) {
    await cp(path.join(directory, "files", file), path.join(output, "fonts", file));
  }
  fontCss += css
    .replace(/,\s*url\(\.\/files\/[^)]+\.woff\)\s*format\('woff'\)/g, "")
    .replace(/url\(\.\/files\//g, "url(/fonts/");
  await cp(path.join(directory, "LICENSE"), path.join(output, "fonts", `LICENSE-${family}.txt`));
}
await writeFile(path.join(output, "fonts", "fonts.css"), fontCss);

// ---- Release snapshot: lets the page show a real download link without JavaScript.
let snapshot = null;
let notesHtml = "";
try {
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "MaaNikki-website" };
  if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;
  const response = await fetch(`${repo.replace("github.com", "api.github.com/repos")}/releases?per_page=10`, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
  const release = (await response.json()).find(
    (item) => !item.draft && item.assets.some((asset) => assetPattern.test(asset.name)),
  );
  if (release) {
    const asset = release.assets.find((item) => assetPattern.test(item.name));
    snapshot = {
      tag_name: release.tag_name,
      published_at: release.published_at,
      html_url: release.html_url,
      assets: [{ name: asset.name, size: asset.size, browser_download_url: asset.browser_download_url }],
    };
    // Release notes credit authors with handles; the homepage summary reads better without them.
    notesHtml = marked.parse((release.body || "").replace(/\s+@[\w-]+(?=\s|$)/gm, ""));
  }
} catch (error) {
  console.warn(`Release snapshot unavailable; keeping release-list link: ${error.message}`);
}
await writeFile(path.join(output, "release.json"), `${JSON.stringify(snapshot, null, 2)}\n`);

// ---- Shared chrome
const icons = await readFile(path.join(root, "src", "icons.svg"), "utf8");
const header = (activePage = "") => `<a class="skip-link" href="#main">跳到正文</a>
<header class="site-header"><div class="site-header__inner">
  <a class="brand" href="/" aria-label="MaaNikki 首页"><img src="/assets/icon.png" alt="" width="36" height="36"><span>MaaNikki</span></a>
  <nav class="site-nav" aria-label="主导航">
    <a class="site-nav__wide" href="/#features">功能</a>
    <a class="site-nav__wide" href="/#start">上手</a>
    <a href="/manual/"${activePage === "manual" ? ' aria-current="page"' : ""}>手册</a>
    <a href="/stats/"${activePage === "stats" ? ' aria-current="page"' : ""}>统计</a>
    <a class="site-nav__wide" href="/#community">社区</a>
    <a class="icon-link" href="${qqLink}" target="_blank" rel="noopener noreferrer" aria-label="加入 QQ 交流群 ${qqGroup}" title="QQ 交流群 ${qqGroup}"><svg aria-hidden="true"><use href="#i-qq"></use></svg></a>
    <a class="icon-link" href="${repo}" target="_blank" rel="noopener noreferrer" aria-label="GitHub 仓库"><svg aria-hidden="true"><use href="#i-github"></use></svg></a>
    <button class="icon-link" type="button" data-theme-toggle aria-label="切换深色模式" aria-pressed="false"><svg aria-hidden="true"><use href="#i-moon"></use></svg></button>
    <a class="nav-download" href="/#download">下载</a>
  </nav>
</div></header>`;
const footer = `<footer class="site-footer"><div class="lace lace--top" aria-hidden="true"></div><div class="wrap site-footer__inner">
  <div class="site-footer__brand">
    <a class="site-footer__name" href="/">MaaNikki</a>
    <p>奇迹大陆这么大，别只用来清日常。</p>
  </div>
  <nav aria-label="项目"><h2>项目</h2><a href="${repo}">源码</a><a href="${releasesUrl}">发行版</a><a href="${repo}/issues">问题反馈</a><a href="/manual/">用户手册</a><a href="/stats/">数据统计</a></nav>
  <nav aria-label="友情链接"><h2>友情链接</h2><a href="https://github.com/MaaXYZ/MaaFramework">MaaFramework</a><a href="https://github.com/MistEO/MXU">MXU</a><a href="https://maa.plus/">MAA</a><a href="https://maaend.com/">MaaEnd</a><a href="https://mirrorchyan.com/zh/projects?rid=MaaNikki&amp;source=maanikki_website">Mirror酱</a></nav>
</div><p class="wrap site-footer__note">社区开源项目 · 代码采用 AGPL-3.0-only · 《无限暖暖》游戏相关内容与商标归其权利方所有。</p></footer>`;
const head = (title, description, url) => `<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}">
<meta name="theme-color" content="#fff5f6" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#241c1e" media="(prefers-color-scheme: dark)">
<meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:image" content="https://maanikki.cn/assets/icon.png"><meta property="og:url" content="https://maanikki.cn${url}">
<link rel="canonical" href="https://maanikki.cn${url}"><link rel="icon" href="/assets/icon.png" type="image/png">
<script>(function(){try{var t=localStorage.getItem('maanikki-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}document.documentElement.classList.add('js')})()</script>
<link rel="stylesheet" href="/fonts/fonts.css"><link rel="stylesheet" href="/styles.css"><script src="/app.js" defer></script>`;
const shell = (title, description, url, body, activePage = "") =>
  `<!doctype html><html lang="zh-CN"><head>${head(title, description, url)}</head><body>${icons}${header(activePage)}${body}${footer}</body></html>`;

// ---- Homepage
const sizeMb = snapshot ? Math.round(snapshot.assets[0].size / 1024 / 1024) : 0;
const dateText = snapshot
  ? new Date(snapshot.published_at).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })
  : "";
const homeBody = (await readFile(path.join(root, "src", "home.html"), "utf8"))
  .replaceAll("{{DOWNLOAD_URL}}", escapeHtml(snapshot?.assets[0].browser_download_url || releasesUrl))
  .replaceAll("{{VERSION}}", escapeHtml(snapshot?.tag_name || "最新版本"))
  .replaceAll("{{SIZE}}", snapshot ? `${sizeMb} MB` : "")
  .replaceAll("{{DATE}}", escapeHtml(dateText))
  .replaceAll("{{RELEASE_URL}}", escapeHtml(snapshot?.html_url || releasesUrl))
  .replaceAll("{{RELEASE_NOTES}}", notesHtml || `<p>查看 <a href="${releasesUrl}">GitHub 发行版</a> 了解最新改动。</p>`);
await writeFile(
  path.join(output, "index.html"),
  shell(
    "MaaNikki · 无限暖暖小助手",
    "奇迹大陆这么大，别只用来清日常。MaaNikki 是开源的《无限暖暖》小助手：基于图像识别，替你跑完每日任务，收齐祝福闪光颜色。免费下载 Windows 版。",
    "/",
    homeBody,
  ),
);

// ---- Manual, generated from the software repository
const toc = [];
const usedIds = new Map();
marked.use({
  renderer: {
    heading({ tokens, depth }) {
      const content = this.parser.parseInline(tokens);
      const base = content
        .replace(/<[^>]*>/g, "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}_\-\s]/gu, "")
        .replace(/\s/g, "-");
      const count = usedIds.get(base) || 0;
      usedIds.set(base, count + 1);
      const id = count ? `${base}-${count}` : base;
      if (depth === 2 || depth === 3) toc.push({ id, content, depth });
      return `<h${depth} id="${escapeHtml(id)}">${content}</h${depth}>\n`;
    },
    link({ href, title, tokens }) {
      if (href === "../README.md") href = "/";
      else if (href && !/^(?:https?:|mailto:|#|\/)/.test(href))
        href = `${repo}/blob/main/${path.posix.normalize(`docs/${href}`)}`;
      return `<a href="${escapeHtml(href || "")}"${title ? ` title="${escapeHtml(title)}"` : ""}>${this.parser.parseInline(tokens)}</a>`;
    },
    image({ href, title, text }) {
      if (href?.startsWith("images/")) href = `/assets/${href.slice(7)}`;
      return `<img src="${escapeHtml(href || "")}" alt="${escapeHtml(text)}" loading="lazy"${title ? ` title="${escapeHtml(title)}"` : ""}>`;
    },
    table(token) {
      return `<div class="table-scroll">${marked.Renderer.prototype.table.call(this, token)}</div>`;
    },
  },
});
// The website supplies its own navigation; the Markdown keeps its GitHub-friendly header and TOC.
const manualSource = (await readFile(path.join(source, "docs", "manual.md"), "utf8"))
  .replace(/^\[返回首页\].*\r?\n/m, "")
  .replace(/^## 目录\r?\n[\s\S]*?(?=^## )/m, "");
const manual = marked.parse(manualSource);
const tocHtml = toc
  .map((item) => `<a class="toc-${item.depth}" href="#${escapeHtml(item.id)}">${item.content}</a>`)
  .join("");
await writeFile(
  path.join(output, "manual", "index.html"),
  shell(
    "用户手册 · MaaNikki",
    "MaaNikki 使用说明：快速开始、日常任务、祝福闪光全收集、衣柜与搭配、探索辅助、路线编辑与常见问题。",
    "/manual/",
    `<div class="manual-sky" aria-hidden="true"></div><main id="main" class="manual wrap">
      <aside class="manual__side"><div class="manual__side-inner">
        <label class="manual__search"><svg aria-hidden="true"><use href="#i-search"></use></svg><input type="search" placeholder="搜索手册" aria-label="搜索手册" data-manual-search></label>
        <nav aria-label="手册目录" data-manual-toc>${tocHtml}</nav>
        <p class="manual__empty" data-manual-empty hidden>没有找到相关章节，换个词试试。</p>
      </div></aside>
      <article class="manual__content prose">${manual}</article>
    </main>`,
    "manual",
  ),
);

await writeFile(
  path.join(output, "404.html"),
  shell(
    "页面未找到 · MaaNikki",
    "返回 MaaNikki 首页。",
    "/",
    `<main id="main" class="not-found wrap"><svg class="not-found__star" aria-hidden="true"><use href="#i-star"></use></svg><h1>这一页走丢了</h1><p>大喵也没找到它，先回首页看看吧。</p><a class="btn btn--gold" href="/">回到首页</a></main>`,
  ),
);

// ---- Public anonymous statistics dashboard (/stats/)
let catalogSets = [];
try {
  const catalogRaw = JSON.parse(
    await readFile(path.join(source, "resource", "data", "blessing_catalog.json"), "utf8"),
  );
  catalogSets = (catalogRaw.sets || [])
    .filter((item) => item.rarity === 5 && item.collection_target !== false)
    .map((item) => ({ name: item.name, source: item.source, colors: item.colors }));
} catch (error) {
  console.warn(`Blessing catalog unavailable: ${error.message}`);
}
const catalogScript = `<script id="stats-catalog" type="application/json">${JSON.stringify(catalogSets).replace(/</g, "\\u003c")}</script>`;
await mkdir(path.join(output, "stats"), { recursive: true });
await writeFile(
  path.join(output, "stats", "index.html"),
  shell(
    "数据统计 · MaaNikki",
    "MaaNikki 社区匿名实测统计：五星祝福闪光炫彩与各色条件出率、28 套副本明细、刷噗灵产出与日常偏好。",
    "/stats/",
    `<section class="stats-banner" aria-labelledby="stats-title">
      <div class="hero__sky" aria-hidden="true">
        <span class="hero__twinkle" style="--x:9%;--y:24%;--s:11px;--d:0s"></span>
        <span class="hero__twinkle" style="--x:28%;--y:14%;--s:7px;--d:1.3s"></span>
        <span class="hero__twinkle" style="--x:64%;--y:19%;--s:9px;--d:2.1s"></span>
        <span class="hero__twinkle" style="--x:88%;--y:28%;--s:10px;--d:.7s"></span>
      </div>
      <div class="wrap stats-banner__inner">
        <div>
          <p class="hero__eyebrow"><svg aria-hidden="true"><use href="#i-star"></use></svg>企鹅物流式匿名汇总</p>
          <h1 id="stats-title">奇迹大陆 · <em>闪光与日常统计</em></h1>
          <p class="stats-banner__lead">汇总 MaaNikki 搭配师在日常运行中匿名贡献的五星满级变色、幻境刷噗灵与任务偏好数据。浏览器每次打开实时拉取最新样本。</p>
        </div>
        <p class="stats-status-pill" data-stats-status role="status">正在同步实时样本…</p>
      </div>
      <div class="lace lace--hem" aria-hidden="true"></div>
    </section>
    <main id="main" class="stats-page wrap" data-stats>
      <div class="stats-kpis" data-stats-kpis hidden></div>

      <section class="stats-section" data-stats-main hidden aria-labelledby="color-rates-title">
        <div class="stats-card stats-card--tag">
          <div class="stats-card-header">
            <div>
              <p class="kicker">变色出率</p>
              <h2 id="color-rates-title">五星满级变色出率解析</h2>
            </div>
            <div class="stats-mode-switch" role="tablist" aria-label="统计口径切换">
              <button type="button" class="stats-mode-btn is-active" data-rate-mode="conditional" role="tab" aria-selected="true">池内条件出率</button>
              <button type="button" class="stats-mode-btn" data-rate-mode="raw" role="tab" aria-selected="false">全样本占比</button>
            </div>
          </div>
          <div class="stats-iridescent-banner" data-stats-iridescent></div>
          <p class="stats-methodology-hint" data-stats-mode-hint>
            每套五星祝福闪光固定包含「<strong>彩色 + 4 种普通色</strong>」（如仅 4 套含白色、23 套含蓝色）。<strong>池内条件出率</strong>只以包含该颜色的五星套组升满次数为分母，避免少见色池因总样本稀释而显低；除去彩色后四色均分的理论期望约为 <span data-stats-expected-normal>23.8%</span>。
          </p>
          <div class="stats-color-rows" data-stats-colors></div>
        </div>

        <div class="stats-duo-grid">
          <article class="stats-card stats-card--tag" data-stats-slots-card>
            <p class="kicker">部位分布</p>
            <h3>三部位升满样本分布</h3>
            <p class="stats-card-sub">全收集按缺色期望排定升级优先级，样本覆盖头部、手部与脚部。</p>
            <div data-stats-slots></div>
          </article>
          <article class="stats-card stats-card--tag" data-stats-bling-card>
            <p class="kicker">素材激化</p>
            <h3>刷噗灵实测产出</h3>
            <p class="stats-card-sub">记录幻境刷取噗灵时的活跃能量消耗与实际产出比。</p>
            <div data-stats-bling></div>
          </article>
        </div>
      </section>

      <section class="stats-section" data-stats-sets-section hidden aria-labelledby="sets-title">
        <div class="stats-card stats-card--tag">
          <div class="stats-card-header stats-sets-header">
            <div>
              <p class="kicker">副本与套组</p>
              <h2 id="sets-title">28 套五星祝福闪光实测明细</h2>
            </div>
            <div class="stats-sort-group" aria-label="排序方式">
              <button type="button" class="stats-chip is-active" data-set-sort="count">按样本量</button>
              <button type="button" class="stats-chip" data-set-sort="iridescent">按炫彩率</button>
              <button type="button" class="stats-chip" data-set-sort="catalog">按副本顺序</button>
            </div>
          </div>
          <div class="stats-realm-filters" data-stats-realms aria-label="按副本筛选"></div>
          <div class="stats-sets-grid" data-stats-sets></div>
        </div>
      </section>

      <section class="stats-section" data-stats-community-section hidden aria-labelledby="community-stats-title">
        <header class="stats-section-head">
          <div>
            <p class="kicker">社区习惯</p>
            <h2 id="community-stats-title">搭配师日常偏好与挖掘风向标</h2>
          </div>
          <p>看看大家平时勾选哪些日常任务、选择哪种幻境模式，以及美鸭梨最常挖掘哪些材料。</p>
        </header>
        <div class="stats-duo-grid">
          <article class="stats-card stats-card--tag">
            <h3>日常任务与幻境模式偏好</h3>
            <div data-stats-prefs></div>
          </article>
          <article class="stats-card stats-card--tag">
            <h3>美鸭梨挖掘热门材料</h3>
            <div data-stats-dig></div>
          </article>
        </div>
      </section>

      <section class="stats-privacy" aria-labelledby="privacy-title">
        <h3 id="privacy-title">关于统计方法与隐私保护</h3>
        <p>本页并非游戏官方公布概率。置信区间采用 <strong>95% Wilson 区间</strong>，在小样本与低概率场景下依然稳健，查看单套组或单颜色时请结合区间宽度参考。</p>
        <p>参考企鹅物流的匿名汇总设计，客户端仅使用服务端首次随机生成的匿名统计 ID（与游戏 UID、账号及硬件无关，请求 IP 不落盘），只上报闪光套组部位与颜色、刷噗灵能量与产出、挖掘材料名及任务开关偏好。你随时可以在软件「<strong>设置 → 通用 → 帮助改进软件</strong>」中独立关闭任意统计项。</p>
      </section>
    </main>${catalogScript}<script type="module" src="/stats.js"></script>`,
    "stats",
  ),
);

// ---- Static assets
await cp(path.join(root, "src", "styles.css"), path.join(output, "styles.css"));
await cp(path.join(root, "src", "app.js"), path.join(output, "app.js"));
await cp(path.join(root, "src", "stats.js"), path.join(output, "stats.js"));
await cp(path.join(source, "resource", "icon.png"), path.join(output, "assets", "icon.png"));
for (const file of await readdir(path.join(source, "docs", "images"))) {
  if (/\.(png|webp|jpg|svg)$/i.test(file))
    await cp(path.join(source, "docs", "images", file), path.join(output, "assets", file));
}
await writeFile(path.join(output, "CNAME"), "maanikki.cn\n");
await writeFile(path.join(output, ".nojekyll"), "");
await writeFile(path.join(output, "robots.txt"), "User-agent: *\nAllow: /\nSitemap: https://maanikki.cn/sitemap.xml\n");
await writeFile(
  path.join(output, "sitemap.xml"),
  '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://maanikki.cn/</loc></url><url><loc>https://maanikki.cn/manual/</loc></url><url><loc>https://maanikki.cn/stats/</loc></url></urlset>\n',
);
console.log(`Built homepage, manual (${toc.length} headings) → ${path.relative(root, output)}`);
console.log(`Download: ${snapshot?.tag_name || "GitHub release list"}`);
