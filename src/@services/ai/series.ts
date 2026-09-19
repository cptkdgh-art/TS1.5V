/**
 * ============================================================
 * @module services/ai/series
 * @file series.ts
 * ============================================================
 * @description 시리즈 관련 AI 함수
 * ============================================================
 */

import type { Novel, Series, SeriesBlueprint, SeriesMemoryBlock, SeriesMemoryState, VolumeBlueprint } from '@core/types';
import { generateContent } from './config';
import {
  SERIES_HISTORIAN_INSTRUCTION,
  SERIES_ARCHITECT_INSTRUCTION,
  VOLUME_REGENERATION_INSTRUCTION,
  SERIES_REBALANCE_INSTRUCTION,
} from './prompts';
import { extractAndParseJson } from './utils';
import {
  composeSeriesMemory,
  createSeriesMemoryState,
  inspectSeriesMemoryState,
} from './seriesMemory';

export interface SeriesHistoryResult {
  content: string;
  memoryState: SeriesMemoryState;
  changedCount: number;
  reusedCount: number;
  removedCount: number;
}

/** AI 응답용 청사진 타입 */
interface BlueprintResponse {
  worldview?: string;
  mainConflict?: string;
  characterArcs?: string;
  volumes?: VolumeBlueprint[];
}

/** AI 응답용 볼륨 타입 */
interface VolumeResponse {
  volumeNumber?: number;
  title?: string;
  localSetting?: string;
  goal?: string;
  mainConflict?: string;
  keyEvents?: string;
  status?: 'planned' | 'drafting' | 'completed';
}

/**
 * 시리즈 히스토리 요약 (연대기)
 */
export async function summarizeSeriesHistory(
  novelsInSeries: Novel[],
  series: Series,
): Promise<SeriesHistoryResult> {
  const inspection = inspectSeriesMemoryState(series, novelsInSeries);
  const blocks: SeriesMemoryBlock[] = [];
  let changedCount = 0;

  for (const item of inspection.current) {
    if (item.reusableBlock) {
      blocks.push({
        ...item.reusableBlock,
        volumeId: item.volumeId,
        volumeLabel: item.volumeLabel,
        novelTitle: item.novel.title,
      });
      continue;
    }

    const prompt = `--- ${item.volumeLabel} (${item.novel.title}) 화별 기억 ---\n${item.novel.contextSummary?.content || ''}\n\n--- 요청 ---\n이 권에서 확정된 사건, 인물 상태, 관계, 소유물, 비밀, 미해결 단서를 다음 권이 이어 쓸 수 있는 간결한 권 연대기로 정리하세요. 다른 권의 내용을 추측하거나 새 사실을 만들지 마세요.`;
    try {
      const response = await generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        systemInstruction: SERIES_HISTORIAN_INSTRUCTION,
      });
      blocks.push({
        novelId: item.novel.id,
        volumeId: item.volumeId,
        volumeLabel: item.volumeLabel,
        novelTitle: item.novel.title,
        sourceSignature: item.sourceSignature,
        content: response?.trim() || '요약 실패',
        generatedAt: Date.now(),
      });
      changedCount += 1;
    } catch {
      throw new Error(`${item.volumeLabel} 연대기 요약 실패`);
    }
  }

  const memoryState = createSeriesMemoryState(blocks);
  return {
    content: composeSeriesMemory(blocks),
    memoryState,
    changedCount,
    reusedCount: inspection.reusedCount,
    removedCount: inspection.removedBlocks.length,
  };
}

// ============================================================
// 시리즈 아키텍트 함수들
// ============================================================

/**
 * 시리즈 청사진 생성
 * - Series 객체 기반으로 전체 시리즈 구조 설계
 * - 사용자가 직접 입력한 제약 조건은 유지
 * - 이미 집필된 권(Canon)은 수정하지 않음
 *
 * @param series - 시리즈 객체 (seriesPlotSummary 필수)
 * @param totalVolumes - 목표 권 수
 */
