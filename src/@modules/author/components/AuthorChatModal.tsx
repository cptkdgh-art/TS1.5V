/**
 * ============================================================
 * @module modules/author/components
 * @file AuthorChatModal.tsx
 * ============================================================
 * @description 작가와의 대화 모달 (일반/메타)
 * ============================================================
 */

import { useState, useRef, useEffect } from 'react';
import type { Content } from '@google/genai';
import type { AiAuthor } from '@core/types';
import { Modal, Button, toast, useConfirmDialog } from '@shared/components';
import { haveGeneralChatWithAuthor, haveAfterwordChat } from '@services/ai/chat';
import { useAuthorStore } from '@stores/authorStore';
import { getActiveWorkspaceId } from '@services/storage';
import { getWorkspaceGeneration } from '@services/storage/workspaceCoordination';

interface AuthorChatModalProps {
  author: AiAuthor;
  chatType: 'general' | 'meta';
  authors: AiAuthor[];
  onClose: () => void;
  onUpdateAuthors: (authors: AiAuthor[]) => void;
}

export function AuthorChatModal({
  author,
  chatType,
  onClose,
}: AuthorChatModalProps) {
  const historyKey = chatType === 'general' ? 'generalChatHistory' : 'metaChatHistory';
  const [chatHistory, setChatHistory] = useState<Content[]>(author[historyKey] || []);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const confirm = useConfirmDialog();
  const requestRef = useRef(0);
  const sendingRef = useRef(false);

  useEffect(() => {
    setChatHistory(useAuthorStore.getState().getAuthorById(author.id)?.[historyKey] || []);
    sendingRef.current = false;
    setIsLoading(false);
    return () => { requestRef.current += 1; };
  }, [author.id, historyKey]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || sendingRef.current) return;
    const currentAuthor = useAuthorStore.getState().getAuthorById(author.id);
    if (!currentAuthor) return;
    const history = currentAuthor[historyKey] || [];
    const signature = JSON.stringify(history);
    const generation = getWorkspaceGeneration(getActiveWorkspaceId());
    const request = ++requestRef.current;
    sendingRef.current = true;

    const userMessage: Content = { role: 'user', parts: [{ text: inputMessage }] };
    const newHistory = [...history, userMessage];
    setChatHistory(newHistory);
    setInputMessage('');
    setIsLoading(true);

    try {
      let response: string;
      if (chatType === 'general') {
        response = await haveGeneralChatWithAuthor(inputMessage, history, currentAuthor);
      } else {
        response = await haveAfterwordChat(inputMessage, history, currentAuthor);
      }

      const modelMessage: Content = { role: 'model', parts: [{ text: response }] };
      const updatedHistory = [...newHistory, modelMessage];
      if (request !== requestRef.current) return;
      const updated = await useAuthorStore.getState().mutateAuthor(author.id, (latest) => {
        if (request !== requestRef.current || JSON.stringify(latest[historyKey] || []) !== signature) return undefined;
        return { ...latest, [historyKey]: updatedHistory };
      }, generation);
      if (updated && request === requestRef.current) setChatHistory(updated[historyKey] || []);
    } catch (error) {
      if (request !== requestRef.current) return;
      console.error('대화 실패:', error);
      toast.error('대화 중 오류가 발생했습니다.');
      const errorMessage: Content = {
        role: 'model',
        parts: [{ text: '죄송합니다, 응답 중 오류가 발생했습니다.' }],
      };
      setChatHistory([...newHistory, errorMessage]);
    } finally {
      if (request === requestRef.current) {
        sendingRef.current = false;
        setIsLoading(false);
      }
    }
  };

  const handleClearHistory = async () => {
    if (sendingRef.current) return;
    const expectedRequest = requestRef.current;
    const confirmed = await confirm({
      title: '대화 기록 삭제',
      message: '대화 기록을 삭제하시겠습니까?',
      confirmText: '삭제',
      variant: 'danger',
    });
    if (!confirmed || sendingRef.current || expectedRequest !== requestRef.current) return;

    const request = ++requestRef.current;
    sendingRef.current = true;
    setIsLoading(true);
    try {
      await useAuthorStore.getState().mutateAuthor(author.id, (latest) => (
        request === requestRef.current ? { ...latest, [historyKey]: [] } : undefined
      ));
      if (request === requestRef.current) setChatHistory([]);
    } catch {
      if (request === requestRef.current) toast.error('대화 기록 삭제에 실패했습니다.');
    } finally {
      if (request === requestRef.current) {
        sendingRef.current = false;
        setIsLoading(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const title = chatType === 'general'
    ? `${author.name}와 일반 대화`
    : `${author.name}와 메타 대화`;

  const description = chatType === 'general'
    ? '작가 자신의 관점과 작품관으로 자유롭게 대화합니다.'
    : '작가와 창작에 대한 메타적 논의를 합니다.';

  return (
    <Modal isOpen onClose={onClose} title={title} size="lg">
      <div className="flex flex-col h-[70vh]">
        <p className="text-gray-400 text-sm mb-4">{description}</p>

        {/* 채팅 영역 */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2"
        >
          {chatHistory.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <p>{author.name}과의 대화를 시작하세요.</p>
            </div>
          )}
          {chatHistory.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-700 text-gray-200'
                }`}
              >
                <p className="whitespace-pre-wrap">
                  {msg.parts?.[0] && 'text' in msg.parts[0] ? msg.parts[0].text : ''}
                </p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-700 p-3 rounded-lg animate-pulse">
                <p className="text-gray-400">{author.name}이(가) 생각 중...</p>
              </div>
            </div>
          )}
        </div>

        {/* 입력 영역 */}
        <div className="border-t border-gray-700 pt-4">
          <div className="flex gap-2 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearHistory}
              disabled={chatHistory.length === 0 || isLoading}
            >
              대화 기록 삭제
            </Button>
          </div>
          <div className="flex gap-2">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="메시지를 입력하세요..."
              className="flex-1 bg-gray-700 border border-gray-600 rounded-lg p-3 text-white resize-none"
              rows={2}
              disabled={isLoading}
            />
            <Button
              variant="primary"
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading}
            >
              전송
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
