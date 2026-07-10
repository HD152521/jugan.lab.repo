# skills

여러 주차에 걸쳐 재사용하는 스킬 라이브러리. 스킬 하나당 폴더 하나 권장.

```
skills/
└── <skill-name>/
    └── SKILL.md
```

## 로스터

| 스킬 | 역할 | 트리거 |
|------|------|--------|
| `reels-weekly` | 주간 릴스 파이프라인 오케스트레이터. `agents/reels-*` 5종을 순서대로 실행하고 각 단계 director 게이트 검수 | `/reels-weekly w05` 또는 "이번 주 릴스 만들어줘" |

## 사용법

Claude Code가 스킬을 인식하려면 `.claude/skills/`로 복사한다(에이전트와 동일 패턴):

```powershell
Copy-Item -Recurse skills\reels-weekly .claude\skills\
```

> `reels-weekly`는 `agents/reels-*.md`가 `.claude/agents/`에 있어야 동작한다(스킬이 그 에이전트들을 순서대로 호출).
