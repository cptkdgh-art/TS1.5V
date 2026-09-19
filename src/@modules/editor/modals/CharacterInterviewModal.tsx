/**
 * ============================================================
 * @module modules/editor/modals
 * @file CharacterInterviewModal.tsx
 * ============================================================
 * @description 인물 인터뷰 모달 - AI 캐릭터와의 대화
 * ============================================================
 */

import React, { useState, useRef } from 'react';
import type { Character, Content } from '@core/types';
import { XMarkIcon, toast } from '@shared/components';
import { interviewCharacter } from '@services/ai';

interface CharacterInterviewModalProps {
  character: Character;
  onClose: () => void;
  onUpdateCharacterLog: (newLog: string) => void;
}

export function CharacterInterviewModal({
  character,
  onClose,
  onUpdateCharacterLog,
}: CharacterInterviewModalProps) {
  const [history, setHistory] = useState<Content[]>([
    { role: 'model', parts: [{ text: `(${character.name}이(가) 당신 앞에 앉아 있습니다. 편안한 분위기에서 대화를 시작해보세요.)` }] }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, isLoading]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage: Content = { role: 'user', parts: [{ text: input }] };
    const newHistory = [...history, userMessage];
    setHistory(newHistory);
    setInput('');
    setIsLoading(true);
    try {
      const response = await interviewCharacter(input, newHistory, character);
      setHistory([...newHistory, { role: 'model', parts: [{ text: response }] }]);
    } catch (error) {
      toast.error(`캐릭터 응답 실패: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToLog = () => {
    if (history.length < 3) {
      toast.warning('저장할 대화 내용이 충분하지 않습니다.');
      return;
    }
    const interviewLog = history
      .slice(1)
      .map(msg => msg.role === 'user'
        ? `[질문] ${msg.parts?.[0]?.text || ''}`
        : `[${character.name}] ${msg.parts?.[0]?.text || ''}`)
      .join('\n\n');

    const timestamp = new Date().toLocaleDateString('ko-KR');
    const formattedLog = `\n--- 인터뷰 (${timestamp}) ---\n${interviewLog}\n`;
    onUpdateCharacterLog(formattedLog);
    toast.success(`인터뷰 내용이 ${character.name}의 성장 기록에 추가되었습니다.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-3xl h-[85vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
          <div>
            <h3 className="text-xl font-bold text-white">인물 인터뷰: {character.name}</h3>
            <p className="text-sm text-gray-400">{character.personality}</p>
          </div>
          <button onClick={onClose}><XMarkIcon className="w-6 h-6 text-gray-400 hover:text-white" /></button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-gray-900/50 rounded-lg mb-4" ref={scrollRef}>
          {history.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-lg ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-teal-700'}`}>
                <p className="whitespace-pre-wrap text-sm text-white">{msg.parts?.[0]?.text as string}</p>
              </div>
            </div>
          ))}
          {isLoading && <div className="text-gray-500 text-sm animate-pulse">{character.name}이(가) 생각 중...</div>}
        </div>

        <div className="flex gap-2 mb-4">
          <input
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:ring-teal-500 focus:border-teal-500"
            placeholder={`${character.name}에게 질문하세요...`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
          />
          <button onClick={handleSend} className="bg-teal-600 hover:bg-teal-700 text-white px-4 rounded-lg font-bold whitespace-nowrap">질문</button>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-gray-700 pt-4">
          <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white py-3 rounded-lg font-semibold text-sm">
            대화 종료
          </button>
          <button onClick={handleSaveToLog} className="bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-lg font-semibold text-sm">
            인터뷰 내용을 성장 기록에 저장
          </button>
        </div>
      </div>
    </div>
  );
}
