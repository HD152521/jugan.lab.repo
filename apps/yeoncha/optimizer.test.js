// 연휴 탐색 순수 함수 테스트 — 의존성 없음, Node 내장 러너 사용
//   실행:  node --test
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { HOLIDAYS, RANGE_START, RANGE_END } = require('./holidays.js');
const { buildCalendar, findStreaks, recommend, isMyeongjeol, planLeaves, MIN_STREAK_DAYS } = require('./optimizer.js');

const calendar = buildCalendar(HOLIDAYS, RANGE_START, RANGE_END);
const byIso = new Map(calendar.map((d) => [d.iso, d]));

test('buildCalendar: 구간의 모든 날을 빠짐없이 만든다', () => {
  // Arrange / Act
  const first = calendar[0];
  const last = calendar[calendar.length - 1];

  // Assert
  assert.equal(first.iso, RANGE_START);
  assert.equal(last.iso, RANGE_END);
  // 2026-07-08 ~ 2027-12-31 = 542일
  assert.equal(calendar.length, 542);
});

test('buildCalendar: 주말과 공휴일을 isOff로 표시한다', () => {
  const sunday = byIso.get('2026-07-12'); // 일요일
  const saturday = byIso.get('2026-07-11'); // 토요일
  const holiday = byIso.get('2026-08-15'); // 광복절
  const workday = byIso.get('2026-07-08'); // 수요일 근무일

  assert.equal(sunday.isOff, true);
  assert.equal(saturday.isOff, true);
  assert.equal(holiday.isOff, true);
  assert.equal(holiday.holiday, '광복절');
  assert.equal(workday.isOff, false);
});

test('recommend: 정확히 요청한 연차 수만 사용한다', () => {
  for (const leaveCount of [1, 2, 3]) {
    const recs = recommend(calendar, leaveCount, 10);
    assert.ok(recs.length > 0, `연차 ${leaveCount}개 추천이 있어야 한다`);
    for (const s of recs) {
      assert.equal(s.leave, leaveCount);
      assert.equal(s.leaveDays.length, leaveCount);
    }
  }
});

test('recommend: 연차 쓰는 날은 모두 실제 근무일이다', () => {
  const recs = recommend(calendar, 2, 20);
  for (const s of recs) {
    for (const iso of s.leaveDays) {
      const day = byIso.get(iso);
      assert.ok(day, `${iso}는 달력에 존재해야 한다`);
      assert.equal(day.isOff, false, `${iso}는 근무일이어야 연차로 쓸 수 있다`);
    }
  }
});

test('recommend: efficiency = length / leave, 최소 연휴 길이 보장', () => {
  const recs = recommend(calendar, 2, 20);
  for (const s of recs) {
    assert.equal(s.efficiency, s.length / s.leave);
    assert.equal(s.cells.length, s.length);
    assert.ok(s.length >= MIN_STREAK_DAYS);
  }
});

test('recommend: 구간이 극대적이다 (양 끝 바깥은 근무일 또는 범위 경계)', () => {
  const recs = recommend(calendar, 2, 20);
  const idxOf = new Map(calendar.map((d, i) => [d.iso, i]));
  for (const s of recs) {
    const startIdx = idxOf.get(s.start);
    const endIdx = idxOf.get(s.end);
    const before = calendar[startIdx - 1];
    const after = calendar[endIdx + 1];
    if (before) assert.equal(before.isOff, false, '시작 앞날은 근무일이어야 극대');
    if (after) assert.equal(after.isOff, false, '종료 뒷날은 근무일이어야 극대');
  }
});

test('recommend: 길이 내림차순, 동률이면 빠른 날짜 우선으로 정렬된다', () => {
  const recs = recommend(calendar, 3, 10);
  for (let i = 1; i < recs.length; i++) {
    const prev = recs[i - 1];
    const cur = recs[i];
    assert.ok(
      prev.length > cur.length || (prev.length === cur.length && prev.start <= cur.start),
      '정렬 순서가 어긋났다'
    );
  }
});

test('recommend: 추천 구간끼리 날짜가 겹치지 않는다 (같은 명절 중복 제거)', () => {
  for (const leaveCount of [1, 2, 3]) {
    const recs = recommend(calendar, leaveCount, 10);
    for (let i = 0; i < recs.length; i++) {
      for (let j = i + 1; j < recs.length; j++) {
        const a = recs[i];
        const b = recs[j];
        const overlap = a.start <= b.end && b.start <= a.end;
        assert.equal(overlap, false, `${a.start}~${a.end} 와 ${b.start}~${b.end} 가 겹침`);
      }
    }
  }
});

