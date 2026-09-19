/**
 * ============================================================
 * @module modules/editor/modals
 * @file EditorFeedbackModal.tsx
 * ============================================================
 * @description 웹소설 편집자 피드백 모달 (The Editor K 웹소설 버전)
 * - 11가지 기준으로 챕터 분석
 * - 점수와 피드백 표시
 * - 편집자와 추가 대화 가능
 * ============================================================
 */

import { useState, useEffect } from 'react';
import type { Content } from '@google/genai';
import type { Character } from '@core/types';
import {
  getWebNovelEditorFeedback,
  chatWithWebNovelEditor,
  type WebNovelEditorFeedback,
} from '@services/ai';
import { toast, SparklesIcon } from '@shared/components';

interface EditorFeedbackModalProps {
  chapter: {
    title: string;
    content: string;
  };
  novelTitle: string;
  novelSubject: string;
  chapterNumber: number;
  previousChapterSummary?: string;
  characters?: Character[];
  onClose: () => void;
}

/** 점수에 따른 색상 */
function getScoreColor(score: number, maxScore: number): string {
  const percentage = (score / maxScore) * 100;
  if (percentage >= 80) return 'text-green-400';
  if (percentage >= 60) return 'text-yellow-400';
  if (percentage >= 40) return 'text-orange-400';
  return 'text-red-400';
}

/** 점수 바 컴포넌트 */
function ScoreBar({ score, maxScore, label, comment }: { score: number; maxScore: number; label: string; comment: string }) {
  const percentage = (score / maxScore) * 100;
  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-gray-300">{label}</span>
        <span className={`text-sm font-bold ${getScoreColor(score, maxScore)}`}>
          {score}/{maxScore}
        </span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${
            percentage >= 80
              ? 'bg-green-500'
              : percentage >= 60
              ? 'bg-yellow-500'
              : percentage >= 40
              ? 'bg-orange-500'
              : 'bg-red-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">{comment}</p>
    </div>
  );
}

