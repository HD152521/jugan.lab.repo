// 실험 목록 데이터 — 새 실험 추가 시 이 파일만 수정
// status: 'live'(공개됨) | 'building'(제작중) | 'planned'(예정)
// url: 배포 후 실제 경로로 교체 (null이면 링크 비활성)
const EXPERIMENTS = [
  {
    no: 1,
    title: '연차술사',
    desc: '연차 몇 개로 며칠까지 쉴 수 있을까? 공휴일에 연차를 붙여 최장 연휴를 계산',
    tag: '직장인',
    status: 'live',
    url: 'https://yeoncha.juganlab.com',
  },
  {
    no: 2,
    title: '축의금 계산기',
    desc: '관계·식대·참석 여부로 축의금 추천 + 낸 돈/받은 돈 장부',
    tag: '2030',
    status: 'building',
    url: null,
  },
  {
    no: 3,
    title: '참은 지 N일',
    desc: '전 연인에게 연락 안 한 날을 금연앱처럼 카운트',
    tag: '이별러',
    status: 'planned',
    url: null,
  },
  {
    no: 4,
    title: '이번 달 배달비 계산기',
    desc: '카드 내역 붙여넣으면 배달비만 합산, 치킨 N마리로 환산',
    tag: '자취생',
    status: 'planned',
    url: null,
  },
];

const TOTAL_SEASON = 12; // 시즌1 목표 실험 수