test('recommend: 서로 다른 명절/공휴일 구간이 골고루 나온다 (추석만 반복 아님)', () => {
  // 연차 2개 전체 추천에서 추석 외 다른 공휴일 구간도 최소 1개 포함
  const recs = recommend(calendar, 2, 10);
  const nonMyeongjeol = recs.filter((s) => !isMyeongjeol(s));
  assert.ok(nonMyeongjeol.length >= 1, '명절이 아닌 연휴도 추천에 있어야 한다');
});

test('isMyeongjeol: 추석·설날 구간만 true', () => {
  const recs = recommend(calendar, 1, 20);
  const chuseok = recs.find((s) => s.cells.some((c) => c.holiday && c.holiday.includes('추석')));
  const hangeul = recs.find((s) => s.cells.some((c) => c.holiday === '한글날'));
  if (chuseok) assert.equal(isMyeongjeol(chuseok), true);
  if (hangeul && !hangeul.cells.some((c) => c.holiday && /설날|추석/.test(c.holiday))) {
    assert.equal(isMyeongjeol(hangeul), false);
  }
});

test('planLeaves: 예산을 넘지 않고 leftover = 예산 - 사용', () => {
  for (const budget of [3, 10, 20, 40]) {
    const r = planLeaves(calendar, budget, { afterISO: RANGE_START });
    assert.ok(r.used <= budget, `사용(${r.used})이 예산(${budget})을 넘음`);
    assert.equal(r.leftover, budget - r.used);
    assert.equal(r.bridges, r.plan.length);
  }
});

test('planLeaves: 모든 브리지는 공휴일에 붙고, 효율 하한 이상, 시간순 정렬', () => {
  const r = planLeaves(calendar, 20, { afterISO: RANGE_START });
  assert.ok(r.plan.length > 0);
  for (const s of r.plan) {
    assert.ok(s.cells.some((c) => c.holiday), '공휴일에 붙어야 한다');
    assert.ok(s.efficiency >= 2, '효율 하한(2) 이상이어야 한다');
  }
  for (let i = 1; i < r.plan.length; i++) {
    assert.ok(r.plan[i - 1].start <= r.plan[i].start, '시간순이어야 한다');
  }
});

test('planLeaves: 선택된 브리지끼리 날짜가 겹치지 않는다', () => {
  const r = planLeaves(calendar, 40, { afterISO: RANGE_START });
  for (let i = 0; i < r.plan.length; i++) {
    for (let j = i + 1; j < r.plan.length; j++) {
      const a = r.plan[i];
      const b = r.plan[j];
      assert.equal(a.start <= b.end && b.start <= a.end, false);
    }
  }
});

test('planLeaves: 예산이 남아돌아도 붙일 자리 이상은 안 쓴다 (억지 배정 없음)', () => {
  const big = planLeaves(calendar, 40, { afterISO: RANGE_START });
  const huge = planLeaves(calendar, 40 + 20, { afterISO: RANGE_START });
  // 붙일 수 있는 브리지가 한정 → 예산 키워도 사용량 동일, 나머지는 leftover
  assert.equal(huge.used, big.used);
  assert.ok(huge.leftover > big.leftover);
});

test('planLeaves: 설·추석 빼면 명절 브리지가 사라진다', () => {
  const withM = planLeaves(calendar, 40, { afterISO: RANGE_START });
  const noM = planLeaves(calendar, 40, { afterISO: RANGE_START, excludeMyeongjeol: true });
  assert.ok(withM.plan.some(isMyeongjeol), '기본엔 명절 브리지가 있어야 한다');
  assert.equal(noM.plan.some(isMyeongjeol), false, '제외 시 명절 브리지가 없어야 한다');
});

test('findStreaks: 극대성 — 시작 앞날이 쉬는 날인 구간은 만들지 않는다', () => {
  const streaks = findStreaks(calendar, 3);
  const idxOf = new Map(calendar.map((d, i) => [d.iso, i]));
  for (const s of streaks) {
    const startIdx = idxOf.get(s.start);
    if (startIdx > 0) {
      assert.equal(calendar[startIdx - 1].isOff, false);
    }
  }
});
