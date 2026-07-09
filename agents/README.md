# agents

@jugan.lab 릴스 제작 파이프라인 에이전트 5종. Claude Code 커스텀 에이전트 형식(.md + frontmatter).

## 로스터

| 에이전트 | 역할 | 모델 | 실행 순서 |
|----------|------|------|-----------|
| `reels-trend-scout` | 이번 주 릴스 트렌드 조사 → 트렌드리포트.md | sonnet | 1 |
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
