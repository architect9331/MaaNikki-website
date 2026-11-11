// Anonymous community statistics dashboard. Hydrates live aggregates from stats.maanikki.cn
// and combines them with the embedded 5-star Eureka catalog for accurate conditional rates.

const COLOR_ORDER = ["彩", "蓝", "绿", "黄", "粉", "红", "紫", "白"];
const COLOR_CLASS = {
  彩: "iridescent",
  蓝: "blue",
  绿: "green",
  黄: "yellow",
  粉: "pink",
  红: "red",
  紫: "purple",
  白: "white",
};
const TASK_LABELS = {
  start_game: "启动游戏",
  dig: "美鸭梨挖掘",
  zhaoxi: "朝夕心愿",
  glow_material_prep: "焕新材料筹备",
  realm_challenge: "幻境挑战",
  starlight_crystals: "跑图收集星光结晶",
  xinghai: "星海拾光",
  home: "家园日常",
  monthly_pass: "奇迹之旅奖励",
  mailbox: "邮箱领取",
  weekly_free_gifts: "每周免费礼包",
  monthly_crystal_exchange: "每月五抽兑换",
  crown: "奇迹之冠巅峰赛",
  open_world_collect: "大世界材料采集",
  minigame_bling: "小游戏刷噗灵",
  custom_route: "自定义路线",
};
const REALM_MODE_LABELS = {
  "collection:managed": "五星全收集 · 全流程托管",
  "collection:farm_only": "五星全收集 · 只刷胚子",
  crafting: "制衣材料全收集",
  "daily:Nourish": "日常消耗 · 素材激化",
  "daily:Bless": "日常消耗 · 祝福闪光",
  "daily:Monster": "日常消耗 · 魔物试炼",
};
const MIN_COMMUNITY_REPORTERS = 5;

const root = document.querySelector("[data-stats]");
const statusEl = document.querySelector("[data-stats-status]");
const fmtInt = (v) => Number(v || 0).toLocaleString("zh-CN");
const fmtPct = (v, digits = 1) => `${(Number(v || 0) * 100).toFixed(digits)}%`;
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"]/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch],
  );

