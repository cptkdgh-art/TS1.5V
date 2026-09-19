/**
 * ============================================================
 * @module modules/author/components
 * @file CreateFromTextModal.tsx
 * ============================================================
 * @description 텍스트에서 작가 프로필 생성 모달 (API 선택 지원)
 * ============================================================
 */

import { useState, useRef } from 'react';
import type { AiAuthor } from '@core/types';
import { Modal, Button, toast } from '@shared/components';
import { formatAiErrorForUser } from '@services/ai';
import { createAuthorProfileFromNovel } from '@services/ai/analysis';
import { useSettingsStore } from '@stores/settingsStore';

interface CreateFromTextModalProps {
  onClose: () => void;
  onCreateAuthor: (details: Omit<AiAuthor, 'id' | 'createdAt' | 'metaChatHistory'>) => AiAuthor;
}

export function CreateFromTextModal({ onClose, onCreateAuthor }: CreateFromTextModalProps) {
  const { geminiApiKey } = useSettingsStore();

  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<Partial<AiAuthor> | null>(null);
  const [authorName, setAuthorName] = useState('');
  const [isLongNovelMode, setIsLongNovelMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newlySelectedFiles = event.target.files;
    if (newlySelectedFiles && newlySelectedFiles.length > 0) {
      setFiles((currentFiles) => {
        const currentFileKeys = new Set(
          currentFiles.map((file) => `${file.name}-${file.size}-${file.lastModified}`)
        );

        const filesToAdd = Array.from(newlySelectedFiles).filter((file) => {
          const key = `${file.name}-${file.size}-${file.lastModified}`;
          return !currentFileKeys.has(key);
        });

        return [...currentFiles, ...filesToAdd];
      });
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    if (!geminiApiKey) {
      toast.warning('Gemini API 키가 설정되지 않았습니다.');
      return;
    }

    setIsLoading(true);
    setResult(null);

    let content = '';
    if (files.length > 0) {
      const fileContents = await Promise.all(files.map((file) => file.text()));
      content = fileContents.join('\n\n');
    }

    if (!content.trim()) {
      toast.warning('분석할 텍스트가 없습니다.');
      setIsLoading(false);
      return;
    }

    try {
      const profile = await createAuthorProfileFromNovel(content, isLongNovelMode);
      setResult(profile);
      setAuthorName('분석된 작가');
    } catch (error) {
      console.error('문체 분석 실패:', error);
      toast.error(formatAiErrorForUser(error, '문체 분석에 실패했습니다.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    if (!result || !authorName.trim()) return;

    onCreateAuthor({
      name: authorName,
      specialty: result.specialty || '',
      writingStyle: result.writingStyle || '',
      coreDirectives: result.coreDirectives || '',
      tags: result.tags || [],
      identityCore: result.identityCore,
    });

    onClose();
  };

  // 총 파일 크기 계산
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const totalSizeKB = (totalSize / 1024).toFixed(1);

  return (
    <Modal isOpen onClose={onClose} title="텍스트에서 작가 생성" size="lg">
      <div className="space-y-6">
        <div className="rounded-lg border border-blue-500/30 bg-blue-950/20 p-3 text-sm text-blue-100">
          Gemini 빠른 분석으로 작가 프로필을 만듭니다. 장문은 필요한 부분만 추려 보냅니다.
        </div>

        {/* 파일 업로드 */}
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            소설 파일 업로드 (.txt)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          <Button variant="gray" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
            파일 선택
          </Button>

          {files.length > 0 && (
            <div className="mt-3 space-y-2">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-gray-700 p-2 rounded"
                >
                  <span className="text-sm text-gray-300 truncate flex-1">{file.name}</span>
                  <span className="text-xs text-gray-500 mx-2">
                    {(file.size / 1024).toFixed(1)}KB
                  </span>
                  <button
                    onClick={() => handleRemoveFile(index)}
                    className="text-red-400 hover:text-red-300 text-sm"
                    disabled={isLoading}
                  >
                    제거
                  </button>
                </div>
              ))}
              <p className="text-xs text-gray-500">
                총 {files.length}개 파일, {totalSizeKB}KB
              </p>
            </div>
          )}
        </div>

        {/* 옵션 */}
        <div>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={isLongNovelMode}
              onChange={(e) => setIsLongNovelMode(e.target.checked)}
              className="form-checkbox h-4 w-4 rounded bg-gray-600 border-gray-500 text-indigo-500"
              disabled={isLoading}
            />
            <span>장편 소설 모드 (10만자 이상)</span>
          </label>
          <p className="text-xs text-gray-500 mt-1">
            장편의 경우 더 넓은 범위를 샘플링하여 분석합니다.
          </p>
        </div>

        {/* 분석 버튼 */}
        <Button
          variant="primary"
          onClick={handleAnalyze}
          disabled={isLoading || files.length === 0}
          className="w-full"
        >
          {isLoading ? '문체 분석 중...' : 'Gemini로 문체 분석하기'}
        </Button>

        {/* 분석 결과 */}
        {result && (
          <div className="bg-gray-700 rounded-lg p-4 space-y-4 border border-indigo-500/50">
            <div className="flex items-center gap-2 text-indigo-400 font-medium">
              <span>✅</span>
              <span>문체 분석 완료</span>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                작가 이름
              </label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">
                전문 분야
              </label>
              <p className="text-gray-400 text-sm bg-gray-800 p-2 rounded">
                {result.specialty}
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">
                문체 스타일
              </label>
              <p className="text-gray-400 text-sm bg-gray-800 p-2 rounded whitespace-pre-wrap max-h-32 overflow-y-auto">
                {result.writingStyle}
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">
                핵심 지침
              </label>
              <p className="text-gray-400 text-sm bg-gray-800 p-2 rounded whitespace-pre-wrap max-h-32 overflow-y-auto">
                {result.coreDirectives}
              </p>
            </div>

            {result.tags && result.tags.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1">
                  태그
                </label>
                <div className="flex flex-wrap gap-2">
                  {result.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-indigo-600/50 text-indigo-200 rounded text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          {result && (
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={!authorName.trim()}
            >
              작가 생성
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