export async function generateSeriesBlueprint(
  series: { seriesPlotSummary?: string; blueprint?: SeriesBlueprint },
  totalVolumes: number
): Promise<SeriesBlueprint> {
  const logline = series.seriesPlotSummary || '';
  const currentBlueprint = series.blueprint;

  // 사용자가 직접 입력한 제약 조건
  const constraints = currentBlueprint
    ? {
        worldview: currentBlueprint.worldview,
        mainConflict: currentBlueprint.mainConflict,
        characterArcs: currentBlueprint.characterArcs,
      }
    : null;

  // 이미 잠긴 권(Canon)의 정보 수집
  const lockedVolumes = currentBlueprint?.volumes.filter(v => v.isLocked) || [];
  const existingContext = lockedVolumes.length > 0
    ? lockedVolumes.map(v => `${v.volumeNumber}권: ${v.goal} - ${v.keyEvents}`).join('\n')
    : '';

  let prompt = `
시리즈 로그라인: ${logline}
목표 총 권수: ${totalVolumes}권
`;

  if (constraints && (constraints.worldview || constraints.mainConflict || constraints.characterArcs)) {
    prompt += `
[사용자 지정 제약 조건 (수정 금지)]
- 세계관: ${constraints.worldview || '(AI가 자유롭게 생성)'}
- 메인 갈등: ${constraints.mainConflict || '(AI가 자유롭게 생성)'}
- 인물 성장: ${constraints.characterArcs || '(AI가 자유롭게 생성)'}
* 위 내용은 사용자가 직접 입력한 설정이므로 절대 변경하지 말고, 이에 맞춰 권별 줄거리만 생성하십시오.
`;
  }

  if (existingContext) {
    prompt += `\n[참고: 이미 집필된 기존 권 정보 (Canon)]\n${existingContext}\n\n* 중요: 위 '기존 권'의 내용은 이미 확정된 역사입니다. 절대 수정하지 말고, 그 이후의 이야기를 이어서 설계하십시오.`;
  }

  prompt += `

[요청]
위 정보를 바탕으로 ${totalVolumes}권짜리 시리즈의 전체 구조를 설계해주세요.
각 권마다 명확한 목표, 갈등, 핵심 사건을 정해주세요.

[응답 형식 - JSON]
{
  "worldview": "시리즈 세계관 핵심 설명",
  "mainConflict": "시리즈 전체를 관통하는 메인 갈등",
  "characterArcs": "주인공과 주요 인물들의 성장 아크",
  "volumes": [
    {
      "volumeNumber": 1,
      "title": "1권 제목",
      "localSetting": "이 권에서만 적용되는 지역, 조직, 분위기, 규칙의 변주",
      "goal": "이 권의 목표",
      "mainConflict": "이 권의 주요 갈등",
      "keyEvents": "핵심 사건들",
      "status": "planned"
    }
  ]
}
`;

  try {
    const response = await generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: SERIES_ARCHITECT_INSTRUCTION,
    });

    const result = extractAndParseJson<BlueprintResponse>(response || '', {});

    return {
      worldview: result.worldview || '',
      mainConflict: result.mainConflict || '',
      characterArcs: result.characterArcs || '',
      volumes: (result.volumes || []).map((v, index) => {
        const volumeNumber = v.volumeNumber || index + 1;
        const existing = currentBlueprint?.volumes.find((item) => item.volumeNumber === volumeNumber);
        return {
          ...v,
          id: existing?.id || crypto.randomUUID(),
          volumeNumber,
          displayLabel: existing?.displayLabel || `${volumeNumber}권`,
          localSetting: v.localSetting ?? existing?.localSetting ?? '',
          status: v.status || 'planned',
          linkedNovelId: existing?.linkedNovelId,
          isLocked: existing?.isLocked,
        };
      }),
      lastUpdated: Date.now(),
    };
  } catch (error) {
    console.error('[generateSeriesBlueprint] 실패:', error);
    throw new Error('시리즈 구조 설계 실패: AI 응답을 해석할 수 없습니다.');
  }
}

/**
 * 단일 권 재생성
 * - 특정 권 하나만 다시 설계
 * - 전후 맥락을 고려하여 매끄럽게 연결
 *
 * @param series - 시리즈 객체
 * @param blueprint - 현재 청사진
 * @param volumeNumber - 재생성할 권 번호 (1-based)
 */
