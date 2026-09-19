import { describe, expect, it } from 'vitest';
import { compressInstructionForPro, prepareGeneratedChapter } from './generation';

describe('prepareGeneratedChapter', () => {
  it('작가가 생성한 문체와 표기를 임의로 교정하지 않는다', () => {
    const original = '# 첫 장면\n\n*그는* 단순한 문을 보았다. 단순한 문이었다.';

    expect(prepareGeneratedChapter(original).content).toBe(original);
  });

  it('본문 뒤의 구조화된 복선 메모만 분리한다', () => {
    const original = `그는 빈 의자를 오래 바라보았다.

---복선메모---
[심음] 빈 의자: 사라진 동료의 자리
---끝---`;
    const result = prepareGeneratedChapter(original);

    expect(result.content).toBe('그는 빈 의자를 오래 바라보았다.');
    expect(result.memo?.planted[0].content).toBe('빈 의자');
  });
});

describe('compressInstructionForPro', () => {
  it('현재 프롬프트 구획명의 세계관과 등장인물을 압축한다', () => {
    const world = '가'.repeat(700);
    const characters = Array.from(
      { length: 8 },
      (_, index) => `[인물${index + 1}] ${'성격과 배경 '.repeat(30)}`,
    ).join('\n');
    const instruction = `[작가 프로필]\n고유한 문체를 지킨다.\n\n--- 세계관 설정 (압축) ---\n[File: 세계.txt]\n${world}\n\n--- 주요 등장인물 ---\n${characters}\n\n--- 집필 기본 원칙 ---\n본문을 쓴다.`;

    const compressed = compressInstructionForPro(instruction);

    expect(compressed).toContain('[작가 프로필]\n고유한 문체를 지킨다.');
    expect(compressed).toContain('--- 세계관 설정 (요약) ---');
    expect(compressed).toContain('… (이하 생략)');
    expect(compressed).toContain('--- 주요 등장인물 (요약 5명) ---');
    expect(compressed).toContain('(외 3명 생략)');
    expect(compressed).not.toContain('[인물8]');
  });

  it('Pro 세계관은 전체 안전 예산 안에서 파일당 400자까지 보존한다', () => {
    const worldview = Array.from(
      { length: 10 },
      (_, index) => `[File: 세계-${index + 1}.txt]\n${String(index).repeat(700)}`,
    ).join('\n\n');
    const instruction = `--- 세계관 설정 (압축) ---\n${worldview}\n\n--- 집필 기본 원칙 ---\n본문을 쓴다.`;

    const compressed = compressInstructionForPro(instruction);

    expect(compressed).toContain('[File: 세계-1.txt]');
    expect(compressed).toContain('0'.repeat(400));
    expect(compressed).toContain('[File: 세계-8.txt]');
    expect(compressed).not.toContain('[File: 세계-9.txt]');
    expect(compressed.length).toBeLessThanOrEqual(8018);
  });
});
