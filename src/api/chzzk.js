// 치지직 후원내역 API 연동 모듈

export const HISTORY_URL = "https://api.chzzk.naver.com/commercial/v1/product/purchase/history";
export const CHZZK_LAUNCH_YEAR = 2023;

export async function fetchHistoryPage(year, page, size = 50) {
  const url = `${HISTORY_URL}?page=${page}&size=${size}&searchYear=${year}`;
  const res = await fetch(url, {credentials: "include"});
  if (!res.ok) throw new Error(`history ${year} p${page} -> HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== 200) throw new Error(`history ${year} p${page} -> code ${json.code}`);
  return json.content;
}

export async function fetchYearVideos(year) {
  const first = await fetchHistoryPage(year, 0);
  const items = [...first.data];
  for (let page = 1; page < first.totalPages; page++) {
    const content = await fetchHistoryPage(year, page);
    items.push(...content.data);
  }
  return items.filter(isVideoDonation);
}

export async function fetchAllVideos() {
  const thisYear = new Date().getFullYear();
  const years = [];
  for (let y = thisYear; y >= CHZZK_LAUNCH_YEAR; y--) years.push(y);
  const perYear = await Promise.all(years.map(fetchYearVideos));
  return perYear.flat();
}

export const isVideoDonation = (d) => d.donationType === "VIDEO" && !!d.donationVideoUrl;
