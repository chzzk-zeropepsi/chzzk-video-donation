# 치지직 영도 서포터

치지직 영상도네(영도)용 클립 병기고. 내 후원내역에서 영도 영상을 자동으로 모으고, 검색해서 바로 링크를 복사한다.

## 설치 (개발자 모드)
1. 크로미움 브라우저에서 `chrome://extensions` 열기
2. 우측 상단 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램을 로드** → 이 폴더 선택

## 사용
1. 치지직에 **로그인**된 상태여야 한다 (후원내역 API가 본인 인증 쿠키를 사용).
2. 확장 아이콘 클릭 → **동기화** → 과거 영도(YOUTUBE / CHZZK_CLIP) 영상이 목록에 채워진다.
3. 검색창에 제목·채널·태그 입력 → **복사** 버튼으로 링크 클립보드 복사 → 후원창에 붙여넣기.

## 데이터 소스
`GET https://api.chzzk.naver.com/commercial/v1/product/purchase/history?page=&size=&searchYear=`
- `donationType == "VIDEO"` 만 추출
- `donationVideoType`: `YOUTUBE` | `CHZZK_CLIP`
- `donationText` = 영상 제목, `donationVideoUrl` = 링크
- 치지직은 trim(시작/길이)을 저장하지 않으므로 그 정보는 이 도구에서 따로 관리(예정).

## 로드맵
- [x] 영도 내역 자동 수집 + 목록 + 검색 + 복사 (MVP)
- [ ] 태그 / 폴더 분류 UI
- [ ] trim(유튜브 시작지점) 편집 및 복사 시 반영
- [ ] 신규 영상 수동 추가
- [ ] 계정 동기화(서버)
