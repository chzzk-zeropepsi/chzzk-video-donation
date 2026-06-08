# 치지직 영도 서포터 — 설계 및 실행계획

## 설계
치지직 영상도네(영도)용 개인 클립 병기고. 핵심 아이디어:
- 사용자의 **후원내역 API**(`purchase/history`)에서 `donationType=="VIDEO"`를 자동 수집 → 수동 입력 없이 병기고가 채워진다.
- 치지직이 버리는 **trim(시작/길이)** 와 사용자 분류(**태그·폴더**)를 이 도구가 보존한다.
- 영도할 때 검색 → 복사 → 후원창에 붙여넣기.

폼팩터: 크로미움 확장(MV3). 후원내역 API가 로그인 쿠키를 요구하므로 확장이 적합.
저장: 우선 `chrome.storage.local`, 동기화는 후속.

## 디렉터리 구조
```
manifest.json
src/api/chzzk.js      치지직 API 연동
src/core/library.js   데이터 모델 + 저장소
src/popup/            팝업 UI (html/css/js)
icons/                아이콘
```

## 실행계획
- [x] 프로젝트 골격 + 디렉터리 구조
- [x] 후원내역 자동 수집(연도×페이지 순회, VIDEO 필터)
- [x] 목록 + 검색 + 복사 (MVP)
- [x] 신규 영상 수동 추가 (유튜브/치지직 클립), 시작/종료 구간 입력
- [x] 인라인 수정 (URL/제목/구간), 복사 시 `start`/`end` 반영
- [x] 즐겨찾기 (상단 고정 표시)
- [x] 삭제 (재동기화 내성 - 차단 목록)
- [x] 후원 팝업 옆 영도 패널 (콘텐츠 스크립트, 반응형)
- [x] 치지직 테마(color-scheme) 연동 (패널/팝업)
- [x] 태그 / 폴더 분류 + 필터 (중첩 폴더 지원)
- [x] 전용 관리 페이지 (폴더 트리, 일괄 이동, 영도 추가)
- [x] 아이콘(변기) + 이름 "영도 저장소"
- [ ] **(검증)** 확장 팝업에서 API 호출 시 인증/Origin 문제 없는지 실제 로드 테스트
- [ ] 계정 동기화(서버) — 검토

## 데이터 모델 (실데이터 검증 완료)
VIDEO 레코드: `donationVideoType` = `YOUTUBE` | `CHZZK_CLIP`,
`donationVideoUrl`(링크), `donationText`(제목), `channelName`, `purchaseDate`, `payAmount`.
`donationVideoDescription`은 항상 빈 값 → trim 정보 없음(도구에서 별도 관리).
