import { describe, expect, it } from 'vitest';
import { shouldAutoScrollToStreaming } from './streamingScroll';

describe('streaming manuscript auto-scroll', () => {
  it('집필 시작에만 이동하고 완료 저장 뒤에는 다시 이동하지 않는다', () => {
    expect(shouldAutoScrollToStreaming(false, true, false)).toBe(true);
    expect(shouldAutoScrollToStreaming(true, true, true)).toBe(false);
    expect(shouldAutoScrollToStreaming(true, true, false)).toBe(false);
    expect(shouldAutoScrollToStreaming(true, false, false)).toBe(false);
  });
});
