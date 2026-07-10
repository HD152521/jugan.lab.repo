// 캡처된 스틸 + TTS 나레이션을 ffmpeg로 합성해 1080x1920 세로 mp4를 만든다.
// BGM 없음(인스타 트렌딩 오디오를 나중에 얹는 전제).
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

const FRAMES_DIR = path.join(__dirname, 'out', 'frames');
const NARR_DIR = path.join(__dirname, 'out', 'narration');
const SEG_DIR = path.join(__dirname, 'out', 'segments');
const FINAL_DIR = path.join(__dirname, 'out', 'final');
const PROMO_DIR = path.resolve(__dirname, '..', '..', 'weeks', 'w01-yeoncha', 'promo');

const W = 1080;
const H = 1920;
const FPS = 30;
const BG = '0x0F3D33'; // 다크그린 레터박스

fs.mkdirSync(SEG_DIR, { recursive: true });
fs.mkdirSync(FINAL_DIR, { recursive: true });

function run(cmd, args) {
  console.log('>', cmd, args.join(' '));
  execFileSync(cmd, args, { stdio: 'inherit' });
}

function ffprobeDuration(file) {
  const out = execFileSync(ffprobePath, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    file,
  ]).toString().trim();
  return parseFloat(out);
}

function makeStillSegment(pngFile, seconds, outFile) {
  run(ffmpegPath, [
    '-y',
    '-loop', '1',
    '-i', pngFile,
    '-t', String(seconds),
    '-vf', `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${BG},fps=${FPS},format=yuv420p`,
    '-c:v', 'libx264',
    '-profile:v', 'high',
    '-pix_fmt', 'yuv420p',
    '-r', String(FPS),
    outFile,
  ]);
}

async function main() {
  const narration = JSON.parse(fs.readFileSync(path.join(NARR_DIR, 'narration.json'), 'utf-8'));
  const dur = (i) => narration[i - 1].duration;
  const PAD = 0.3;

  // ---- 씬 스케줄 계산 ----
  const scene1 = dur(1) + PAD;
  const scene2 = dur(2) + PAD;
  const line3 = dur(3);
  const line4 = dur(4);
  const frame3a = line3 * 0.45;
  const frame3b = line3 * 0.55;
  const frame3c = line4 + PAD;
  const scene3 = frame3a + frame3b + frame3c;
  const scene4 = dur(5) + PAD;
  const scene5 = dur(6) + PAD;

  const totalDuration = scene1 + scene2 + scene3 + scene4 + scene5;

  const narrStarts = {
    1: 0,
    2: scene1,
    3: scene1 + scene2,
    4: scene1 + scene2 + line3,
    5: scene1 + scene2 + scene3,
    6: scene1 + scene2 + scene3 + scene4,
  };

  console.log('schedule(s):', {
    scene1, scene2, scene3, scene4, scene5, totalDuration,
    frame3a, frame3b, frame3c,
    narrStarts,
  });

  // ---- 스틸 -> 개별 세그먼트 mp4 ----
  const segments = [
    { png: 'scene1.png', seconds: scene1, name: 'seg1.mp4' },
    { png: 'scene2.png', seconds: scene2, name: 'seg2.mp4' },
    { png: 'scene3a-input.png', seconds: frame3a, name: 'seg3a.mp4' },
    { png: 'scene3b-plan.png', seconds: frame3b, name: 'seg3b.mp4' },
    { png: 'scene3c-toggle.png', seconds: frame3c, name: 'seg3c.mp4' },
    { png: 'scene4.png', seconds: scene4, name: 'seg4.mp4' },
    { png: 'scene5.png', seconds: scene5, name: 'seg5.mp4' },
  ];

  for (const seg of segments) {
    makeStillSegment(
      path.join(FRAMES_DIR, seg.png),
      seg.seconds,
      path.join(SEG_DIR, seg.name)
    );
  }

  // ---- 세그먼트 concat ----
  const listFile = path.join(SEG_DIR, 'concat_list.txt');
  fs.writeFileSync(
    listFile,
    segments.map((s) => `file '${path.join(SEG_DIR, s.name).replace(/\\/g, '/')}'`).join('\n'),
    'utf-8'
  );
  const concatVideo = path.join(SEG_DIR, 'concat_video.mp4');
  run(ffmpegPath, ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', concatVideo]);

  // ---- 나레이션 6개 -> adelay + amix ----
  const narrInputs = [];
  const filterParts = [];
  for (let i = 1; i <= 6; i++) {
    const file = path.join(NARR_DIR, `line${i}.mp3`);
    narrInputs.push('-i', file);
    const delayMs = Math.round(narrStarts[i] * 1000);
    filterParts.push(`[${i - 1}:a]adelay=${delayMs}|${delayMs}[a${i - 1}]`);
  }
  const mixInputs = Array.from({ length: 6 }, (_, i) => `[a${i}]`).join('');
  const filterComplex = `${filterParts.join(';')};${mixInputs}amix=inputs=6:duration=longest:normalize=0[aout]`;

  const mixedAudio = path.join(SEG_DIR, 'narration_mixed.m4a');
  run(ffmpegPath, [
    '-y',
    ...narrInputs,
    '-filter_complex', filterComplex,
    '-map', '[aout]',
    '-t', String(totalDuration),
    '-c:a', 'aac',
    '-b:a', '160k',
    mixedAudio,
  ]);

  // ---- 최종 mux ----
  const finalName = '연차술사_릴스.mp4';
  const finalPath = path.join(FINAL_DIR, finalName);
  run(ffmpegPath, [
    '-y',
    '-i', concatVideo,
    '-i', mixedAudio,
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '160k',
    '-shortest',
    '-movflags', '+faststart',
    finalPath,
  ]);

  // ---- 커버 이미지 복사 ----
  fs.copyFileSync(path.join(FRAMES_DIR, 'cover.png'), path.join(FINAL_DIR, '연차술사_커버.png'));

  // ---- 산출물 폴더로 배포 ----
  fs.mkdirSync(PROMO_DIR, { recursive: true });
  fs.copyFileSync(finalPath, path.join(PROMO_DIR, finalName));
  fs.copyFileSync(path.join(FINAL_DIR, '연차술사_커버.png'), path.join(PROMO_DIR, '연차술사_커버.png'));

  console.log('DONE. total duration ~', totalDuration.toFixed(2), 's');
  console.log('final video:', path.join(PROMO_DIR, finalName));

  fs.writeFileSync(
    path.join(SEG_DIR, 'schedule.json'),
    JSON.stringify({ scene1, scene2, scene3, scene4, scene5, totalDuration, frame3a, frame3b, frame3c, narrStarts }, null, 2)
  );
}

main().catch((err) => {
  console.error('build failed:', err);
  process.exit(1);
});
