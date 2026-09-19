# 진폭 제작 패키지 v1 - AI 생성 규격

이 문서는 다른 사람이나 AI가 진폭스튜디오 1.5V에서 바로 열 수 있는 `.jinpok.json` 제작 패키지를 만들기 위한 규격이다.

함께 전달할 파일:

- `jinpok-production-package-v1.schema.json`: 기계 검사용 JSON Schema
- `jinpok-production-package-v1.example.jinpok.json`: 독립 작품 완성 예시
- `jinpok-production-package-v1.series-example.jinpok.json`: 시리즈 권 매핑 완성 예시

## 1. AI에게 그대로 주는 요청문

아래 요청문 뒤에 작가·작품·세계관·원고 자료를 붙이면 된다.

```text
첨부한 "진폭 제작 패키지 v1 - AI 생성 규격"과 JSON Schema를 준수하여
진폭스튜디오 1.5V에서 가져올 수 있는 제작 패키지를 만들어라.

필수 조건:
1. 결과는 설명이나 마크다운 코드블록 없이 JSON 객체 하나만 출력한다.
2. kind는 반드시 "jinpok-production-package", schemaVersion은 반드시 1이다.
3. package.sourceApp은 "jinpok-stido", sourceSchema는 "1.5"다.
4. 모든 작가·시리즈·작품 ID는 서로 중복되지 않는 문자열로 만든다.
5. Novel.aiAuthorId, Novel.seriesId, Series.novelIds, blueprint의 linkedNovelId는
   payload 안의 실제 ID와 정확히 연결한다.
6. 포함하지 않는 자료는 manifest.sections에서 false로 표시하고 해당 배열은 비우거나
   선택 필드를 생략한다.
7. appSettings, API 키, 인증 토큰, remote cache handle, lorekeeperCache,
   generationLogs는 절대 넣지 않는다.
8. manifest.counts는 payload의 실제 개수와 일치시킨다.
9. 원고가 없더라도 Novel.chapters와 Novel.history는 빈 배열로 넣는다.
10. 독립 작품은 Novel.characters와 Novel.worldviewFiles에 설정을 넣는다.
    시리즈 작품은 공유 인물·세계관을 Series에 넣고 각 Novel에는 중복 저장하지 않는다.
11. 알 수 없는 내용을 임의로 지어내지 말고 빈 문자열, 빈 배열 또는 필드 생략으로 처리한다.
12. JSON 문법을 마지막에 자체 검사한 뒤 출력한다.
13. 세계관 파일은 집필 우선순위 순서로 배열한다. 첫 파일은 반드시 작품헌법·절대규칙처럼
    매 화 지켜야 하는 핵심 설정으로 만들고, 나머지는 조직·시설·등급·인물군·에피소드 규칙처럼 주제별로 나눈다.
14. 세계관 원문이 12,000자를 넘으면 한 파일에 몰아넣지 말고 권장 6~12개 파일로 분리한다.
    사실을 줄이거나 요약해 버리지 말고 원문 정보를 주제 파일에 보존한다.
15. Novel.useLorekeeper는 특별히 끌 이유가 없다면 true로 넣는다.
16. 시리즈 작품은 Series.blueprint.volumes[].id와 Novel.seriesVolumeId를 정확히 연결하고,
    volumeNumber는 표시·정렬용으로만 사용한다.
17. 여러 회차에 걸친 집필 방향은 episodePacing.scope를 until-complete로 두고,
    goal에는 전개 방향, 선택적 destination에는 도달 상태를 구분해 기록한다.
18. contextSummary.rollups와 Series.seriesMemoryState는 진폭스튜디오가 원고·요약에서 파생하는
    내부 가속 데이터다. 외부 AI가 새 기획 패키지를 만들 때는 임의 생성하지 말고 생략한다.
```

## 2. 파일 규칙

- 권장 파일명: `진폭_제작패키지_{작품명}_r1.jinpok.json`
- 인코딩: UTF-8
- 최상위 값: JSON 객체 하나
- 주석: 금지
- 후행 쉼표: 금지
- 날짜 문자열: ISO 8601, 예: `2026-08-21T14:00:00.000Z`
- 시간 숫자: Unix 밀리초, 예: `1787320800000`
- ID: UUID 권장. UUID가 어렵다면 패키지 안에서 절대 겹치지 않는 영문 ID 사용

## 3. 최상위 구조

```json
{
  "kind": "jinpok-production-package",
  "schemaVersion": 1,
  "package": {},
  "sourceWorkspace": {},
  "manifest": {},
  "payload": {
    "authors": [],
    "series": [],
    "novels": []
  }
}
```

