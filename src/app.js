const root = document.documentElement;

// ---- Theme: follows the system until the visitor chooses
const themeButton = document.querySelector("[data-theme-toggle]");
const systemDark = matchMedia("(prefers-color-scheme: dark)");
const currentTheme = () => root.dataset.theme || (systemDark.matches ? "dark" : "light");
const syncThemeButton = () => {
  if (!themeButton) return;
  const dark = currentTheme() === "dark";
  themeButton.setAttribute("aria-pressed", String(dark));
  themeButton.setAttribute("aria-label", dark ? "切换浅色模式" : "切换深色模式");
  themeButton.querySelector("use")?.setAttribute("href", dark ? "#i-sun" : "#i-moon");
};
themeButton?.addEventListener("click", () => {
  root.dataset.theme = currentTheme() === "dark" ? "light" : "dark";
  try {
    localStorage.setItem("maanikki-theme", root.dataset.theme);
  } catch {
    /* The choice still applies to this page without storage. */
  }
  syncThemeButton();
});
systemDark.addEventListener("change", syncThemeButton);
syncThemeButton();

// ---- Download: the build snapshot is the fallback; GitHub gives the freshest release
const applyRelease = (release) => {
  const asset = release?.assets?.find((item) => /^MaaNikki-v.+-win-x86_64\.zip$/.test(item.name));
  if (!asset) return;
  const date = new Date(release.published_at).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" });
  const size = `${Math.round(asset.size / 1024 / 1024)} MB`;
  document.querySelectorAll("[data-download]").forEach((link) => (link.href = asset.browser_download_url));
  document.querySelectorAll("[data-release-version]").forEach((node) => (node.textContent = release.tag_name));
  document.querySelectorAll("[data-release-detail]").forEach((node) => (node.textContent = `${size} · ${date}`));
  document.querySelectorAll("[data-release-date]").forEach((node) => (node.textContent = date));
  if (release.html_url) document.querySelectorAll("[data-release-link]").forEach((link) => (link.href = release.html_url));
};
if (document.querySelector("[data-download]")) {
  fetch("https://api.github.com/repos/architect9331/MaaNikki/releases?per_page=10", {
    headers: { Accept: "application/vnd.github+json" },
  })
    .then((response) => (response.ok ? response.json() : Promise.reject()))
    .then((releases) =>
      applyRelease(releases.find((item) => !item.draft && item.assets.some((asset) => /win-x86_64\.zip$/.test(asset.name)))),
    )
    .catch(() => {
      /* The links written at build time keep working. */
    });
  fetch("https://api.github.com/repos/architect9331/MaaNikki")
    .then((response) => (response.ok ? response.json() : Promise.reject()))
    .then((repo) => {
      const stars = document.querySelector("[data-stars]");
      if (stars && repo.stargazers_count) stars.textContent = ` · ★ ${repo.stargazers_count}`;
    })
    .catch(() => {});

  // MAA-style platform awareness: only Windows can run this, so say so before the download.
  if (!/windows/i.test(navigator.userAgent)) {
    const note = document.querySelector("[data-os-note]");
    if (note) note.hidden = false;
  }
}

// ---- Copy the QQ group number
document.querySelectorAll("[data-copy]").forEach((button) => {
  const label = button.querySelector("[data-copy-label]");
  const original = label?.textContent;
  button.addEventListener("click", async () => {
    let copied = false;
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      copied = true;
    } catch {
      /* Clipboard can be unavailable; the number stays visible on the card. */
    }
    if (label) label.textContent = copied ? "已复制" : "请手动复制";
    setTimeout(() => label && (label.textContent = original), 1800);
  });
});

// ---- Gentle reveal; content is visible without JavaScript or with reduced motion
const revealTargets = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px" },
  );
  revealTargets.forEach((target) => observer.observe(target));
} else {
  revealTargets.forEach((target) => target.classList.add("is-visible"));
}

// ---- Manual: section filter and current-section highlight
const search = document.querySelector("[data-manual-search]");
const tocLinks = [...document.querySelectorAll("[data-manual-toc] a")];
if (tocLinks.length) {
  const headings = tocLinks
    .map((link) => document.getElementById(decodeURIComponent(link.hash.slice(1))))
    .filter(Boolean);
  // Each heading owns the content up to the next heading of the table of contents.
  const sectionText = headings.map((heading, index) => {
    let text = heading.textContent;
    for (let node = heading.nextElementSibling; node && node !== headings[index + 1]; node = node.nextElementSibling) {
      text += ` ${node.textContent}`;
    }
    return text.toLowerCase();
  });
  const empty = document.querySelector("[data-manual-empty]");
  search?.addEventListener("input", () => {
    const query = search.value.trim().toLowerCase();
    let shown = 0;
    tocLinks.forEach((link, index) => {
      const match = !query || sectionText[index]?.includes(query);
      link.hidden = !match;
      if (match) shown += 1;
    });
    if (empty) empty.hidden = shown > 0;
  });
  const spy = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        tocLinks.forEach((link) =>
          link.classList.toggle("is-current", decodeURIComponent(link.hash.slice(1)) === entry.target.id),
        );
      }
    },
    { rootMargin: "-15% 0px -75% 0px" },
  );
  headings.forEach((heading) => spy.observe(heading));
}
