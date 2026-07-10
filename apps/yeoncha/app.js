// 연차술사 UI — holidays.js, optimizer.js 로드 후 실행
(function () {
  const RESULT_LIMIT = 6;
  const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];
  const STORE_KEY = 'yeonchasulsa:v1';

  const VALID_LEAVE = [1, 2, 3, 4, 5];
  const VALID_YEAR = ['all', '2026', '2027'];

  // 마지막 선택(연차/연도)을 localStorage에서 복원 — 없거나 손상 시 기본값
  function loadState() {
    const fallback = { leave: 2, year: 'all' };
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (!saved || typeof saved !== 'object') return fallback;
      return {
        leave: VALID_LEAVE.includes(saved.leave) ? saved.leave : fallback.leave,
        year: VALID_YEAR.includes(saved.year) ? saved.year : fallback.year,
      };
    } catch (_) {
      return fallback;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (_) {
      /* 프라이빗 모드 등에서 저장 실패 — 무시 */
    }
  }

  const state = loadState();

  const calendar = buildCalendar(HOLIDAYS, RANGE_START, RANGE_END);

  const $ = (sel) => document.querySelector(sel);
  const resultsEl = $('#results');
  const summaryEl = $('#summary');

  function fmtDate(iso, withYear) {
    const [y, m, d] = iso.split('-').map(Number);
    const dow = DOW_KO[new Date(y, m - 1, d).getDay()];
    return `${withYear ? y + '. ' : ''}${m}/${d}(${dow})`;
  }

  function fmtLeaveDays(leaveDays) {
    return leaveDays.map((iso) => fmtDate(iso, false)).join(', ');
  }

  function matchYear(streak) {
    if (state.year === 'all') return true;
    return streak.start.startsWith(state.year) || streak.end.startsWith(state.year);
  }

  function shareText(s) {
    return (
      `연차 ${s.leave}개로 ${s.length}일 쉬는 법\n` +
      `${fmtDate(s.start, true)} ~ ${fmtDate(s.end, true)}\n` +
      `연차 쓰는 날: ${fmtLeaveDays(s.leaveDays)}\n` +
      `— 연차술사`
    );
  }

  // iframe/구형 브라우저에서 clipboard API가 막혀도 동작하는 복사
  async function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_) { /* 아래 폴백으로 */ }
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    ta.remove();
    return ok;
  }

  async function shareStreak(s, btn) {
    const text = shareText(s);
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (_) { /* 사용자가 취소했거나 미지원 — 복사로 폴백 */ }
    }
    const ok = await copyText(text);
    const original = btn.textContent;
    btn.textContent = ok ? '복사됨!' : '길게 눌러 복사하세요';
    if (!ok) window.prompt('아래 텍스트를 복사하세요', text);
    setTimeout(() => (btn.textContent = original), 1800);
  }

  function daysUntil(iso) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((toDate(iso) - today) / 86400000);
  }

  function icsFor(s) {
    const stamp = (iso) => iso.replaceAll('-', '');
    const nextDay = (iso) => {
      const d = toDate(iso);
      return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
    };
    const events = s.leaveDays
      .map((iso) =>
        [
          'BEGIN:VEVENT',
          `UID:yeonchasulsa-${stamp(iso)}@weekly.ship`,
          `DTSTART;VALUE=DATE:${stamp(iso)}`,
          `DTEND;VALUE=DATE:${stamp(nextDay(iso))}`,
          'SUMMARY:연차 🏖️',
          `DESCRIPTION:연차 ${s.leave}개로 ${s.length}일 연휴 (${s.start} ~ ${s.end}) — 연차술사`,
          'END:VEVENT',
        ].join('\r\n')
      )
      .join('\r\n');
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//yeonchasulsa//KR', events, 'END:VCALENDAR'].join('\r\n');
  }

  // 구글 캘린더 원탭 추가 링크 — 연휴 전체를 하루종일 이벤트 1개로 (다운로드 없음)
  // 구글 TEMPLATE URL은 이벤트 1개만 담을 수 있어 연차일별 대신 연휴 블록으로 등록.
  function googleCalUrl(s) {
    const stamp = (iso) => iso.replaceAll('-', '');
    const nextDay = (iso) => {
      const d = toDate(iso);
      return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
    };
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `🏖️ ${s.length}일 연휴 (연차 ${s.leave}개)`,
      dates: `${stamp(s.start)}/${stamp(nextDay(s.end))}`, // 하루종일: 종료일은 배타적 → +1일
      details: `연차 쓰는 날: ${fmtLeaveDays(s.leaveDays)}\n— 연차술사`,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  function downloadICS(s) {
    const blob = new Blob([icsFor(s)], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `연차_${s.start}_${s.length}일연휴.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function cellHTML(cell) {
    const cls = cell.holiday ? 'holiday' : cell.isOff ? '' : 'leave';
    const label = cell.holiday
      ? cell.holiday.replace('대체공휴일', '대체').replace(/\(.*\)/, '')
      : cell.isOff
        ? DOW_KO[cell.dow]
        : '연차';
    const [, m, d] = cell.iso.split('-').map(Number);
    return `<div class="cell ${cls}"><span class="d">${m}/${d}</span>${label}</div>`;
  }

  function cardHTML(s, idx, isBest) {
    const dday = daysUntil(s.start);
    const ddayLabel = dday <= 0 ? '진행 중!' : `D-${dday}`;
    return `
      <article class="card${isBest ? ' best' : ''}">
        <div class="card-top">
          <div class="card-days">${s.length}<small>일 연휴</small></div>
          <div class="card-eff">연차 1개당 ${s.efficiency.toFixed(1)}일</div>
          <div class="card-dday">${ddayLabel}</div>
        </div>
        <div class="card-range">${fmtDate(s.start, true)} ~ ${fmtDate(s.end, true)}</div>
        <div class="strip" role="img" aria-label="${s.start}부터 ${s.end}까지 연휴 달력">
          ${s.cells.map(cellHTML).join('')}
        </div>
        <p class="card-leave-note">연차 쓰는 날 → <b>${fmtLeaveDays(s.leaveDays)}</b></p>
        <div class="card-actions">
          <button class="copy-btn" data-action="share" data-idx="${idx}">공유하기</button>
          <a class="copy-btn" href="${googleCalUrl(s)}" target="_blank" rel="noopener">🗓️ 구글 캘린더</a>
          <button class="copy-btn" data-action="ics" data-idx="${idx}">📅 캘린더 파일(.ics)</button>
        </div>
      </article>`;
  }

  let currentStreaks = [];

  function render() {
    currentStreaks = recommend(calendar, state.leave, 50)
      .filter(matchYear)
      .filter((s) => daysUntil(s.end) >= 0) // 이미 지나간 연휴 제외
      .slice(0, RESULT_LIMIT);

    if (currentStreaks.length === 0) {
      summaryEl.textContent = '';
      resultsEl.innerHTML = '<p class="empty">이 조건으로 만들 수 있는 연휴가 없어요. 연차 개수를 바꿔보세요.</p>';
      return;
    }

    const best = currentStreaks[0];
    summaryEl.innerHTML = `연차 <strong>${state.leave}개</strong>면 최대 <strong>${best.length}일</strong> 쉴 수 있어요`;
    resultsEl.innerHTML = currentStreaks.map((s, i) => cardHTML(s, i, i === 0)).join('');
  }

  resultsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const s = currentStreaks[Number(btn.dataset.idx)];
    if (!s) return;
    if (btn.dataset.action === 'share') shareStreak(s, btn);
    else downloadICS(s);
  });

  function bindPicker(selector, key, valueOf) {
    document.querySelectorAll(selector).forEach((btn) => {
      btn.addEventListener('click', () => {
        state[key] = valueOf(btn);
        document.querySelectorAll(selector).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        saveState();
        render();
      });
    });
  }

  // 복원된 state를 버튼 aria-pressed에 반영 (HTML 기본값 덮어쓰기)
  function syncControls() {
    document
      .querySelectorAll('.leave-btn')
      .forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.leave) === state.leave)));
    document
      .querySelectorAll('.year-btn')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.year === state.year)));
  }

  bindPicker('.leave-btn', 'leave', (btn) => Number(btn.dataset.leave));
  bindPicker('.year-btn', 'year', (btn) => btn.dataset.year);

  syncControls();
  render();
})();