### package

| 필드 | 형식 | 설명 |
|---|---|---|
| `packageId` | string | 이번 파일의 고유 ID. 새 파일마다 새로 생성 |
| `lineageId` | string | 같은 의뢰·납품 계보에서 유지하는 ID |
| `revision` | integer | 최초 1, 수정본은 2, 3 순서 |
| `parentPackageId` | string 또는 null | 직전 파일의 packageId. 최초는 null |
| `title` | string | 패키지 표시 이름 |
| `purpose` | enum | `planning`, `commission`, `continuation`, `delivery`, `settings-share` |
| `publisher` | string | 제작사·출판사·전달자 이름 |
| `createdAt` | ISO string | 파일 생성 시각 |
| `sourceApp` | string | 반드시 `jinpok-stido` |
| `sourceSchema` | string | 반드시 `1.5` |

### sourceWorkspace

외부 AI가 새로 만드는 파일이면 실제 작업실이 없으므로 다음처럼 적어도 된다.

```json
{
  "id": "external-ai-workspace",
  "name": "외부 AI 제작 패키지"
}
```

## 4. 포함 정보 스위치

`manifest.sections`의 여덟 필드는 반드시 모두 있어야 한다.

| 스위치 | true일 때 포함하는 정보 |
|---|---|
| `authors` | AI 작가 프로필 |
| `workCore` | 제목, 소재, 분위기, 줄거리, 목표 분량, 담당 관계 |
| `planning` | 문체 설정, 트리트먼트, 에피소드 아크, 복선, 집필 설정 |
| `worldbuilding` | 등장인물, 세계관 파일, 시리즈 청사진 |
| `manuscript` | 챕터 본문 |
| `memory` | 작품 전용 기억, 요약, 스냅샷 |
| `collaboration` | 글쓰기 지시와 협업 대화 |
| `assets` | base64 표지 이미지 |

권장 프리셋:

```json
{
  "기획안": {
    "authors": true,
    "workCore": true,
    "planning": true,
    "worldbuilding": true,
    "manuscript": false,
    "memory": false,
    "collaboration": false,
    "assets": false
  },
  "원고납품": {
    "authors": true,
    "workCore": true,
    "planning": true,
    "worldbuilding": true,
    "manuscript": true,
    "memory": true,
    "collaboration": true,
    "assets": true
  }
}
```

실제 파일에는 위 프리셋 이름을 넣지 말고, 선택한 여덟 개 boolean만 `manifest.sections`에 넣는다.

## 5. payload.authors

작가 한 명의 최소 구조:

```json
{
  "id": "author-unique-id",
  "name": "작가 이름",
  "specialty": "주력 장르와 강점",
  "writingStyle": "문장, 시점, 호흡, 대사 스타일",
  "coreDirectives": "집필 시 반드시 지킬 지침",
  "createdAt": 1787320800000,
  "tags": ["현대판타지", "빠른전개"]
}
```

선택 필드:

- `memoryCache: string[]`: 장기 작가 기억. `memory`가 true일 때만 권장
- `profileVersions: object[]`: 작가 프로필 버전
- `metaChatHistory`, `generalChatHistory`: Google Content 배열. 보통 외부 AI 생성 패키지에서는 생략
- `isDefault`: 외부 생성 작가는 `false` 권장

## 6. payload.novels

작품 한 개의 필수 필드:

```json
{
  "id": "novel-unique-id",
  "title": "작품명",
  "subject": "핵심 소재",
  "mood": "작품 분위기",
  "plotSummary": "전체 줄거리 또는 해당 권의 줄거리",
  "chapters": [],
  "history": [],
  "createdAt": 1787320800000,
  "aiAuthorId": "author-unique-id",
  "characters": []
}
```

### workCore 필드

- `aiAuthorId`: 담당 작가 ID. 미배정이면 `null`
- `seriesId`: 시리즈 ID. 독립 작품이면 생략
- `seriesVolumeId`: 연결할 `Series.blueprint.volumes[].id`. 시리즈 작품은 이 값을 권장
- `volumeNumber`: 화면 표시·정렬용 권수. 실제 연결 기준은 `seriesVolumeId`
- `targetCharacterCount`: 목표 글자 수
- `targetChapterCount`: 목표 회차 수
- `preventAutoEnding`: 자동 완결 방지

### planning 필드

