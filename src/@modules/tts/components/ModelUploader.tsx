/**
 * ============================================================
 * @module modules/tts/components/ModelUploader
 * @file ModelUploader.tsx
 * ============================================================
 * @description ONNX 모델 업로드 컴포넌트
 * - 드래그앤드롭 / 클릭 업로드
 * - 업로드된 모델 목록 표시
 * - 모델 삭제
 * ============================================================
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  saveModel,
  getAllModelMetadata,
  deleteModel,
  getTotalStorageSize,
  hasModel,
  type ModelMetadata,
} from '@services/tts/modelStore';
import { ArrowUpTrayIcon, ArrowDownTrayIcon, TrashIcon, CheckCircleIcon } from '@shared/components';

// 기본 제공 모델 정보
const DEFAULT_MODELS = [
  {
    id: 'piper-ko-kss',
    name: '한국어 기본 (KSS)',
    language: 'ko',
    description: 'Piper TTS 한국어 음성',
    url: 'https://huggingface.co/neurlang/piper-onnx-kss-korean/resolve/main/piper-kss-korean.onnx',
    size: '~64MB',
  },
];

interface ModelUploaderProps {
  onModelSelect?: (modelId: string) => void;
  selectedModelId?: string | null;
  className?: string;
}

export const ModelUploader: React.FC<ModelUploaderProps> = ({
  onModelSelect,
  selectedModelId,
  className = '',
}) => {
  const [models, setModels] = useState<ModelMetadata[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [installedDefaults, setInstalledDefaults] = useState<Set<string>>(new Set());
  const [totalSize, setTotalSize] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 모델 목록 로드
  const loadModels = useCallback(async () => {
    try {
      const metadata = await getAllModelMetadata();
      setModels(metadata);
      const size = await getTotalStorageSize();
      setTotalSize(size);

      // 기본 모델 설치 여부 확인
      const installed = new Set<string>();
      for (const defaultModel of DEFAULT_MODELS) {
        if (await hasModel(defaultModel.id)) {
          installed.add(defaultModel.id);
        }
      }
      setInstalledDefaults(installed);
    } catch (err) {
      console.error('모델 목록 로드 실패:', err);
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // 기본 모델 다운로드
  const handleDownloadDefaultModel = async (modelInfo: typeof DEFAULT_MODELS[0]) => {
    setIsDownloading(modelInfo.id);
    setDownloadProgress(0);
    setError(null);

    try {
      // Fetch with progress tracking
      const response = await fetch(modelInfo.url);
      if (!response.ok) {
        throw new Error(`다운로드 실패: ${response.status}`);
      }

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('스트림 읽기 실패');
      }

      const chunks: Uint8Array[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        received += value.length;

        if (total > 0) {
          setDownloadProgress(Math.round((received / total) * 100));
        }
      }

      // Combine chunks into ArrayBuffer
      const arrayBuffer = new Uint8Array(received);
      let position = 0;
      for (const chunk of chunks) {
        arrayBuffer.set(chunk, position);
        position += chunk.length;
      }

      // Save to IndexedDB
      await saveModel(modelInfo.id, arrayBuffer.buffer, {
        name: modelInfo.name,
        language: modelInfo.language,
        description: modelInfo.description,
        type: 'piper',
      });

      await loadModels();
      onModelSelect?.(modelInfo.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '다운로드 실패');
    } finally {
      setIsDownloading(null);
      setDownloadProgress(0);
    }
  };

  // 파일 업로드 처리
  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith('.onnx')) {
      setError('ONNX 파일만 업로드 가능합니다 (.onnx)');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const modelId = `model_${Date.now()}`;
      const modelName = file.name.replace('.onnx', '');

      await saveModel(modelId, arrayBuffer, {
        name: modelName,
        language: 'ko', // 기본값, 나중에 사용자가 선택하도록
        description: `업로드: ${new Date().toLocaleDateString()}`,
        type: 'custom',
      });

      await loadModels();
      onModelSelect?.(modelId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드 실패');
    } finally {
      setIsUploading(false);
    }
  };

  // 드래그 이벤트
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await handleFileUpload(files[0]);
    }
  };

  // 파일 선택
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFileUpload(files[0]);
    }
  };

  // 모델 삭제
  const handleDeleteModel = async (modelId: string) => {
    try {
      await deleteModel(modelId);
      await loadModels();
      if (selectedModelId === modelId) {
        onModelSelect?.(models[0]?.id || '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 실패');
    }
  };

  // 용량 포맷
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
      <h3 className="text-white font-medium mb-4">음성 모델</h3>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-500/20 text-red-400 p-2 rounded mb-3 text-sm">{error}</div>
      )}

      {/* 업로드 영역 */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
          transition-colors duration-200
          ${isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-600 hover:border-gray-500'}
          ${isUploading ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".onnx"
          onChange={handleFileSelect}
          className="hidden"
        />

        <ArrowUpTrayIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />

        {isUploading ? (
          <p className="text-gray-400 text-sm">업로드 중...</p>
        ) : (
          <>
            <p className="text-gray-300 text-sm">ONNX 모델 파일을 드래그하거나 클릭</p>
            <p className="text-gray-500 text-xs mt-1">Piper TTS, VITS 등 지원</p>
          </>
        )}
      </div>

      {/* 모델 목록 */}
      {models.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>저장된 모델 ({models.length}개)</span>
            <span>총 {formatSize(totalSize)}</span>
          </div>

          {models.map((model) => (
            <div
              key={model.id}
              onClick={() => onModelSelect?.(model.id)}
              className={`
                flex items-center justify-between p-3 rounded-lg cursor-pointer
                transition-colors duration-200
                ${
                  selectedModelId === model.id
                    ? 'bg-indigo-500/20 border border-indigo-500'
                    : 'bg-gray-700 hover:bg-gray-600'
                }
              `}
            >
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{model.name}</p>
                <p className="text-gray-400 text-xs">
                  {model.language.toUpperCase()} · {formatSize(model.size)}
                </p>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteModel(model.id);
                }}
                className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                title="삭제"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 빈 상태 안내 */}
      {models.length === 0 && (
        <div className="mt-4 text-center text-gray-500 text-sm py-2">
          <p>아래에서 기본 모델을 설치하거나</p>
          <p className="text-xs">위에 직접 업로드하세요</p>
        </div>
      )}

      {/* 기본 모델 다운로드 */}
      <div className="mt-4">
        <h4 className="text-gray-400 text-sm font-medium mb-2">기본 제공 모델</h4>
        <div className="space-y-2">
          {DEFAULT_MODELS.map((modelInfo) => {
            const isInstalled = installedDefaults.has(modelInfo.id);
            const isCurrentlyDownloading = isDownloading === modelInfo.id;

            return (
              <div
                key={modelInfo.id}
                className={`
                  flex items-center justify-between p-3 rounded-lg
                  ${isInstalled ? 'bg-green-500/10 border border-green-500/30' : 'bg-gray-700'}
                `}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium flex items-center gap-2">
                    {modelInfo.name}
                    {isInstalled && (
                      <CheckCircleIcon className="w-4 h-4 text-green-400" />
                    )}
                  </p>
                  <p className="text-gray-400 text-xs">
                    {modelInfo.language.toUpperCase()} · {modelInfo.size}
                  </p>
                </div>

                {isInstalled ? (
                  <span className="text-green-400 text-xs">설치됨</span>
                ) : isCurrentlyDownloading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 transition-all duration-300"
                        style={{ width: `${downloadProgress}%` }}
                      />
                    </div>
                    <span className="text-indigo-400 text-xs w-8">{downloadProgress}%</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleDownloadDefaultModel(modelInfo)}
                    disabled={isDownloading !== null}
                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600
                             disabled:bg-gray-600 disabled:cursor-not-allowed
                             text-white text-xs rounded-lg transition-colors"
                  >
                    <ArrowDownTrayIcon className="w-4 h-4" />
                    설치
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 커스텀 모델 안내 */}
      <div className="mt-4 p-3 bg-gray-700/50 rounded-lg">
        <p className="text-xs text-gray-400">
          💡 나만의 음성 모델을 사용하려면 <strong>ONNX 파일</strong>을 업로드하세요.
          <br />
          <a
            href="https://github.com/rhasspy/piper/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:underline"
          >
            더 많은 Piper 모델 보기 →
          </a>
        </p>
      </div>
    </div>
  );
};

export default ModelUploader;
