// Playwright로 연차술사 실제 앱을 조작해 릴스용 세로 스틸(1080x1920)을 캡처한다.
// viewport 540x960 + deviceScaleFactor 2 => 스크린샷이 그대로 1080x1920.
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { PORT } = require('./server.js');

const BASE_URL = `http://localhost:${PORT}`;
const FRAMES_DIR = path.join(__dirname, 'out', 'frames');
const MINT = '#3DDC97';
const DARK_GREEN = '#0F3D33';
const CREAM = '#FBF6EC';

fs.mkdirSync(FRAMES_DIR, { recursive: true });

// state 전체를 그대로 주입 (yeonchasulsa:v1 스키마와 동일한 필드만 사용)
const STORE_KEY = 'yeonchasulsa:v1';

function stateJSON(overrides) {
  const base = {
    leave: 2,
    year: 'all',
    excludeMyeongjeol: false,
    mode: 'find',
    budget: 15,
    customHolidays: [],
    plan: [],
  };
  return JSON.stringify({ ...base, ...overrides });
}

// 자막/배지 오버레이 CSS — 다크그린 반투명 필 + 흰 텍스트 + 민트 강조어
const OVERLAY_CSS = `
  #jugan-overlay-root {
    position: fixed;
    inset: 0;
    z-index: 999999;
    pointer-events: none;
    font-family: 'Pretendard Variable', Pretendard, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
  }
  #jugan-badge {
    position: absolute;
    top: 34px;
    right: 28px;
    background: linear-gradient(120deg, #0F3D33, #16543f);
    border: 1.5px solid ${MINT};
    color: #fff;
    font-weight: 800;
    font-size: 30px;
    letter-spacing: -0.01em;
    padding: 14px 26px;
    border-radius: 999px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  }
  #jugan-subtitle {
    position: absolute;
    left: 32px;
    right: 32px;
    bottom: 64px;
    background: rgba(15, 61, 51, 0.86);
    border: 1px solid rgba(61, 220, 151, 0.5);
    border-radius: 20px;
    padding: 26px 30px;
    color: #ffffff;
    font-weight: 700;
    font-size: 34px;
    line-height: 1.45;
    letter-spacing: -0.01em;
    text-align: center;
  }
  #jugan-subtitle .mint { color: ${MINT}; }
  #jugan-dim {
    position: fixed;
    inset: 0;
    z-index: 999998;
    background: radial-gradient(120% 90% at 50% 8%, rgba(15,61,51,0.05), rgba(15,61,51,0.55) 88%);
    pointer-events: none;
  }
  .jugan-highlight-ring {
    outline: 3px solid ${MINT} !important;
    outline-offset: 3px;
    border-radius: 14px !important;
    box-shadow: 0 0 0 8px rgba(61,220,151,0.18) !important;
  }
`;

async function injectOverlay(page, { subtitleHtml, badgeText }) {
  await page.addStyleTag({ content: OVERLAY_CSS });
  await page.evaluate(
    ({ subtitleHtml, badgeText }) => {
      document.getElementById('jugan-overlay-root')?.remove();
      document.getElementById('jugan-dim')?.remove();
      const dim = document.createElement('div');
      dim.id = 'jugan-dim';
      document.body.appendChild(dim);
      const root = document.createElement('div');
      root.id = 'jugan-overlay-root';
      if (badgeText) {
        const badge = document.createElement('div');
        badge.id = 'jugan-badge';
        badge.textContent = badgeText;
        root.appendChild(badge);
      }
      if (subtitleHtml) {
        const sub = document.createElement('div');
        sub.id = 'jugan-subtitle';
        sub.innerHTML = subtitleHtml;
        root.appendChild(sub);
      }
      document.body.appendChild(root);
    },
    { subtitleHtml, badgeText }
  );
}

async function clearHighlights(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.jugan-highlight-ring').forEach((el) => el.classList.remove('jugan-highlight-ring'));
  });
}

