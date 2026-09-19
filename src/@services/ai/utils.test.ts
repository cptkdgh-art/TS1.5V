import { describe, expect, it } from 'vitest';
import { computeChapterSignature, computeStableSignature, extractAndParseJson, getSummaryCoveredCount, matchesChapterSignature, validateSummaryCheckpoint } from './utils';

describe('extractAndParseJson', () => {
  it('설명 문장 안의 JSON 객체를 추출한다', () => {
    const parsed = extractAndParseJson<{ filename: string }>(
      '좋습니다. {"filename":"세계관.txt"} 저장하세요.',
      { filename: 'fallback' }
    );

    expect(parsed).toEqual({ filename: '세계관.txt' });
  });

  it('객체 배열 응답을 첫 객체로 오인하지 않고 배열로 유지한다', () => {
    const parsed = extractAndParseJson<Array<{ goal: string }>>(
      '```json\n[{"goal":"도입"},{"goal":"반전"}]\n```',
      []
    );

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toEqual([{ goal: '도입' }, { goal: '반전' }]);
  });

  it('코드블록 밖의 객체 배열도 배열로 유지한다', () => {
    const parsed = extractAndParseJson<Array<{ name: string }>>(
      '아래 결과입니다.\n[{"name":"서연"},{"name":"민재"}]\n확인하세요.',
      []
    );

    expect(parsed).toEqual([{ name: '서연' }, { name: '민재' }]);
  });

  it('문자열 내부 괄호는 JSON 경계로 오인하지 않는다', () => {
    const parsed = extractAndParseJson<{ content: string }>(
      '{"content":"문 안쪽에 [금고]와 {비밀}이 있었다."} trailing',
      { content: 'fallback' }
    );

    expect(parsed).toEqual({ content: '문 안쪽에 [금고]와 {비밀}이 있었다.' });
  });

  it('트레일링 콤마와 따옴표 없는 키를 복구한다', () => {
    const parsed = extractAndParseJson<{ filename: string; content: string }>(
      '{filename:"도시.txt", content:"밤의 도시",}',
      { filename: 'fallback', content: '' }
    );

    expect(parsed).toEqual({ filename: '도시.txt', content: '밤의 도시' });
  });

  it('파싱 불가능하면 기본값을 반환한다', () => {
    const fallback = { ok: false };
    expect(extractAndParseJson('JSON 없음', fallback)).toBe(fallback);
  });
});

describe('content signatures', () => {
  it('같은 길이와 같은 시작 문장이어도 뒤쪽 본문 수정은 감지한다', () => {
    const base = [{ id: 'ch-1', title: '1화', content: `${'같은 시작'.repeat(4)}A` }];
    const edited = [{ ...base[0], content: `${'같은 시작'.repeat(4)}B` }];

    expect(computeChapterSignature(base)).not.toBe(computeChapterSignature(edited));
  });

  it('같은 입력은 언제나 같은 서명을 만든다', () => {
    expect(computeStableSignature('진폭')).toBe(computeStableSignature('진폭'));
    expect(matchesChapterSignature(computeChapterSignature([]), [])).toBe(true);
  });

  it('기존 요약 뒤에 추가된 챕터를 수정이 아닌 증분 추가로 판정한다', () => {
    const covered = [
      { id: 'ch-1', title: '1화', content: '첫 화' },
      { id: 'ch-2', title: '2화', content: '둘째 화' },
    ];
    const current = [...covered, { id: 'ch-3', title: '3화', content: '새 화' }];
    const result = validateSummaryCheckpoint({
      content: '요약',
      summarizedChapters: 2,
      createdAt: 1,
      coveredChapterIds: covered.map((chapter) => chapter.id),
      contentSignature: computeChapterSignature(covered),
    }, current, 0);

    expect(result).toEqual({ isValid: true, reason: 'chapters_added', newChaptersCount: 1 });
  });

  it('요약 완료 지점 이후를 원문 전달 구간으로 남긴다', () => {
    const summary = {
      content: '1~2화 요약', summarizedChapters: 2, createdAt: 1,
      coveredChapterIds: ['ch-1', 'ch-2'],
    };

    expect(getSummaryCoveredCount(summary, 8, 3, true)).toBe(2);
    expect(getSummaryCoveredCount(summary, 8, 3, false)).toBe(0);
  });
});
