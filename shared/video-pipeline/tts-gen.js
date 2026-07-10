// 나레이션 6줄을 ko-KR-SunHiNeural 음성으로 합성하고 각 파일의 길이를 narration.json에 기록한다.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ffprobePath = require('ffprobe-static').path;
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const LINES = [
  '연차 하나로 추석 5일',
  '매년 손으로 계산하다 포기했음',
  '개수만 넣으면 자동으로 찾아줌',
  '토글 누르면 결과도 바로 바뀌',
  '바로 내 폰 캘린더에 등록됨',
  '너 연차 몇 개 남았음?',
];
// 주의: 대본 원문 4번째 줄은 "결과도 바로 바뀜" — 오타 방지를 위해 원문 그대로 사용
LINES[3] = '토글 누르면 결과도 바로 바뀜';

const OUT_DIR = path.join(__dirname, 'out', 'narration');

function ffprobeDuration(file) {
  const out = execFileSync(ffprobePath, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    file,
  ]).toString().trim();
  return parseFloat(out);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const tts = new MsEdgeTTS();
  await tts.setMetadata('ko-KR-SunHiNeural', OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

  const manifest = [];
  for (let i = 0; i < LINES.length; i++) {
    const text = LINES[i];
    const idx = i + 1;
    const { audioFilePath } = await tts.toFile(OUT_DIR, text);
    const finalPath = path.join(OUT_DIR, `line${idx}.mp3`);
    fs.renameSync(audioFilePath, finalPath);
    const duration = ffprobeDuration(finalPath);
    manifest.push({ idx, text, file: finalPath, duration });
    console.log(`line${idx}: "${text}" -> ${duration.toFixed(2)}s`);
  }
  tts.close();

  fs.writeFileSync(
    path.join(OUT_DIR, 'narration.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );
  console.log('narration.json written.');
}

main().catch((err) => {
  console.error('TTS generation failed:', err);
  process.exit(1);
});