function parseCatalog() {
  try {
    const raw = document.getElementById("stats-catalog")?.textContent;
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Wilson score interval at 95%: well-behaved for small counts and rare events.
function wilsonInterval(hits, total) {
  if (!total || total <= 0) return [0, 0];
  const z = 1.96;
  const p = hits / total;
  const denom = 1 + (z * z) / total;
  const centre = p + (z * z) / (2 * total);
  const margin =
    z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
  return [
    Math.max(0, (centre - margin) / denom),
    Math.min(1, (centre + margin) / denom),
  ];
}

function formatUpdatedTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

const catalog = parseCatalog();
const state = {
  summary: null,
  rateMode: "conditional",
  realmFilter: "ALL",
  setSort: "count",
};

function computeModel(summary) {
  const colorsMap = new Map(
    (summary.colors ?? []).map((r) => [r.color, Number(r.count) || 0]),
  );
  const totalRolls = [...colorsMap.values()].reduce((a, b) => a + b, 0);
  const setColorMap = new Map();
  for (const row of summary.setColors ?? []) {
    const count = Number(row.count) || 0;
    if (!setColorMap.has(row.name)) setColorMap.set(row.name, new Map());
    setColorMap.get(row.name).set(row.color, count);
  }
  const hasPerSet = setColorMap.size > 0 && catalog.length > 0;
  const setRows = catalog.map((item, index) => {
    const counts = setColorMap.get(item.name) ?? new Map();
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    const iridescent = counts.get("彩") || 0;
    return {
      index,
      name: item.name,
      source: item.source,
      colors: item.colors,
      counts,
      total,
      iridescent,
      iridescentRate: total > 0 ? iridescent / total : 0,
    };
  });
  const coveredSets = setRows.filter((s) => s.total > 0).length;
  const poolSetsCount = new Map();
  const poolRollsDenom = new Map();
  for (const color of COLOR_ORDER) {
    const matching = setRows.filter((s) => s.colors.includes(color));
    poolSetsCount.set(color, matching.length);
    poolRollsDenom.set(
      color,
      hasPerSet
        ? matching.reduce((sum, s) => sum + s.total, 0)
        : totalRolls,
    );
  }
  return {
    totalRolls,
    colorsMap,
    hasPerSet,
    setRows,
    coveredSets,
    poolSetsCount,
    poolRollsDenom,
  };
}

function renderKpis(summary, model) {
  const kpisEl = root.querySelector("[data-stats-kpis]");
  const iriHits = model.colorsMap.get("彩") || 0;
  const iriRate = model.totalRolls ? iriHits / model.totalRolls : 0;
  const [iriLow, iriHigh] = wilsonInterval(iriHits, model.totalRolls);
  const baselineIn = iriLow <= 0.05 && iriHigh >= 0.05;
  const slotsText = (summary.slots ?? [])
    .map((s) => `${s.slot.replace("部", "")} ${fmtInt(s.count)}`)
    .join(" · ");
  const rollContributors = summary.rollReporters || summary.reporters || 0;
  const totalReporters = Math.max(summary.reporters || 0, rollContributors);
  const realmsCount = new Set(catalog.map((s) => s.source)).size;

  kpisEl.innerHTML = `
    <article class="stats-kpi stats-kpi-accent">
      <span class="stats-kpi-label">炫彩（彩色）实测出率</span>
      <strong class="stats-kpi-value">${fmtPct(iriRate, 2)}</strong>
      <span class="stats-kpi-meta">${fmtInt(iriHits)} / ${fmtInt(model.totalRolls)} 次 · 95% 区间 ${fmtPct(iriLow, 2)} ~ ${fmtPct(iriHigh, 2)}</span>
      <span class="stats-kpi-badge">${baselineIn ? "5.0% 社区基线位于置信区间内" : "实时 95% Wilson 置信估计"}</span>
    </article>
    <article class="stats-kpi">
      <span class="stats-kpi-label">五星满级样本总数</span>
      <strong class="stats-kpi-value">${fmtInt(model.totalRolls)}<small> 次</small></strong>
      <span class="stats-kpi-meta">${esc(slotsText || "覆盖头、手、脚三部位")}</span>
    </article>
    <article class="stats-kpi">
      <span class="stats-kpi-label">已覆盖五星套组</span>
      <strong class="stats-kpi-value">${catalog.length ? `${model.coveredSets} / ${catalog.length}` : fmtInt(model.coveredSets)}<small> 套</small></strong>
      <span class="stats-kpi-meta">${realmsCount ? `横跨 ${realmsCount} 个祝福闪光副本` : "全部五星可刷取套组"}</span>
    </article>
    <article class="stats-kpi">
      <span class="stats-kpi-label">匿名贡献搭配师</span>
      <strong class="stats-kpi-value">${fmtInt(rollContributors)}<small> 位</small></strong>
      <span class="stats-kpi-meta">${totalReporters > rollContributors ? `累计活跃上报 ${fmtInt(totalReporters)} 位` : "企鹅物流式随机匿名 ID"}</span>
    </article>
  `;
  kpisEl.hidden = false;
}

function renderColorRates(model) {
  const iriHits = model.colorsMap.get("彩") || 0;
  const iriRate = model.totalRolls ? iriHits / model.totalRolls : 0;
  const [iriLow, iriHigh] = wilsonInterval(iriHits, model.totalRolls);
  const expectedNormal = (1 - iriRate) / 4;
  const avgPerIri = iriHits > 0 ? (model.totalRolls / iriHits).toFixed(1) : "—";

  const expectedSpan = root.querySelector("[data-stats-expected-normal]");
  if (expectedSpan) expectedSpan.textContent = fmtPct(expectedNormal, 1);

  const iriEl = root.querySelector("[data-stats-iridescent]");
  const iriScaleMax = 0.1;
  const pctScale = (v) => `${Math.min(100, Math.max(0, (v / iriScaleMax) * 100)).toFixed(2)}%`;
  iriEl.innerHTML = `
    <div class="iri-spotlight-head">
      <div>
        <span class="color-swatch swatch-iridescent"></span>
        <strong>彩色（炫彩）全套组实测</strong>
        <span class="iri-sub">平均约 <strong>${esc(avgPerIri)}</strong> 次五星满级出 1 件彩色</span>
      </div>
      <div class="iri-numbers">
        <strong>${fmtPct(iriRate, 2)}</strong>
        <span>95% CI ${fmtPct(iriLow, 2)} ~ ${fmtPct(iriHigh, 2)}</span>
      </div>
    </div>
    <div class="iri-meter" aria-hidden="true">
      <div class="iri-meter-ci" style="left:${pctScale(iriLow)};width:calc(${pctScale(iriHigh)} - ${pctScale(iriLow)})"></div>
      <div class="iri-meter-fill" style="width:${pctScale(iriRate)}"></div>
      <div class="iri-meter-ref" style="left:${pctScale(0.05)}" title="5.0% 参考线"><span>5% 参考</span></div>
    </div>
  `;

  const hintEl = root.querySelector("[data-stats-mode-hint]");
  if (hintEl) {
    hintEl.innerHTML =
      state.rateMode === "conditional" && model.hasPerSet
        ? `每套五星祝福闪光固定包含「<strong>彩色 + 4 种普通色</strong>」（如仅 4 套含白色、23 套含蓝色）。<strong>池内条件出率</strong>只以包含该颜色的五星套组升满次数为分母，避免少见色池因总样本稀释而显低；除去彩色后四色均分的理论期望约为 <strong>${fmtPct(expectedNormal, 1)}</strong>（虚线标记）。`
        : `<strong>全样本占比</strong>直接将各颜色出现次数除以全部 ${fmtInt(model.totalRolls)} 次升满。由于并非每套五星都包含同一种普通色（例如仅 4 套含白色），全样本占比会受套组色池覆盖数量影响。`;
  }

  const rowsEl = root.querySelector("[data-stats-colors]");
  const maxBarScale = 0.35;
  const barPos = (v) => `${Math.min(100, Math.max(0, (v / maxBarScale) * 100)).toFixed(2)}%`;
  const useConditional = state.rateMode === "conditional" && model.hasPerSet;

  rowsEl.innerHTML = COLOR_ORDER.map((color) => {
    const hits = model.colorsMap.get(color) || 0;
    const denom = useConditional
      ? model.poolRollsDenom.get(color) || model.totalRolls
      : model.totalRolls;
    const rate = denom > 0 ? hits / denom : 0;
    const [low, high] = wilsonInterval(hits, denom);
    const setsCount = model.poolSetsCount.get(color) || 0;
    const refRate =
      useConditional ? (color === "彩" ? 0.05 : expectedNormal) : null;
    const cls = COLOR_CLASS[color] || "blue";

    return `
      <div class="color-rate-row">
        <div class="color-rate-label">
          <span class="color-swatch swatch-${cls}"></span>
          <strong>${esc(color)}色</strong>
          ${catalog.length ? `<span class="color-pool-tag" title="${setsCount} 套五星闪光包含此颜色">${setsCount}/${catalog.length} 套</span>` : ""}
        </div>
        <div class="color-rate-bar-wrap" aria-hidden="true">
          <div class="color-rate-track">
            <div class="color-rate-fill fill-${cls}" style="width:${barPos(rate)}"></div>
            <div class="color-rate-ci" style="left:${barPos(low)};width:calc(${barPos(high)} - ${barPos(low)})"></div>
            ${refRate !== null ? `<div class="color-rate-ref" style="left:${barPos(refRate)}"></div>` : ""}
          </div>
        </div>
        <div class="color-rate-stats">
          <strong>${fmtPct(rate, 1)}</strong>
          <span class="color-rate-count">${fmtInt(hits)} / ${fmtInt(denom)}</span>
          <span class="color-rate-interval">${fmtPct(low, 1)} ~ ${fmtPct(high, 1)}</span>
        </div>
      </div>
    `;
  }).join("");
}

function renderSlots(summary, model) {
  const slotsEl = root.querySelector("[data-stats-slots]");
  const slots = summary.slots ?? [];
  const slotColors = { 头部: "pink", 手部: "lavender", 脚部: "mint" };
  if (slots.length && model.totalRolls > 0) {
    slotsEl.innerHTML = `
      <div class="slot-stacked-bar" aria-hidden="true">
        ${slots
          .map(
            (s) =>
              `<span class="slot-seg seg-${slotColors[s.slot] || "pink"}" style="width:${((s.count / model.totalRolls) * 100).toFixed(2)}%"></span>`,
          )
          .join("")}
      </div>
      <div class="slot-legend">
        ${slots
          .map(
            (s) => `
          <div class="slot-legend-item">
            <span><i class="slot-dot seg-${slotColors[s.slot] || "pink"}"></i>${esc(s.slot)}</span>
            <strong>${fmtInt(s.count)} 次 <small>(${fmtPct(s.count / model.totalRolls, 1)})</small></strong>
          </div>`,
          )
          .join("")}
      </div>
    `;
  } else {
    slotsEl.innerHTML = `<p class="stats-empty-inline">暂无分部位统计记录。</p>`;
  }
}

function renderSets(model) {
  const section = root.querySelector("[data-stats-sets-section]");
  if (!model.hasPerSet) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  const realmsEl = root.querySelector("[data-stats-realms]");
  const realms = [];
  const realmTotals = new Map();
  for (const row of model.setRows) {
    if (!realmTotals.has(row.source)) {
      realms.push(row.source);
      realmTotals.set(row.source, 0);
    }
    realmTotals.set(row.source, realmTotals.get(row.source) + row.total);
  }
  realmsEl.innerHTML = [
    `<button type="button" class="realm-pill${state.realmFilter === "ALL" ? " is-active" : ""}" data-realm="ALL">全部副本 <small>${fmtInt(model.totalRolls)}</small></button>`,
    ...realms.map(
      (r) =>
        `<button type="button" class="realm-pill${state.realmFilter === r ? " is-active" : ""}" data-realm="${esc(r)}">${esc(r)} <small>${fmtInt(realmTotals.get(r) || 0)}</small></button>`,
    ),
  ].join("");

  const filtered = model.setRows.filter(
    (s) => state.realmFilter === "ALL" || s.source === state.realmFilter,
  );
  filtered.sort((a, b) => {
    if (state.setSort === "iridescent") {
      if (b.iridescentRate !== a.iridescentRate) return b.iridescentRate - a.iridescentRate;
      return b.total - a.total;
    }
    if (state.setSort === "catalog") return a.index - b.index;
    return b.total - a.total || a.index - b.index;
  });

  const setsEl = root.querySelector("[data-stats-sets]");
  setsEl.innerHTML = filtered
    .map((s) => {
      const orderedPool = ["彩", ...s.colors.filter((c) => c !== "彩")];
      const barSegs =
        s.total > 0
          ? orderedPool
              .map((c) => {
                const cnt = s.counts.get(c) || 0;
                if (!cnt) return "";
                const cls = COLOR_CLASS[c] || "blue";
                return `<span class="set-seg fill-${cls}" style="width:${((cnt / s.total) * 100).toFixed(2)}%" title="${esc(c)}色 ${cnt} 次"></span>`;
              })
              .join("")
          : "";
      const pills = orderedPool
        .map((c) => {
          const cnt = s.counts.get(c) || 0;
          const cls = COLOR_CLASS[c] || "blue";
          return `<span class="set-color-pill"><i class="color-swatch swatch-${cls}"></i>${esc(c)} <b>${fmtInt(cnt)}</b></span>`;
        })
        .join("");
      return `
        <article class="set-stat-card">
          <div class="set-stat-top">
            <div>
              <h4>${esc(s.name)}</h4>
              <span class="set-realm-tag">${esc(s.source)}</span>
            </div>
            <div class="set-stat-numbers">
              <strong>${fmtInt(s.total)} <small>次</small></strong>
              <span>彩 ${fmtInt(s.iridescent)} · ${s.total ? fmtPct(s.iridescentRate, 1) : "—"}</span>
            </div>
          </div>
          <div class="set-stacked-bar" aria-hidden="true">${barSegs}</div>
          <div class="set-color-pills">${pills}</div>
        </article>
      `;
    })
    .join("");
}

function renderCollectingState(currentCount, label) {
  const ratio = Math.min(100, Math.round((currentCount / MIN_COMMUNITY_REPORTERS) * 100));
  return `
    <div class="stats-collecting">
      <div class="stats-collecting-top">
        <span class="stats-collecting-badge">样本采集中</span>
        <span>已接入 ${fmtInt(currentCount)} / ${MIN_COMMUNITY_REPORTERS} 位匿名搭配师</span>
      </div>
      <div class="stats-collecting-bar" aria-hidden="true"><span style="width:${Math.max(8, ratio)}%"></span></div>
      <p>${esc(label)}云端统计已就绪，累计满 ${MIN_COMMUNITY_REPORTERS} 位搭配师匿名上报后将自动在此展示实时排行。</p>
    </div>
  `;
}

function renderCommunity(summary) {
  const section = root.querySelector("[data-stats-community-section]");
  section.hidden = false;
  const prefsEl = root.querySelector("[data-stats-prefs]");
  const digEl = root.querySelector("[data-stats-dig]");
  const prefReporters = Number(summary.prefReporters) || 0;
  const digReporters = Number(summary.digReporters) || 0;

  if (prefReporters < MIN_COMMUNITY_REPORTERS) {
    prefsEl.innerHTML = renderCollectingState(prefReporters, "日常任务启用率与幻境挑战模式占比");
  } else {
    const prefs = summary.preferences ?? [];
    const enabledMap = new Map();
    const disabledMap = new Map();
    const realmModes = [];
    for (const row of prefs) {
      const cnt = Number(row.reporters) || 0;
      if (row.category === "task_enabled") enabledMap.set(row.value, cnt);
      else if (row.category === "task_disabled") disabledMap.set(row.value, cnt);
      else if (row.category === "realm_mode" && REALM_MODE_LABELS[row.value]) {
        realmModes.push({ label: REALM_MODE_LABELS[row.value], count: cnt });
      }
    }
    const taskRows = [];
    for (const [key, label] of Object.entries(TASK_LABELS)) {
      const on = enabledMap.get(key) || 0;
      const off = disabledMap.get(key) || 0;
      const denom = on + off;
      if (denom > 0) taskRows.push({ label, on, denom, rate: on / denom });
    }
    taskRows.sort((a, b) => b.rate - a.rate || b.on - a.on);
    const modeTotal = realmModes.reduce((s, r) => s + r.count, 0) || prefReporters;

    prefsEl.innerHTML = `
      ${
        realmModes.length
          ? `<div class="rank-group"><p class="rank-subhead">幻境挑战模式占比</p>${realmModes
              .map(
                (m) => `<div class="rank-row"><div class="rank-row-head"><span>${esc(m.label)}</span><strong>${fmtPct(m.count / modeTotal, 0)}</strong></div><div class="rank-bar"><span style="width:${((m.count / modeTotal) * 100).toFixed(1)}%"></span></div></div>`,
              )
              .join("")}</div>`
          : ""
      }
      <div class="rank-group">
        <p class="rank-subhead">日常与周期任务勾选率</p>
        ${taskRows
          .slice(0, 8)
          .map(
            (t) => `<div class="rank-row"><div class="rank-row-head"><span>${esc(t.label)}</span><strong>${fmtPct(t.rate, 0)}</strong></div><div class="rank-bar"><span style="width:${(t.rate * 100).toFixed(1)}%"></span></div></div>`,
          )
          .join("")}
      </div>
    `;
  }

  if (digReporters < MIN_COMMUNITY_REPORTERS) {
    digEl.innerHTML = renderCollectingState(digReporters, "美鸭梨挖掘热门材料排行");
  } else {
    const items = (summary.digTargets ?? []).slice(0, 10);
    const maxCount = Math.max(1, ...items.map((i) => Number(i.count) || 0));
    digEl.innerHTML = `<div class="rank-group"><p class="rank-subhead">按累计派遣挖掘次数排行（来自 ${fmtInt(digReporters)} 位搭配师）</p>${items
      .map(
        (item, idx) => `<div class="rank-row"><div class="rank-row-head"><span><b class="rank-idx">${idx + 1}</b>${esc(item.item)}</span><strong>${fmtInt(item.count)} 次 <small>· ${fmtInt(item.reporters)} 人</small></strong></div><div class="rank-bar"><span class="fill-mint" style="width:${(((Number(item.count) || 0) / maxCount) * 100).toFixed(1)}%"></span></div></div>`,
      )
      .join("")}</div>`;
  }
}

function renderAll(summary) {
  state.summary = summary;
  const model = computeModel(summary);
  if (!model.totalRolls) {
    statusEl.textContent = "等待首批五星闪光升满样本累计中…";
    return;
  }
  const timeText = formatUpdatedTime(summary.updatedAt);
  statusEl.textContent = `实时汇总已同步${timeText ? ` · ${timeText}` : ""} · 共 ${fmtInt(model.totalRolls)} 次满级样本`;
  root.querySelector("[data-stats-main]").hidden = false;
  renderKpis(summary, model);
  renderColorRates(model);
  renderSlots(summary, model);
  renderSets(model);
  renderCommunity(summary);
}

root?.addEventListener("click", (event) => {
  const modeBtn = event.target.closest("[data-rate-mode]");
  if (modeBtn && state.summary) {
    state.rateMode = modeBtn.dataset.rateMode;
    for (const btn of root.querySelectorAll("[data-rate-mode]")) {
      const active = btn === modeBtn;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
    }
    renderColorRates(computeModel(state.summary));
    return;
  }
  const realmBtn = event.target.closest("[data-realm]");
  if (realmBtn && state.summary) {
    state.realmFilter = realmBtn.dataset.realm;
    renderSets(computeModel(state.summary));
    return;
  }
  const sortBtn = event.target.closest("[data-set-sort]");
  if (sortBtn && state.summary) {
    state.setSort = sortBtn.dataset.setSort;
    for (const btn of root.querySelectorAll("[data-set-sort]")) {
      btn.classList.toggle("is-active", btn === sortBtn);
    }
    renderSets(computeModel(state.summary));
  }
});

fetch("https://stats.maanikki.cn/v1/summary")
  .then((response) => {
    if (!response.ok) throw new Error(String(response.status));
    return response.json();
  })
  .then(renderAll)
  .catch(() => {
    if (statusEl) statusEl.textContent = "统计数据暂时读取失败，请稍后刷新页面重试。";
  });
