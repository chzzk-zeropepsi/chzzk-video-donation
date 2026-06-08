// 병기고(라이브러리) 데이터 모델 + 저장소

const STORAGE_KEY = "library";

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
  source: "history",
});

export const copyUrl = (item) => {
  if (item.type === "YOUTUBE" && item.startSec)
    return `${item.url}${item.url.includes("?") ? "&" : "?"}t=${item.startSec}`;
  return item.url;
};

export async function loadLibrary() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return stored[STORAGE_KEY] || {};
}

export async function saveLibrary(lib) {
  await chrome.storage.local.set({[STORAGE_KEY]: lib});
}

export async function mergeFromHistory(videoDonations) {
  const lib = await loadLibrary();
  let added = 0;
  for (const d of videoDonations) {
    const item = fromHistory(d);
    if (!lib[item.key]) {
      lib[item.key] = item;
      added++;
    }
  }
  await saveLibrary(lib);
  return added;
}
