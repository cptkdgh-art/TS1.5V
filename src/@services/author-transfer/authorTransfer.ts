import type { AiAuthor } from '@core/types';
import { getRaw, getWorkspaceStorageKey, STORAGE_KEYS } from '@services/storage';

export interface AuthorCopyOptions {
  includeMemory: boolean;
  includeChats: boolean;
  sourceWorkspaceName: string;
}

export async function readWorkspaceAuthors(workspaceId: string): Promise<AiAuthor[]> {
  const value = await getRaw<unknown>(getWorkspaceStorageKey(workspaceId, STORAGE_KEYS.AUTHORS));
  if (!Array.isArray(value)) return [];
  return value.filter((author): author is AiAuthor => (
    !!author
    && typeof author === 'object'
    && typeof (author as AiAuthor).id === 'string'
    && typeof (author as AiAuthor).name === 'string'
  ));
}

export function copyAuthorToWorkspace(
  source: AiAuthor,
  existingAuthors: AiAuthor[],
  options: AuthorCopyOptions,
): AiAuthor {
  const {
    id: _id,
    createdAt: _createdAt,
    isDefault: _isDefault,
    role: _role,
    directorChatHistory: _directorChatHistory,
    directorChatSummary: _directorChatSummary,
    memoryCache,
    metaChatHistory,
    generalChatHistory,
    ...profile
  } = structuredClone(source);
  const hasSameName = existingAuthors.some(
    (author) => author.name.trim().toLowerCase() === source.name.trim().toLowerCase(),
  );

  return {
    ...profile,
    id: crypto.randomUUID(),
    name: hasSameName ? `${source.name} (${options.sourceWorkspaceName})` : source.name,
    createdAt: Date.now(),
    isDefault: false,
    ...(options.includeMemory && memoryCache ? { memoryCache } : {}),
    ...(options.includeChats && metaChatHistory ? { metaChatHistory } : {}),
    ...(options.includeChats && generalChatHistory ? { generalChatHistory } : {}),
  };
}
