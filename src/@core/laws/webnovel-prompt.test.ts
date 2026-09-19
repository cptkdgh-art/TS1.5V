import { describe, expect, it } from 'vitest';
import { buildWebNovelPrompt } from './webnovel-prompt';
import type { WebNovelSettings } from '@core/types/webnovel.types';

function makeSettings(overrides: Partial<WebNovelSettings> = {}): WebNovelSettings {
  return {
    isEnabled: true,
    genre: 'hunter',
    platform: 'kakao-page',
    style: {
      breathing: {
        targetLength: { min: 15, max: 40 },
        rhythmPattern: 'varied',
        maxLinesPerParagraph: 3,
      },
      dialogue: {
        minDialogueRatio: 50,
        maxConsecutiveNarration: 5,
        enforceCharacterVoice: true,
      },
      hooking: {
        cliffhangerIntensity: 'strong',
        catharsisBias: 80,
        minCatharsisPerEpisode: 1,
        tensionBuildupStart: 75,
      },
    },
    autoApplyRules: true,
    ...overrides,
  };
}

describe('buildWebNovelPrompt', () => {
  it('비활성화하면 아무 지침도 추가하지 않는다', () => {
    expect(buildWebNovelPrompt({ settings: makeSettings({ isEnabled: false }) })).toBe('');
  });

  it('장르는 분류명만 남기고 장르 공식은 주입하지 않는다', () => {
    const output = buildWebNovelPrompt({ settings: makeSettings() });

    expect(output).toContain('[작품 분류 참고: 헌터물]');
    expect(output).not.toContain('각성/등급 시스템');
    expect(output).not.toContain('정보의 격차');
    expect(output).not.toContain('먼치킨');
  });

  it('플랫폼·대화비율·사이다·클리프행어 공식을 주입하지 않는다', () => {
    const output = buildWebNovelPrompt({ settings: makeSettings() });

    expect(output).not.toContain('[플랫폼:');
    expect(output).not.toContain('대화문이 50%');
    expect(output).not.toContain('사이다 많이');
    expect(output).not.toContain('강렬한 절단');
  });

  it('문장과 문단의 가독성 설정만 보조한다', () => {
    const output = buildWebNovelPrompt({ settings: makeSettings() });

    expect(output).toContain('[웹소설 가독성 보조]');
    expect(output).toContain('문장 길이: 15-40자');
    expect(output).toContain('문단: 3줄');
    expect(output).toContain('작가의 호흡대로');
  });

  it('자동 문체 보조를 끄면 개별 길이 설정은 추가하지 않는다', () => {
    const output = buildWebNovelPrompt({ settings: makeSettings({ autoApplyRules: false }) });

    expect(output).toContain('[웹소설 가독성 보조]');
    expect(output).not.toContain('[문체 가이드]');
  });

  it('기록보관자와 사용자가 관리한 복선은 유지한다', () => {
    const output = buildWebNovelPrompt({
      settings: makeSettings(),
      useLorekeeper: true,
      foreshadowingContext: {
        activeForeshadowings: [{
          name: '사라진 반지',
          type: 'mystery',
          status: 'planted',
          urgency: 'short',
          aiGuidance: { doHint: [], dontReveal: [], payoffTiming: '' },
        }],
        pacingInstruction: '',
        payoffCandidates: [],
        prohibitions: [],
      },
    });

    expect(output).toContain('ask_lorekeeper');
    expect(output).toContain('사라진 반지');
  });
});
