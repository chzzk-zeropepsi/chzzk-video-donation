import {
  loadLibrary, loadFolders, addFolder, deleteFolder,
  setItemFolder, setItemTags, updateItem, removeItem, addManual,
  fmtTime, folderPaths, isUnder,
} from "../core/library.js";

const $ = (sel) => document.querySelector(sel);
const url = (p) => chrome.runtime.getURL(p);
const NONE = "__none__";
const depthOf = (p) => p.split("/").length - 1;
const nameOf = (p) => p.split("/").pop();
const indent = (n) => "   ".repeat(n);
const paths = () => folderPaths(folders);

let items = [];
let folders = [];
let current = "";
const selected = new Set();

const applyTheme = (theme) => {
  document.documentElement.dataset.theme = theme
    || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
};
chrome.storage.local.get("theme").then(({theme}) => applyTheme(theme));
chrome.storage.onChanged.addListener((c) => { if (c.theme) applyTheme(c.theme.newValue); });

const sortKey = (it) => (it.addedAt || it.donatedAt || "").replace("T", " ");
const inFolder = (it) =>
  current === "" ? true : current === NONE ? !it.folder : isUnder(it.folder, current);
const matches = (it, q) =>
  [it.title, it.channelName, ...(it.tags || [])].join(" ").toLowerCase().includes(q);

async function reload() {
  const lib = await loadLibrary();
  items = Object.values(lib).sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
  folders = await loadFolders();
  renderNav();
  renderRows();
}

function count(folder) {
  return items.filter((it) =>
    folder === "" ? true : folder === NONE ? !it.folder : isUnder(it.folder, folder)).length;
}

function navItem(value, label, depth = 0) {
  const li = document.createElement("li");
  li.className = "nav-item" + (value === current ? " active" : "");
  li.style.paddingLeft = `${10 + depth * 14}px`;
  li.append(Object.assign(document.createElement("span"), {textContent: label}));
  li.append(Object.assign(document.createElement("span"), {className: "nav-count", textContent: count(value)}));
  li.addEventListener("click", () => { current = value; renderNav(); renderRows(); });
  if (value && value !== NONE) {
    const addSub = Object.assign(document.createElement("button"), {className: "nav-add", textContent: "＋", title: "하위 폴더 만들기"});
    addSub.addEventListener("click", async (e) => {
      e.stopPropagation();
      const name = (prompt(`'${value}' 안에 만들 하위 폴더 이름`) || "").trim();
      if (!name) return;
      await addFolder(`${value}/${name}`);
      current = `${value}/${name}`;
      reload();
    });
    li.append(addSub);
    const del = Object.assign(document.createElement("button"), {className: "nav-del", textContent: "✕", title: "폴더 삭제 (하위 포함)"});
    del.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm(`'${value}' 폴더를 삭제할까요? (하위 폴더 포함, 항목은 상위로 이동)`)) return;
      await deleteFolder(value);
      if (isUnder(current, value)) current = "";
      reload();
    });
    li.append(del);
  }
  return li;
}

function renderNav() {
  $("#folder-nav").replaceChildren(
    navItem("", "전체"),
    navItem(NONE, "미분류"),
    ...paths().map((f) => navItem(f, nameOf(f), depthOf(f))),
  );
  $("#folder-title").textContent =
    current === "" ? "전체" : current === NONE ? "미분류" : current;
  $("#new-folder-hint").textContent = current && current !== NONE
    ? `'${current}' 하위에 생성됩니다`
    : "최상위에 생성됩니다";
}

function folderOptions(selectedValue) {
  const opt = (v, l) => `<option value="${v}"${v === selectedValue ? " selected" : ""}>${l}</option>`;
  return [opt("", "미분류"), ...paths().map((f) => opt(f, indent(depthOf(f)) + nameOf(f)))].join("");
}

function folderSelect(item) {
  const sel = document.createElement("select");
  sel.className = "r-folder";
  sel.innerHTML = folderOptions(item.folder || "");
  sel.addEventListener("change", async () => {
    await setItemFolder(item.key, sel.value);
    item.folder = sel.value;
    reload();
  });
  return sel;
}

function row(item) {
  const node = $("#row-tpl").content.cloneNode(true);
  const logo = node.querySelector(".logo");
  logo.src = url(item.type === "YOUTUBE" ? "icons/youtube.svg" : "icons/chzzk.png");
  const title = node.querySelector(".r-title");
  title.value = item.title;
  title.addEventListener("change", () => updateItem(item.key, {title: title.value}));
  node.querySelector(".r-folder").replaceWith(folderSelect(item));
  const sel = node.querySelector(".r-sel");
  sel.checked = selected.has(item.key);
  sel.addEventListener("change", () => {
    sel.checked ? selected.add(item.key) : selected.delete(item.key);
    renderBulk();
  });
  const tags = node.querySelector(".r-tags");
  tags.value = (item.tags || []).join(", ");
  tags.addEventListener("change", async () => { await setItemTags(item.key, tags.value); reload(); });
  const trim = item.startSec == null && item.endSec == null
    ? "" : `✂ ${fmtTime(item.startSec) || "0:00"}~${fmtTime(item.endSec) || "끝"}`;
  node.querySelector(".r-trim").textContent = trim;
  node.querySelector(".r-del").addEventListener("click", async () => {
    if (!confirm("이 항목을 삭제할까요?")) return;
    await removeItem(item.key);
    reload();
  });
  return node;
}

function renderRows() {
  const q = $("#search").value.trim().toLowerCase();
  const shown = items.filter(inFolder).filter((it) => !q || matches(it, q));
  $("#rows").replaceChildren(...shown.map(row));
  $("#empty").hidden = shown.length > 0;
  $("#check-all").checked = shown.length > 0 && shown.every((it) => selected.has(it.key));
  renderBulk();
}

function renderBulk() {
  $("#bulk").hidden = selected.size === 0;
  $("#bulk-count").textContent = `${selected.size}개 선택`;
  $("#bulk-folder").innerHTML = folderOptions("");
}

async function bulkMove() {
  const target = $("#bulk-folder").value;
  for (const key of selected) await setItemFolder(key, target);
  selected.clear();
  reload();
}

$("#new-folder-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("#new-folder").value.trim();
  if (!name) return;
  const parent = current && current !== NONE ? current : "";
  await addFolder(parent ? `${parent}/${name}` : name);
  $("#new-folder").value = "";
  reload();
});

$("#add-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = $("#add-status");
  try {
    const folder = current && current !== NONE ? current : "";
    const item = await addManual(
      $("#add-url").value, $("#add-title").value,
      $("#add-start").value, $("#add-end").value);
    if (folder) await setItemFolder(item.key, folder);
    e.target.reset();
    status.textContent = `추가됨: ${item.title}`;
    reload();
  } catch (err) {
    status.textContent = err.message;
  }
});

$("#bulk-move").addEventListener("click", bulkMove);
$("#bulk-clear").addEventListener("click", () => { selected.clear(); renderRows(); });
$("#check-all").addEventListener("change", (e) => {
  const q = $("#search").value.trim().toLowerCase();
  const shown = items.filter(inFolder).filter((it) => !q || matches(it, q));
  for (const it of shown) e.target.checked ? selected.add(it.key) : selected.delete(it.key);
  renderRows();
});

$("#search").addEventListener("input", renderRows);
reload();
