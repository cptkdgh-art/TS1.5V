/**
 * ============================================================
 * @module modules/editor/modals
 * @file BriefingRoomModal.tsx
 * ============================================================
 * @description 다음 챕터 브리핑 룸 모달
 * ============================================================
 */

import React, { useState, useRef, useEffect } from 'react';
import { XMarkIcon, toast } from '@shared/components';
import type { AiAuthor, Content } from '@core/types';
import { getLiveFeedback, summarizeBriefingChat } from '@services/ai';

interface BriefingRoomModalProps {
  novelTitle: string;
  author: AiAuthor | null;
  onClose: () => void;
  onApplyAsDirective: (text: string) => void;
  onPromoteToGuideline: (text: string) => void;
}

export function BriefingRoomModal({
  novelTitle,
  author,
  onClose,
  onApplyAsDirective,
  onPromoteToGuideline,
}: BriefingRoomModalProps) {
  const [history, setHistory] = useState<Content[]>([
    { role: 'model', parts: [{ text: `안녕하세요, 편집장님. '${novelTitle}'의 다음 챕터에 대해 논의할 준비가 되었습니다. 어떤 내용을 구상하고 계신가요?` }] }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
      const response = await getLiveFeedback(input, newHistory, author, novelTitle);
      setHistory([...newHistory, { role: 'model', parts: [{ text: response }] }]);
    } catch (error) {
      toast.error(`응답 실패: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (action: 'save' | 'note' | 'memory') => {
    if (action === 'save') {
      onClose();
      return;
    }

    if (history.length < 3) {
      toast.warning('요약할 대화 내용이 충분하지 않습니다.');
      return;
    }

    setIsLoading(true);
    try {
      const summary = await summarizeBriefingChat(history);
      if (action === 'note') {
        onApplyAsDirective(summary);
        toast.success('자유 연출 노트에 적용되었습니다.');
      } else if (action === 'memory') {
        onPromoteToGuideline(summary);
        toast.success('핵심 연출 지침(AI 기억)에 각인되었습니다.');
      }
      onClose();
    } catch (error) {
      toast.error(`요약 실패: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-3xl h-[85vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
          <h3 className="text-xl font-bold text-white">다음 챕터 브리핑 룸</h3>
          <button onClick={onClose}><XMarkIcon className="w-6 h-6 text-gray-400 hover:text-white" /></button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-gray-900/50 rounded-lg mb-4" ref={scrollRef}>
          {history.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-lg ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-gray-700'}`}>
                <p className="whitespace-pre-wrap text-sm text-white">{msg.parts?.[0]?.text as string}</p>
              </div>
            </div>
          ))}
          {isLoading && <div className="text-gray-500 text-sm animate-pulse">작가가 입력 중...</div>}
        </div>

        <div className="flex gap-2 mb-4">
          <input
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:ring-teal-500 focus:border-teal-500"
            placeholder="다음 챕터의 아이디어를 이야기하세요..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
          />
          <button onClick={handleSend} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 rounded-lg font-bold whitespace-nowrap">전송</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-gray-700 pt-4">
          <button onClick={() => handleAction('save')} className="bg-gray-600 hover:bg-gray-500 text-white py-3 rounded-lg font-semibold text-sm">
            대화 기록만 저장 (닫기)
          </button>
          <button onClick={() => handleAction('note')} disabled={isLoading} className="bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-lg font-semibold text-sm disabled:bg-gray-700">
            요약하여 연출 노트에 추가
          </button>
          <button onClick={() => handleAction('memory')} disabled={isLoading} className="bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-lg font-semibold text-sm disabled:bg-gray-700">
            요약하여 AI 기억에 각인
          </button>
        </div>
      </div>
    </div>
  );
}
