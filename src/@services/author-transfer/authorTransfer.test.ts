import { describe, expect, it, vi } from 'vitest';
import type { AiAuthor } from '@core/types';
import { copyAuthorToWorkspace } from './authorTransfer';

const source: AiAuthor = {
  id: 'source-author',
  name: '윤슬',
  specialty: '현대 판타지',
  writingStyle: '짧고 선명한 문장',
  coreDirectives: '생활 디테일을 놓치지 않는다.',
  createdAt: 1,
  isDefault: true,
  role: 'Co-Developer',
  memoryCache: ['인물의 선택을 먼저 본다.'],
  generalChatHistory: [{ role: 'user', parts: [{ text: '이전 작품 대화' }] }],
  metaChatHistory: [{ role: 'user', parts: [{ text: '이전 메타 대화' }] }],
  directorChatSummary: '구버전 감독 기록',
};

describe('workspace author copy', () => {
  it('creates an independent author while keeping memory and excluding chats by default', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111');
    const copied = copyAuthorToWorkspace(source, [], {
      includeMemory: true,
      includeChats: false,
      sourceWorkspaceName: '장르 작업실',
    });

    expect(copied.id).not.toBe(source.id);
    expect(copied.name).toBe('윤슬');
    expect(copied.isDefault).toBe(false);
    expect(copied.role).toBeUndefined();
    expect(copied.memoryCache).toEqual(source.memoryCache);
    expect(copied.generalChatHistory).toBeUndefined();
    expect(copied.metaChatHistory).toBeUndefined();
    expect(copied.directorChatSummary).toBeUndefined();
  });

  it('labels a same-name copy with its source workspace and can include chats', () => {
    const copied = copyAuthorToWorkspace(source, [source], {
      includeMemory: false,
      includeChats: true,
      sourceWorkspaceName: '로맨스실',
    });

    expect(copied.name).toBe('윤슬 (로맨스실)');
    expect(copied.memoryCache).toBeUndefined();
    expect(copied.generalChatHistory).toEqual(source.generalChatHistory);
    expect(copied.metaChatHistory).toEqual(source.metaChatHistory);
  });
});
