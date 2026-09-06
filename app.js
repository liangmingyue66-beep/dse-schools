/* webv0.9 逻辑：分组筛选(直达/地区省→市联动/属性/分数高亮区) + 条件 chips
   路由：无锚=全局页，#school=校名=院校页(独立校内筛选)。 */
"use strict";

/* ---------- 1. 工具 ---------- */
const S2T = `广廣 东東 头頭 门門 关關 阳陽 远遠 云雲 庆慶 汉漢 语語 计計 机機 软軟 网網
络絡 会會 学學 电電 车車 术術 设設 临臨 医醫 药藥 护護 经經 济濟 国國 闻聞 艺藝
乐樂 体體 环環 实實 验驗 数數 据據 气氣 间間 质質 测測 试試 应應 统統 华華 侨僑
师師 范範 编編 邮郵 类類 级級 线線 组組 织織 规規 则則 标標 准準 评評 审審 认認
证證 专專 业業 传傳`.split(/\s+/);
const S2TMAP = {};
for (const p of S2T) if (p.length === 2) S2TMAP[p[0]] = p[1];
const T2SMAP = {};
for (const k in S2TMAP) T2SMAP[S2TMAP[k]] = k;
// 数据已是简体(data.js 由构建期转换)；norm 负责把用户输入也统一到简体(支持繁体输入)
const norm = s => String(s).split("").map(c => T2SMAP[c] || c).join("");
const simp = s => String(s).split("").map(c => T2SMAP[c] || c).join("");
const POINTS = { "5**": 7, "5*": 6, "5": 5, "4": 4, "3": 3, "2": 2, "1": 1 };
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- 2. 数据索引 ---------- */
const UNI_NAMES = DSE_DATA.unis.map(u => u["校名"]);
const PROGS_BY = {};
for (const p of DSE_DATA.progs) (PROGS_BY[p["院校"]] = PROGS_BY[p["院校"]] || []).push(p);
const totalOf = (a, b, c) => (a && b && c) ? POINTS[a] + POINTS[b] + POINTS[c] : null;
const fitScore = (p, total) => p["有2025/26收生数据"] === "是" && p["最低总分"] && Number(p["最低总分"]) <= total;
const uniCities = u => (u["城市"] || "").split("、").filter(Boolean);

/* ---------- 3. 初始化：省份/城市选项、校名 datalist ---------- */
const PROV_CITIES = {};                 // 省 -> [城市...]
DSE_DATA.unis.forEach(u => {
  (PROV_CITIES[u["省份"]] = PROV_CITIES[u["省份"]] || new Set());
  uniCities(u).forEach(c => PROV_CITIES[u["省份"]].add(c));
});
(() => {
  Object.keys(PROV_CITIES).sort().forEach(pv => {
    const op = document.createElement("option");
    op.value = pv; op.textContent = pv;
    $("prov").appendChild(op);
  });
  fillCityOptions($("prov").value);
  $("schoolNames").innerHTML = UNI_NAMES.map(n => `<option value="${esc(simp(n))}">`).join("");
})();
function fillCityOptions(prov) {
  const sel = $("city2");
  const old = sel.value;
  sel.innerHTML = '<option value="">不限城市</option>';
  let list;
  if (prov) {
    list = [...(PROV_CITIES[prov] || [])].sort((a, b) => simp(a).localeCompare(simp(b), "zh"));
    list.forEach(c => { const o = document.createElement("option"); o.value = c; o.textContent = simp(c); sel.appendChild(o); });
  } else {
    Object.keys(PROV_CITIES).sort().forEach(pv => {
      [...PROV_CITIES[pv]].sort((a, b) => simp(a).localeCompare(simp(b), "zh")).forEach(c => {
        const o = document.createElement("option");
        o.value = pv + "|" + c;                 // 无省时用"省|市"作值
        o.textContent = simp(pv) + "·" + simp(c);
        sel.appendChild(o);
      });
    });
  }
  if (old && [...sel.options].some(o => o.value === old)) sel.value = old; else sel.value = "";
}

/* ---------- 4. 路由 ---------- */
function hashSchool() {
  const m = /#school=(.+)$/.exec(location.hash);
  if (!m) return null;
  return UNI_NAMES.find(n => simp(n) === decodeURIComponent(m[1])) || null;
}
const goSchool = name => { location.hash = "#school=" + encodeURIComponent(simp(name)); };
const goHome = () => { location.hash = ""; };

/* ---------- 5. 当前条件 & chips ---------- */
let appliedScore = null;    // 已应用的总分（分数筛选开关）
function liveTotal() { return totalOf($("g_zh").value, $("g_en").value, $("g_ma").value); }