- `avoidRepetition`: 반복 서사 방지
- `episodePacing`: 집필 집중과 문장 호흡 설정. `scope`는 `next-chapter` 또는 `until-complete`. 장기 집중은 `goal`에 전개 방향, 선택적 `destination`에 도달 상태를 기록
- `episodeArc`: `{ "goal": "...", "chapters": [], "startChapterIndex": 0 }`
- `treatment`: 전체 시놉시스와 화별 설계
- `webnovelSettings`: 장르·플랫폼·문체 설정
- `openingStyle`: `intense`, `buildup`, `mystery`, `prologue`
- `startingPoint`: `daily`, `crack`, `before-incident`, `mid-incident`
- `generationEngine`: 현재 기본 권장값 `gemini-3.7-flash`. `gemini-3.8-flash`는 본문 집필 시험용으로 명시적으로 선택할 때만 사용
- `chapterGenerationMode`: `single`(1화), `extended`(긴 1화), `batch2`(2화 연속), `batch3`(3화 연속). 기본 `single`
- `chapterTargetCharacters`: 한 회차가 실제로 도달할 목표 본문 글자 수. 기본 `6000`, 허용 `2000~15000`
- `maxTokens`: 이전 버전 호환용 필드. 생략 가능하며 현재 앱은 목표 글자와 모델에 맞춰 내부 상한을 자동 계산
- `contextManagement`: 자동 요약 설정
- `contextCaching`: 넣는다면 `caches`는 반드시 빈 객체 `{}`

### worldbuilding 필드

등장인물:

```json
{
  "id": "character-unique-id",
  "name": "인물명",
  "personality": "성격과 행동 원리",
  "appearance": "외형",
  "background": "과거와 현재 역할",
  "log": "현재까지의 성장·변화 기록"
}
```

세계관 파일:

```json
{
  "filename": "세계의 법칙.txt",
  "content": "AI가 집필 때 참고할 수 있는 구체적인 설정"
}
```

세계관 파일 배열은 곧 기본 우선순위다. 대형 세계관 권장 순서:

```text
00_작품헌법과 절대규칙.txt
01_공개사회와 공공연한비밀.txt
02_주요조직과 시설.txt
03_회원등급과 경제구조.txt
04_핵심인물군과 관계규칙.txt
05_에피소드별 상세설정.txt
```

- 전체 원문 합계가 12,000자를 넘으면 진폭스튜디오는 대형 세계관 모드로 자동 전환한다.
- 앞쪽 핵심본은 집필 시스템 문맥에 유지하고, 기록보관자는 현재 회차 지시와 직전 장면을 기준으로 전체 로컬 원문에서 관련 구역을 선별한다.
- 이 동작은 제작 패키지 스키마를 바꾸지 않는다. `worldviewFiles`에는 축약본이 아니라 보존할 원문을 그대로 넣는다.
- 시리즈 공통 규칙은 `Series.worldviewFiles`에 둔다. 특정 권에서만 달라지는 설정은 해당 `Novel.worldviewFiles`에 둘 수 있으며, 같은 파일명이면 작품 전용 파일이 시리즈 공통 파일을 덮어쓴다.
- 기록보관자 검색에는 별도 AI 호출이 들지 않는다.

### manuscript 필드

챕터:

```json
{
  "id": "chapter-unique-id",
  "title": "1화. 제목",
  "content": "원고 본문",
  "chapterNumber": 1
}
```

- 챕터 ID는 작품 안에서 중복되면 안 된다.
- 본문이 없으면 `chapters: []`로 둔다.
- `feedbackChat`, `authorInterlude`는 선택 필드다.
- `trace`는 앱이 생성·입고 시 자동 부여하므로 외부 AI가 새 패키지를 만들 때는 생략해도 된다.
- 앱 내부에서는 회차 ID가 순서·제목 변경과 무관한 원본 좌표이며, 본문 수정 때 `trace.revision`만 증가한다.

### memory 필드

- `authorMemoryByAuthor`: 작가 ID를 키로 쓰는 문자열 배열 객체
- `contextSummary`: 원고 요약. 챕터 ID를 정확히 연결할 수 없으면 생략
- `canonFacts`: 현재 유효한 인물 상태·관계·비밀 등을 챕터 ID에 연결한 시간축 사실 장부
- `snapshots`: 완전한 작품 스냅샷. 외부 AI 신규 생성 시 보통 생략

Canon 항목은 `sourceChapterId`, `validFromChapterId`, `validUntilChapterId`로 회차를 연결한다. 원고가 없는 기획 패키지라면 생략하고, 확실하지 않은 사실은 `status: "draft"`로 둔다. `locked: true`는 사용자가 직접 확정한 항목에만 사용한다.

예시:

```json
{
  "authorMemoryByAuthor": {
    "author-unique-id": [
      "주인공은 타인의 기억을 읽을 수 있지만 자기 기억은 읽지 못한다.",
      "전투보다 협상과 추리가 우선이다."
    ]
  }
}
```

