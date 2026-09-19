import { describe, expect, it } from 'vitest';
import type { AiAuthor } from '@core/types';
import { DEFAULT_AUTHORS } from '@core/constants';
import {
  createAuthorIdentityCore,
  createLegacyAuthorIdentityCore,
  forkAuthorIdentityCore,
  isAuthorIdentityCore,
  migrateAuthorIdentities,
  normalizeAuthorIdentityDraft,
  resolveAuthorIdentityCore,
} from './authorIdentity';

const legacyAuthor: AiAuthor = {
  id: 'custom-1',
  name: '기존 작가',
  specialty: '심리극',
  writingStyle: '행동을 먼저 보여준다.',
  coreDirectives: '감정을 단정하지 않는다.',
  tags: ['#절제'],
  createdAt: 10,
};

describe('authorIdentity', () => {
  it('legacy 작가에서 작품 정보 없이 안정적인 fallback 코어를 만든다', () => {
    const first = createLegacyAuthorIdentityCore(legacyAuthor);
    const second = createLegacyAuthorIdentityCore(legacyAuthor);

    expect(first).toEqual(second);
    expect(first.coreId).toBe('legacy-core-custom-1');
    expect(first.voiceOrigins).toBe(legacyAuthor.writingStyle);
    expect(first.literaryValues[0].belief).toBe(legacyAuthor.coreDirectives);
    expect(JSON.stringify(first)).not.toContain('workId');
    expect(JSON.stringify(first)).not.toContain('novelId');
  });

  it('불완전한 저장 코어를 사용하지 않고 legacy fallback으로 해석한다', () => {
    const malformed = { ...legacyAuthor, identityCore: { schemaVersion: 1 } } as unknown as AiAuthor;

    expect(isAuthorIdentityCore(malformed.identityCore)).toBe(false);
    expect(resolveAuthorIdentityCore(malformed).coreId).toBe('legacy-core-custom-1');
  });

  it('AI 초안을 알려진 필드만 가진 안전한 값으로 정규화한다', () => {
    const normalized = normalizeAuthorIdentityDraft({
      selfDefinition: '나는 선택을 추적한다.',
      recurringQuestions: ['왜 돌아서는가?'],
      aestheticTaste: { drawnTo: ['침묵'], workId: '금지된-작품' },
      workId: '금지된-작품',
    });

    expect(normalized.selfDefinition).toBe('나는 선택을 추적한다.');
    expect(normalized.aestheticTaste.drawnTo).toEqual(['침묵']);
    expect(normalized.aestheticTaste.avoids).toEqual([]);
    expect(normalized).not.toHaveProperty('workId');
    expect(normalized.aestheticTaste).not.toHaveProperty('workId');
  });

  it('기본 작가의 기존 편집값은 보존하며 공식 코어만 안전하게 심는다', () => {
    const stored = { ...DEFAULT_AUTHORS[0], name: '사용자가 고친 이름', identityCore: undefined };
    const migrated = migrateAuthorIdentities([stored], DEFAULT_AUTHORS);

    expect(migrated[0].name).toBe('사용자가 고친 이름');
    expect(migrated[0].identityCore).toEqual(DEFAULT_AUTHORS[0].identityCore);
    expect(migrated[0].identityCore).not.toBe(DEFAULT_AUTHORS[0].identityCore);
  });

  it('사용자 legacy 작가는 flat 필드 기반 코어로 승격하고 기존 코어는 덮어쓰지 않는다', () => {
    const migrated = migrateAuthorIdentities([legacyAuthor], DEFAULT_AUTHORS);
    expect(migrated[0].identityCore?.coreId).toBe('legacy-core-custom-1');

    const same = migrateAuthorIdentities(migrated, DEFAULT_AUTHORS);
    expect(same).toBe(migrated);
    expect(same[0]).toBe(migrated[0]);
  });

  it('새 코어를 만들 때 중첩 배열을 입력 객체와 공유하지 않는다', () => {
    const draft = normalizeAuthorIdentityDraft({ literaryValues: [{ belief: '선택', creativeEffect: '행동', doubt: '우연' }] });
    const core = createAuthorIdentityCore(draft, { coreId: 'core', versionId: 'v1', now: 20 });

    draft.literaryValues[0].belief = '변경';
    expect(core.literaryValues[0].belief).toBe('선택');
    expect(isAuthorIdentityCore(core)).toBe(true);
  });

  it('작가를 복제하면 정체성 내용은 잇고 존재 ID와 중첩 객체는 분리한다', () => {
    const original = createAuthorIdentityCore(
      normalizeAuthorIdentityDraft({ narrativeInstincts: ['행동을 먼저 본다.'] }),
      { coreId: 'original-core', versionId: 'original-v3', now: 10 }
    );
    const forked = forkAuthorIdentityCore(original, { coreId: 'fork-core', versionId: 'fork-v1', now: 30 });

    expect(forked.coreId).toBe('fork-core');
    expect(forked.versionId).toBe('fork-v1');
    expect(forked.narrativeInstincts).toEqual(original.narrativeInstincts);
    expect(forked.narrativeInstincts).not.toBe(original.narrativeInstincts);
    expect(forked.createdAt).toBe(30);
  });
});
