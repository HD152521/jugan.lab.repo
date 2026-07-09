// 아티팩트용 단일 파일 빌드: node build-preview.js <출력경로>
const fs = require('fs');
const path = require('path');

const here = __dirname;
const read = (f) => fs.readFileSync(path.join(here, f), 'utf8');

const css = read('style.css');
const js = ['experiments.js', 'app.js'].map(read).join('\n');

// 아티팩트는 외부 요청이 막히므로 프사를 data URI로 인라인
const logoB64 = fs.readFileSync(path.join(here, 'profile.png')).toString('base64');

const bodyMatch = read('index.html').match(/<div class="phone">[\s\S]*<\/div>\s*(?=<script)/);
if (!bodyMatch) {
  console.error('index.html에서 본문(<div class="phone">)을 찾지 못했습니다');
  process.exit(1);
}

const out =
  '<title>주간실험실 — 매주 실험 하나</title>\n' +
  '<style>\n' + css + '\n</style>\n' +
  bodyMatch[0].replace('src="profile.png"', `src="data:image/png;base64,${logoB64}"`) + '\n' +
  '<script>\n' + js + '\n</script>\n';

const target = process.argv[2] || path.join(here, 'preview.html');
fs.writeFileSync(target, out);
console.log('written:', target, out.length, 'bytes');
