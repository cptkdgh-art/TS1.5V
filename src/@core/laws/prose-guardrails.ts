export const COMMON_PROSE_GUARDRAIL_TITLE = '개연성과 문장 절제';

export const COMMON_PROSE_GUARDRAILS = [
  '제1원칙: 모든 사건, 행동, 감정, 공간 이동은 작품이 세운 설정과 장르적 전제 안에서 원인-행동-결과가 자연스럽게 이어져야 한다.',
  '장면에서 이미 드러난 감정을 수식어와 추상명사를 겹쳐 다시 총평하지 않는다.',
  '인물, 사물, 감정에 여러 형용사와 부사를 연달아 붙이는 불필요한 수식을 피한다.',
  '수식어를 빼도 장면의 정보, 감각, 관계 또는 분위기가 달라지지 않으면 생략한다.',
  '과장된 수식보다 구체적인 명사와 정확한 동작을 우선한다.',
  '‘A와 B가 뒤섞인 완벽한 침묵이었다’, ‘자신이 무슨 짓을 저질렀는지 깨닫고 전율했다’처럼 장면의 의미를 상투적인 결론 문장으로 봉합하지 않는다.',
  '단, 작가 문체에 자연스러운 직접적인 감정 표현과 장르적 분위기, 감각적 체험, 인물의 고유한 시선에 기여하는 묘사는 충분히 허용한다.',
] as const;

export function buildCommonProseGuardrailPrompt(): string {
  return `[${COMMON_PROSE_GUARDRAIL_TITLE}]\n${COMMON_PROSE_GUARDRAILS.map((rule) => `- ${rule}`).join('\n')}`;
}
