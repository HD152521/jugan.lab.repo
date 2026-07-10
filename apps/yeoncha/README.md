# 연차술사 (yeoncha)

> weekly.ship **1주차** 프로젝트 · 배포 대상 앱

공휴일·대체공휴일에 연차를 붙여 **가장 긴 연휴**를 만들어주는 계산기.
"연차 N개로 며칠까지 쉴 수 있을까?"에 답한다. (2026 하반기 ~ 2027)

## 파일 구성

| 파일 | 역할 |
|------|------|
| `index.html` | 마크업 + 스타일. `holidays.js → optimizer.js → app.js` 순서로 로드 |
| `holidays.js` | 공휴일 데이터(`HOLIDAYS`)와 탐색 구간(`RANGE_START/END`) |
| `optimizer.js` | 연휴 탐색 순수 함수 (`buildCalendar`/`findStreaks`/`recommend`) — 브라우저·Node 공용 |
| `app.js` | UI 렌더링·연차/연도 선택·공유·ICS 내보내기·선택값 저장 |
| `optimizer.test.js` | 순수 함수 테스트 (Node 내장 러너, 무의존성) |

의존성 없는 정적 페이지. 빌드 단계 없음.

## 로컬 실행

```bash
# 정적 서버 아무거나
npx serve apps/yeoncha
# 또는 python -m http.server 로 apps/yeoncha 에서
```

`index.html`을 파일로 바로 열어도 동작한다(클래식 스크립트 전역 공유).

## 테스트

```bash
cd apps/yeoncha
node --test        # optimizer 순수 함수 검증 (8 케이스)
```

## 배포 (Vercel)

- 별도 Vercel 프로젝트로 연결하고 **Root Directory = `apps/yeoncha`** 지정
- 빌드 명령 없음 / 정적 서빙
- 배포 후 `apps/hub/experiments.js`의 1번 실험 `url`을 실제 링크로 교체

## 주요 기능

- 연차 1~5개 / 연도(전체·2026·2027) 선택
- **설·추석 빼고** 토글 — 실제로 쓰기 어려운 명절을 제외하고 "숨은 연휴"만 보기
- 겹치는 연휴는 가장 긴 것 하나로 합쳐 표시 (같은 명절 반복 방지)
- 연휴 길이순 추천 카드, BEST 배지, 연차 1개당 효율, D-day
- 공유하기(Web Share + 클립보드 폴백)
- 캘린더 등록 2가지: 🗓️ 구글 캘린더 원탭 추가(연휴 전체 블록) / 📅 ICS 파일(애플·삼성, 연차일별)
- 지난 연휴 자동 제외, 마지막 선택값 기억(localStorage)

## 데이터 주의

- 2026~2027 법정공휴일·대체공휴일 기준 (2026.7. 검증)
- 근로자의 날(5/1)은 법정공휴일이 아니라 제외
- 임시공휴일은 발표 시 `holidays.js`에 반영
