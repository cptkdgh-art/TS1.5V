import { describe, expect, it } from 'vitest';
import type { Novel, Series } from '@core/types';
import {
  LOREKEEPER_PACKET_CHARS,
  resolveWorldviewFiles,
  retrieveWorldviewChunks,
} from './worldviewPolicy';

const novel: Novel = {
  id: 'novel-1', title: '작품', subject: '', mood: '', aiAuthorId: null, plotSummary: '',
  chapters: [], history: [], characters: [], createdAt: 1,
  worldviewFiles: [
    { filename: '공통.txt', content: '이번 권에서는 야간 출입이 허용된다.' },
    { filename: '현재 권.txt', content: '현재 권 전용 설정' },
  ],
};

const series: Series = {
  id: 'series-1', title: '시리즈', seriesPlotSummary: '', characters: [], novelIds: [novel.id], createdAt: 1,
  worldviewFiles: [
    { filename: '공통.txt', content: '원래 야간 출입은 금지된다.' },
    { filename: '시리즈 법칙.txt', content: '모든 권에 적용되는 설정' },
  ],
};

describe('worldviewPolicy', () => {
  it('작품 설정을 시리즈 공통 설정 위에 겹치고 중복 이름은 작품 쪽을 남긴다', () => {
    const files = resolveWorldviewFiles(novel, series);

    expect(files.map((file) => file.filename)).toEqual(['공통.txt', '현재 권.txt', '시리즈 법칙.txt']);
    expect(files[0].content).toContain('허용');
  });

  it('전체 원문을 보내지 않고 질의와 가까운 구역을 로컬에서 고른다', () => {
    const files = [
      { filename: '센터.txt', content: '일반 센터 규칙이다. '.repeat(300) },
      { filename: '메디컬.txt', content: `${'일반 의료 규칙이다. '.repeat(120)}정자은행은 가족계획실 지하에 있다.${'보존 절차를 따른다. '.repeat(120)}` },
      { filename: '재단.txt', content: '재단 취업망 규칙이다. '.repeat(300) },
    ];

    const result = retrieveWorldviewChunks(files, '정자은행은 가족계획실에 있다. 장면을 이어 써줘');
    const packet = result.map((chunk) => chunk.content).join('\n');

    expect(result[0].filename).toBe('메디컬.txt');
    expect(packet).toContain('정자은행');
    expect(packet.length).toBeLessThanOrEqual(LOREKEEPER_PACKET_CHARS + result.length);
  });

  it('문서에 적힌 별칭을 확장하고 한 파일의 관련 구역을 두 곳까지 찾는다', () => {
    const files = [
      {
        filename: '조직.txt',
        content: `프라이빗 센터(이하 본원)는 회원 전용 기관이다.\n${'일반 안내 문장이다. '.repeat(70)}\n프라이빗 센터의 지하 기록실은 승인된 직원만 들어갈 수 있다.`,
      },
      { filename: '도시.txt', content: '도시 외곽의 대중교통과 공원 규칙이다. '.repeat(90) },
    ];

    const result = retrieveWorldviewChunks(files, '본원에 관한 장면을 이어 써줘');

    expect(result[0].filename).toBe('조직.txt');
    expect(result.filter((chunk) => chunk.filename === '조직.txt')).toHaveLength(2);
    expect(result.map((chunk) => chunk.content).join('\n')).toContain('지하 기록실');
  });
});
