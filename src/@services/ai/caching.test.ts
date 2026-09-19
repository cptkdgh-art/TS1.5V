import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Novel } from '@core/types';

const cacheApi = vi.hoisted(() => ({
  create: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('./config', () => ({
  ai: { caches: cacheApi },
  CACHE_TOKEN_THRESHOLD: 4096,
  DEFAULT_ACTIVE_BUFFER_WINDOW: 3,
}));

import { computeContextCacheSignature, manageContextCache } from './caching';

beforeEach(() => {
  cacheApi.create.mockReset();
  cacheApi.delete.mockReset();
});

describe('computeContextCacheSignature', () => {
  it('같은 요약이어도 시스템 지시가 바뀌면 기존 캐시를 재사용하지 않는다', () => {
    const before = computeContextCacheSignature('summary', '1~10화 요약', '작가 A');
    const after = computeContextCacheSignature('summary', '1~10화 요약', '작가 B');

    expect(before).not.toBe(after);
  });

  it('요약 캐시와 원문 캐시의 이름 공간을 분리한다', () => {
    expect(computeContextCacheSignature('summary', '동일 내용', '동일 지시'))
      .not.toBe(computeContextCacheSignature('raw', '동일 내용', '동일 지시'));
  });

  it('만료 캐시 삭제 응답을 기다리지 않고 다음 본문 준비를 계속한다', async () => {
    cacheApi.delete.mockReturnValue(new Promise(() => {}));
    const novel = {
      chapters: [
        { id: 'chapter-1', title: '1화', content: '짧은 원문' },
        { id: 'chapter-2', title: '2화', content: '최신 원문' },
        { id: 'chapter-3', title: '3화', content: '최신 원문' },
        { id: 'chapter-4', title: '4화', content: '최신 원문' },
      ],
      contextCaching: {
        isEnabled: true,
        activeBufferWindow: 1,
        caches: {
          'gemini-3.7-flash': {
            cacheName: 'expired-cache',
            createTime: '2026-09-05T00:00:00.000Z',
            expireTime: '2026-09-05T00:00:01.000Z',
            cachedChapterCount: 1,
            cachedTokenCount: 5000,
            contentSignature: 'old-signature',
          },
        },
      },
    } as unknown as Novel;

    const outcome = await Promise.race([
      manageContextCache(novel, 'gemini-3.7-flash', '작가 지시', ''),
      new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 50)),
    ]);

    expect(outcome).not.toBe('timeout');
    expect(cacheApi.delete).toHaveBeenCalledWith({ name: 'expired-cache' });
  });
});