export async function regenerateSingleVolume(
  series: { seriesPlotSummary?: string },
  blueprint: SeriesBlueprint,
  volumeNumber: number
): Promise<VolumeBlueprint> {
  const logline = series.seriesPlotSummary || '';
  const orderedVolumes = [...blueprint.volumes].sort((a, b) => a.volumeNumber - b.volumeNumber);
  const targetVolumeIndex = orderedVolumes.findIndex((volume) => volume.volumeNumber === volumeNumber);
  const targetVolume = orderedVolumes[targetVolumeIndex];
  if (!targetVolume) throw new Error('재설계할 권을 찾을 수 없습니다.');
  const prevVolume = orderedVolumes[targetVolumeIndex - 1];
  const nextVolume = orderedVolumes[targetVolumeIndex + 1];
  const totalVols = orderedVolumes.length;

  // 권의 위치에 따른 역할
  const position =
    targetVolumeIndex === 0
      ? '시리즈의 시작(도입부)'
      : targetVolumeIndex === totalVols - 1
        ? '시리즈의 대단원(결말)'
        : '시리즈의 중간(전개/위기)';

  const prevSummary = prevVolume?.keyEvents || prevVolume?.goal || (prevVolume ? '(내용 미정)' : '시리즈의 시작점');
  const nextSummary = nextVolume?.keyEvents || nextVolume?.goal || (nextVolume ? '(내용 미정)' : '시리즈의 결말 또는 미정');

  const prompt = `
[시리즈 정보]
로그라인: ${logline || '미정 (AI가 창의적으로 채울 것)'}
전체 권수: ${totalVols}권

[타겟 정보]
재설계 대상: 제 ${targetVolume.volumeNumber}권 (${position})
현재 목표(변경 가능): ${targetVolume.goal || '미정'}

[문맥 (Context)]
- 이전 권(${prevVolume?.volumeNumber || 'Start'}) 요약: ${prevSummary}
- 다음 권(${nextVolume?.volumeNumber || 'End'}) 요약: ${nextSummary}

[요청]
위 문맥을 이어주는 매끄러운 ${targetVolume.volumeNumber}권의 설계를 작성하십시오.
만약 전후 맥락이 비어있다면, **'시리즈 로그라인'과 '현재 권의 위치(${position})'를 절대적인 기준**으로 삼아 해당 권이 맡아야 할 서사적 역할을 추론하여 내용을 창조하십시오.

[응답 형식 - JSON]
{
  "volumeNumber": ${targetVolume.volumeNumber},
  "title": "권 제목",
  "localSetting": "이 권에서만 적용되는 지역, 조직, 분위기, 규칙의 변주",
  "goal": "이 권의 목표",
  "mainConflict": "주요 갈등",
  "keyEvents": "핵심 사건",
  "status": "planned"
}
`;

  try {
    const response = await generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: VOLUME_REGENERATION_INSTRUCTION,
    });

    const result = extractAndParseJson<VolumeResponse>(response || '', {});

    return {
      id: targetVolume.id || crypto.randomUUID(),
      volumeNumber: targetVolume.volumeNumber,
      displayLabel: targetVolume.displayLabel || `${targetVolume.volumeNumber}권`,
      title: result.title || `제${targetVolume.volumeNumber}권`,
      localSetting: result.localSetting || targetVolume.localSetting || '',
      goal: result.goal || '',
      mainConflict: result.mainConflict || '',
      keyEvents: result.keyEvents || '',
      status: result.status || 'planned',
      linkedNovelId: targetVolume.linkedNovelId,
      isLocked: targetVolume.isLocked,
    };
  } catch (error) {
    console.error('[regenerateSingleVolume] 실패:', error);
    throw new Error('권 재설계 실패');
  }
}

/**
 * 시리즈 구조 재조정
 * - 전체 구조 재균형
 * - isLocked: true인 권은 절대 변경하지 않음
 *
 * @param series - 시리즈 객체
 * @param blueprint - 현재 청사진
 */
export async function rebalanceSeriesStructure(
  series: { seriesPlotSummary?: string },
  blueprint: SeriesBlueprint
): Promise<SeriesBlueprint> {
  const logline = series.seriesPlotSummary || '';

  const prompt = `
[현재 청사진]
${JSON.stringify(blueprint, null, 2)}

[작업 유형]
시리즈 구조 재균형 (빈 권 채우기 및 전체 흐름 연결)

[시리즈 로그라인]
${logline}

* 지침: 'isLocked: true'인 권의 내용은 절대 변경하지 마십시오. 빈 권의 내용을 채우고, 전체 흐름을 연결하십시오.

[응답 형식 - JSON]
{
  "worldview": "세계관",
  "mainConflict": "메인 갈등",
  "characterArcs": "인물 성장",
  "volumes": [...]
}
`;

  try {
    const response = await generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: SERIES_REBALANCE_INSTRUCTION,
    });

    const result = extractAndParseJson<BlueprintResponse>(response || '', {});

    // isLocked 상태 보존
    const updatedVolumes = (result.volumes || []).map((v, idx) => {
      const original = (v.id && blueprint.volumes.find((volume) => volume.id === v.id))
        || blueprint.volumes.find((volume) => volume.volumeNumber === v.volumeNumber)
        || blueprint.volumes[idx];
      if (original?.isLocked) {
        return { ...original }; // 잠긴 권은 원본 유지
      }
      return {
        ...v,
        id: original?.id || crypto.randomUUID(),
        displayLabel: original?.displayLabel || `${v.volumeNumber || idx + 1}권`,
        localSetting: v.localSetting ?? original?.localSetting ?? '',
        linkedNovelId: original?.linkedNovelId,
        isLocked: original?.isLocked,
      };
    });

    return {
      worldview: result.worldview || blueprint.worldview,
      mainConflict: result.mainConflict || blueprint.mainConflict,
      characterArcs: result.characterArcs || blueprint.characterArcs,
      volumes: updatedVolumes,
      lastUpdated: Date.now(),
    };
  } catch (error) {
    console.error('[rebalanceSeriesStructure] 실패:', error);
    throw new Error('시리즈 재조정 실패');
  }
}
