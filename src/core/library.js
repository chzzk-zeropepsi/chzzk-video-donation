// 병기고(라이브러리) 데이터 모델 + 저장소

const STORAGE_KEY = "library";
const DELETED_KEY = "deleted";
const FOLDERS_KEY = "folders";

export const youtubeId = (url) => {
  const m = url.match(/(?:v=|\/shorts\/|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
};

export const clipId = (url) => {
  const m = url.match(/\/clips\/([\w-]+)/);
  return m ? m[1] : null;
};

export const itemKey = (type, url) =>
  type === "YOUTUBE" ? `yt:${youtubeId(url) || url}` : `clip:${clipId(url) || url}`;

export const parseTime = (str) => {
  const s = (str || "").trim();
  if (!s) return null;
  const parts = s.split(":").map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
};

export const fmtTime = (sec) => {
  if (sec == null) return "";
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

export const parseTags = (str) =>
  [...new Set((str || "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean))];

export const detectType = (url) => {
  if (/youtube\.com|youtu\.be/.test(url)) return "YOUTUBE";
  if (/chzzk\.naver\.com\/clips\//.test(url)) return "CHZZK_CLIP";
  return null;
};

export async function addManual(rawUrl, title, startStr, endStr) {
  const url = rawUrl.trim();
  const type = detectType(url);
  if (!type) throw new Error("유튜브 또는 치지직 클립 URL이 아니에요");
  const key = itemKey(type, url);
  const lib = await loadLibrary();
  if (lib[key]) throw new Error("이미 목록에 있어요");
  lib[key] = {
    key, type, url,
    title: title?.trim() || url,
    channelName: "",
    donatedAt: "",
    payAmount: null,
    tags: [], folder: "", memo: "",
    startSec: parseTime(startStr),
    endSec: parseTime(endStr),
    favorite: false, source: "manual",
    addedAt: new Date().toISOString(),
  };
  await saveLibrary(lib);
  const deleted = await loadDeleted();
  if (deleted[key]) {
    delete deleted[key];
    await chrome.storage.local.set({[DELETED_KEY]: deleted});
  }
  return lib[key];
}

export const fromHistory = (d) => ({
  key: itemKey(d.donationVideoType, d.donationVideoUrl),
  type: d.donationVideoType,
  url: d.donationVideoUrl,
  title: d.donationText || "(제목 없음)",
  channelName: d.channelName,
  donatedAt: d.purchaseDate,
  payAmount: d.payAmount,
  tags: [],
  folder: "",
  memo: "",
  startSec: null,
  endSec: null,
  favorite: false,
  source: "history",
});

export async function setFavorite(key, value) {
  const lib = await loadLibrary();
  if (!lib[key]) return;
  lib[key].favorite = value;
  await saveLibrary(lib);
}

export const copyUrl = (item) => {
  if (item.type !== "YOUTUBE") return item.url;
  const params = [];
  if (item.startSec) params.push(`start=${item.startSec}`);
  if (item.endSec) params.push(`end=${item.endSec}`);
  if (!params.length) return item.url;
  return `${item.url}${item.url.includes("?") ? "&" : "?"}${params.join("&")}`;
};

export async function loadLibrary() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return stored[STORAGE_KEY] || {};
}

export async function saveLibrary(lib) {
  await chrome.storage.local.set({[STORAGE_KEY]: lib});
}

export async function loadDeleted() {
  const stored = await chrome.storage.local.get(DELETED_KEY);
  return stored[DELETED_KEY] || {};
}

export async function removeItem(key) {
  const lib = await loadLibrary();
  delete lib[key];
  await saveLibrary(lib);
  const deleted = await loadDeleted();
  deleted[key] = true;
  await chrome.storage.local.set({[DELETED_KEY]: deleted});
}

export async function loadFolders() {
  const [stored, lib] = await Promise.all([chrome.storage.local.get(FOLDERS_KEY), loadLibrary()]);
  const used = Object.values(lib).map((it) => it.folder).filter(Boolean);
  return [...new Set([...(stored[FOLDERS_KEY] || []), ...used])].sort();
}

export async function addFolder(name) {
  const folder = name.trim();
  if (!folder) return;
  const stored = await chrome.storage.local.get(FOLDERS_KEY);
  const folders = new Set(stored[FOLDERS_KEY] || []);
  folders.add(folder);
  await chrome.storage.local.set({[FOLDERS_KEY]: [...folders]});
}

export const parentPath = (path) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");
export const isUnder = (path, ancestor) => path === ancestor || path.startsWith(`${ancestor}/`);

export const folderPaths = (folders) => {
  const set = new Set();
  for (const f of folders) {
    const parts = f.split("/");
    for (let i = 1; i <= parts.length; i++) set.add(parts.slice(0, i).join("/"));
  }
  return [...set].sort();
};

export async function deleteFolder(path) {
  const stored = await chrome.storage.local.get(FOLDERS_KEY);
  const kept = (stored[FOLDERS_KEY] || []).filter((f) => !isUnder(f, path));
  await chrome.storage.local.set({[FOLDERS_KEY]: kept});
  const parent = parentPath(path);
  const lib = await loadLibrary();
  for (const item of Object.values(lib)) if (isUnder(item.folder, path)) item.folder = parent;
  await saveLibrary(lib);
}

export async function setItemFolder(key, folder) {
  const lib = await loadLibrary();
  if (!lib[key]) return;
  lib[key].folder = folder;
  await saveLibrary(lib);
}

export async function setItemTags(key, tagsStr) {
  const lib = await loadLibrary();
  if (!lib[key]) return;
  lib[key].tags = parseTags(tagsStr);
  await saveLibrary(lib);
}

export async function updateItem(key, {title, url, folder, tagsStr, startStr, endStr}) {
  const lib = await loadLibrary();
  const item = lib[key];
  if (!item) return null;
  if (title != null) item.title = title.trim() || item.title;
  if (url != null && url.trim()) {
    const u = url.trim();
    const type = detectType(u);
    if (!type) throw new Error("유튜브 또는 치지직 클립 URL이 아니에요");
    item.url = u;
    item.type = type;
  }
  if (folder != null) item.folder = folder.trim();
  if (tagsStr != null) item.tags = parseTags(tagsStr);
  item.startSec = parseTime(startStr);
  item.endSec = parseTime(endStr);
  await saveLibrary(lib);
  return item;
}

export async function mergeFromHistory(videoDonations) {
  const lib = await loadLibrary();
  const deleted = await loadDeleted();
  let added = 0;
  for (const d of videoDonations) {
    const item = fromHistory(d);
    if (lib[item.key] || deleted[item.key]) continue;
    lib[item.key] = item;
    added++;
  }
  await saveLibrary(lib);
  return added;
}
