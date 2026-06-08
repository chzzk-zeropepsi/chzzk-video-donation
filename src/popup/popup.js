import {fetchAllVideos} from "../api/chzzk.js";
import {loadLibrary, mergeFromHistory, copyUrl} from "../core/library.js";

const $ = (sel) => document.querySelector(sel);
const list = $("#list");
const status = $("#status");
const tpl = $("#item-tpl");

let items = [];

const matches = (item, q) =>
  [item.title, item.channelName, ...item.tags].join(" ").toLowerCase().includes(q);

function render(query = "") {
  const q = query.trim().toLowerCase();
  const shown = q ? items.filter((it) => matches(it, q)) : items;
  list.replaceChildren(...shown.map(toElement));
  if (!items.length) status.textContent = "비어있어요. [동기화]로 영도 내역을 불러오세요.";
  else status.textContent = `${shown.length} / ${items.length}개`;
}

function toElement(item) {
  const node = tpl.content.cloneNode(true);
  const badge = node.querySelector(".badge");
  badge.textContent = item.type === "YOUTUBE" ? "YT" : "클립";
  badge.classList.add(item.type);
  node.querySelector(".title").textContent = item.title;
  node.querySelector(".sub").textContent = `${item.channelName} · ${item.donatedAt?.slice(0, 10) || ""}`;
  const copy = node.querySelector(".copy");
  copy.addEventListener("click", () => onCopy(item, copy));
  return node;
}

async function onCopy(item, btn) {
  await navigator.clipboard.writeText(copyUrl(item));
  btn.textContent = "복사됨";
  btn.classList.add("done");
  setTimeout(() => { btn.textContent = "복사"; btn.classList.remove("done"); }, 1200);
}

async function refresh(query) {
  const lib = await loadLibrary();
  items = Object.values(lib).sort((a, b) => (b.donatedAt || "").localeCompare(a.donatedAt || ""));
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

$("#search").addEventListener("input", (e) => render(e.target.value));
$("#sync").addEventListener("click", sync);
refresh();
