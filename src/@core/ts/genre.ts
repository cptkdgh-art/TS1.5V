import type { TsWorkDesign } from './work-design';
import { buildTsWorkDesignBrief } from './work-design';

/**
 * TS 장르 공통 코어.
 * 작품별 취향과 작가 개성보다 위에 군림하는 강제 플롯이 아니라,
 * 확정된 변화 규칙과 상태 연속성을 놓치지 않기 위한 공통 기준이다.
 */
export const TS_GENRE_CORE_GUIDE = `--- [TS 장르 전문 문법 — 사용자 지시와 작품 설정을 우선] ---
TS 작품에서는 변화 그 자체뿐 아니라 변화가 인물의 자기인식·신체감각·관계·사회적 위치·선택을 어떻게 바꾸는지 추적한다.

1. 확정된 변화 규칙을 일관되게 유지한다.
- 원인, 속도, 범위, 가역성, 재변신 가능 여부, 비용과 부작용을 작품 안에서 임의로 뒤집지 않는다.
- 이미 확정된 신체 상태와 변신 단계가 이유 없이 되돌아가거나 중복되지 않게 한다.

2. 작품의 대표 TS 타입을 중심축으로 삼는다.
- 추가 TS 타입은 대표 타입을 대체하지 않고 보조 요소로 결합한다.
- 예: 대표가 빙의이고 추가가 현실개변이라면, 작품의 기본 체험은 빙의이며 현실개변은 그 체험을 보강한다.

3. 배경 장르와 TS 타입을 구분한다.
- 성전환·변신·빙의·바디스왑·가죽 등은 TS 타입이다.
- 현대일상·현대판타지·직장·인방·판타지 등은 이야기가 펼쳐지는 부장르/배경이다.

4. 분위기는 사건의 종류가 아니라 장면의 정서와 연출 강도를 조절한다.
- 힐링, 코믹, 약피폐, 피폐 등의 대표 분위기를 우선하고 추가 분위기는 보조한다.

5. 정신과 신체를 자동으로 동일시하지 않는다.
- 몸이 바뀌었다는 이유만으로 성격·기억·취향이 즉시 바뀌었다고 가정하지 않는다.
- 정신·기억 변화는 작품의 세부 설정에서 확정된 경우에만 반영한다.

6. 관계 변화와 정보 격차를 누적한다.
- 누가 원래 정체를 아는지, 어떤 호칭과 관계가 바뀌었는지, 비밀이 어디까지 공유되었는지 장기적으로 추적한다.

7. 반복 확인 장면을 기계적으로 재사용하지 않는다.
- 거울, 신체 확인, 화장실, 옷 확인 등은 현재 장면에 필요할 때만 사용하며 같은 효과를 반복하지 않는다.

8. 작품 핵심 자유입력을 우선한다.
- 태그보다 사용자가 직접 적은 '작품 핵심'과 '시리즈/권별 핵심'이 구체적이면 이를 우선하여 장면과 플롯을 설계한다.`;

/**
 * TS1.5V의 새 작품 설계 모델용 브리프.
 */
export function buildTsStudioBrief(design: TsWorkDesign): string {
  const designBrief = buildTsWorkDesignBrief(design);
  return `${TS_GENRE_CORE_GUIDE}\n\n--- [작품별 TS 설계] ---\n${designBrief}`;
}

/**
 * 구 1.5V 호출부 호환용.
 * 앱 몸통 이식 과정에서 buildTsStudioBrief로 순차 교체한다.
 */
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
