import { useBooleanFlags } from './useBooleanFlags';

export interface BusyFlags {
  analyzing: boolean;
  analyzingCharacters: boolean;
  analyzingWorldview: boolean;
  cloningAuthor: boolean;
  summarizing: boolean;
  generatingCharacter: boolean;
  generatingAspect: boolean;
  savingTitle: boolean;
  savingPlotSummary: boolean;
  savingSeriesPlotSummary: boolean;
  savingSubject: boolean;
  savingMood: boolean;
}

const INITIAL: BusyFlags = {
  analyzing: false,
  analyzingCharacters: false,
  analyzingWorldview: false,
  cloningAuthor: false,
  summarizing: false,
  generatingCharacter: false,
  generatingAspect: false,
  savingTitle: false,
  savingPlotSummary: false,
  savingSeriesPlotSummary: false,
  savingSubject: false,
  savingMood: false,
};

/** 에디터의 비동기 작업 진행 플래그 12개 */
export function useBusyFlags() {
  const [busy, setBusy] = useBooleanFlags(INITIAL);
  return { busy, setBusy };
}
