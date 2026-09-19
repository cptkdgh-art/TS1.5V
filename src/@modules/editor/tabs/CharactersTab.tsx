/**
 * ============================================================
 * @module modules/editor/tabs
 * @file CharactersTab.tsx
 * ============================================================
 * @description 등장인물 탭 - 캐릭터 관리
 * ============================================================
 */

import type { Novel, Character, Series } from '@core/types';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  WandSparklesIcon,
  SparklesIcon,
  ChatBubbleThoughtIcon,
} from '@shared/components';

interface CharactersTabProps {
  novel: Novel;
  series: Series | null;
  onUpdateNovel: (updatedNovel: Novel) => void;
  onUpdateSeries: (updatedSeries: Series) => void;
  isAnalyzingCharacters: boolean;
  setEditingCharacter: (character: Character | null) => void;
  setCharacterModalOpen: (isOpen: boolean) => void;
  requestConfirmation: (title: string, message: React.ReactNode, confirmText: string, onConfirm: () => void) => void;
  onConfirmAnalysis: () => void;
  onGenerateCharacter: () => void;
  onStartInterview: (characterId: string) => void;
}

export function CharactersTab({
  novel,
  series,
  onUpdateNovel,
  onUpdateSeries,
  isAnalyzingCharacters,
  setEditingCharacter,
  setCharacterModalOpen,
  requestConfirmation,
  onConfirmAnalysis,
  onGenerateCharacter,
  onStartInterview,
}: CharactersTabProps) {
  const characters = series ? series.characters : novel.characters;

  const handleAnalyzeCharactersClick = () => {
    requestConfirmation(
      '등장인물 분석 확인',
      <p>소설 본문 전체를 AI에게 보내 새로운 등장인물을 찾고, 기존 인물의 변화를 분석합니다. 계속하시겠습니까?</p>,
      '분석 시작',
      onConfirmAnalysis
    );
  };

  const handleDeleteCharacter = (idToDelete: string) => {
    if (series) {
      onUpdateSeries({ ...series, characters: series.characters.filter(c => c.id !== idToDelete) });
    } else {
      onUpdateNovel({ ...novel, characters: novel.characters.filter(c => c.id !== idToDelete) });
    }
  };

  return (
    <div className="font-sans">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">등장인물</h2>
        <div className="flex gap-2">
          <button
            onClick={handleAnalyzeCharactersClick}
            disabled={isAnalyzingCharacters}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-3 rounded-lg text-sm disabled:bg-gray-700 disabled:cursor-wait"
          >
            <WandSparklesIcon className="w-4 h-4" />
            {isAnalyzingCharacters ? '분석 중...' : '본문에서 분석'}
          </button>
          <button
            onClick={onGenerateCharacter}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-3 rounded-lg text-sm"
          >
            <SparklesIcon className="w-4 h-4" />
            AI로 인물 추천받기
          </button>
          <button
            onClick={() => { setEditingCharacter(null); setCharacterModalOpen(true); }}
            className="p-2 text-white rounded-full bg-indigo-600 hover:bg-indigo-700"
          >
            <PlusIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <ul className="space-y-3">
        {characters.map(char => (
          <li key={char.id} className="bg-gray-700 p-4 rounded-md">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-indigo-400 text-lg">{char.name}</h3>
                <p className="text-sm text-gray-300 mt-1">{char.personality}</p>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => onStartInterview(char.id)}
                  className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-600"
                  title="인물과 대화하기"
                >
                  <ChatBubbleThoughtIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setEditingCharacter(char); setCharacterModalOpen(true); }}
                  className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-600"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteCharacter(char.id)}
                  className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-600"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {characters.length === 0 && (
        <div className="text-center py-10 text-gray-500">
          <p>아직 등록된 등장인물이 없습니다.</p>
          <p className="text-sm mt-2">위의 버튼을 사용하여 인물을 추가하세요.</p>
        </div>
      )}
    </div>
  );
}
