# agents

@jugan.lab 릴스 제작 파이프라인 에이전트 5종. Claude Code 커스텀 에이전트 형식(.md + frontmatter).

> **브랜드 원본 = JuganLab 노션 릴스 킷.** 마스코트=안경 오리(크루드 손드로잉, 필수 주연), 팔레트=딥그린+옐로우(민트 아님), 톤=개발자 반말·밈·자학. 목표는 앱 소개가 아니라 **알고리즘 도달** — 화면넘기기 대신 공감·페인 서사. 레퍼런스는 블로그가 아니라 실제 릴스 3~5개.

## 로스터

| 에이전트 | 역할 | 모델 | 실행 순서 |
|----------|------|------|-----------|
| `reels-trend-scout` | 사용자가 준 릴스 3~5개 분석 → 레퍼런스리포트.md (블로그·마케팅 글 금지) | sonnet | 1 |
| `reels-strategist` | 알고리즘 타는 영상 기획 → 기획서.md | opus | 2 |
| `reels-scriptwriter` | 초 단위 대본 + 캡션 → 대본.md | sonnet | 3 |
| `reels-producer` | Playwright+TTS+ffmpeg로 mp4 제작 | sonnet | 4 |
| `reels-director` | 각 단계 검수 게이트 + 최종 업로드 승인 | opus | 각 단계 후 |

## 사용법

Claude Code가 에이전트를 인식하려면 이 파일들을 `.claude/agents/`로 복사해야 한다:

```powershell
# 레포에서 작업할 때 (프로젝트 레벨)
Copy-Item agents\reels-*.md .claude\agents\
```

주간 워크플로 (메인 세션에서 순서대로 실행):

```
1. reels-trend-scout 실행  → director 검수
2. reels-strategist 실행   → director 검수
3. reels-scriptwriter 실행 → director 검수
4. reels-producer 실행     → director 최종 승인 + 업로드 체크리스트
```

산출물은 전부 `weeks/<주차>/promo/`에 쌓인다 (mp4는 .gitignore 제외 대상).

> 참고: 서브에이전트는 다른 서브에이전트를 호출할 수 없으므로,
> 단계 간 연결(다음 에이전트 실행)은 메인 세션이 담당한다. director는 게이트 검수만.

## 한 번에 돌리기 — `reels-weekly` 스킬

위 4단계 + director 게이트 순서 연결을 매번 수동으로 하지 않도록 오케스트레이터 스킬로 묶어뒀다:
[`skills/reels-weekly`](../skills/reels-weekly/SKILL.md).

```
/reels-weekly w05      # w05 주차 릴스 파이프라인 끝까지 실행
```

스킬이 트렌드→기획→대본→영상을 순서대로 호출하고, 스테이지마다 director 게이트를 통과시킨다.
(이 에이전트들이 `.claude/agents/`에 복사돼 있어야 함)
