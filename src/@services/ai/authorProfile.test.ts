import { describe, expect, it } from 'vitest';
import type { AiAuthor } from '@core/types';
import { createAuthorIdentityCore, normalizeAuthorIdentityDraft } from './authorIdentity';
import { restoreAuthorProfileVersion, updateAuthorWithProfileHistory } from './authorProfile';

const author: AiAuthor = {
  id: 'a1', name: '초기 이름', specialty: '심리극', writingStyle: '짧은 문장',
  coreDirectives: '설명하지 않는다.', tags: ['#절제'], createdAt: 1,
};

describe('updateAuthorWithProfileHistory', () => {
  it('문체가 바뀌면 이전 프로필을 보관한다', () => {
    const updated = updateAuthorWithProfileHistory(author, { writingStyle: '긴 문장' }, 100);

    expect(updated.writingStyle).toBe('긴 문장');
    expect(updated.profileVersions).toHaveLength(1);
    expect(updated.profileVersions![0].writingStyle).toBe('짧은 문장');
  });

  it('대화 기록이나 기억만 바뀌면 프로필 이력을 만들지 않는다', () => {
    const updated = updateAuthorWithProfileHistory(author, { memoryCache: ['새 기억'] }, 100);

    expect(updated.memoryCache).toEqual(['새 기억']);
    expect(updated.profileVersions).toBeUndefined();
  });

  it('정체성 코어가 바뀌면 이전 코어를 깊은 복사로 보관한다', () => {
    const originalCore = createAuthorIdentityCore(
      normalizeAuthorIdentityDraft({ selfDefinition: '나는 흔적을 쓴다.' }),
      { coreId: 'core-1', versionId: 'v1', now: 10 }
    );
    const nextCore = { ...originalCore, versionId: 'v2', selfDefinition: '나는 선택을 쓴다.', updatedAt: 20 };
    const updated = updateAuthorWithProfileHistory({ ...author, identityCore: originalCore }, { identityCore: nextCore }, 30);

    expect(updated.profileVersions?.[0].identityCore?.versionId).toBe('v1');
    nextCore.aestheticTaste.drawnTo.push('변경');
    expect(updated.profileVersions?.[0].identityCore?.aestheticTaste.drawnTo).toEqual([]);
  });

  it('코어가 있는 이력을 복원하면서 현재 상태를 다시 이력으로 남긴다', () => {
    const v1 = createAuthorIdentityCore(normalizeAuthorIdentityDraft({ selfDefinition: '첫 정체성' }), {
      coreId: 'core-1', versionId: 'v1', now: 10,
    });
    const v2 = createAuthorIdentityCore(normalizeAuthorIdentityDraft({ selfDefinition: '현재 정체성' }), {
      coreId: 'core-1', versionId: 'v2', now: 20,
    });
    const restored = restoreAuthorProfileVersion({ ...author, name: '현재', identityCore: v2 }, {
      id: 'old', createdAt: 10, name: '과거', specialty: '심리극', writingStyle: '절제',
      coreDirectives: '흔적을 쓴다.', tags: ['#과거'], identityCore: v1,
    }, 30);

    expect(restored.name).toBe('과거');
    expect(restored.identityCore?.versionId).toBe('v1');
    expect(restored.profileVersions?.[0].identityCore?.versionId).toBe('v2');
  });

  it('legacy 이력을 복원할 때 현재 정체성 코어는 지우지 않는다', () => {
    const core = createAuthorIdentityCore(normalizeAuthorIdentityDraft({ selfDefinition: '현재 정체성' }), {
      coreId: 'core-1', versionId: 'v1', now: 10,
    });
    const restored = restoreAuthorProfileVersion({ ...author, identityCore: core }, {
      id: 'legacy', createdAt: 5, name: '예전 이름', specialty: '심리극', writingStyle: '절제',
      coreDirectives: '설명하지 않는다.', tags: [],
    }, 20);

    expect(restored.identityCore).toEqual(core);
  });
});
