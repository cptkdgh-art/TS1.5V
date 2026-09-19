import type { EpisodePacing, Novel, WritingFocusScope } from '@core/types';

export const DEFAULT_WRITING_FOCUS_SCOPE: WritingFocusScope = 'until-complete';

export function getWritingFocusScope(pacing?: EpisodePacing): WritingFocusScope {
  return pacing?.scope === 'next-chapter' ? 'next-chapter' : DEFAULT_WRITING_FOCUS_SCOPE;
}

export function applyWritingFocusAfterChapterCommit(novel: Novel, completed: boolean): Novel {
  const pacing = novel.episodePacing;
  if (!completed || !pacing?.isEnabled || getWritingFocusScope(pacing) !== 'next-chapter') {
    return novel;
  }

  return {
    ...novel,
    episodePacing: {
      ...pacing,
      isEnabled: false,
    },
  };
}
