# 진폭 TS STUDIO — TS 사전 기초조사 v0.1

조사일: 2026-09-17

## 목적

TS 사전을 단순 도움말이 아니라 작품 분류, 작가 추천, 집필 프롬프트, 상태 추적, 검수 엔진이 공통으로 참조하는 지식베이스로 사용한다.

이번 v0.1은 한국·일본·영어권에서 실제로 쓰이는 중심 용어와 대표 분류를 먼저 고정한 기초 조사다. 팬덤 용어는 플랫폼·시대·커뮤니티별 의미가 달라질 수 있으므로 **canonical ID와 지역별 label/alias를 분리**한다.

## 조사 결론

### 1. TS / TSF / TG·TF는 완전한 1:1 번역어가 아니다

- 일본 `TSF`는 성별·성적 신체 변화가 중심인 픽션 장르명으로 오랫동안 쓰여 왔다.
- 한국 `TS물`은 일본 TSF 계열의 영향을 강하게 받았고, 변신·교체·빙의·환생·가죽 등을 넓게 묶어 부르는 경우가 많다.
- 영어권 `TG/TF`는 변환 창작 커뮤니티에서 쓰이는 넓은 실무 용어다. `TF`는 일반 transformation, `TG`는 gender/sex transformation 쪽으로 쓰이지만 사이트마다 경계가 다르다.
- 앱 내부에서는 `tsf`, `tg_tf`, `gender_change`를 별도 항목으로 두고 서로 관련 개념으로 연결한다.

### 2. 작중 변화와 팬덤 성반전 버전을 분리한다

- `Rule 63`, `Always a Girl/Boy`, 일부 `genderbend/genderswap` 용례는 캐릭터가 작품 안에서 변한 것이 아니라 처음부터 다른 성별 버전으로 재설계된 2차창작을 가리킬 수 있다.
- 일본 `女体化`도 문맥에 따라 작중 여체화와 2차창작 성반전 양쪽에 쓰일 수 있다.
- 따라서 `inStoryTransformation: boolean` 같은 구분이 필요하다.

### 3. 변환 메커니즘은 최소 다음을 분리한다

- body transformation
- body swap / 入れ替わり
- possession / mind possession / 憑依
- reincarnation / TS転生
- skinsuit / bodysuit / 皮モノ
- reality rewrite / 現実改変
- avatar/new-body lock-in
- surgery/body modification
- disease / TS病
- sudden aftermath setup / あさおん

특히 Body Swap과 Possession은 상태 추적 규칙이 다르므로 하나로 합치지 않는다.

### 4. 변화 방향과 변화 내용은 별도 축이다

- MtF / FtM은 방향이다.
- Feminization / Masculinization은 과정·표현의 초점이다.
- 완전한 sex change가 없어도 외형·목소리·행동·역할만 여성화/남성화될 수 있다.
- 신체 변화와 정신·자아 변화는 독립 축으로 저장한다.

### 5. 일본 TSF에서 실무적으로 확인되는 별도 용어

- `男の娘 / Otokonoko`: 여성적으로 보이거나 여성적 표현을 하는 남성 캐릭터. 그 자체로 TS는 아니다.
- `女装 / 女装男子`: 여장. 신체 변화 없이 캐릭터 표현만 달라질 수 있다.
- `あさおん`: “朝起きたら女の子になっていた”의 약칭. 변화 장면보다 변화 이후의 일상·당혹·적응에서 시작하기 쉬운 정형 상황.
- `TS病 / 性転換病`: 병·바이러스·체질 등의 이유로 성별이 바뀌는 커뮤니티형 설정.
- `TS百合`: TS 여성 캐릭터가 포함된 GL/백합 관계 태그.

### 6. 영어권 TG/TF에서 실무적으로 유용한 별도 축

Fictionmania 계열 분류는 다음을 분리해 왔다.

- Body Suits
- Body Swap
- Mind Transfer / Mind Possession
- Fast Transformation
- Slow Transformation
- Stuck
- Magical Transformation
- Chemical / Drug Induced Change
- Identity Death
- Mental Alteration
- Crossdressing

진폭에서는 이 중 작품 생성에 바로 필요한 핵심만 canonical로 가져오고, 세부 성인/페티시 분류는 optional preference tag로 분리한다.

### 7. Feminization과 성인 페티시 용어를 분리한다