export function EditorFeedbackModal({
  chapter,
  novelTitle,
  novelSubject,
  chapterNumber,
  previousChapterSummary,
  characters,
  onClose,
}: EditorFeedbackModalProps) {
  const [feedback, setFeedback] = useState<WebNovelEditorFeedback | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'original' | 'overview' | 'details' | 'chat'>('original');
  const [chatHistory, setChatHistory] = useState<Content[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // 피드백 로드
  useEffect(() => {
    const loadFeedback = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getWebNovelEditorFeedback(
          chapter.title,
          chapter.content,
          novelTitle,
          novelSubject,
          chapterNumber,
          previousChapterSummary,
          characters?.map((c) => ({ name: c.name, personality: c.personality }))
        );
        if (result) {
          setFeedback(result);
        } else {
          setError('피드백을 가져오는데 실패했습니다.');
        }
      } catch (err) {
        setError('피드백 분석 중 오류가 발생했습니다.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    loadFeedback();
  }, [chapter, novelTitle, novelSubject, chapterNumber, previousChapterSummary, characters]);

  // 편집자와 대화
  const handleChat = async () => {
    if (!chatInput.trim() || !feedback) return;
    const userMsg: Content = { role: 'user', parts: [{ text: chatInput }] };
    const newHistory = [...chatHistory, userMsg];
    setChatHistory(newHistory);
    setChatInput('');
    setIsChatLoading(true);
    try {
      const response = await chatWithWebNovelEditor(
        chatInput,
        newHistory,
        chapter.title,
        chapter.content,
        feedback
      );
      setChatHistory([...newHistory, { role: 'model', parts: [{ text: response }] }]);
    } catch (error) {
      toast.error(`대화 실패: ${(error as Error).message}`);
    } finally {
      setIsChatLoading(false);
    }
  };

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md text-center">
          <SparklesIcon className="w-12 h-12 mx-auto mb-4 text-indigo-400 animate-pulse" />
          <h3 className="text-xl font-bold text-white mb-2">편집장 K가 분석 중...</h3>
          <p className="text-gray-400 text-sm">
            11가지 기준으로 챕터를 검토하고 있습니다
          </p>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (error || !feedback) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
          <h3 className="text-xl font-bold text-red-400 mb-4">분석 실패</h3>
          <p className="text-gray-300 mb-4">{error || '알 수 없는 오류가 발생했습니다.'}</p>
          <button
            onClick={onClose}
            className="w-full bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-white"
          >
            닫기
          </button>
        </div>
      </div>
    );
  }

  // 총점 색상
  const totalScoreColor =
    feedback.totalScore >= 80
      ? 'text-green-400'
      : feedback.totalScore >= 60
      ? 'text-yellow-400'
      : feedback.totalScore >= 40
      ? 'text-orange-400'
      : 'text-red-400';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-bold text-white">편집장 K의 피드백</h3>
              <p className="text-gray-400 text-sm mt-1">
                {chapterNumber}화 - {chapter.title}
              </p>
            </div>
            <div className="text-right">
              <span className={`text-4xl font-bold ${totalScoreColor}`}>
                {feedback.totalScore}
              </span>
              <span className="text-gray-400 text-lg">/100</span>
            </div>
          </div>
          {/* 탭 */}
          <div className="flex gap-2 mt-4">
            {(['original', 'overview', 'details', 'chat'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {tab === 'original' ? '📄 원문' : tab === 'overview' ? '총평' : tab === 'details' ? '상세 분석' : '대화하기'}
              </button>
            ))}
          </div>
        </div>

        {/* 컨텐츠 */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'original' && (
            <div className="h-full flex flex-col">
              <div className="flex-1 bg-gray-900 rounded-lg flex flex-col min-h-0">
                <h4 className="text-lg font-bold text-white p-4 pb-2 border-b border-gray-700 flex-shrink-0">
                  {chapter.title}
                </h4>
                <div className="flex-1 overflow-y-auto p-4 pt-4">
                  <div className="text-gray-300 whitespace-pre-wrap leading-relaxed text-[15px]">
                    {chapter.content}
                  </div>
                </div>
              </div>
              <p className="text-gray-500 text-sm text-center mt-3 flex-shrink-0">
                💡 피드백 내용은 '총평' 또는 '상세 분석' 탭에서 확인하세요
              </p>
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* 총평 */}
              <div className="bg-gray-900 p-4 rounded-lg">
                <h4 className="text-lg font-bold text-white mb-2">총평</h4>
                <p className="text-gray-300">{feedback.summary}</p>
              </div>

              {/* 핵심 문제점 */}
              <div>
                <h4 className="text-lg font-bold text-white mb-3">핵심 개선 포인트</h4>
                <div className="space-y-3">
                  {feedback.topIssues.map((issue: { priority: number; issue: string; suggestion: string }, idx: number) => (
                    <div key={idx} className="bg-gray-900 p-4 rounded-lg border-l-4 border-orange-500">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded">
                          #{issue.priority}
                        </span>
                        <span className="text-white font-medium">{issue.issue}</span>
                      </div>
                      <p className="text-gray-400 text-sm">{issue.suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 잘된 점 */}
              <div>
                <h4 className="text-lg font-bold text-white mb-3">잘된 점</h4>
                <div className="space-y-2">
                  {feedback.goodPoints.map((point: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 text-green-400">
                      <span>✓</span>
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 편집장 K의 한마디 */}
              <div className="bg-indigo-900/30 p-4 rounded-lg border border-indigo-700">
                <h4 className="text-sm font-bold text-indigo-400 mb-2">편집장 K의 한마디</h4>
                <p className="text-gray-300 italic">"{feedback.editorNote}"</p>
              </div>
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* 훅/몰입 */}
              <div>
                <h4 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <span className="text-2xl">🎯</span> 훅/몰입 (30점)
                </h4>
                <div className="bg-gray-900 p-4 rounded-lg">
                  <ScoreBar
                    score={feedback.hook.firstHook.score}
                    maxScore={10}
                    label="첫 훅"
                    comment={feedback.hook.firstHook.comment}
                  />
                  <ScoreBar
                    score={feedback.hook.pacing.score}
                    maxScore={10}
                    label="페이싱"
                    comment={feedback.hook.pacing.comment}
                  />
                  <ScoreBar
                    score={feedback.hook.cliffhanger.score}
                    maxScore={10}
                    label="절단마공"
                    comment={feedback.hook.cliffhanger.comment}
                  />
                </div>
              </div>

              {/* 표현/연출 */}
              <div>
                <h4 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <span className="text-2xl">✍️</span> 표현/연출 (30점)
                </h4>
                <div className="bg-gray-900 p-4 rounded-lg">
                  <ScoreBar
                    score={feedback.style.dialogueRatio.score}
                    maxScore={8}
                    label="대사 비율"
                    comment={feedback.style.dialogueRatio.comment}
                  />
                  <ScoreBar
                    score={feedback.style.descriptionDensity.score}
                    maxScore={7}
                    label="묘사 밀도"
                    comment={feedback.style.descriptionDensity.comment}
                  />
                  <ScoreBar
                    score={feedback.style.sentenceRhythm.score}
                    maxScore={8}
                    label="문장 리듬"
                    comment={feedback.style.sentenceRhythm.comment}
                  />
                  <ScoreBar
                    score={feedback.style.showDontTell.score}
                    maxScore={7}
                    label="감정 묘사 (Show don't Tell)"
                    comment={feedback.style.showDontTell.comment}
                  />
                </div>
              </div>

              {/* 서사/일관성 */}
              <div>
                <h4 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <span className="text-2xl">📖</span> 서사/일관성 (40점)
                </h4>
                <div className="bg-gray-900 p-4 rounded-lg">
                  <ScoreBar
                    score={feedback.narrative.characterConsistency.score}
                    maxScore={10}
                    label="캐릭터 일관성"
                    comment={feedback.narrative.characterConsistency.comment}
                  />
                  <ScoreBar
                    score={feedback.narrative.emotionalArc.score}
                    maxScore={10}
                    label="감정선"
                    comment={feedback.narrative.emotionalArc.comment}
                  />
                  <ScoreBar
                    score={feedback.narrative.foreshadowingBalance.score}
                    maxScore={10}
                    label="복선 균형"
                    comment={feedback.narrative.foreshadowingBalance.comment}
                  />
                  <ScoreBar
                    score={feedback.narrative.tensionBalance.score}
                    maxScore={10}
                    label="전개 긴장감"
                    comment={feedback.narrative.tensionBalance.comment}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="flex flex-col h-full">
              <p className="text-gray-400 text-sm mb-4">
                피드백에 대해 궁금한 점이 있으면 편집장 K에게 물어보세요.
              </p>
              <div className="flex-1 overflow-y-auto bg-gray-900 p-4 rounded-lg mb-4 space-y-3 min-h-[300px]">
                {chatHistory.length === 0 && (
                  <p className="text-gray-500 text-center">
                    "왜 이 점수가 낮은가요?", "어떻게 개선하면 좋을까요?" 등을 물어보세요.
                  </p>
                )}
                {chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded max-w-[80%] ${
                      msg.role === 'user' ? 'bg-indigo-600 ml-auto' : 'bg-gray-700'
                    }`}
                  >
                    <p className="text-white whitespace-pre-wrap text-sm">
                      {msg.parts?.[0] && 'text' in msg.parts[0] ? (msg.parts[0].text as string) : ''}
                    </p>
                  </div>
                ))}
                {isChatLoading && <p className="text-gray-400 animate-pulse">편집장 K가 입력 중...</p>}
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-gray-700 p-3 rounded text-white border border-gray-600"
                  placeholder="질문을 입력하세요..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleChat()}
                />
                <button
                  onClick={handleChat}
                  disabled={isChatLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded text-white font-bold disabled:bg-gray-600"
                >
                  전송
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-700 hover:bg-gray-600 px-6 py-2 rounded text-white"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
