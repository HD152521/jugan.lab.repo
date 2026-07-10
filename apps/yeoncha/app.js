// 연차술사 UI — holidays.js, optimizer.js 로드 후 실행
(function () {
  const RESULT_LIMIT = 6;
  const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];
  const STORE_KEY = 'yeonchasulsa:v1';

  const VALID_YEAR = ['all', '2026', '2027'];
  const LEAVE_MIN = 1;
  const LEAVE_MAX = 15;

  const VALID_MODE = ['find', 'plan', 'myplan'];
  const BUDGET_MIN = 1;
  const BUDGET_MAX = 40;

  function clampBudget(n) {
    const v = Math.floor(Number(n));
    if (!Number.isFinite(v)) return 15;
    return Math.max(BUDGET_MIN, Math.min(BUDGET_MAX, v));
  }

  function clampLeave(n) {
    const v = Math.floor(Number(n));
    if (!Number.isFinite(v)) return 2;
    return Math.max(LEAVE_MIN, Math.min(LEAVE_MAX, v));
  }

  // 효율(연차 1개당 일수)로 재미용 등급/칭호 부여
  function tierFor(eff) {
    if (eff >= 6) return { g: 'SSS', t: '연차 연금술사', e: '🧙' };
    if (eff >= 5) return { g: 'SS', t: '갓성비', e: '🔥' };
    if (eff >= 4) return { g: 'S', t: '꿀연휴', e: '🍯' };
    if (eff >= 3) return { g: 'A', t: '알찬 연차', e: '👍' };
    if (eff >= 2) return { g: 'B', t: '그럭저럭', e: '🙂' };
    return { g: 'C', t: '그냥 연차', e: '😌' };
  }

  const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

  // HTML 삽입 시 사용자 입력 이스케이프 (회사 휴무 이름 등)
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // 저장된 회사 휴무일 정제 — 범위 내 유효 날짜만, 이름 12자 제한
  function sanitizeCustom(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    for (const c of list) {
      if (!c || typeof c.date !== 'string' || !ISO_RE.test(c.date)) continue;
      if (c.date < RANGE_START || c.date > RANGE_END || seen.has(c.date)) continue;
      seen.add(c.date);
      out.push({ date: c.date, label: (typeof c.label === 'string' ? c.label : '').slice(0, 12) || '회사 휴무' });
    }
    return out;
  }

  // 내 플랜에 담은 연휴 정제 — 필수 필드 갖춘 스냅샷만
  function sanitizePlan(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    for (const b of list) {
      if (!b || !ISO_RE.test(b.start) || !ISO_RE.test(b.end)) continue;
      if (!Array.isArray(b.leaveDays) || !b.leaveDays.every((d) => ISO_RE.test(d))) continue;
      const key = b.leaveDays.join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        start: b.start,
        end: b.end,
        length: Number(b.length) || 0,
        leave: Number(b.leave) || b.leaveDays.length,
        leaveDays: b.leaveDays.slice(),
      });
    }
    return out;
  }

  // 마지막 선택을 localStorage에서 복원 — 없거나 손상 시 기본값
  function loadState() {
    const fallback = { leave: 2, year: 'all', excludeMyeongjeol: false, mode: 'find', budget: 15, customHolidays: [], plan: [] };
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (!saved || typeof saved !== 'object') return fallback;
      return {
        leave: Number.isFinite(saved.leave) ? clampLeave(saved.leave) : fallback.leave,
        year: VALID_YEAR.includes(saved.year) ? saved.year : fallback.year,
        excludeMyeongjeol: saved.excludeMyeongjeol === true,
        mode: VALID_MODE.includes(saved.mode) ? saved.mode : fallback.mode,
        budget: Number.isFinite(saved.budget) ? clampBudget(saved.budget) : fallback.budget,
        customHolidays: sanitizeCustom(saved.customHolidays),
        plan: sanitizePlan(saved.plan),
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

  // 기본 공휴일 + 사용자가 추가한 회사 휴무일을 합쳐 달력 생성 (휴무일 변경 시 재생성)
  let calendar;
  function rebuildCalendar() {
    const merged = { ...HOLIDAYS };
    for (const c of state.customHolidays) merged[c.date] = c.label;
    calendar = buildCalendar(merged, RANGE_START, RANGE_END);
  }
  rebuildCalendar();
  const TODAY_ISO = toISO(new Date());

  // ---------- 내 플랜 (담은 연휴 관리) ----------
  const planKey = (b) => b.leaveDays.join('|');
  const inPlan = (b) => state.plan.some((p) => planKey(p) === planKey(b));
  const daysCount = (a, b) => expandDays(a, b).length;

  function togglePlan(b) {
    const k = planKey(b);
    if (state.plan.some((p) => planKey(p) === k)) {
      state.plan = state.plan.filter((p) => planKey(p) !== k);
    } else {
      state.plan = [
        ...state.plan,
        { start: b.start, end: b.end, length: b.length, leave: b.leave, leaveDays: b.leaveDays.slice() },
      ];
    }
    saveState();
  }

  function planStats() {
    const sorted = [...state.plan].sort((a, b) => a.start.localeCompare(b.start));
    const leaveSet = new Set();
    const offSet = new Set();
    for (const b of sorted) {
      b.leaveDays.forEach((d) => leaveSet.add(d));
      expandDays(b.start, b.end).forEach((d) => offSet.add(d));
    }
    let overlap = false;
    for (let i = 1; i < sorted.length; i++) if (sorted[i - 1].end >= sorted[i].start) overlap = true;
    const used = leaveSet.size;
    return { sorted, used, rest: offSet.size, offSet, overlap, over: used > state.budget, leftover: Math.max(0, state.budget - used) };
  }

  // ---------- 친구와 연차 맞추기 (URL 공유) ----------
  function parseFriendPlan() {
    const search = typeof location !== 'undefined' ? location.search || '' : '';
    const m = /[?&]plan=([^&]+)/.exec(search);
    if (!m) return null;
    const ranges = [];
    for (const seg of decodeURIComponent(m[1]).split('.')) {
      const mm = /^(\d{8})-(\d{8})$/.exec(seg);
      if (!mm) continue;
      const iso = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
      const start = iso(mm[1]);
      const end = iso(mm[2]);
      if (start <= end) ranges.push({ start, end });
    }
    return ranges.length ? ranges : null;
  }
  const friendRanges = parseFriendPlan();
  if (friendRanges) state.mode = 'myplan'; // 친구 링크로 들어오면 바로 맞추기 화면

  function myPlanParam() {
    return [...state.plan]
      .sort((a, b) => a.start.localeCompare(b.start))
      .map((b) => `${b.start.replaceAll('-', '')}-${b.end.replaceAll('-', '')}`)
      .join('.');
  }

  function planShareUrl() {
    const base = typeof location !== 'undefined' ? location.origin + location.pathname : 'https://yeoncha.juganlab.com/';
    return `${base}?plan=${myPlanParam()}`;
  }

  function bothOffRanges() {
    if (!friendRanges) return [];
    const friendOff = new Set();
    friendRanges.forEach((r) => expandDays(r.start, r.end).forEach((d) => friendOff.add(d)));
    const both = [...planStats().offSet].filter((d) => friendOff.has(d));
    return groupConsecutive(both);
  }

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

  function nextDayISO(iso) {
    const d = toDate(iso);
    return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
  }

  function icsFor(s) {
    const stamp = (iso) => iso.replaceAll('-', '');
    const events = s.leaveDays
      .map((iso) =>
        [
          'BEGIN:VEVENT',
          `UID:yeonchasulsa-${stamp(iso)}@weekly.ship`,
          `DTSTART;VALUE=DATE:${stamp(iso)}`,
          `DTEND;VALUE=DATE:${stamp(nextDayISO(iso))}`,
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
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `🏖️ ${s.length}일 연휴 (연차 ${s.leave}개)`,
      dates: `${stamp(s.start)}/${stamp(nextDayISO(s.end))}`, // 하루종일: 종료일은 배타적 → +1일
      details: `연차 쓰는 날: ${fmtLeaveDays(s.leaveDays)}\n— 연차술사`,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  function downloadICS(s, filename) {
    const blob = new Blob([icsFor(s)], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || `연차_${s.start}_${s.length}일연휴.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // 공유용 정사각 이미지(PNG) 생성 → 파일 공유 지원 시 공유, 아니면 다운로드
  async function shareImage(s) {
    const W = 1080;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = W;
    const ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) {
      await copyText(shareText(s));
      return;
    }
    const FS = "'Pretendard Variable', Pretendard, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
    const tier = tierFor(s.efficiency);

    const g = ctx.createLinearGradient(0, 0, W, W);
    g.addColorStop(0, '#fff6df');
    g.addColorStop(1, '#ffd98a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, W);

    ctx.fillStyle = '#a9760b';
    ctx.font = `800 46px ${FS}`;
    ctx.fillText('🏖️ 연차술사', 90, 150);

    ctx.font = `800 40px ${FS}`;
    const pill = `${tier.e} ${tier.t} · ${tier.g}급`;
    const pw = ctx.measureText(pill).width;
    roundRect(ctx, 90, 208, pw + 64, 78, 39);
    ctx.fillStyle = '#6b4700';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(pill, 122, 261);

    ctx.fillStyle = '#7a5410';
    ctx.font = `700 62px ${FS}`;
    ctx.fillText(`연차 ${s.leave}개로`, 90, 470);

    ctx.fillStyle = '#2b2008';
    ctx.font = `900 230px ${FS}`;
    const numText = `${s.length}`;
    ctx.fillText(numText, 84, 690);
    const nw = ctx.measureText(numText).width;
    ctx.font = `800 90px ${FS}`;
    ctx.fillText('일 연휴', 104 + nw, 690);

    ctx.fillStyle = '#5a4a2a';
    ctx.font = `600 44px ${FS}`;
    ctx.fillText(`${fmtDate(s.start, true)} ~ ${fmtDate(s.end, true)}`, 90, 800);
    ctx.font = `500 38px ${FS}`;
    ctx.fillText(`연차 쓰는 날: ${fmtLeaveDays(s.leaveDays)}`, 90, 864);

    ctx.fillStyle = '#a9760b';
    ctx.font = `700 44px ${FS}`;
    ctx.fillText(`연차 1개당 ${s.efficiency.toFixed(1)}일 🔥`, 90, 948);

    ctx.fillStyle = '#8a6a2a';
    ctx.font = `600 36px ${FS}`;
    ctx.fillText('yeoncha.juganlab.com', 90, 1015);

    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) return;
    const file = new File([blob], `연차술사_${s.length}일연휴.png`, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: `연차 ${s.leave}개로 ${s.length}일 연휴! — 연차술사` });
        return;
      } catch (_) { /* 취소/미지원 → 다운로드 폴백 */ }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = file.name;
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
    return `<div class="cell ${cls}"><span class="d">${m}/${d}</span>${esc(label)}</div>`;
  }

  function cardHTML(s, idx, isBest) {
    const dday = daysUntil(s.start);
    const ddayLabel = dday <= 0 ? '진행 중!' : `D-${dday}`;
    const tier = tierFor(s.efficiency);
    return `
      <article class="card${isBest ? ' best' : ''}">
        <div class="card-grade grade-${tier.g}">${tier.e} ${tier.t} · ${tier.g}급</div>
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
          <button class="copy-btn plan-toggle${inPlan(s) ? ' on' : ''}" data-action="plan" data-idx="${idx}">${inPlan(s) ? '✓ 담김' : '➕ 담기'}</button>
          <button class="copy-btn" data-action="img" data-idx="${idx}">🖼️ 이미지</button>
          <button class="copy-btn" data-action="share" data-idx="${idx}">공유</button>
          <a class="copy-btn" href="${googleCalUrl(s)}" target="_blank" rel="noopener">🗓️ 구글</a>
          <button class="copy-btn" data-action="ics" data-idx="${idx}">📅 .ics</button>
        </div>
      </article>`;
  }

  let currentStreaks = [];

  function render() {
    updatePlanTab();
    if (state.mode === 'plan') return renderPlan();
    if (state.mode === 'myplan') return renderMyPlan();
    return renderFind();
  }

  function updatePlanTab() {
    const el = document.getElementById('plan-tab-count');
    if (el) el.textContent = state.plan.length ? `(${state.plan.length})` : '';
  }

  function rangeLabel(r) {
    return `${fmtDate(r.start, false)}~${fmtDate(r.end, false)}`;
  }

  function renderFriendBox() {
    const both = bothOffRanges();
    const friendDays = friendRanges.map(rangeLabel).join(', ');
    const bothHTML = both.length
      ? `<p class="friend-both">🎯 둘 다 쉬는 날: <b>${both.map((r) => `${rangeLabel(r)} (${daysCount(r.start, r.end)}일)`).join(', ')}</b></p>`
      : `<p class="friend-both none">아직 겹치는 날이 없어요. 위에서 연휴를 담아 맞춰보세요!</p>`;
    return `<div class="friend-box">
      <h3>👥 친구 연차와 맞추기</h3>
      <p class="friend-sub">친구가 쉬는 날: ${friendDays}</p>
      ${bothHTML}
    </div>`;
  }

  function downloadPlanICS() {
    const all = new Set();
    state.plan.forEach((b) => b.leaveDays.forEach((d) => all.add(d)));
    const st = planStats();
    const pseudo = {
      leave: all.size,
      length: st.rest,
      start: st.sorted[0].start,
      end: st.sorted[st.sorted.length - 1].end,
      leaveDays: [...all].sort(),
    };
    downloadICS(pseudo, '연차술사_내플랜.ics');
  }

  async function sharePlan(btn) {
    const url = planShareUrl();
    const text = `내 올해 연차 플랜 봐줘! 우리 둘 다 쉬는 날 맞춰보자 🏖️`;
    if (navigator.share) {
      try {
        await navigator.share({ text, url });
        return;
      } catch (_) { /* 취소/미지원 → 복사 */ }
    }
    const ok = await copyText(url);
    const o = btn.textContent;
    btn.textContent = ok ? '링크 복사됨! 친구에게 붙여넣기' : '복사 실패';
    if (!ok) window.prompt('이 링크를 친구에게 보내세요', url);
    setTimeout(() => (btn.textContent = o), 2200);
  }

  // "내 플랜" — 담은 연휴 관리 + 친구 맞추기
  function renderMyPlan() {
    const { sorted, used, rest, overlap, over, leftover } = planStats();
    const friendHTML = friendRanges ? renderFriendBox() : '';

    if (sorted.length === 0) {
      summaryEl.textContent = '';
      resultsEl.innerHTML =
        friendHTML +
        `<p class="empty">아직 담은 연휴가 없어요.<br />‘연휴 찾기’나 ‘연차 플래너’에서 마음에 드는 연휴의 <b>➕ 담기</b>를 눌러 내 계획을 만들어보세요.</p>`;
      return;
    }

    summaryEl.innerHTML =
      `내 플랜 · 연차 <strong>${used}개</strong> 사용 · 확보 <strong>${rest}일</strong>` +
      (leftover > 0 ? ` · 남은 <strong>${leftover}개</strong>` : '');

    const pct = Math.min(100, Math.round((used / Math.max(1, state.budget)) * 100));
    const bar = `<div class="plan-bar"><div class="plan-bar-fill" style="width:${pct}%"></div></div>
      <p class="plan-bar-cap">연차 ${used} / ${state.budget}개 · 확보 ${rest}일</p>`;

    const warns = [];
    if (over) warns.push(`⚠️ 연차 ${used}개로 총 연차(${state.budget}개)를 넘었어요. 총 연차를 늘리거나 일부를 빼세요.`);
    if (overlap) warns.push('⚠️ 담은 연휴 중 날짜가 겹치는 게 있어요.');
    const warnHTML = warns.length ? `<div class="plan-warn">${warns.map((w) => `<p>${w}</p>`).join('')}</div>` : '';

    const actions = `<div class="plan-actions">
      <button class="copy-btn" id="plan-ics">📅 전체 캘린더 등록</button>
      <button class="copy-btn" id="plan-share">🔗 플랜 공유(친구 맞추기)</button>
    </div>`;

    // 저장된 스냅샷을 현재 달력으로 하이드레이트 (efficiency/cells 복원)
    const calByIso = new Map(calendar.map((d) => [d.iso, d]));
    const hydrate = (b) => ({
      ...b,
      efficiency: b.length / b.leave,
      cells: expandDays(b.start, b.end).map(
        (iso) => calByIso.get(iso) || { iso, dow: toDate(iso).getDay(), holiday: null, isOff: true }
      ),
    });
    currentStreaks = sorted.map(hydrate); // 카드 버튼(담기/공유/캘린더) 재사용
    const cards = currentStreaks.map((s, i) => cardHTML(s, i, false)).join('');
    resultsEl.innerHTML = bar + warnHTML + friendHTML + actions + cards;

    const icsBtn = document.getElementById('plan-ics');
    if (icsBtn) icsBtn.addEventListener('click', downloadPlanICS);
    const shareBtn = document.getElementById('plan-share');
    if (shareBtn) shareBtn.addEventListener('click', () => sharePlan(shareBtn));
  }

  // "연휴 찾기" — 연차 개수 하나로 만들 수 있는 연휴 목록
  function renderFind() {
    // 명절 제외는 recommend 내부(dedup 이전)에서 처리 — 대안 연휴가 사라지지 않게
    currentStreaks = recommend(calendar, state.leave, 500, { excludeMyeongjeol: state.excludeMyeongjeol })
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

  // "연차 플래너" — 남은 연차 예산을 효율 브리지에 배분, 남는 건 자유롭게
  function renderPlan() {
    const { plan, used, leftover, totalRest, bridges } = planLeaves(calendar, state.budget, {
      excludeMyeongjeol: state.excludeMyeongjeol,
      afterISO: TODAY_ISO,
      year: state.year,
    });
    currentStreaks = plan; // 공유/캘린더 버튼이 참조

    if (plan.length === 0) {
      summaryEl.textContent = '';
      resultsEl.innerHTML = `<p class="empty">이 조건에 붙일 만한 효율 좋은 연휴가 없어요.<br />연차 ${state.budget}개는 원하는 때 자유롭게 쓰세요 🙂</p>`;
      return;
    }

    summaryEl.innerHTML =
      `효율 좋은 연휴 <strong>${bridges}곳</strong> · 연차 <strong>${used}개</strong> 사용` +
      (leftover > 0 ? ` · 남은 <strong>${leftover}개</strong>는 자유롭게 🎉` : '');

    const impact = `
      <div class="impact">
        <div class="impact-cap-top">연차 ${used}개만 잘 쓰면</div>
        <div class="impact-num">올해 최대 <b>${totalRest}일</b> 쉴 수 있어요 😳</div>
      </div>`;
    const cards = plan.map((s, i) => cardHTML(s, i, false)).join('');
    const leftoverCard =
      leftover > 0
        ? `<article class="card leftover">
             <div class="leftover-big">남은 연차 ${leftover}개</div>
             <p>공휴일에 붙일 만한 알짜 자리는 여기까지예요. 나머지 ${leftover}개는 아껴뒀다가 원하는 때 자유롭게 쓰세요.</p>
           </article>`
        : '';
    resultsEl.innerHTML = impact + cards + leftoverCard;
  }

  resultsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const s = currentStreaks[Number(btn.dataset.idx)];
    if (!s) return;
    if (btn.dataset.action === 'share') shareStreak(s, btn);
    else if (btn.dataset.action === 'img') shareImage(s);
    else if (btn.dataset.action === 'plan') {
      togglePlan(s);
      render();
    } else downloadICS(s);
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

  const mjBtn = document.getElementById('toggle-myeongjeol');
  if (mjBtn) {
    mjBtn.addEventListener('click', () => {
      state.excludeMyeongjeol = !state.excludeMyeongjeol;
      mjBtn.setAttribute('aria-pressed', String(state.excludeMyeongjeol));
      saveState();
      render();
    });
  }

  // 모드에 따라 연차 개수 선택(찾기) / 남은 연차 입력(플래너) 전환
  function applyMode() {
    const m = state.mode;
    const setHidden = (id, hide) => {
      const el = document.getElementById(id);
      if (el) el.hidden = hide;
    };
    setHidden('controls-find', m !== 'find');
    setHidden('controls-plan', !(m === 'plan' || m === 'myplan'));
    setHidden('controls-common', m === 'myplan'); // 연도/명절 필터는 찾기·플래너만
    document.querySelectorAll('.mode-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
  }

  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.mode = btn.dataset.mode;
      applyMode();
      saveState();
      render();
    });
  });

  const budgetInput = document.getElementById('budget-input');
  if (budgetInput) {
    budgetInput.addEventListener('input', () => {
      state.budget = clampBudget(budgetInput.value);
      saveState();
      render();
    });
    // 포커스 벗어날 때 표시값도 정규화
    budgetInput.addEventListener('blur', () => {
      budgetInput.value = state.budget;
    });
  }

  const leaveInput = document.getElementById('leave-input');
  if (leaveInput) {
    leaveInput.addEventListener('input', () => {
      state.leave = clampLeave(leaveInput.value);
      saveState();
      render();
    });
    leaveInput.addEventListener('blur', () => {
      leaveInput.value = state.leave;
    });
  }

  // ---------- 회사 쉬는날 (사용자 추가 휴무일) ----------
  const customDateInput = document.getElementById('custom-date');
  const customLabelInput = document.getElementById('custom-label');
  const customAddBtn = document.getElementById('custom-add-btn');
  const customListEl = document.getElementById('custom-list');
  const customErrorEl = document.getElementById('custom-error');
  const customCountEl = document.getElementById('custom-count');
  const DOW_KO_PAREN = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return `${m}/${d}(${DOW_KO[new Date(y, m - 1, d).getDay()]})`;
  };

  function renderCustomList() {
    if (customCountEl) {
      const n = state.customHolidays.length;
      customCountEl.textContent = n ? `(${n})` : '';
    }
    if (!customListEl) return;
    const sorted = [...state.customHolidays].sort((a, b) => a.date.localeCompare(b.date));
    customListEl.innerHTML = sorted
      .map(
        (c) =>
          `<li><span class="cd">${DOW_KO_PAREN(c.date)}</span><span class="cl">${esc(c.label)}</span>` +
          `<button class="cx" data-remove="${c.date}" aria-label="${esc(c.label)} 삭제">✕</button></li>`
      )
      .join('');
  }

  function addCustom() {
    if (customErrorEl) customErrorEl.textContent = '';
    const date = customDateInput ? customDateInput.value : '';
    const label = ((customLabelInput && customLabelInput.value) || '').trim().slice(0, 12) || '회사 휴무';
    if (!date || !ISO_RE.test(date)) {
      if (customErrorEl) customErrorEl.textContent = '날짜를 선택하세요.';
      return;
    }
    if (date < RANGE_START || date > RANGE_END) {
      if (customErrorEl) customErrorEl.textContent = '2026.7 ~ 2027 기간만 추가할 수 있어요.';
      return;
    }
    if (state.customHolidays.some((c) => c.date === date)) {
      if (customErrorEl) customErrorEl.textContent = '이미 추가된 날짜예요.';
      return;
    }
    state.customHolidays = [...state.customHolidays, { date, label }];
    if (customLabelInput) customLabelInput.value = '';
    saveState();
    rebuildCalendar();
    renderCustomList();
    render();
  }

  if (customAddBtn) customAddBtn.addEventListener('click', addCustom);
  if (customLabelInput) {
    customLabelInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addCustom();
    });
  }
  if (customListEl) {
    customListEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove]');
      if (!btn) return;
      state.customHolidays = state.customHolidays.filter((c) => c.date !== btn.dataset.remove);
      saveState();
      rebuildCalendar();
      renderCustomList();
      render();
    });
  }

  // 복원된 state를 컨트롤에 반영 (HTML 기본값 덮어쓰기)
  function syncControls() {
    document
      .querySelectorAll('.year-btn')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.year === state.year)));
    if (mjBtn) mjBtn.setAttribute('aria-pressed', String(state.excludeMyeongjeol));
    if (budgetInput) budgetInput.value = state.budget;
    if (leaveInput) leaveInput.value = state.leave;
  }

  bindPicker('.year-btn', 'year', (btn) => btn.dataset.year);

  applyMode();
  syncControls();
  renderCustomList();
  render();
})();
