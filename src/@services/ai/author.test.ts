import { afterEach, describe, expect, it, vi } from 'vitest';
import * as aiConfig from './config';
import { generateAuthorRecommendations } from './author';

afterEach(() => {
  vi.restoreAllMocks();
});

const recommendationResponse = JSON.stringify({
  authors: [
    {
      name: '속도선',
      specialty: '빠른 사건 전개와 회차 후킹에 강한 현대 판타지 작가',
      writingStyle: '짧은 문장과 선명한 동사를 사용하며 장면 전환을 빠르게 가져간다.',
      coreDirectives: '주인공의 선택이 곧 사건을 움직이게 하고 이미 끝난 상황을 다시 설명하지 않는다.',
      tags: ['현대판타지', '속도감'],
      identityCore: {
        selfDefinition: '선택의 순간에 인간이 드러난다고 믿는 장르 작가다.',
        reasonToWrite: '평범한 사람이 자기 삶의 주도권을 되찾는 순간을 쓰기 위해서다.',
        worldview: '세계는 불공정하지만 선택의 의미까지 빼앗지는 못한다.',
        viewOfHumanity: '인간은 손해를 알면서도 지키고 싶은 것을 선택한다.',
        literaryValues: [{ belief: '행동이 설명보다 진실하다.', creativeEffect: '결정적 감정은 선택과 행동으로 드러낸다.', doubt: '침묵만으로 모든 감정을 전달할 수는 없다.' }],
        aestheticTaste: { drawnTo: ['빠른 결단'], avoids: ['공허한 과장'], emotionalTexture: '긴장 끝의 짧은 해방감' },
        innerContradictions: [{ valueA: '속도', valueB: '감정의 잔향', unresolvedReason: '독자를 붙들면서 선택의 대가도 남기고 싶다.' }],
        recurringQuestions: ['힘을 얻은 뒤에도 같은 사람일 수 있는가?'],
        readerRelationship: '독자를 함께 달리는 목격자로 대한다.',
        creativeEthics: '고통을 성장 장치로만 소비하지 않는다.',
        narrativeInstincts: ['결정 직전 설명을 줄이고 행동을 앞세운다.'],
        voiceOrigins: '주저하는 마음과 빠른 사건의 충돌에서 짧은 호흡이 생긴다.',
        readabilityPractice: '행동 주체와 결과를 한 호흡 안에서 분명히 연결한다.',
        plausibilityPractice: '모든 능력과 선택에 앞선 원인과 대가를 둔다.',
      },
    },
    {
      name: '대화선',
      specialty: '인물 관계와 대사의 말맛을 중심으로 갈등을 쌓는 작가',
      writingStyle: '인물마다 어휘와 문장 길이를 달리하고 대화 사이의 행동으로 속뜻을 드러낸다.',
      coreDirectives: '설명보다 충돌하는 대화를 우선하고 관계 변화가 없는 장면은 압축한다.',
      tags: ['대화', '관계'],
    },
    {
      name: '잔향선',
      specialty: '감각적인 공간 묘사와 느린 긴장 축적에 강한 미스터리 작가',
      writingStyle: '제한적 시점으로 필요한 감각만 포착하며 긴 문장과 짧은 문장을 대비한다.',
      coreDirectives: '정보를 한꺼번에 밝히지 않고 장면마다 의문 하나를 남기되 추상적인 총평은 피한다.',
      tags: ['미스터리', '긴장'],
    },
  ],
});

describe('AI author recommendations', () => {
  it('간단한 의뢰를 모두 반영해 서로 비교할 후보 3명을 요청하고 정규화한다', async () => {
    const generateSpy = vi.spyOn(aiConfig, 'generateContent').mockResolvedValue(recommendationResponse);

    const result = await generateAuthorRecommendations({
      keywords: '현대 판타지 작가',
      mood: '유쾌하지만 가볍지 않게',
      strengths: '대사와 회차 후킹',
      avoid: '과한 수식어',
      model: 'gemini-3.7-flash',
    });

    expect(result).toHaveLength(3);
    expect(result.map((author) => author.name)).toEqual(['속도선', '대화선', '잔향선']);

    const request = generateSpy.mock.calls[0][0];
    const prompt = request.contents[0].parts?.[0]?.text || '';
    expect(prompt).toContain('현대 판타지 작가');
    expect(prompt).toContain('유쾌하지만 가볍지 않게');
    expect(prompt).toContain('대사와 회차 후킹');
    expect(prompt).toContain('과한 수식어');
    expect(prompt).toContain('authors 배열에는 정확히 3명');
    expect(prompt).toContain('identityCore');
    expect(result[0].identityCore?.selfDefinition).toContain('선택의 순간');
    expect(result[0].identityCore?.coreId).toMatch(/^author-core-/);
    expect(request.timeoutMs).toBe(30000);
    expect(request.retryAttempts).toBe(2);
    expect(request.model).toBe('gemini-3.7-flash');
  });

  it('정상 후보가 2명만 도착해도 비교 화면을 사용할 수 있게 보존한다', async () => {
    const parsed = JSON.parse(recommendationResponse);
    vi.spyOn(aiConfig, 'generateContent').mockResolvedValue(JSON.stringify({
      authors: parsed.authors.slice(0, 2),
    }));

    const result = await generateAuthorRecommendations({ keywords: '판타지' });

    expect(result.map((author) => author.name)).toEqual(['속도선', '대화선']);
  });

  it('첫 응답에 후보가 하나뿐이면 한 번 더 요청해 정상 후보를 보충한다', async () => {
    const parsed = JSON.parse(recommendationResponse);
    const generateSpy = vi.spyOn(aiConfig, 'generateContent')
      .mockResolvedValueOnce(JSON.stringify({ authors: [parsed.authors[0]] }))
      .mockResolvedValueOnce(JSON.stringify({ authors: parsed.authors.slice(1) }));

    const result = await generateAuthorRecommendations({ keywords: '판타지' });

    expect(generateSpy).toHaveBeenCalledTimes(2);
    expect(result.map((author) => author.name)).toEqual(['속도선', '대화선', '잔향선']);
  });

  it('두 번 요청해도 정상 후보가 한 명뿐이면 비교 불가능한 결과를 저장하지 않는다', async () => {
    vi.spyOn(aiConfig, 'generateContent').mockResolvedValue(JSON.stringify({
      authors: [JSON.parse(recommendationResponse).authors[0]],
    }));

    await expect(generateAuthorRecommendations({ keywords: '판타지' }))
      .rejects.toThrow('비교 가능한 후보를 충분히 만들지 못했습니다');
  });
});