function selectedCond() {
  const c = { sn: $("sn").value.trim(), prov: $("prov").value, cityVal: $("city2").value,
              tier: $("tier").value, kw: $("kw").value.trim(), score: appliedScore };
  return c;
}
function renderChips() {
  const box = $("chips");
  const c = selectedCond();
  const chip = (txt, fn) => { const s = document.createElement("span"); s.className = "chip";
    s.textContent = txt + " ×"; s.title = "移除该条件"; s.onclick = fn; box.appendChild(s); };
  box.innerHTML = "";
  if (c.cityVal) chip(simpLabelCity(c.cityVal), () => { $("city2").value = ""; run(); });
  else if (c.prov) chip("省·" + simp(c.prov), () => { $("prov").value = ""; fillCityOptions(""); run(); });
  if (c.tier) chip(c.tier, () => { $("tier").value = ""; run(); });
  if (c.kw) chip("专业:" + c.kw, () => { $("kw").value = ""; run(); });
  if (c.score !== null) chip("分数≤" + c.score, () => clearScore());
  box.hidden = box.children.length === 0;
}
function simpLabelCity(v) {
  if (v.includes("|")) { const [p, c] = v.split("|"); return simp(p) + "·" + simp(c); }
  return simp(v);
}
function clearScore() {
  $("g_zh").value = $("g_en").value = $("g_ma").value = "";
  appliedScore = null;
  $("totalHint").textContent = "";
  run();
}

/* ---------- 6. 全局筛选 ---------- */
function run() {
  if (hashSchool()) return;
  const c = selectedCond();
  $("totalHint").textContent = appliedScore !== null
    ? `已应用：去年最低 ≤ ${appliedScore}`
    : (liveTotal() !== null ? "待应用，点「✔ 应用分数筛选」" : "");
  let city = null, cityProv = null;
  if (c.cityVal) {
    if (c.cityVal.includes("|")) { [cityProv, city] = c.cityVal.split("|"); }
    else city = c.cityVal;
  }
  const sn = norm(c.sn), kw = norm(c.kw);
  const schools = [];
  for (const u of DSE_DATA.unis) {
    if (c.prov && u["省份"] !== c.prov) continue;
    if (cityProv && (u["省份"] !== cityProv || !uniCities(u).includes(city))) continue;
    if (city && !cityProv && !uniCities(u).includes(city)) continue;
    if (c.tier && u["层次"] !== c.tier) continue;
    if (sn && !norm(simp(u["校名"])).includes(sn) && !u["校名"].includes(sn)) continue;
    let ps = PROGS_BY[u["校名"]] || [];
    if (kw && !ps.some(p => norm(p["专业名称"]).includes(kw) || norm(p["成绩区备注"]).includes(kw))) continue;
    if (appliedScore !== null) ps = ps.filter(p => fitScore(p, appliedScore));
    if (appliedScore !== null && ps.length === 0) continue;
    schools.push({ u, ps });
  }
  schools.sort((a, b) => simp(a.u["校名"]).localeCompare(simp(b.u["校名"]), "zh"));
  $("schools").innerHTML = "";
  for (const { u, ps } of schools) {
    const nAll = (PROGS_BY[u["校名"]] || []).length;
    const hasData = (PROGS_BY[u["校名"]] || []).filter(p => p["有2025/26收生数据"] === "是").length;
    const line = appliedScore !== null
      ? `符合"最低≤${appliedScore}"的专业 ${ps.length} / ${nAll}`
      : `共 ${nAll} 个专业（含去年成绩 ${hasData} 个）`;
    const li = document.createElement("li");
    li.innerHTML =
      `<div class="s-top"><span class="s-name">${esc(u["校名"])}</span>
       ${u["层次"] ? `<span class="tierchip">${esc(u["层次"])}</span>` : ""}
       <span class="s-city">${esc(simp(u["省份"]))}·${esc(simp(u["城市"]))}</span>
       <span class="s-tags">进入该校 →</span></div>
       <div class="s-meta">${line}${kw ? ` · 含"${esc($("kw").value)}"` : ""}</div>`;
    li.onclick = () => goSchool(u["校名"]);
    $("schools").appendChild(li);
  }
  $("stat").textContent =
    `${sn ? `校名含"${esc($("sn").value)}"；` : ""}` +
    `${c.cityVal ? `地区=${simpLabelCity(c.cityVal)}；` : (c.prov ? `省=${simp(c.prov)}；` : "")}` +
    `${c.tier ? `层次=${c.tier}；` : ""}` +
    `${kw ? `专业含"${esc($("kw").value)}"；` : ""}` +
    `${appliedScore !== null ? `分数≤${appliedScore}；` : ""}` +
    `共 ${schools.length} / ${DSE_DATA.unis.length} 所院校`;
  renderChips();
}

