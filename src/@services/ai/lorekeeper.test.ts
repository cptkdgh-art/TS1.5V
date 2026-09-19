import { describe, expect, it } from 'vitest';
import type { Novel } from '@core/types';
import { buildLorekeeperBriefing, formatLorekeeperBriefing } from './lorekeeper';

function makeNovel(useLorekeeper?: boolean): Novel {
  return {
    id: 'novel-1',
    title: '세계관 테스트',
    subject: '판타지',
    mood: '긴장감',
    aiAuthorId: null,
    plotSummary: '',
    chapters: [],
    history: [],
    characters: [],
    createdAt: 1,
    useLorekeeper,
    worldviewFiles: [
      { filename: '01-핵심 규칙.txt', content: `마법을 사용하면 반드시 기억 하나를 대가로 잃는다.\n${'마법 사회의 공통 규칙이다. '.repeat(220)}` },
      { filename: '02-왕국.txt', content: `왕국의 수도는 밤이 되면 모든 성문을 닫는다.\n${'왕국 행정과 성문 운영 규칙이다. '.repeat(220)}` },
      { filename: '03-종족.txt', content: `해안 종족은 바닷물을 떠나면 힘을 잃는다.\n${'해안 종족의 생활과 전투 규칙이다. '.repeat(220)}` },
    ],
  };
}

describe('buildLorekeeperBriefing', () => {
  it('기존 작품의 값이 비어 있어도 대형 세계관을 파일 순서대로 챙긴다', () => {
    const briefing = buildLorekeeperBriefing(makeNovel(), null, '다음 장면을 이어 써줘');

    expect(briefing).not.toBeNull();
    const formatted = formatLorekeeperBriefing(briefing!);
    expect(formatted).toContain('01-핵심 규칙.txt');
    expect(formatted).toContain('02-왕국.txt');
  });

  it('현재 장면과 일치하는 설정을 파일 순서보다 먼저 배치한다', () => {
    const briefing = buildLorekeeperBriefing(makeNovel(), null, '해안 종족의 전투를 이어 써줘');

    expect(briefing?.relevantWorldRules[0]).toContain('03-종족.txt');
  });

  it('사용자가 명시적으로 끄면 브리핑을 만들지 않는다', () => {
    expect(buildLorekeeperBriefing(makeNovel(false), null, '다음 장면')).toBeNull();
  });
});
