# 진폭 TS STUDIO — TS 사전 원자료 조사 기록

조사일: 2026-09-17

## 목적

이 문서는 앱용 정규화 사전(`src/@core/ts/dictionary.ts`)과 분리된 **원자료 조사 기록**이다.

순서는 반드시 다음을 따른다.

1. 실제 자료에서 용어/분류/정의를 확인한다.
2. 출처별 의미 차이와 중복을 기록한다.
3. 충분히 교차 확인된 뒤 앱용 canonical ID와 규칙으로 정규화한다.

따라서 이 문서의 조사 메모가 먼저이며, `dictionary.ts`는 여기서 파생된 앱용 해석본이다.

---

## 일본 TSF

### TSFes
출처: https://tsfes.com/about/

확인 내용:
- TSF를 성별의 전환에 관한 창작으로 설명한다.
- 실제 기획 테마/장르 분류 예시로 `女体化`, `憑依`, `入れ替わり`, `皮モノ`, `他者変身`을 명시한다.
- 따라서 일본 TSF에서 이 용어들은 단순 번역어가 아니라 서로 구별되는 실무 분류로 취급할 가치가 있다.

### なろうTS大図書館 — TS用語集
출처: https://ncode.syosetu.com/n6126gu/2/

확인 내용:
- `朝おん`: 남성이 아침에 일어났더니 여성의 몸이 되어 있는 정형 상황.
- `朝おと`: 위의 반대 방향(여→남) 용례.
- `入れ替わり`: 두 사람의 육체/영혼이 서로 바뀌는 설정으로 설명.
- 일본 TS 커뮤니티에서는 변환 원인/상황 자체를 세부 용어로 분리해 사용한다.

### JapanDict / JMdict — 男の娘
출처: https://www.japandict.com/%E7%94%B7%E3%81%AE%E5%A8%98?lang=eng

확인 내용:
- `男の娘`은 여성적으로 보이거나 여성적 젠더 표현을 하는 젊은 남성, 특히 여장을 포함하는 경우의 속어로 설명된다.
- 이것 자체는 신체 성전환을 뜻하지 않는다.
- 앱에서는 `character_expression` 계열로 분리하고 TS 발생 여부와 독립적으로 취급하는 것이 타당하다.

---

## 영어권 TG/TF·Genderswap

### Fictionmania (Fanlore 정리)
출처: https://fanlore.org/wiki/Fictionmania

확인 내용:
- Fictionmania는 gender-change, crossdressing, genderswap, transformation 계열 창작 아카이브다.
- Category와 Keyword를 구분하며, 변화 방식/원인/장르/취향을 별도로 태깅한다.
- 변화 방식 카테고리로 다음이 실제 분리되어 있다:
  - Body Suits
  - Body Swap
  - Chemical or Drug Induced Change
  - Fast Transformation
  - Identity Death
  - Magical Transformations
  - Mind Altered / Hypnosis / Brainwashed
  - Mind Transfer / Mind Possession
  - Multiple Transformations
  - Slow Transformation
  - Stuck
  - The Operation
  - Transitioning
- 특히 Body Swap과 Mind Transfer/Possession을 다른 카테고리로 취급한다.
- `Identity Death`, `Mind Altered`, `Stuck`는 향후 상태 엔진/검수용 별도 축 후보로 가치가 있다.

### Fanlore — Genderswap
출처: https://fanlore.org/wiki/Genderswap

확인 내용:
- `genderswap`은 하나의 의미만 갖지 않는다.
- 작중에서 마법/기술로 갑자기 성별이 바뀌는 경우와, 처음부터 다른 성별로 존재하는 `always-a-girl/boy`형이 모두 포함될 수 있다.
- `Gender Bender`는 작중 갑작스러운 gender/sex change 용례로 설명되는 반면, `Rule 63`은 대체 성별 버전 의미가 강하다.
- 따라서 앱에서는 `in-story transformation`과 `alternate-gender redesign`을 분리해야 한다.

### AO3 — Gender Transition canonical 재구성 공지
출처: https://secure.ao3.org/admin_posts/30937

확인 내용:
- 기존 `Sex Change`를 `Changes to Gender or Sex`의 동의어로 재정리.
- `Gender Transition`, `Medical Gender Transition`, `Forced Gender Transition`을 분리한다.
- 이는 창작물의 초자연적/강제적 성별 변화와 현실적 의료 전환을 하나의 의미로 뭉개지 말아야 한다는 근거가 된다.
- 진폭 TS 사전에서도 현실의 트랜스젠더 의료 전환과 TS 장르적 변환 장치를 자동 동의어 처리하지 않는다.

---

## 한국 TS물

### 리브레 위키 — TS물
출처: https://librewiki.net/wiki/TS%EB%AC%BC

확인 내용:
- TS물을 성전환이 주제가 되는 창작물로 설명한다.
- 주요 유형으로:
  - 몸 바꾸기(body swap)
  - 변신(transformation)
  - 빙의(possession)
  - 수술(surgery)
  - 환생(reincarnation)
- 응용 유형으로:
  - 가죽(skinsuit)
  - 복제인간(clone)
  - 부분 성전환(feminization)
  - 평행 세계(parallel world)
을 제시한다.
- 한국권 분류 역시 메커니즘을 세분화하는 경향이 확인된다.

### 나무위키/커뮤니티 자료
예시: https://namu.moe/w/TS%EB%AC%BC

사용 원칙:
- 한국 웹소설/커뮤니티 은어의 실제 사용 범위 확인용.
- 공식 표준으로 취급하지 않는다.
- `암타`, `TS 스킨`, `나데나데`, `틋녀` 등 의미 이동이 큰 표현은 별도 교차검증 전까지 `community` confidence로 둔다.

---

## 현재까지 원자료에서 직접 확인된 핵심 분리

- `Body Swap` ≠ `Possession/Mind Transfer`
- `Slow Transformation` ≠ `Fast Transformation`
- `TSF` 안에서도 女体化 / 憑依 / 入れ替わり / 皮モノ / 他者変身은 별도 분류로 쓰인다.
- `男の娘/Otokonoko`는 캐릭터 표현 용어이며, 그 자체로 신체 성전환을 의미하지 않는다.
- `Genderswap`은 작중 변화와 처음부터 다른 성별 버전을 모두 포함할 수 있으므로 하위 분리가 필요하다.
- `Rule 63`은 특히 alternate-gender redesign 쪽 의미가 강하다.
- 현실적 `Gender Transition`과 장르적 `Changes to Gender or Sex`를 동일 개념으로 취급하지 않는다.

---

## 아직 조사 부족 — 앱에서 확정값으로 쓰지 말 것

다음은 추가 자료조사 전까지 **초안/커뮤니티 용례**로만 유지한다.

- 한국: 나데나데, TS 스킨, 약백합, 노맨스, 역키잡, 암타, 시우/시아, 틋붕/틋녀/틋남
- 일본: 可変TS, 集団TSF, TS転移, TS病의 범위와 하위 관습
- 영어권: Sissification, Forced Feminization, Identity Death, Stuck의 현재 커뮤니티별 의미 차이
- 중국권: 性转/性轉 및 주요 플랫폼 분류 체계

## 다음 조사 방식

각 용어마다 최소 2개 이상의 독립 자료를 확인하고 다음 표준으로 기록한다.

- 원문 용어
- 출처
- 원문 정의 요약
- 지역/플랫폼
- 다른 용어와의 차이
- 실제 태그/카테고리 여부
- 앱 canonical 후보
- 신뢰도
- 집필 규칙으로 변환 가능한 부분
- 상태/연속성 검수로 변환 가능한 부분