/* ---------- 7. 院校页 ---------- */
let dApplied = null;                 // 本校已应用的分数
const dLive = () => totalOf($("d_zh").value, $("d_en").value, $("d_ma").value);

function openSchool(name) {
  $("d_kw").value = "";
  $("d_zh").value = $("d_en").value = $("d_ma").value = "";
  dApplied = null;
  $("pg-schools").hidden = true;
  $("pg-school").hidden = false;
  const u = DSE_DATA.unis.find(x => x["校名"] === name) || {};
  $("detailTitle").innerHTML = esc(simp(name)) +
    (u["城市"] ? "（" + esc(simp(u["省份"])) + "·" + esc(simp(u["城市"])) + "）" : "") +
    (u["层次"] ? `　<span class="tierchip">${esc(u["层次"])}</span>` : "");
  // 书内页码放校名下、小字（供核对原书，不抢眼）
  const oldP = $("pagemark");
  if (oldP) oldP.remove();
  if (u["资料页"] && u["专业表页"]) {
    const pmark = document.createElement("p");
    pmark.id = "pagemark";
    pmark.className = "pagemark";
    pmark.textContent = `书内页码 P.${u["资料页"]}–${u["专业表页"]}（《指南2026/27》可对照原书核验）`;
    $("detailTitle").insertAdjacentElement("afterend", pmark);
  }
  const oldR = $("reqline");
  if (oldR) oldR.remove();
  const oldH = $("hintline");
  if (oldH) oldH.remove();
  const oldE = $("extraclaim");
  if (oldE) oldE.remove();
  let anchor = $("detailTitle");
  if (u["一般入学要求"]) {
    const rline = document.createElement("p");
    rline.id = "reqline";
    rline.className = "pagemark";
    rline.textContent = `一般入学要求：${u["一般入学要求"]}`;
    anchor.insertAdjacentElement("afterend", rline);
    anchor = rline;
  }
  const hline = document.createElement("p");
  hline.id = "hintline";
  hline.className = "pagemark";
  hline.textContent = "注：录取最低分可能含校长推荐计划/体艺类等特殊计划，请以院校官方简章为准。";
  anchor.insertAdjacentElement("afterend", hline);
  const eline = document.createElement("p");
  eline.id = "extraclaim";
  eline.className = "pagemark";
  eline.style.color = "#b06a00";
  eline.textContent = "额外科目要求信息可能有遗漏或错误，请以原书为准。";
  hline.insertAdjacentElement("afterend", eline);
  drawDetail();
}
function drawDetail() {
  const name = hashSchool();
  if (!name) return;
  const kw = norm($("d_kw").value.trim());
  $("d_total").textContent = dApplied !== null
    ? `已应用：最低 ≤ ${dApplied}`
    : (dLive() !== null ? "待应用，点「✔ 应用本校分数筛选」" : "");
  let ps = PROGS_BY[name] || [];
  if (kw) ps = ps.filter(p => norm(p["专业名称"]).includes(kw) || norm(p["成绩区备注"]).includes(kw));
  const before = ps.length;
  if (dApplied !== null) ps = ps.filter(p => fitScore(p, dApplied));
  const allCount = (PROGS_BY[name] || []).length;
  // 排序：有2025/26录取成绩的专业排前面，无成绩的排后面
  const yes = ps.filter(p => p["有2025/26收生数据"] === "是");
  const no = ps.filter(p => p["有2025/26收生数据"] !== "是");
  $("detailStat").textContent =
    `显示 ${ps.length} / ${allCount} 个专业` +
    (kw ? ` · 校内含"${esc($("d_kw").value)}"` : "") +
    (yes.length && no.length ? `（有成绩 ${yes.length} 在上，无成绩 ${no.length} 在下）` : "") +
    (dApplied !== null ? `；本步 ${before} 个中筛出` : " · 2025/26 实录");
  let html = "";
  if (yes.length) html += yes.map(progItem).join("");
  if (no.length) {
    html += `<li class="gh">—— 无 2025/26 录取成绩（${no.length}）——</li>` + no.map(progItem).join("");
  }
  $("progs").innerHTML = html || `<li style="color:#888">没有符合条件的专业，调整一下条件试试。</li>`;
}
function progItem(p) {
  const has = p["有2025/26收生数据"] === "是";
  const reqLines = [];
  if (p["专业要求(中英数公民)"]) reqLines.push(`专业要求（中/英/数/公民）：${esc(p["专业要求(中英数公民)"])}`);
  if (p["额外科目要求"]) reqLines.push(`额外要求：${esc(p["额外科目要求"])}`);
  const reqHtml = reqLines.length ? `<div class="r-extra">${reqLines.join("<br>")}</div>` : "";
  if (!has) return `<li><div class="r-top"><span class="r-name">${esc(p["专业名称"])}</span>
    <span class="r-dept">${esc(p["院系"] || "—")}</span><span class="badge no">无2025/26成绩</span></div>
    <div class="r-meta">${esc(p["成绩区备注"]) || "该专业无去年录取成绩记录"}</div>
    ${reqHtml}</li>`;
  // 录取最高 / 录取最低 两行都展示：原始三科等级 + 总分和（判断交给用户）
  const hi = p["最高总分"]
    ? `录取最高 <b>${esc(p["最高总分"])}</b>　中${esc(p["最高_中"])} · 英${esc(p["最高_英"])} · 数${esc(p["最高_数"])}`
    : "";
  let lo;
  if (p["最低总分"]) {
    lo = `录取最低 <b>${esc(p["最低总分"])}</b>　中${esc(p["最低_中"])} · 英${esc(p["最低_英"])} · 数${esc(p["最低_数"])}`;
  } else {
    lo = `录取最低 —（书中未单列最低；${p["2025/26录取人数"] === "1" ? "仅录取 1 人，最高即最低" : "可能未公布"}）`;
  }
  return `<li><div class="r-top"><span class="r-name">${esc(p["专业名称"])}</span>
    <span class="r-dept">${esc(p["院系"] || "—")}</span></div>
    ${reqHtml}
    <div class="r-score">${hi}<br>${lo}</div>
    <div class="r-meta">去年录取 ${esc(p["2025/26录取人数"]) || "—"} 人${p["最低院校志愿序号"] ? " · 最低志愿序号 " + esc(p["最低院校志愿序号"]) : ""}</div>
    ${p["成绩区备注"] ? `<span class="r-note">${esc(p["成绩区备注"])}</span>` : ""}</li>`;
}