async function gotoWithState(page, overrides, { query = '' } = {}) {
  await page.addInitScript(
    ([key, json]) => window.localStorage.setItem(key, json),
    [STORE_KEY, stateJSON(overrides)]
  );
  await page.goto(`${BASE_URL}/${query}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#results .card', { timeout: 5000 }).catch(() => {});
}

async function scrollCardIntoView(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) el.scrollIntoView({ block: 'center', inline: 'center' });
  }, selector);
  await page.waitForTimeout(80);
}

async function shot(page, filename) {
  const p = path.join(FRAMES_DIR, filename);
  await page.screenshot({ path: p });
  console.log('captured', filename);
  return p;
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 540, height: 960 },
    deviceScaleFactor: 2,
  });

  // ---------- 씬1: 연차 1개 -> 추석 5일, SS 갓성비, D-75 ----------
  await gotoWithState(page, { leave: 1, year: '2026', mode: 'find' });
  await scrollCardIntoView(page, '#results .card.best');
  await injectOverlay(page, {
    subtitleHtml: `연차 <span class="mint">1개</span> → 추석 <span class="mint">5일</span>`,
    badgeText: 'SS 갓성비 🔥',
  });
  await shot(page, 'scene1.png');

  // ---------- 씬2: hero 문구 + 자막(광복절 토요일 맥락, 숫자 결부 없음) ----------
  await gotoWithState(page, { leave: 2, year: 'all', mode: 'find' });
  await page.evaluate(() => window.scrollTo(0, 0));
  await injectOverlay(page, {
    subtitleHtml: `광복절도 토요일… 나 며칠 쉬지?`,
  });
  await shot(page, 'scene2.png');

  // ---------- 씬3: 실제 조작 — 개수 입력 "1" -> 결과 렌더 ----------
  await gotoWithState(page, { leave: 2, year: '2026', mode: 'find' });
  const leaveInput = page.locator('#leave-input');
  await leaveInput.click({ clickCount: 3 });
  await leaveInput.fill('');
  await leaveInput.type('1', { delay: 90 });
  await leaveInput.dispatchEvent('input');
  await page.waitForTimeout(150);
  await page.evaluate(() => window.scrollTo(0, 0));
  await injectOverlay(page, {
    subtitleHtml: `개수만 넣으면 <span class="mint">끝</span>. 붙일 자리까지 <span class="mint">자동</span>.`,
  });
  await shot(page, 'scene3a-input.png');

  // 플래너 모드 전환 -> 임팩트 스탯 등장
  await page.locator('.mode-btn[data-mode="plan"]').click();
  await page.waitForTimeout(150);
  await page.evaluate(() => window.scrollTo(0, 0));
  await injectOverlay(page, {
    subtitleHtml: `개수만 넣으면 <span class="mint">끝</span>. 붙일 자리까지 <span class="mint">자동</span>.`,
  });
  await shot(page, 'scene3b-plan.png');

  // "설·추석 빼고" 토글 -> 결과 변경 (자막은 씬3 스펙 문구로 고정)
  await page.locator('#toggle-myeongjeol').click();
  await page.waitForTimeout(150);
  await page.evaluate(() => window.scrollTo(0, 0));
  await injectOverlay(page, {
    subtitleHtml: `개수만 넣으면 <span class="mint">끝</span>. 붙일 자리까지 <span class="mint">자동</span>.`,
  });
  await shot(page, 'scene3c-toggle.png');

  // ---------- 씬4: BEST 카드 캘린더 스트립 + ICS/구글 버튼 강조 ----------
  await gotoWithState(page, { leave: 1, year: '2026', mode: 'find' });
  await scrollCardIntoView(page, '#results .card.best');
  await page.evaluate(() => {
    document.querySelectorAll('#results .card.best .strip').forEach((el) => el.classList.add('jugan-highlight-ring'));
    document.querySelectorAll('#results .card.best .card-actions a, #results .card.best .card-actions [data-action="ics"]').forEach((el) =>
      el.classList.add('jugan-highlight-ring')
    );
  });
  await injectOverlay(page, {
    subtitleHtml: `내 캘린더에 바로 등록 <span class="mint">(서버 전송 없음)</span>`,
  });
  await shot(page, 'scene4.png');
  await clearHighlights(page);

  // ---------- 씬5: 내 플랜(추석 9일, 연차3개) + 친구 맞추기 교집합 ----------
  const planEntry = {
    start: '2026-09-19',
    end: '2026-09-27',
    length: 9,
    leave: 3,
    leaveDays: ['2026-09-21', '2026-09-22', '2026-09-23'],
  };
  const friendQuery = '?plan=20260919-20260927'; // 동료도 동일 구간을 쉬는 것으로 표시 -> 교집합 데모
  await gotoWithState(
    page,
    { mode: 'myplan', year: '2026', budget: 15, plan: [planEntry] },
    { query: friendQuery }
  );
  await page.waitForTimeout(150);
  await page.evaluate(() => window.scrollTo(0, 0));
  await injectOverlay(page, {
    subtitleHtml: `<span class="mint">3개</span> 넣으면? 추석 <span class="mint">9일</span>. 동료랑 겹치는 날도.`,
  });
  await shot(page, 'scene5.png');

  // ---------- 커버(썸네일) ----------
  await gotoWithState(page, { leave: 1, year: '2026', mode: 'find' });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.addStyleTag({
    content: `
    #jugan-cover {
      position: fixed; inset: 0; z-index: 999999;
      background: linear-gradient(160deg, #0F3D33 0%, #123f34 55%, #0b2b24 100%);
      display: flex; flex-direction: column; justify-content: center; align-items: flex-start;
      padding: 96px 64px;
      font-family: 'Pretendard Variable', Pretendard, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
      color: #fff;
    }
    #jugan-cover .tag {
      display: inline-block;
      background: rgba(61,220,151,0.16);
      border: 1.5px solid #3DDC97;
      color: #3DDC97;
      font-weight: 800; font-size: 28px; letter-spacing: 0.01em;
      padding: 10px 22px; border-radius: 999px; margin-bottom: 48px;
    }
    #jugan-cover .main {
      font-weight: 900; font-size: 76px; line-height: 1.22; letter-spacing: -0.03em;
      margin-bottom: 28px;
    }
    #jugan-cover .main .mint { color: #3DDC97; }
    #jugan-cover .sub {
      font-weight: 600; font-size: 36px; color: #d9ece4; line-height: 1.5;
    }
    #jugan-cover .brandline {
      position: absolute; bottom: 72px; left: 64px; right: 64px;
      font-weight: 700; font-size: 28px; color: rgba(255,255,255,0.65);
      display: flex; justify-content: space-between; align-items: center;
    }
    #jugan-cover .brandline b { color: #3DDC97; }
    `,
  });
  await page.evaluate(() => {
    document.getElementById('jugan-overlay-root')?.remove();
    document.getElementById('jugan-dim')?.remove();
    const cover = document.createElement('div');
    cover.id = 'jugan-cover';
    cover.innerHTML = `
      <span class="tag">주간실험실 실험 #01</span>
      <div class="main">연차 <span class="mint">1개</span> = 추석 <span class="mint">5일</span></div>
      <div class="sub">9/23 하루 쓰고 5일 쉰다</div>
      <div class="brandline"><span>연차술사</span><b>yeoncha.juganlab.com</b></div>
    `;
    document.body.appendChild(cover);
  });
  await shot(page, 'cover.png');

  await browser.close();
  console.log('all frames captured.');
}

main().catch((err) => {
  console.error('capture failed:', err);
  process.exit(1);
});
