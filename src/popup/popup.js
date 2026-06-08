import {fetchAllVideos} from "../api/chzzk.js";
import {loadLibrary, mergeFromHistory, copyUrl, setFavorite, addManual, removeItem, updateItem, fmtTime} from "../core/library.js";

const trimLabel = (item) => {
  if (item.startSec == null && item.endSec == null) return "";
  return ` · ✂ ${fmtTime(item.startSec) || "0:00"}~${fmtTime(item.endSec) || "끝"}`;
};

const applyTheme = (theme) => {
  document.documentElement.dataset.theme = theme
    || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
};
chrome.storage.local.get("theme").then(({theme}) => applyTheme(theme));
chrome.storage.onChanged.addListener((changes) => {
  if (changes.theme) applyTheme(changes.theme.newValue);
});

const $ = (sel) => document.querySelector(sel);
const list = $("#list");
const status = $("#status");
const tpl = $("#item-tpl");
const editTpl = $("#edit-tpl");
const folderFilter = $("#folder-filter");

let items = [];
let editingKey = null;
let currentFolder = "";

const matches = (item, q) =>
  [item.title, item.channelName, ...item.tags].join(" ").toLowerCase().includes(q);

const folderMatch = (item) =>
  currentFolder === "" ? true
    : currentFolder === "__none__" ? !item.folder
    : item.folder === currentFolder;

function setFolder(folder) {
  currentFolder = folder;
  folderFilter.value = folder;
  render($("#search").value);
}

function chip(text, onClick) {
  const el = document.createElement("button");
  el.className = "chip";
  el.textContent = text;
  el.addEventListener("click", onClick);
  return el;
}

const sectionHeader = (text) => {
  const li = document.createElement("li");
  li.className = "section";
  li.textContent = text;
  return li;
};

function render(query = "") {
  const q = query.trim().toLowerCase();
  let shown = items.filter(folderMatch);
  if (q) shown = shown.filter((it) => matches(it, q));
  const favs = shown.filter((it) => it.favorite);
  const rest = shown.filter((it) => !it.favorite);
  const nodes = [];
  if (favs.length) {
    nodes.push(sectionHeader("★ 즐겨찾기"), ...favs.map(toElement));
    if (rest.length) nodes.push(sectionHeader("전체"));
  }
  nodes.push(...rest.map(toElement));
  list.replaceChildren(...nodes);
  if (!items.length) status.textContent = "비어있어요. [동기화]로 영도 내역을 불러오세요.";
  else status.textContent = `${shown.length} / ${items.length}개`;
}

function toElement(item) {
  if (item.key === editingKey) return toEditElement(item);
  const node = tpl.content.cloneNode(true);
  const logo = node.querySelector(".logo");
  const isYt = item.type === "YOUTUBE";
  logo.src = isYt ? "../../icons/youtube.svg" : "../../icons/chzzk.png";
  logo.alt = isYt ? "YouTube" : "치지직 클립";
  node.querySelector(".title").textContent = item.title;
  const base = item.source === "manual"
    ? "직접 추가"
    : `${item.channelName} · ${item.donatedAt?.slice(0, 10) || ""}`;
  node.querySelector(".sub").textContent = base + trimLabel(item);
  const chips = node.querySelector(".chips");
  if (item.folder) chips.append(chip(`📁 ${item.folder}`, () => setFolder(item.folder)));
  for (const tag of item.tags) {
    chips.append(chip(`#${tag}`, () => { $("#search").value = tag; render(tag); }));
  }
  const fav = node.querySelector(".fav");
  fav.textContent = item.favorite ? "★" : "☆";
  fav.classList.toggle("on", item.favorite);
  fav.addEventListener("click", () => onToggleFav(item));
  const copy = node.querySelector(".copy");
  copy.addEventListener("click", () => onCopy(item, copy));
  node.querySelector(".del").addEventListener("click", () => onDelete(item));
  node.querySelector(".edit").addEventListener("click", () => {
    editingKey = item.key;
    render($("#search").value);
  });
  return node;
}

function toEditElement(item) {
  const node = editTpl.content.cloneNode(true);
  const urlEl = node.querySelector(".e-url");
  const titleEl = node.querySelector(".e-title");
  const startEl = node.querySelector(".e-start");
  const endEl = node.querySelector(".e-end");
  urlEl.value = item.url;
  titleEl.value = item.title;
  startEl.value = fmtTime(item.startSec);
  endEl.value = fmtTime(item.endSec);
  const close = () => { editingKey = null; render($("#search").value); };
  node.querySelector(".e-save").addEventListener("click", async () => {
    try {
      const updated = await updateItem(item.key, {
        url: urlEl.value, title: titleEl.value,
        startStr: startEl.value, endStr: endEl.value});
      Object.assign(item, updated);
      close();
    } catch (err) {
      status.textContent = err.message;
    }
  });
  node.querySelector(".e-cancel").addEventListener("click", close);
  return node;
}

async function onDelete(item) {
  await removeItem(item.key);
  items = items.filter((it) => it.key !== item.key);
  render($("#search").value);
}

async function onToggleFav(item) {
  item.favorite = !item.favorite;
  await setFavorite(item.key, item.favorite);
  render($("#search").value);
}

async function onCopy(item, btn) {
  await navigator.clipboard.writeText(copyUrl(item));
  btn.textContent = "복사됨";
  btn.classList.add("done");
  setTimeout(() => { btn.textContent = "복사"; btn.classList.remove("done"); }, 1200);
}

function populateFolders() {
  const folders = [...new Set(items.map((it) => it.folder).filter(Boolean))].sort();
  const opt = (value, label) => `<option value="${value}">${label}</option>`;
  folderFilter.innerHTML = [
    opt("", "전체 폴더"),
    opt("__none__", "미분류"),
    ...folders.map((f) => opt(f, f)),
  ].join("");
  if (![...folderFilter.options].some((o) => o.value === currentFolder)) currentFolder = "";
  folderFilter.value = currentFolder;
  $("#folder-list").innerHTML = folders.map((f) => `<option value="${f}">`).join("");
}

async function refresh(query) {
  const lib = await loadLibrary();
  const sortKey = (it) => (it.addedAt || it.donatedAt || "").replace("T", " ");
  items = Object.values(lib).sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
  populateFolders();
  render(query ?? $("#search").value);
}

async function sync() {
  status.textContent = "후원내역 불러오는 중…";
  try {
    const added = await mergeFromHistory(await fetchAllVideos());
    await refresh();
    status.textContent = added ? `${added}개 새로 추가됨` : "새로 추가된 항목 없음";
  } catch (e) {
    status.textContent = `실패: ${e.message} (치지직 로그인 상태인지 확인)`;
  }
}

const addForm = $("#add-form");

$("#add-toggle").addEventListener("click", () => {
  addForm.hidden = !addForm.hidden;
  if (!addForm.hidden) $("#add-url").focus();
});

addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const item = await addManual(
      $("#add-url").value, $("#add-title").value,
      $("#add-start").value, $("#add-end").value);
    addForm.reset();
    addForm.hidden = true;
    await refresh("");
    $("#search").value = "";
    status.textContent = `추가됨: ${item.title}`;
  } catch (err) {
    status.textContent = err.message;
  }
});

$("#search").addEventListener("input", (e) => render(e.target.value));
folderFilter.addEventListener("change", () => setFolder(folderFilter.value));
$("#sync").addEventListener("click", sync);
$("#manage").addEventListener("click", () => {
  chrome.tabs.create({url: chrome.runtime.getURL("src/manage/manage.html")});
});
refresh();
