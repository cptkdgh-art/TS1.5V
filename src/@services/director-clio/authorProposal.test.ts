import { describe, expect, it } from 'vitest';
import { parseDirectorClioResponse } from './authorProposal';

describe('Director Clio author proposal response', () => {
  it('자연어 답변과 구조화된 작가 설계안을 분리한다', () => {
    const response = parseDirectorClioResponse(JSON.stringify({
      message: '이 작품에는 감정을 절제하는 추적극 작가가 맞습니다.',
      authorProposal: {
        name: '잔향 추적자',
        specialty: '도시 미스터리와 관계 추적',
        writingStyle: '제한적 3인칭과 짧은 문장으로 단서를 누적한다.',
        coreDirectives: '행동으로 정보를 드러내고 인물의 선택에 대가를 붙인다.',
        tags: ['미스터리', ' 미스터리 ', '추적극'],
      },
    }));

    expect(response.text).toContain('감정을 절제');
    expect(response.authorProposal).toEqual(expect.objectContaining({
      schemaVersion: 2,
      name: '잔향 추적자',
      specialty: '도시 미스터리와 관계 추적',
      writingStyle: '제한적 3인칭과 짧은 문장으로 단서를 누적한다.',
      coreDirectives: '행동으로 정보를 드러내고 인물의 선택에 대가를 붙인다.',
      tags: ['미스터리', '추적극'],
    }));
    expect(response.authorProposal?.identityCore.selfDefinition).toContain('잔향 추적자');
  });

  it('v2 제안의 작품과 무관한 깊은 정체성 코어를 검증한다', () => {
    const response = parseDirectorClioResponse(JSON.stringify({
      message: '내면에서 문체가 나오는 작가를 설계했습니다.',
      authorProposal: {
        schemaVersion: 2,
        name: '겨울의 목격자', specialty: '관계 서사', writingStyle: '절제된 문장',
        coreDirectives: '선택의 대가를 끝까지 남긴다.', tags: ['관계'],
        identityCore: {
          coreId: 'model-supplied-core', versionId: 'model-supplied-version', createdAt: 1, updatedAt: 1,
          selfDefinition: '침묵 뒤에 남은 선택을 기록하는 작가', reasonToWrite: '말해지지 않은 책임을 드러내기 위해 쓴다.',
          worldview: '모든 선택은 관계에 흔적을 남긴다.', viewOfHumanity: '인간은 두려움 속에서도 선택할 수 있다.',
          literaryValues: [{ belief: '사건보다 선택이 인물을 증명한다.', creativeEffect: '결정 직전의 행동을 구체화한다.', doubt: '우연도 삶을 바꾼다.' }],
          aestheticTaste: { drawnTo: ['겨울빛'], avoids: ['감정 총평'], emotionalTexture: '차갑지만 오래 남는 온기' },
          innerContradictions: [{ valueA: '용서', valueB: '책임', unresolvedReason: '둘 다 관계를 지키는 방식이기 때문이다.' }],
          recurringQuestions: ['용서는 책임을 지우는가?'], readerRelationship: '독자를 함께 판단하는 목격자로 본다.',
          creativeEthics: '고통을 장식으로 소비하지 않는다.', narrativeInstincts: ['대가를 다음 장면에 남긴다.'],
          voiceOrigins: '감정 설명보다 행동의 잔향을 믿는다.', readabilityPractice: '정보를 행동 순서에 맞춰 공개한다.',
          plausibilityPractice: '선택을 욕망과 두려움에 연결한다.',
        },
      },
    }));

    expect(response.authorProposal?.schemaVersion).toBe(2);
    expect(response.authorProposal?.identityCore.literaryValues[0].doubt).toContain('우연');
    expect(response.authorProposal?.identityCore.coreId).toBeTruthy();
    expect(response.authorProposal?.identityCore.coreId).not.toBe('model-supplied-core');
    expect(response.authorProposal?.identityCore.versionId).not.toBe('model-supplied-version');
  });

  it('필수 내면이 빠진 v2 제안은 실행 카드로 만들지 않는다', () => {
    const response = parseDirectorClioResponse(JSON.stringify({
      message: '세계관을 더 논의해야 합니다.',
      authorProposal: {
        schemaVersion: 2,
        name: '미완성', specialty: '드라마', writingStyle: '절제', coreDirectives: '인과 유지', tags: [],
        identityCore: { selfDefinition: '관찰자' },
      },
    }));
    expect(response).toEqual({ text: '세계관을 더 논의해야 합니다.' });
  });

  it('필수 필드가 빠진 설계안은 실행 카드로 만들지 않는다', () => {
    const response = parseDirectorClioResponse(JSON.stringify({
      message: '문체를 조금 더 논의해야 합니다.',
      authorProposal: { name: '미완성 작가' },
    }));

    expect(response).toEqual({ text: '문체를 조금 더 논의해야 합니다.' });
  });

  it('구조화되지 않은 구버전 응답도 일반 대화로 보존한다', () => {
    expect(parseDirectorClioResponse('기존 작가를 먼저 비교해볼게.')).toEqual({
      text: '기존 작가를 먼저 비교해볼게.',
    });
  });
});
