import { describe, expect, it } from 'vitest';
import { parseDirectorClioBackup } from './backup';

const validBackup = {
  schemaVersion: 1,
  memories: ['작가 개성 우선'],
  activeNovelId: 'novel-1',
  sessions: {
    'novel-1': {
      novelId: 'novel-1',
      history: [{ role: 'user', parts: [{ text: '진단해줘' }] }],
      authorProposals: [{
        id: 'proposal-1',
        createdAt: 2,
        afterMessageIndex: 1,
        sourceNovelId: 'novel-1',
        name: '맞춤 작가',
        specialty: '현대 판타지',
        writingStyle: '간결한 제한적 3인칭',
        coreDirectives: '인물의 선택과 결과를 연결한다.',
        tags: ['현대판타지'],
      }],
      summary: '작품 진단',
      readMode: 'recent',
      updatedAt: 1,
    },
  },
};

describe('director Clio backup', () => {
  it('정상 백업을 허용한다', () => {
    const parsed = parseDirectorClioBackup(validBackup);
    expect(parsed?.sessions['novel-1'].authorProposals?.[0]).toEqual(expect.objectContaining({
      schemaVersion: 2,
      name: '맞춤 작가',
    }));
    expect(parsed?.sessions['novel-1'].authorProposals?.[0].identityCore).toBeTruthy();
  });

  it('세션 키와 작품 ID가 다르면 거부한다', () => {
    const malformed = structuredClone(validBackup);
    malformed.sessions['novel-1'].novelId = 'novel-2';

    expect(parseDirectorClioBackup(malformed)).toBeNull();
  });

  it('지원하지 않는 읽기 범위를 거부한다', () => {
    const malformed = structuredClone(validBackup) as unknown as Record<string, any>;
    malformed.sessions['novel-1'].readMode = 'automatic-full';

    expect(parseDirectorClioBackup(malformed)).toBeNull();
  });

  it('필수 필드가 빠진 작가 설계안은 거부한다', () => {
    const malformed = structuredClone(validBackup) as unknown as Record<string, any>;
    delete malformed.sessions['novel-1'].authorProposals[0].writingStyle;

    expect(parseDirectorClioBackup(malformed)).toBeNull();
  });
});
