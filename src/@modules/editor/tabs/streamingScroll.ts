export function shouldAutoScrollToStreaming(
  wasAutoLoading: boolean,
  isAutoLoading: boolean,
  isCommittingChapter: boolean,
): boolean {
  return !wasAutoLoading && isAutoLoading && !isCommittingChapter;
}