## 7. payload.series

시리즈가 없다면 반드시 빈 배열 `[]`을 넣는다.

```json
{
  "id": "series-unique-id",
  "title": "시리즈명",
  "seriesPlotSummary": "전 권을 관통하는 줄거리",
  "characters": [],
  "worldviewFiles": [],
  "novelIds": ["novel-volume-1", "novel-volume-2"],
  "createdAt": 1787320800000,
  "blueprint": {
    "worldview": "시리즈 세계관 핵심",
    "mainConflict": "전체 갈등",
    "characterArcs": "주요 인물 성장선",
    "volumes": [
      {
        "id": "series-volume-1",
        "volumeNumber": 1,
        "displayLabel": "1권",
        "title": "1권 제목",
        "localSetting": "1권에서만 적용되는 지역·조직·분위기·한시적 규칙",
        "goal": "1권 목표",
        "mainConflict": "1권 갈등",
        "keyEvents": "핵심 사건",
        "status": "planned",
        "linkedNovelId": "novel-volume-1"
      }
    ],
    "lastUpdated": 1787320800000
  }
}
```

시리즈 규칙:

- `Series.novelIds`는 소속 작품 목록이며 권 순서의 기준이 아니다.
- 실제 권 연결은 `Novel.seriesVolumeId`와 `blueprint.volumes[].id`의 일치로 판단한다.
- 화면 순서와 권 번호는 `blueprint.volumes[].volumeNumber`를 사용한다. 번호가 바뀌어도 `id`는 바꾸지 않는다.
- 각 소설의 `seriesId`는 이 시리즈 ID와 같아야 한다.
- `blueprint.volumes[].linkedNovelId`는 실제 작품 ID여야 하며 한 작품과 한 권 계획은 1:1로 연결한다.
- `blueprint.worldview`, `mainConflict`, `characterArcs`는 전 권 공통 기준이다.
- `blueprint.volumes[].localSetting`, `goal`, `mainConflict`, `keyEvents`는 매핑된 해당 권에만 적용한다.
- 권 전용 설정이 공통 설정과 어긋나면 임의로 합치지 말고, 공통 Canon을 유지한 채 해당 권의 국소 변주로 작성한다.
- 공유 인물과 세계관은 Series에 넣는다.
- 시리즈 소속 Novel의 `characters`는 `[]`, `worldviewFiles`는 `[]` 권장이다.
- 단, 해당 권에서 시리즈 공통 설정을 의도적으로 덮어쓸 때만 Novel에 같은 파일명의 세계관 파일을 넣는다.

## 8. manifest.counts 계산

| 필드 | 계산법 |
|---|---|
| `authors` | `payload.authors.length` |
| `series` | `payload.series.length` |
| `novels` | `payload.novels.length` |
| `chapters` | 모든 Novel의 `chapters.length` 합 |
| `characters` | 모든 Novel과 Series의 `characters.length` 합 |
| `worldviewFiles` | 모든 Novel과 Series의 `worldviewFiles.length` 합 |
| `assetBytes` | 이미지가 없으면 0. 정확히 계산하기 어렵다면 assets를 false로 하고 0 |

`omittedSensitiveFields` 권장 고정값:

```json
[
  "appSettings",
  "apiKeys",
  "remoteCacheHandles",
  "lorekeeperCache",
  "generationLogs"
]
```

## 9. 절대 넣으면 안 되는 값

- Gemini, xAI, GLM API 키
- 로그인 정보, OAuth 토큰, 쿠키
- `appSettings`
- `lorekeeperCache`
- `generationLogs`
- Google 캐시 리소스 이름과 만료 시각
- 로컬 파일 절대경로
- 사용자 개인정보

## 10. 최종 자체 검사

AI는 출력 전 다음을 확인한다.

1. JSON 파싱이 되는가?
2. 여덟 section boolean이 모두 있는가?
3. 모든 payload 배열이 있는가?
4. 모든 Novel에 필수 필드와 빈 배열이 있는가?
5. 모든 관계 ID가 payload 안에서 실제로 존재하는가?
6. 엔터티 ID가 서로 중복되지 않는가?
7. counts가 실제 배열 개수와 맞는가?
8. false인 section의 민감하거나 불필요한 데이터가 빠졌는가?
9. API 키와 원격 캐시가 없는가?
10. JSON 밖에 설명 문장이 붙지 않았는가?

완성된 파일은 진폭스튜디오 홈의 `제작 패키지 센터`에서 `패키지 가져오기`로 연다.