/* ---------- 8. 事件 ---------- */

/* 使用指南弹窗 */
const guide = () => $("guideModal");
const showGuide = () => { guide().hidden = false; };
const hideGuide = () => { guide().hidden = true; };
document.addEventListener("DOMContentLoaded", showGuide);   // 进入网页直接弹出
window.addEventListener("hashchange", () => { /* 切页不弹 */ });
$("guideBtn").addEventListener("click", showGuide);          // 首页按钮随时重开
$("guideClose").addEventListener("click", hideGuide);
$("guideOk").addEventListener("click", hideGuide);
guide().addEventListener("click", e => { if (e.target === guide()) hideGuide(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") hideGuide(); });

function update() {
  const name = hashSchool();
  if (name) { openSchool(name); return; }
  $("pg-school").hidden = true;
  $("pg-schools").hidden = false;
  run();
}
window.addEventListener("hashchange", update);
$("go").onclick = () => { location.hash = ""; run(); };
$("reset").onclick = () => {
  if (hashSchool()) { $("d_kw").value = ""; $("d_zh").value = $("d_en").value = $("d_ma").value = ""; dApplied = null; drawDetail(); return; }
  $("sn").value = $("kw").value = ""; $("tier").value = ""; $("prov").value = "";
  fillCityOptions(""); $("city2").value = "";
  $("g_zh").value = $("g_en").value = $("g_ma").value = ""; appliedScore = null;
  run();
};
$("back").onclick = goHome;
$("applyScore").onclick = () => {
  const t = liveTotal();
  if (t === null) { alert("请先选择中英数三科成绩"); return; }
  appliedScore = t; run();
};
$("clearScore").onclick = clearScore;
$("prov").addEventListener("change", () => { fillCityOptions($("prov").value); run(); });
$("city2").addEventListener("change", run);
["tier", "kw"].forEach(id => $(id).addEventListener("change", run));
$("kw").addEventListener("input", run);
$("sn").addEventListener("input", () => { if (!hashSchool()) run(); });
$("sn").addEventListener("keydown", e => {
  if (e.key !== "Enter") return;
  const s = norm($("sn").value.trim());
  if (!s) return;
  const hit = UNI_NAMES.filter(n => norm(simp(n)).includes(s) || n.includes(s));
  if (hit.length === 1) goSchool(hit[0]);
});
["g_zh", "g_en", "g_ma"].forEach(id => $(id).addEventListener("change", () => {
  if (!hashSchool()) run();      // 只更新提示/待应用态
}));
$("d_kw").addEventListener("input", drawDetail);
["d_zh", "d_en", "d_ma"].forEach(id => $(id).addEventListener("change", () => { if (hashSchool()) drawDetail(); }));
$("d_apply").onclick = () => {
  const t = dLive();
  if (t === null) { alert("请先选择本校中英数三科成绩"); return; }
  dApplied = t; drawDetail();
};
$("d_clear").onclick = () => { $("d_zh").value = $("d_en").value = $("d_ma").value = ""; dApplied = null; drawDetail(); };
update();
