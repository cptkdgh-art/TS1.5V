import type { TsWorkDesign } from './work-design';
import { buildTsWorkDesignBrief } from './work-design';

/** Shared conditional facts, never an automatic plot or a replacement author voice. */
export const TS_GENRE_CORE_GUIDE = `--- [TS 연속성 참고 — 선택·확정된 설정에만 적용] ---
TS라는 분류만으로 신체 변화·정체성 갈등·연애·사회적 역할 변화·복귀 사건을 추가하지 않는다.

1. 이미 확정된 변화 규칙만 유지한다.
- 원인·속도·범위·비용·부작용·가역성이 정해졌다면 모순시키지 않는다. 미정인 항목을 사전의 기본값으로 확정하지 않는다.
- 변화가 점진적이라는 사실과 문장이 느리게 읽힌다는 성향을 혼동하지 않는다.

2. 몸·의식·기억·정체성은 서로 별개다.
- 몸이 바뀌었다고 성격·기억·기호가 자동으로 바뀌지 않는다.
- 교체나 빙의가 설정되어 있다면 누가 어느 몸에 있고 무엇을 아는지 유지한다. 원주인 공존·기억 습득은 설정된 경우에만 존재한다.

3. 정보 공개와 세계 기록을 유지한다.
- 누가 정체를 알고 있는지, 어떤 기록이 변경되었는지는 이전 사건을 따른다.
- 들킴·기억개변·관계 변화가 없었다면 이를 새로 발생시키라는 뜻이 아니다.

4. 작품 분류와 작가 숙련 분야를 분리한다.
- 대표·추가 타입, 배경, 분위기는 사용자가 선택한 작품 정보다. 작가 전문 태그로 작품 선택값을 변경하지 않는다.
- 구체적인 작품 핵심·시리즈/권별 지시가 넓은 분류명보다 우선한다.

5. 사전의 흐름도와 예시 장면은 필수가 아니다.
- 모든 작품이 최초 인지·적응·발각·정체성 변화·복귀 순서를 거칠 필요는 없다.
- 장면은 사용자 요청과 현재 이야기의 필요에서 나오며, 확정된 관계·사건 순서·결말을 문체 성향으로 바꾸지 않는다.`;

export function buildTsStudioBrief(design: TsWorkDesign): string {
  return `${TS_GENRE_CORE_GUIDE}\n\n--- [작품별 TS 설계] ---\n${buildTsWorkDesignBrief(design)}`;
}

/** Existing 1.5 callers can still provide their original classification fields. */
export function buildTsGenreBrief(input: {
  primaryGenre?: string;
  subgenres?: string[];
  themes?: string[];
}): string {
  if (input.primaryGenre !== 'TS') return '';
  const selected = [
    input.subgenres?.length ? `선택된 TS 요소: ${input.subgenres.join(', ')}` : '',
    input.themes?.length ? `추가 초점: ${input.themes.join(', ')}` : '',
  ].filter(Boolean).join('\n');
  return `${TS_GENRE_CORE_GUIDE}${selected ? `\n\n${selected}` : ''}`;
}
