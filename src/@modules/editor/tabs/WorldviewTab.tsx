/**
 * ============================================================
 * @module modules/editor/tabs
 * @file WorldviewTab.tsx
 * ============================================================
 * @description 세계관 탭 - 세계관 설정 파일 관리
 * ============================================================
 */

import { useRef, useState } from 'react';
import type { Novel, Series } from '@core/types';
import { isLorekeeperEnabled } from '@services/ai/lorekeeperPolicy';
import {
  GlobeAltIcon,
  TrashIcon,
  WandSparklesIcon,
  SparklesIcon,
  DocumentTextIcon,
  XMarkIcon,
  PencilIcon,
  PlusIcon,
  useConfirmDialog,
} from '@shared/components';

interface WorldviewTabProps {
  novel: Novel;
  series: Series | null;
  onUpdateNovel: (updatedNovel: Novel) => void;
  onUpdateSeries: (updatedSeries: Series) => void;
  isAnalyzingWorldview: boolean;
  requestConfirmation: (title: string, message: React.ReactNode, confirmText: string, onConfirm: () => void) => void;
  onConfirmAnalysis: () => void;
  onGenerateAspect: () => void;
}

export function WorldviewTab({
  novel,
  series,
  onUpdateNovel,
  onUpdateSeries,
  isAnalyzingWorldview,
  requestConfirmation,
  onConfirmAnalysis,
  onGenerateAspect,
}: WorldviewTabProps) {
  const worldviewFileRef = useRef<HTMLInputElement>(null);
  const worldviewFiles = series ? series.worldviewFiles : novel.worldviewFiles;

  const [openedFileIndex, setOpenedFileIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'view' | 'edit' | 'create'>('view');
  const [editingContent, setEditingContent] = useState('');
  const [editingFilename, setEditingFilename] = useState('');
  const confirm = useConfirmDialog();
  const lorekeeperEnabled = isLorekeeperEnabled(novel.useLorekeeper);

  const handleWorldviewUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const filePromises = Array.from(files).map((file: File) => {
        return new Promise<{ filename: string; content: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const content = e.target?.result as string;
            resolve({ filename: file.name, content });
          };
          reader.onerror = reject;
          reader.readAsText(file);
        });
      });

      Promise.all(filePromises).then(newFiles => {
        if (series) {
          onUpdateSeries({ ...series, worldviewFiles: [...(series.worldviewFiles || []), ...newFiles] });
        } else {
          onUpdateNovel({ ...novel, worldviewFiles: [...(novel.worldviewFiles || []), ...newFiles] });
        }
      });
    }
    if (event.target) event.target.value = '';
  };

  const handleViewFile = (index: number) => {
    setOpenedFileIndex(index);
    setViewMode('view');
  };

  const handleEditFile = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const file = worldviewFiles?.[index];
    if (file) {
      setOpenedFileIndex(index);
      setViewMode('edit');
      setEditingFilename(file.filename);
      setEditingContent(file.content);
    }
  };

  const handleCreateNew = () => {
    setOpenedFileIndex(null);
    setViewMode('create');
    setEditingFilename('새 세계관 설정.txt');
    setEditingContent('');
  };

  const handleSaveNewFile = () => {
    if (!editingFilename.trim() || !editingContent.trim()) return;

    const newFile = {
      filename: editingFilename.endsWith('.txt') ? editingFilename : `${editingFilename}.txt`,
      content: editingContent.trim()
    };

    if (series) {
      onUpdateSeries({ ...series, worldviewFiles: [...(series.worldviewFiles || []), newFile] });
    } else {
      onUpdateNovel({ ...novel, worldviewFiles: [...(novel.worldviewFiles || []), newFile] });
    }
    setViewMode('view');
  };

  const handleSaveOpenedFile = () => {
    if (openedFileIndex === null) return;

    const updatedFiles = [...(worldviewFiles || [])];
    updatedFiles[openedFileIndex] = {
      filename: editingFilename,
      content: editingContent
    };

    if (series) {
      onUpdateSeries({ ...series, worldviewFiles: updatedFiles });
    } else {
      onUpdateNovel({ ...novel, worldviewFiles: updatedFiles });
    }
    setOpenedFileIndex(null);
  };

  const handleDeleteFile = async (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const file = worldviewFiles?.[index];
    const confirmed = await confirm({
      title: '세계관 파일 삭제',
      message: (
        <p>
          <span className="font-semibold text-white">{file?.filename || '선택한 파일'}</span>을 삭제합니다.
          이 작업은 복구할 수 없습니다.
        </p>
      ),
      confirmText: '삭제',
      variant: 'danger',
    });
    if (!confirmed) return;

    if (series) {
      const updatedFiles = (series.worldviewFiles || []).filter((_, i) => i !== index);
      onUpdateSeries({ ...series, worldviewFiles: updatedFiles });
    } else {
      const updatedFiles = (novel.worldviewFiles || []).filter((_, i) => i !== index);
      onUpdateNovel({ ...novel, worldviewFiles: updatedFiles });
    }
    if (openedFileIndex === index) setOpenedFileIndex(null);
  };

  const handleAnalyzeWorldviewClick = () => {
    requestConfirmation(
      '세계관 분석 확인',
      <p>소설 본문 전체를 AI에게 보내 그 안에 담긴 세계관 정보를 체계적으로 추출하고 정리합니다. 계속하시겠습니까?</p>,
      '분석 시작',
      onConfirmAnalysis
    );
  };

  const handleLorekeeperToggle = (enabled: boolean) => {
    onUpdateNovel({ ...novel, useLorekeeper: enabled });
  };

  return (
    <div className="font-sans space-y-8 max-w-4xl mx-auto pb-10">
      {/* Header Section */}
      <div>
        <h2 className="text-2xl font-bold mb-2">세계관 라이브러리</h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          이곳에 업로드된 모든 파일의 내용은 AI가 소설을 쓸 때 핵심 참고 자료로 사용됩니다. (예: 마법 체계, 연표, 용어 사전 등)
        </p>
      </div>

      {/* File Management Card */}
      <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md border border-gray-700">
        <div className="flex items-center gap-2 mb-4 text-indigo-400 font-bold text-lg border-b border-gray-700 pb-2">
          <GlobeAltIcon className="w-5 h-5" />
          설정 파일 목록
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <button
            onClick={handleCreateNew}
            className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-3 rounded-lg transition-colors text-sm shadow-lg shadow-green-900/20"
          >
            <PlusIcon className="w-4 h-4" />
            직접 추가
          </button>
          <button
            onClick={onGenerateAspect}
            className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-3 rounded-lg transition-colors text-sm shadow-lg shadow-purple-900/20"
          >
            <SparklesIcon className="w-4 h-4" />
            AI 생성
          </button>
          <button
            onClick={handleAnalyzeWorldviewClick}
            disabled={isAnalyzingWorldview}
            className="flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-3 rounded-lg transition-colors text-sm disabled:bg-gray-700 shadow-lg shadow-teal-900/20"
          >
            <WandSparklesIcon className="w-4 h-4" />
            {isAnalyzingWorldview ? '분석 중...' : '본문 분석'}
          </button>
          <div className="relative">
            <input
              type="file"
              ref={worldviewFileRef}
              onChange={handleWorldviewUpload}
              className="hidden"
              multiple
              accept=".txt"
            />
            <button
              onClick={() => worldviewFileRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-3 rounded-lg transition-colors text-sm shadow-lg shadow-indigo-900/20"
            >
              <DocumentTextIcon className="w-4 h-4" />
              파일 업로드
            </button>
          </div>
        </div>

        {/* File List */}
        <div className="space-y-2 bg-gray-900/50 p-3 rounded-lg max-h-[400px] overflow-y-auto">
          {worldviewFiles?.map((file, index) => (
            <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-700 p-3 rounded-md group hover:bg-gray-600 transition-colors border border-gray-600/50 hover:border-gray-500 gap-3">
              <div className="flex items-center gap-3 overflow-hidden flex-1">
                <DocumentTextIcon className="w-5 h-5 text-gray-400 shrink-0" />
                <span className="text-gray-200 truncate font-medium text-sm">{file.filename}</span>
              </div>
              <div className="flex items-center justify-end gap-2 shrink-0">
                <button
                  onClick={() => handleViewFile(index)}
                  className="text-xs text-indigo-300 hover:text-indigo-200 font-semibold px-2 py-1 rounded hover:bg-indigo-900/50 transition-colors flex items-center gap-1"
                >
                  보기
                </button>
                <button
                  onClick={(e) => handleEditFile(e, index)}
                  className="p-1.5 text-gray-400 hover:text-white transition-colors rounded hover:bg-gray-500"
                  title="수정"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDeleteFile(e, index)}
                  className="p-1.5 text-gray-400 hover:text-red-400 transition-colors rounded hover:bg-gray-500"
                  title="삭제"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {(!worldviewFiles || worldviewFiles.length === 0) && (
            <div className="text-center text-gray-500 py-8 flex flex-col items-center">
              <GlobeAltIcon className="w-10 h-10 mb-2 opacity-20" />
              <p className="text-sm">등록된 세계관 파일이 없습니다.</p>
            </div>
          )}
        </div>
      </div>

      {/* Expert AI Collaboration Section */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-indigo-400 flex items-center gap-2">
          <SparklesIcon className="w-5 h-5" />
          전문가 AI 협업
        </h3>
        <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md border border-gray-700 flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-bold text-white text-base">세계관 전문가(기록보관자) AI 활성화</h4>
              <span className="bg-teal-900 text-teal-300 text-[10px] px-1.5 py-0.5 rounded font-bold">추천</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              이 기능을 켜면 AI 작가가 세계관에 대해 '기록보관자'에게 질문하며 작업하여 토큰 사용량을 최적화하고 일관성을 높입니다. (장편 소설 필수 기능)
            </p>
          </div>
          <label className="flex items-center cursor-pointer relative shrink-0 mt-1">
            <input
              type="checkbox"
              className="sr-only"
              aria-label="세계관 기록보관자 활성화"
              checked={lorekeeperEnabled}
              onChange={(e) => handleLorekeeperToggle(e.target.checked)}
            />
            <div className={`block w-12 h-7 rounded-full transition-colors ${lorekeeperEnabled ? 'bg-indigo-600' : 'bg-gray-600'}`}></div>
            <div className={`absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform ${lorekeeperEnabled ? 'transform translate-x-5' : ''}`}></div>
          </label>
        </div>
      </div>

      {/* Integrated Viewer/Editor Modal */}
      {(openedFileIndex !== null || viewMode === 'create') && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-5 border-b border-gray-700">
              <h3 className="text-xl font-bold text-white truncate pr-4">
                {viewMode === 'view' ? (
                  worldviewFiles?.[openedFileIndex!]?.filename || '파일 보기'
                ) : viewMode === 'create' ? (
                  '새 세계관 항목 추가'
                ) : (
                  '세계관 파일 수정'
                )}
              </h3>
              <button onClick={() => { setOpenedFileIndex(null); setViewMode('view'); }} className="text-gray-400 hover:text-white shrink-0">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto bg-gray-900">
              {viewMode === 'view' ? (
                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                  <p className="whitespace-pre-wrap text-gray-300 leading-relaxed text-sm">
                    {worldviewFiles?.[openedFileIndex!]?.content}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">
                      {viewMode === 'create' ? '항목명' : '파일명'}
                    </label>
                    <input
                      type="text"
                      value={editingFilename}
                      onChange={(e) => setEditingFilename(e.target.value)}
                      placeholder={viewMode === 'create' ? '예: 마법 체계, 국가 설정, 연표 등' : ''}
                      className="w-full bg-gray-800 border border-gray-600 rounded-md p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm placeholder:text-gray-500"
                    />
                  </div>
                  <div className="flex-1 flex flex-col">
                    <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">내용</label>
                    <textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      placeholder={viewMode === 'create' ? '세계관 설정 내용을 자유롭게 작성하세요...' : ''}
                      className="w-full bg-gray-800 border border-gray-600 rounded-md p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none h-80 leading-relaxed text-sm placeholder:text-gray-500"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-gray-700 flex justify-end gap-3 bg-gray-800 rounded-b-lg">
              {viewMode === 'view' ? (
                <button onClick={() => setOpenedFileIndex(null)} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-5 rounded-lg transition-colors text-sm">
                  닫기
                </button>
              ) : viewMode === 'create' ? (
                <>
                  <button onClick={() => { setViewMode('view'); }} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-5 rounded-lg transition-colors text-sm">
                    취소
                  </button>
                  <button
                    onClick={handleSaveNewFile}
                    disabled={!editingFilename.trim() || !editingContent.trim()}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-5 rounded-lg transition-colors text-sm"
                  >
                    추가
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setOpenedFileIndex(null)} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-5 rounded-lg transition-colors text-sm">
                    취소
                  </button>
                  <button onClick={handleSaveOpenedFile} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-lg transition-colors text-sm">
                    저장
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
