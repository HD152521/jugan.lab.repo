# jugan.lab.repo

주차별 학습/프로젝트 모노레포. 시간축(주차별 코드)과 재사용 라이브러리축(스킬·에이전트·프롬프트)을 분리해서 관리한다.

## 구조

| 폴더 | 성격 | 변경 주기 |
|------|------|-----------|
| `weeks/` | 주차별 과제/코드. 그 주 끝나면 사실상 동결 | 시간순으로 쌓임 |
| `apps/` | 실제 배포하는 프로덕트 (Vercel 연결 대상) | 지속 |
| `skills/` | 재사용 스킬 라이브러리 | 지속 |
| `agents/` | 에이전트 정의/설정 | 지속 |
| `prompts/` | 프롬프트 모음 (영상 등) | 지속 |
| `shared/` | 공용 유틸/헬퍼 | 지속 |

## 주차 인덱스

- [w01-yeoncha](./weeks/w01-yeoncha/) — 연차술사 ✅ 배포 (앱: [`apps/yeoncha`](./apps/yeoncha/))
- [w02-chukui](./weeks/w02-chukui/) — 축의금 계산기 (계획) · 리텐션=경조사 장부
- [w03-chamgi](./weeks/w03-chamgi/) — 참은 지 N일 (계획) · 바이럴=공유 카운터
- [w04-baedalbi](./weeks/w04-baedalbi/) — 이번 달 배달비 계산기 (계획) · 바이럴=치킨 환산
- [w05-sangsa](./weeks/w05-sangsa/) — 상사 말 번역기 (계획) · 바이럴=상황극+제보 사전
- [w06-gyosu](./weeks/w06-gyosu/) — 교수님 이메일 변환기 (계획) · 시즌=시험기간
- [w07-yasik](./weeks/w07-yasik/) — 야식 저금통 (계획) · 리텐션=스트릭+목표 게이지
- [w08-phishing](./weeks/w08-phishing/) — 보이스피싱 판별기 (계획) · 바이럴=효도 공유
- [w09-cooldown](./weeks/w09-cooldown/) — 싸움 카톡 쿨다운 (계획) · 바이럴=커플 공감
- [w10-jasoseo](./weeks/w10-jasoseo/) — 자소서 압축기 (계획) · 시즌=공채
- [w11-yageun](./weeks/w11-yageun/) — 야근 수당 카운터 (예비 슬롯)
- [w12-gallery](./weeks/w12-gallery/) — 시즌1 전시관+투표 (계획)
- [w01-example](./weeks/w01-example/) — (템플릿)

## Git 사용법

### 처음 한 번 (클론)

```bash
git clone https://github.com/HD152521/jugan.lab.repo.git
cd jugan.lab.repo
```

### 커밋 메시지 규칙

작업한 **영역 prefix**를 붙인다. 로그만 봐도 뭐가 바뀌었는지 보이게.

| prefix | 대상 |
|--------|------|
| `w03: ...` | 3주차 작업 (`weeks/w03-*`) |
| `skills: ...` | 스킬 라이브러리 |
| `agents: ...` | 에이전트 정의 |
| `prompts: ...` | 프롬프트 |
| `apps: ...` | 배포 프로덕트 |
| `chore: ...` | 설정·구조 등 기타 |

예:
```bash
git commit -m "w03: RabbitMQ 바인딩 실습 코드 추가"
git commit -m "skills: 영상 프롬프트 생성 스킬 v2"
```

### 매번 하는 작업 흐름

```bash
git status                 # 뭐 바뀌었는지 확인
git add .                  # 전체 스테이징 (또는 git add <경로>로 부분만)
git commit -m "w03: ..."   # 커밋
git push origin main       # 원격 반영
```

작업 시작 전에 최신화:
```bash
git pull origin main
```

### 주차 마무리 (태그)

한 주 끝나면 그 시점을 태그로 박아둔다. 나중에 "3주차 끝난 상태"를 바로 꺼내볼 수 있음.

```bash
git tag w03                # 태그 생성
git push origin w03        # 태그 원격에 push (태그는 push에 안 딸려감)

git tag                    # 태그 목록
git checkout w03           # 그 시점 상태로 이동 (구경용, 작업은 main에서)
```

### 브랜치 (선택)

혼자면 `main`에 직접 작업해도 무방. 깔끔하게 하고 싶으면 주차별 브랜치:

```bash
git switch -c w03          # w03 브랜치 생성 + 이동
# ... 작업 ...
git switch main
git merge w03              # main에 합치기
git branch -d w03          # 브랜치 정리
```

### 자주 쓰는 조회

```bash
git log --oneline -10          # 최근 10개 커밋 한 줄로
git log --oneline -- weeks/w03 # 특정 폴더 변경 이력만
git diff                       # 아직 스테이징 안 한 변경
git restore <파일>             # 변경 되돌리기 (커밋 전)
```

> 산출물(mp4 등)·`.env`는 `.gitignore`로 이미 제외됨. 실수로 커밋하지 않게 `git status`로 한 번 확인하는 습관.

## 배포 (Vercel)

`apps/` 하위 각 앱을 별도 Vercel 프로젝트로 연결하되 **Root Directory**를 해당 폴더로 지정.
불필요한 빌드는 프로젝트 Settings → Git → Ignored Build Step 에서 차단:

```bash
git diff --quiet HEAD^ HEAD -- ./
```
