import type { AiAuthor, AuthorProfileVersion } from '@core/types';
import { cloneAuthorIdentityCore } from './authorIdentity';

const PROFILE_FIELDS = ['name', 'specialty', 'writingStyle', 'coreDirectives'] as const;

type ProfileUpdate = Pick<AiAuthor, (typeof PROFILE_FIELDS)[number]> & {
  tags?: string[];
  identityCore?: AiAuthor['identityCore'];
};

export function hasAuthorProfileChanged(author: AiAuthor, updates: Partial<ProfileUpdate>): boolean {
  if (PROFILE_FIELDS.some((field) => updates[field] !== undefined && updates[field] !== author[field])) {
    return true;
  }
  if (updates.tags) {
    return JSON.stringify(updates.tags) !== JSON.stringify(author.tags || []);
  }
  if (updates.identityCore) {
    return JSON.stringify(updates.identityCore) !== JSON.stringify(author.identityCore);
  }
  return false;
}

export function createAuthorProfileVersion(author: AiAuthor, now = Date.now()): AuthorProfileVersion {
  return {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    name: author.name,
    specialty: author.specialty,
    writingStyle: author.writingStyle,
    coreDirectives: author.coreDirectives,
    tags: [...(author.tags || [])],
    identityCore: author.identityCore ? cloneAuthorIdentityCore(author.identityCore) : undefined,
  };
}

export function updateAuthorWithProfileHistory(
  author: AiAuthor,
  updates: Partial<AiAuthor>,
  now = Date.now()
): AiAuthor {
  if (!hasAuthorProfileChanged(author, updates)) return { ...author, ...updates };
  const version = createAuthorProfileVersion(author, now);
  return {
    ...author,
    ...updates,
    profileVersions: [version, ...(author.profileVersions || [])].slice(0, 20),
  };
}

/** 이전 flat 프로필과 정체성 코어를 함께 복원하고, 현재 상태는 새 이력으로 남긴다. */
export function restoreAuthorProfileVersion(
  author: AiAuthor,
  version: AuthorProfileVersion,
  now = Date.now()
): AiAuthor {
  const restored: Partial<AiAuthor> = {
    name: version.name,
    specialty: version.specialty,
    writingStyle: version.writingStyle,
    coreDirectives: version.coreDirectives,
    tags: [...version.tags],
  };
  // 구버전 이력에는 코어가 없다. 이 경우 새 코어를 지우지 않고 flat 프로필만 복원한다.
  if (version.identityCore) restored.identityCore = cloneAuthorIdentityCore(version.identityCore);
  return updateAuthorWithProfileHistory(author, restored, now);
}
