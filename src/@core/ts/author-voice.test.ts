import { describe, expect, it } from 'vitest';
import { DEFAULT_AUTHORS as LEGACY_DEFAULT_AUTHORS } from '../constants/defaultAuthors';
import { buildStoryClassificationText } from '../constants/story-guides';
import { isAuthorIdentityCore, migrateAuthorIdentities } from '../../@services/ai/authorIdentity';
import { DEFAULT_TS_AUTHORS } from './authors';
import { buildAuthorVoiceText, getAuthorVoiceContract, normalizeVoiceControl } from './author-voice';
import { DEFAULT_AUTHORS, DEFAULT_TS_RUNTIME_AUTHORS } from './runtime-authors';
import { combineDefaultAuthorCatalogs } from './runtime-author-adapter';
import { TS_VOICE_FINGERPRINTS } from './voice-fingerprints';
import { buildTsWritingDirective } from './writing-directive';
import type { TsWorkDesign } from './work-design';

const design = (overrides: Partial<TsWorkDesign> = {}): TsWorkDesign => ({
  workKind: 'novel', uiLanguage: 'ko', manuscriptLanguage: 'ko', direction: null,
  tsType: { primary: 'body_swap', secondary: [] },
  subgenre: { primary: 'modern_daily', secondary: [] },
  mood: { primary: 'calm', secondary: [] },
  storyCore: 'A와 B는 친구다. 오늘 서류를 전달하고 돌아온다. 연애와 정체 발각은 없다.',
  ...overrides,
});

describe('native TS author integration', () => {
  it('adapts all 12 TS presets to validated native identities', () => {
    expect(DEFAULT_TS_RUNTIME_AUTHORS).toHaveLength(12);
    expect(DEFAULT_TS_RUNTIME_AUTHORS.map((a) => a.id)).toEqual(DEFAULT_TS_AUTHORS.map((a) => a.id));
    for (const author of DEFAULT_TS_RUNTIME_AUTHORS) {
      expect(isAuthorIdentityCore(author.identityCore)).toBe(true);
      expect(author.isDefault).toBe(true);
      expect(author.memoryCache).toBeUndefined();
      expect(author.generalChatHistory).toBeUndefined();
    }
  });
  it('keeps original default records and IDs intact', () => {
    for (const legacy of LEGACY_DEFAULT_AUTHORS) {
      expect(DEFAULT_AUTHORS.find((author) => author.id === legacy.id)).toBe(legacy);
    }
    expect(new Set(DEFAULT_AUTHORS.map((author) => author.id)).size).toBe(DEFAULT_AUTHORS.length);
  });
  it('never overwrites an edited saved identity with an updated preset', () => {
    const original = DEFAULT_TS_RUNTIME_AUTHORS[0];
    const custom = { ...original, name: '내 작가', isDefault: false,
      identityCore: { ...original.identityCore!, selfDefinition: '내 고유 작가관' } };
    const input = [custom];
    expect(migrateAuthorIdentities(input, DEFAULT_AUTHORS)).toBe(input);
    expect(input[0].identityCore.selfDefinition).toBe('내 고유 작가관');
  });
  it('has 12 different qualitative voice origins, not just control numbers', () => {
    const origins = Object.values(TS_VOICE_FINGERPRINTS).map((voice) => voice.voiceOrigins);
    expect(new Set(origins).size).toBe(12);
  });
  it('prioritizes legacy records on a catalog ID collision', () => {
    const original = DEFAULT_TS_RUNTIME_AUTHORS[0];
    expect(combineDefaultAuthorCatalogs([original], [{ ...original, name: 'replacement' }]))
      .toEqual([original]);
  });
});

describe('author voice and commission contract', () => {
  it('renders the identityCore string rather than using the tagline as identity', () => {
    const author = { ...DEFAULT_TS_AUTHORS[0], identityCore: 'IDENTITY_SENTINEL' };
    expect(buildAuthorVoiceText({ author })).toContain('IDENTITY_SENTINEL');
  });
  it('never mixes a default voice into a current custom/native profile', () => {
    const author = { ...DEFAULT_TS_AUTHORS[0], writingStyleSummary: 'OLD_PRESET_SENTINEL' };
    const out = buildAuthorVoiceText({ author, existingIdentity: 'CURRENT_USER_VOICE' });
    expect(out).toContain('CURRENT_USER_VOICE');
    expect(out).not.toContain('OLD_PRESET_SENTINEL');
  });
  it('passes native identity and relevant memory through story classification', () => {
    const out = buildStoryClassificationText({ tsDesign: design(),
      authorIdentityContext: 'NATIVE_IDENTITY', authorMemory: ['LOCAL_AGREEMENT'] });
    expect(out).toContain('NATIVE_IDENTITY');
    expect(out).toContain('LOCAL_AGREEMENT');
  });
  it('keeps empty and generic legacy classification unchanged', () => {
    expect(buildStoryClassificationText({})).toBe('');
    expect(buildStoryClassificationText({primaryGenre:'현대판타지',subgenres:['헌터'],themes:['성장']}))
      .toBe('주 장르: 현대판타지\n부 장르: 헌터\n주제: 성장');
  });
  it('adds the voice contract to the currently used legacy TS writer path', () => {
    expect(buildStoryClassificationText({ primaryGenre: 'TS' })).toContain('작가 고유성·집필 범위');
  });
  it('does not invent a narrative convention blend when nothing was chosen', () => {
    const out = buildTsWritingDirective({ design: design() });
    expect(out).not.toContain('참고 비율');
    expect(out).not.toContain('선택한 서사 관습 참고:');
  });
  it('retains explicit convention, chapter instruction, facts and exclusions', () => {
    const out = buildTsWritingDirective({ design: design({narrativeTradition:'jp_tsf'}),
      chapterInstruction:'대사는 거칠게, 사건은 그대로.', continuityFacts:['A의 정신은 B의 몸에 있다.'],
      exclusions:['연애 없음'], additionalInstructions:['3인칭 유지'] });
    for (const text of ['선택한 서사 관습 참고:', '대사는 거칠게', 'A의 정신은 B의 몸에 있다.', '연애 없음', '3인칭 유지']) {
      expect(out).toContain(text);
    }
  });
  it('does not use expertise as a cross-genre eligibility gate', () => {
    const romanceAuthor = DEFAULT_TS_AUTHORS.find((a) => a.id === 'rua')!;
    const out = buildTsWritingDirective({ design: design(), author: romanceAuthor,
      chapterInstruction:'연애 없는 권력 갈등을 거친 말투로 표현. 관계와 사건은 변경하지 말 것.' });
    expect(out).toContain(romanceAuthor.writingStyleSummary);
    expect(out).toContain('연애 없는 권력 갈등');
    expect(out).toContain('집필 가능 장르 목록이나 필수 소재가 아니다');
  });
  it('has a corresponding English contract', () => {
    expect(getAuthorVoiceContract('en')).toContain('not permission lists');
    expect(getAuthorVoiceContract('en')).toContain('not event order');
  });
  it('handles nonfinite controls without NaN leaking to the prompt', () => {
    expect(normalizeVoiceControl(NaN)).toBe(50);
    expect(normalizeVoiceControl(Infinity)).toBe(50);
    expect(normalizeVoiceControl(-5)).toBe(0);
    expect(normalizeVoiceControl(500)).toBe(100);
  });
});
