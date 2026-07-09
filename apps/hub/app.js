// 허브 렌더링 — experiments.js의 EXPERIMENTS를 카드로 그림
(function () {
  const STATUS_LABEL = { live: 'LIVE', building: '제작중', planned: '예정' };

  const listEl = document.getElementById('list');
  const fillEl = document.getElementById('season-fill');
  const countEl = document.getElementById('season-count');

  function cardHTML(exp) {
    const isLive = exp.status === 'live';
    const isLink = isLive && exp.url;
    const cls = isLive ? 'exp live' : 'exp locked';
    const tagOpen = isLink ? `<a class="${cls}" href="${exp.url}">` : `<div class="${cls}">`;
    const tagClose = isLink ? '</a>' : '</div>';
    const pad = String(exp.no).padStart(2, '0');
    return `
      ${tagOpen}
        <div class="exp-top">
          <span class="exp-no">실험 #${pad}</span>
          <span class="exp-status ${exp.status}">${STATUS_LABEL[exp.status]}</span>
        </div>
        <h2>${exp.title}${isLink ? ' <span class="arrow">→</span>' : ''}</h2>
        <p>${exp.desc}</p>
        <span class="exp-tag">${exp.tag}</span>
      ${tagClose}`;
  }

  // 공개된 실험만 노출 — 다음 실험은 공개 전까지 비밀
  listEl.innerHTML = EXPERIMENTS.filter((e) => e.status === 'live').map(cardHTML).join('');

  const liveCount = EXPERIMENTS.filter((e) => e.status === 'live').length;
  fillEl.style.width = `${(liveCount / TOTAL_SEASON) * 100}%`;
  countEl.textContent = `${liveCount}/${TOTAL_SEASON}`;
})();
