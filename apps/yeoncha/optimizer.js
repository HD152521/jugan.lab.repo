// 연휴 탐색 알고리즘 — 순수 함수만 (브라우저/Node 공용)

const MAX_WINDOW_DAYS = 16;
const MIN_STREAK_DAYS = 4;

/**
 * @typedef {Object} Day
 * @property {string} iso       'YYYY-MM-DD'
 * @property {number} dow       요일 (0=일 ~ 6=토)
 * @property {?string} holiday  공휴일명 (없으면 null)
 * @property {boolean} isOff    쉬는 날(주말 또는 공휴일) 여부
 */

/**
 * @typedef {Object} Streak
 * @property {string} start        연휴 시작일 (ISO)
 * @property {string} end          연휴 종료일 (ISO)
 * @property {number} length       총 연휴 일수
 * @property {number} leave        사용 연차 수
 * @property {string[]} leaveDays  연차 쓰는 날 (ISO 배열)
 * @property {number} efficiency   연차 1개당 쉬는 일수 (length / leave)
 * @property {Day[]} cells         연휴 구간의 날짜 셀
 */

function toDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toISO(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * 탐색 구간의 날짜 배열 생성.
 * @param {Record<string, string>} holidays  iso -> 공휴일명
 * @param {string} startISO
 * @param {string} endISO
 * @returns {Day[]}
 */
function buildCalendar(holidays, startISO, endISO) {
  const days = [];
  const end = toDate(endISO);
  for (let d = toDate(startISO); d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const iso = toISO(d);
    const dow = d.getDay();
    const holiday = holidays[iso] || null;
    days.push({ iso, dow, holiday, isOff: dow === 0 || dow === 6 || holiday !== null });
  }
  return days;
}

/**
 * 연차 maxLeave개 이하로 만들 수 있는 모든 극대 연휴 구간 탐색.
 * 극대 구간: 양 끝 바깥 날이 근무일이어서 더 늘리려면 연차가 추가로 필요한 구간.
 * @param {Day[]} days
 * @param {number} maxLeave
 * @returns {Streak[]}
 */
function findStreaks(days, maxLeave) {
  const results = [];
  for (let i = 0; i < days.length; i++) {
    if (i > 0 && days[i - 1].isOff) continue; // 시작 극대성
    let leave = 0;
    const leaveDays = [];
    for (let j = i; j < days.length && j - i < MAX_WINDOW_DAYS; j++) {
      if (!days[j].isOff) {
        leave++;
        if (leave > maxLeave) break;
        leaveDays.push(days[j].iso);
      }
      const nextIsWork = j + 1 >= days.length || !days[j + 1].isOff;
      const len = j - i + 1;
      if (nextIsWork && leave >= 1 && len >= MIN_STREAK_DAYS) {
        results.push({
          start: days[i].iso,
          end: days[j].iso,
          length: len,
          leave,
          leaveDays: [...leaveDays],
          efficiency: len / leave,
          cells: days.slice(i, j + 1),
        });
      }
    }
  }
  return results;
}

// 두 연휴 구간의 날짜가 겹치는지 (ISO 문자열 비교로 충분)
function overlaps(a, b) {
  return a.start <= b.end && b.start <= a.end;
}

/**
 * 설날·추석 연휴가 포함된 구간인지. 명절은 실제로 연차 쓰기 어려워 별도 취급.
 * @param {Streak} streak
 * @returns {boolean}
 */
function isMyeongjeol(streak) {
  return streak.cells.some((c) => c.holiday && (c.holiday.includes('설날') || c.holiday.includes('추석')));
}

/**
 * 선택한 연차 개수에 대한 추천 목록.
 * 길이 내림차순(같으면 빠른 날짜)으로 정렬한 뒤, 날짜가 겹치는 구간은
 * 가장 긴 것 하나만 남긴다 — 같은 명절의 미세 변형이 목록을 도배하는 것 방지.
 * @param {Day[]} days
 * @param {number} leaveCount  정확히 사용할 연차 수
 * @param {number} limit       반환 최대 개수
 * @returns {Streak[]}
 */
function recommend(days, leaveCount, limit) {
  const sorted = findStreaks(days, leaveCount)
    .filter((s) => s.leave === leaveCount)
    .sort((a, b) => b.length - a.length || a.start.localeCompare(b.start));

  const chosen = [];
  for (const s of sorted) {
    if (chosen.some((c) => overlaps(c, s))) continue; // 이미 뽑은 연휴와 겹치면 스킵
    chosen.push(s);
    if (chosen.length >= limit) break;
  }
  return chosen;
}

/**
 * @typedef {Object} LeavePlan
 * @property {Streak[]} plan     시간순으로 정렬된, 연차를 쓸 효율 브리지들
 * @property {number} used       실제 사용한 연차 수
 * @property {number} leftover   남는 연차 수 (자유롭게 써도 되는 양)
 * @property {number} totalRest  브리지로 확보한 총 휴일 수
 * @property {number} bridges    선택된 브리지 개수
 */

/**
 * 남은 연차 예산을 "공휴일에 붙는 효율 높은 브리지"에만 배분하는 연간 플랜.
 * 예: 수·금이 공휴일이면 목요일 1개로 긴 연휴 — 이런 자리만 추천한다.
 * 붙일 만한 자리가 예산보다 적으면 남은 연차는 leftover(자유롭게)로 남긴다.
 * @param {Day[]} days
 * @param {number} budget                남은 연차 총 개수
 * @param {Object} [opts]
 * @param {boolean} [opts.excludeMyeongjeol=false]  설·추석 제외
 * @param {number}  [opts.minEfficiency=2]          연차 1개당 최소 휴일 수(효율 하한)
 * @param {number}  [opts.maxLeavePerBridge=2]      브리지 하나에 쓸 연차 상한
 * @param {?string} [opts.afterISO=null]            이 날짜 이후 연휴만 (지난 건 제외)
 * @param {string}  [opts.year='all']               'all' | '2026' | '2027'
 * @returns {LeavePlan}
 */
function planLeaves(days, budget, opts = {}) {
  const {
    excludeMyeongjeol = false,
    minEfficiency = 2,
    maxLeavePerBridge = 2,
    afterISO = null,
    year = 'all',
  } = opts;

  let cands = findStreaks(days, maxLeavePerBridge)
    .filter((s) => s.cells.some((c) => c.holiday)) // 공휴일에 붙는 것만
    .filter((s) => s.efficiency >= minEfficiency); // 효율 하한
  if (excludeMyeongjeol) cands = cands.filter((s) => !isMyeongjeol(s));
  if (afterISO) cands = cands.filter((s) => s.end >= afterISO);
  if (year !== 'all') cands = cands.filter((s) => s.start.startsWith(year) || s.end.startsWith(year));

  // 효율 높은 순 → 겹치는 클러스터마다 최고 하나만
  cands.sort((a, b) => b.efficiency - a.efficiency || b.length - a.length || a.start.localeCompare(b.start));
  const perCluster = [];
  for (const s of cands) {
    if (!perCluster.some((c) => overlaps(c, s))) perCluster.push(s);
  }

  // 예산 안에서 효율 높은 것부터 담기 (이미 서로 안 겹침)
  const chosen = [];
  let used = 0;
  for (const s of perCluster) {
    if (used + s.leave > budget) continue; // 예산 초과면 스킵하고 더 싼 다음 것 시도
    chosen.push(s);
    used += s.leave;
  }

  const plan = [...chosen].sort((a, b) => a.start.localeCompare(b.start));
  const totalRest = chosen.reduce((n, s) => n + s.length, 0);
  return { plan, used, leftover: Math.max(0, budget - used), totalRest, bridges: chosen.length };
}

if (typeof module !== 'undefined') {
  module.exports = {
    buildCalendar,
    findStreaks,
    recommend,
    isMyeongjeol,
    planLeaves,
    toDate,
    toISO,
    MIN_STREAK_DAYS,
    MAX_WINDOW_DAYS,
  };
}
