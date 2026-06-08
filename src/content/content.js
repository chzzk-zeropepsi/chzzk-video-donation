// 치지직 후원 팝업이 뜨면 그 옆에 영도 리스트 패널을 주입한다.

const PANEL_ID = "yds-panel";
const DIALOG_SEL = '[class*="live_chatting_popup_donation_layer__"]';
const url = (p) => chrome.runtime.getURL(p);

let libMod = null;
const lib = async () => (libMod ??= await import(url("src/core/library.js")));

const findDialog = () => document.querySelector(DIALOG_SEL);

const bgLuminance = (color) => {
  const n = (color.match(/[\d.]+/g) || []).map(Number);
  if (n.length < 3 || n[3] === 0) return null;
  return 0.2126 * n[0] + 0.7152 * n[1] + 0.0722 * n[2];
};

function detectTheme() {
  const scheme = getComputedStyle(document.documentElement).colorScheme;
  if (scheme.includes("dark") && !scheme.includes("light")) return "dark";
  if (scheme.includes("light") && !scheme.includes("dark")) return "light";
  for (const node of [document.body, document.documentElement]) {
    const lum = node && bgLuminance(getComputedStyle(node).backgroundColor);
    if (lum != null) return lum < 128 ? "dark" : "light";
  }
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme() {
  const theme = detectTheme();
  document.getElementById(PANEL_ID)?.setAttribute("data-theme", theme);
  chrome.storage.local.set({theme});
}
const sortKey = (it) => (it.addedAt || it.donatedAt || "").replace("T", " ");

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  for (const c of children) node.append(c);
  return node;
}

async function loadItems() {
  const m = await lib();
  const library = await m.loadLibrary();
  return Object.values(library).sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
}

function itemRow(item, copyUrl, fmtTime) {
  const logo = el("img", {
    className: "yds-logo",
    src: url(item.type === "YOUTUBE" ? "icons/youtube.svg" : "icons/chzzk.png"),
    alt: "",
  });
  const trim = item.startSec == null && item.endSec == null
    ? ""
    : ` · ✂ ${fmtTime(item.startSec) || "0:00"}~${fmtTime(item.endSec) || "끝"}`;
  const folder = item.folder ? `📁 ${item.folder} · ` : "";
  const sub = folder + (item.source === "manual" ? "직접 추가" : item.channelName || "") + trim;
  const meta = el("div", {className: "yds-meta"}, [
    el("div", {className: "yds-title", textContent: item.title}),
    el("div", {className: "yds-sub", textContent: sub}),
  ]);
  const copy = el("button", {className: "yds-copy", textContent: "복사"});
  copy.addEventListener("click", async () => {
    await navigator.clipboard.writeText(copyUrl(item));
    copy.textContent = "복사됨";
    copy.classList.add("done");
    setTimeout(() => { copy.textContent = "복사"; copy.classList.remove("done"); }, 1200);
  });
  if (item.favorite) logo.classList.add("yds-fav");
  return el("li", {className: "yds-item"}, [logo, meta, copy]);
}

const NONE = "__none__";

async function buildPanel() {
  const m = await lib();
  const items = await loadItems();
  const folders = m.folderPaths(await m.loadFolders());
  let folder = "";
  const list = el("ul", {className: "yds-list"});
  const matches = (it, q) =>
    [it.title, it.channelName, ...(it.tags || [])].join(" ").toLowerCase().includes(q);
  const inFolder = (it) =>
    folder === "" ? true : folder === NONE ? !it.folder : m.isUnder(it.folder, folder);
  const render = (q = "") => {
    const base = items.filter(inFolder);
    const favs = base.filter((it) => it.favorite);
    const shown = q ? base.filter((it) => matches(it, q)) : [...favs, ...base.filter((it) => !it.favorite)];
    list.replaceChildren(...shown.map((it) => itemRow(it, m.copyUrl, m.fmtTime)));
  };
  const search = el("input", {className: "yds-search", type: "search", placeholder: "영도 검색"});
  search.addEventListener("input", () => render(search.value.trim().toLowerCase()));
  const folderSel = el("select", {className: "yds-folder"});
  const opt = (v, l) => Object.assign(document.createElement("option"), {value: v, textContent: l});
  const indent = (p) => "　".repeat(p.split("/").length - 1) + p.split("/").pop();
  folderSel.append(opt("", "전체 폴더"), opt(NONE, "미분류"), ...folders.map((f) => opt(f, indent(f))));
  folderSel.addEventListener("change", () => { folder = folderSel.value; render(search.value.trim().toLowerCase()); });
  const header = el("div", {className: "yds-header"}, [
    el("strong", {className: "yds-brand", textContent: "영도 리스트"}),
    folderSel,
    search,
  ]);
  render();
  return el("div", {id: PANEL_ID, className: "yds-panel"}, [header, list]);
}

function position(panel, dialog) {
  const r = dialog.getBoundingClientRect();
  const w = panel.offsetWidth || 300;
  const gap = 12;
  let left = r.left - w - gap;
  if (left < 8) left = r.right + gap;
  if (left + w > window.innerWidth - 8) left = Math.max(8, window.innerWidth - w - 8);
  panel.style.top = `${Math.max(8, r.top)}px`;
  panel.style.left = `${left}px`;
  panel.style.maxHeight = `${Math.min(r.height, window.innerHeight - 16)}px`;
}

async function inject(dialog) {
  if (document.getElementById(PANEL_ID)) return;
  const panel = await buildPanel();
  panel.setAttribute("data-theme", detectTheme());
  document.body.append(panel);
  position(panel, dialog);
}

const sync = () => {
  const dialog = findDialog();
  const panel = document.getElementById(PANEL_ID);
  if (dialog && !panel) inject(dialog);
  else if (!dialog && panel) panel.remove();
  else if (dialog && panel) position(panel, dialog);
};

new MutationObserver(sync).observe(document.body, {childList: true, subtree: true});
window.addEventListener("resize", sync);

new MutationObserver(applyTheme).observe(document.documentElement, {
  attributes: true, attributeFilter: ["class", "data-theme", "style"],
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
applyTheme();