- `Feminization`은 신체·외형·목소리·행동·사회적 역할 등의 여성화 전체를 포괄할 수 있는 넓은 표현으로 둔다.
- `Sissification`은 영어권에서 복종·굴욕·역할 강제 등 성인/페티시 문맥을 동반하는 경우가 많아 일반 feminization과 자동 동의어 처리하지 않는다.
- 한국/일본의 `암컷타락 / メス堕ち`도 일반 TS 메커니즘이 아니라 성인 취향·관계 전개 태그로 분리한다.

## 앱 데이터 원칙

각 용어는 최소 다음 필드를 가진다.

- canonical ID
- category
- KO / EN / JA label
- aliases
- regions
- summary
- distinctions
- prompt hints
- continuity rules
- related IDs
- source IDs
- confidence
- maturity (`general` / `adult-context`)
- create-work 선택 노출 여부

현재 구현: `src/@core/ts/dictionary.ts`

## 프롬프트 참조 원칙

전체 사전을 매 회차 프롬프트에 넣지 않는다.

1. 작품의 TS 방향·타입·취향 태그에서 관련 canonical ID를 추출한다.
2. 관련 항목만 찾는다.
3. 각 항목의 summary + promptHint + continuityRules만 압축해 집필 컨텍스트에 넣는다.
4. 작가 정체성은 여전히 최상위 창작 주체이며, 사전은 “용어·규칙·연속성 참고” 역할만 한다.

이를 위해 다음 헬퍼를 추가했다.

- `resolveTsDictionaryIdsFromDesign()`
- `buildTsDictionaryPromptContext()`
- `searchTsDictionary()`

## 출처 등급 사용법

### 비교적 강한 기준

- Wiktionary: TSF의 일본어 역사적 용례
- JapanDict/JMdict: 男の娘 기본 사전 의미
- AO3 공식 태그 공지: Changes to Gender or Sex / Gender Transition 구분
- 실제 플랫폼 태그·카테고리: Kakuyomu, Narou 등

### 장르 실무 기준

- TSFes: 일본 TSF 창작 분류
- Fictionmania 분류 및 Fanlore 정리: 영어권 TG/TF 역사적 분류
- TSF 커뮤니티 용어집

### 커뮤니티 참고

- 한국 커뮤니티 위키·게시물은 한국어 은어와 실제 사용 범위 확인에 유용하지만 공식 표준으로 보지 않는다.
- `암컷타락`, `보추`, `나데나데`, `TS 스킨`처럼 의미 이동이 큰 용어는 반드시 `community` confidence로 유지하고 추후 추가 조사한다.

## v0.1에 반영한 핵심 항목

TSF, TG/TF, MtF, FtM, Gender Change, Transformation, Feminization, Masculinization, Body Swap, Possession, Reincarnation, Skinsuit, Reality Rewrite, Avatar Lock-in, Surgery/Body Modification, あさおん, TS病, 女体化, 男体化, 男の娘, Male Crossdressing, Rule 63, Slow Transformation, Fast Transformation, Mental/Identity Change, TS百合, Sissification, メス堕ち/암컷타락.

## 다음 조사 묶음

- 한국 웹소설: 나데나데, TS 스킨, 노맨스, 약백합, 착각, 역키잡 등 관계·톤 용어의 실제 사용 빈도와 경계
- 일본: 可変TS, 集団TSF, 現実改変, 皮モノ, 他者変身, TS転移, TS病 세부 관습
- 영어권: stuck, identity death, body suit, mental change, slow/fast TF의 현재 사이트별 용례
- 중국권: 性转/性轉 및 중국 플랫폼 태그 체계
- 각 항목별 “집필 시 발생하기 쉬운 연속성 오류” 규칙 추가

## 주요 조사 출처

- https://en.wiktionary.org/wiki/TSF
- https://www.japandict.com/%E7%94%B7%E3%81%AE%E5%A8%98?lang=eng
- https://tsfes.com/about/
- https://ncode.syosetu.com/n6126gu/2/
- https://kai-you.net/article/80374
- https://fanlore.org/wiki/Genderswap
- https://secure.ao3.org/admin_posts/30937
- https://fanlore.org/wiki/Fictionmania
- https://en.wikipedia.org/wiki/Transformation_Story_Archive
- https://en.wikipedia.org/wiki/Rule_63
- https://librewiki.net/wiki/TS%EB%AC%BC
- https://namu.moe/w/TS%EB%AC%BC
- https://namu.moe/w/%EB%AA%B8%20%EB%B0%94%EA%BE%B8%EA%B8%B0
- https://namu.moe/w/%EC%95%94%EC%BB%B7%ED%83%80%EB%9D%BD
