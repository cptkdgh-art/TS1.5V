/**
 * ============================================================
 * @module modules/author
 * @file AuthorManager.tsx
 * ============================================================
 * @description AI 작가 관리 페이지 컴포넌트
 * ============================================================
 */

import { useState, useCallback, useRef, lazy, Suspense, useMemo } from 'react';
import type { AiAuthor } from '@core/types';
import {
  ArrowLeftIcon,
  PlusIcon,
  DiceIcon,
  DocumentTextIcon,
  WandSparklesIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ChatBubbleThoughtIcon,
  BrainIcon,
  ClipboardDocumentListIcon,
  UserPlusIcon,
} from '@shared/components';
import { Button, Modal, toast } from '@shared/components';
import { AuthorCard, TagFilter, DeleteAuthorModal, WorkspaceAuthorImportModal } from './components';
import { useTagClassification, useAuthorFilter } from './hooks';
import { ensureAuthorIdentity, forkAuthorIdentityCore, isAuthorIdentityCore, updateAuthorWithProfileHistory } from '@services/ai';

function isImportableAuthor(value: unknown): value is AiAuthor {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const author = value as Partial<AiAuthor>;
  return typeof author.id === 'string'
    && typeof author.name === 'string'
    && typeof author.specialty === 'string'
    && typeof author.writingStyle === 'string'
    && typeof author.coreDirectives === 'string'
    && (author.identityCore === undefined || isAuthorIdentityCore(author.identityCore));
}

// 무거운 모달 컴포넌트들은 lazy loading (번들 최적화)
const EditAuthorModal = lazy(() => import('./components/EditAuthorModal').then(m => ({ default: m.EditAuthorModal })));
const ClioDirectorModal = lazy(() => import('./components/ClioDirectorModal').then(m => ({ default: m.ClioDirectorModal })));
const ClioMemoryModal = lazy(() => import('./components/ClioMemoryModal').then(m => ({ default: m.ClioMemoryModal })));
const IntegratedMemoryModal = lazy(() => import('./components/IntegratedMemoryModal').then(m => ({ default: m.IntegratedMemoryModal })));
const RandomGenModal = lazy(() => import('./components/RandomGenModal').then(m => ({ default: m.RandomGenModal })));
const CreateFromTextModal = lazy(() => import('./components/CreateFromTextModal').then(m => ({ default: m.CreateFromTextModal })));
const FusionModal = lazy(() => import('./components/FusionModal').then(m => ({ default: m.FusionModal })));
const AuthorMemoryModal = lazy(() => import('./components/AuthorMemoryModal').then(m => ({ default: m.AuthorMemoryModal })));
const AuthorChatModal = lazy(() => import('./components/AuthorChatModal').then(m => ({ default: m.AuthorChatModal })));

function ModalChunkFallback() {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm text-center">
        <div className="mx-auto mb-3 h-8 w-8 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
        <p className="text-sm text-gray-300">창을 여는 중...</p>
      </div>
    </div>
  );
}

export interface AuthorManagerProps {
  authors: AiAuthor[];
  onBack: () => void;
  onUpdateAuthors: (authors: AiAuthor[]) => void;
  onCreateAuthor: (details: Omit<AiAuthor, 'id' | 'createdAt' | 'metaChatHistory'>) => AiAuthor;
}

export function AuthorManager({
  authors,
  onBack,
  onUpdateAuthors,
  onCreateAuthor,
}: AuthorManagerProps) {
  // 모달 상태
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editingAuthor, setEditingAuthor] = useState<AiAuthor | null>(null);
  const [authorToDelete, setAuthorToDelete] = useState<AiAuthor | null>(null);
  const [pendingImport, setPendingImport] = useState<AiAuthor[] | null>(null);
  const [isWorkspaceImportOpen, setWorkspaceImportOpen] = useState(false);

  // 클리오 관련 모달
  const [isDirectorModalOpen, setDirectorModalOpen] = useState(false);
  const [isClioMemoryModalOpen, setClioMemoryModalOpen] = useState(false);
  const [isIntegratedMemoryModalOpen, setIntegratedMemoryModalOpen] = useState(false);

  // 생성 관련 모달
  const [isRandomGenModalOpen, setRandomGenModalOpen] = useState(false);
  const [isCreateFromTextModalOpen, setCreateFromTextModalOpen] = useState(false);
  const [isFusionModalOpen, setFusionModalOpen] = useState(false);

  // 작가별 모달
  const [memoryAuthor, setMemoryAuthor] = useState<AiAuthor | null>(null);
  const [chattingAuthor, setChattingAuthor] = useState<{ author: AiAuthor; type: 'general' | 'meta' } | null>(null);

  // 융합 선택
  const [authorsToFuse, setAuthorsToFuse] = useState<string[]>([]);

  // 파일 입력 ref
  const importFileRef = useRef<HTMLInputElement>(null);

  // 훅 사용
  const { categorizedTags, reclassifyTag } = useTagClassification(authors);
  const { selectedTags, filteredAuthors, toggleTag, clearFilters } = useAuthorFilter(authors);

  /** 작가 저장 (생성/수정) */
  const handleSaveAuthor = useCallback(
    (details: Omit<AiAuthor, 'id' | 'createdAt' | 'metaChatHistory'>) => {
      if (editingAuthor) {
        const updated = authors.map((a) =>
          a.id === editingAuthor.id
            ? updateAuthorWithProfileHistory(a, details)
            : a
        );
        onUpdateAuthors(updated);
      } else {
        onCreateAuthor(details);
      }
      setEditModalOpen(false);
      setEditingAuthor(null);
    },
    [authors, editingAuthor, onCreateAuthor, onUpdateAuthors]
  );

  /** 작가 삭제 확정 */
  const confirmDelete = useCallback(() => {
    if (authorToDelete) {
      onUpdateAuthors(authors.filter((a) => a.id !== authorToDelete.id));
      setAuthorToDelete(null);
    }
  }, [authorToDelete, authors, onUpdateAuthors]);

  /** 작가 복제 */
  const handleDuplicate = useCallback(
    (author: AiAuthor) => {
      const { id: _id, createdAt: _createdAt, name, isDefault: _isDefault, role: _role, profileVersions: _profileVersions, ...rest } = author;
      onCreateAuthor({
        ...rest,
        name: `${name} (복제)`,
        identityCore: author.identityCore ? forkAuthorIdentityCore(author.identityCore) : undefined,
      });
    },
    [onCreateAuthor]
  );

  /** 융합 선택 토글 */
  const handleFuseToggle = useCallback((authorId: string) => {
    setAuthorsToFuse((prev) =>
      prev.includes(authorId)
        ? prev.filter((id) => id !== authorId)
        : [...prev, authorId]
    );
  }, []);

  /** 융합 대상 작가 목록 (메모이제이션) */
  const selectedAuthorsForFusion = useMemo(() => {
    if (authorsToFuse.length < 2) return [];
    const fuseSet = new Set(authorsToFuse);
    return authors.filter((a) => fuseSet.has(a.id));
  }, [authors, authorsToFuse]);

  /** 작가 내보내기 */
  const handleExport = useCallback(() => {
    const dataStr = JSON.stringify(authors, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
    const filename = `ai_authors_backup_${new Date().toISOString().split('T')[0]}.json`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.dispatchEvent(new MouseEvent('click', { bubbles: false, cancelable: true, view: window }));
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 40000);
  }, [authors]);

  /** 작가 가져오기 클릭 */
  const handleImportClick = () => {
    if (importFileRef.current) {
      importFileRef.current.value = '';
      importFileRef.current.click();
    }
  };

  /** 파일 선택 처리 */
  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const result = e.target?.result;
          if (typeof result === 'string') {
            const imported = JSON.parse(result);
            if (Array.isArray(imported) && imported.every(isImportableAuthor)) {
              setPendingImport(imported.map(ensureAuthorIdentity));
            } else {
              toast.error('유효하지 않은 작가 파일 형식입니다.');
            }
          }
        } catch (error) {
          console.error('작가 파일 불러오기 실패:', error);
          toast.error('파일을 분석하는 데 실패했습니다.');
        }
      };
      reader.onerror = () => {
        toast.error('파일을 읽는 중 오류가 발생했습니다.');
      };
      reader.readAsText(file);
    }
  };

  /** 가져오기 확정 */
  const confirmImport = useCallback(() => {
    if (!pendingImport) return;

    const existingIds = new Set(authors.map((a) => a.id));
    const newList = [...authors];
    let importedCount = 0;
    let conflictCount = 0;

    pendingImport.forEach((imported) => {
      if (existingIds.has(imported.id)) {
        conflictCount++;
        const newAuthor = {
          ...imported,
          id: `author-${Date.now()}-${importedCount}`,
          name: `${imported.name} (가져옴)`,
          identityCore: imported.identityCore ? forkAuthorIdentityCore(imported.identityCore) : undefined,
        };
        newList.push(newAuthor);
      } else {
        newList.push(imported);
        existingIds.add(imported.id);
      }
      importedCount++;
    });

    onUpdateAuthors(newList);
    setPendingImport(null);
    toast.success(
      `${importedCount}명의 작가를 성공적으로 가져왔습니다.${
        conflictCount > 0 ? ` (${conflictCount}명은 새로운 ID가 부여됨)` : ''
      }`
    );
  }, [authors, onUpdateAuthors, pendingImport]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col p-4 sm:p-6 lg:p-8">
      <input
        type="file"
        ref={importFileRef}
        onChange={handleFileSelected}
        className="hidden"
        accept=".json"
      />

      {/* 헤더 */}
      <header className="flex items-center mb-10">
        <button
          onClick={onBack}
          className="flex items-center text-indigo-400 hover:text-indigo-300 transition-colors text-lg"
        >
          <ArrowLeftIcon className="w-5 h-5 mr-2" />
          <span>소설 목록으로</span>
        </button>
      </header>

      <div className="max-w-7xl mx-auto w-full">
        {/* 제목 및 액션 버튼 */}
        <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
          <div className="flex-shrink-0">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white whitespace-nowrap">
              AI 작가 관리
            </h1>
            <p className="text-gray-400 mt-1">
              총 {authors.length}명의 작가가 있습니다.
            </p>
          </div>

            {/* 데스크톱: 전체 버튼 */}
          <div className="hidden md:flex gap-2 flex-wrap justify-end">
            <Button variant="purple" onClick={() => setDirectorModalOpen(true)}>
              <ChatBubbleThoughtIcon className="w-5 h-5 mr-2" />
              총괄 감독 클리오
            </Button>
            <Button variant="purple" onClick={() => setClioMemoryModalOpen(true)}>
              <BrainIcon className="w-5 h-5 mr-2" />
              총괄감독 기억
            </Button>
            <Button variant="gray" onClick={() => setIntegratedMemoryModalOpen(true)}>
              <ClipboardDocumentListIcon className="w-5 h-5 mr-2" />
              통합 기억 관리
            </Button>
            <Button variant="gray" onClick={handleExport}>
              <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
              내보내기
            </Button>
            <Button variant="gray" onClick={handleImportClick}>
              <ArrowUpTrayIcon className="w-5 h-5 mr-2" />
              JSON 불러오기
            </Button>
            <Button variant="gray" onClick={() => setWorkspaceImportOpen(true)}>
              <UserPlusIcon className="w-5 h-5 mr-2" />
              작가 불러오기
            </Button>
            <Button variant="gray" onClick={() => setRandomGenModalOpen(true)}>
              <DiceIcon className="w-5 h-5 mr-2" />
              AI 추천
            </Button>
            <Button variant="gray" onClick={() => setCreateFromTextModalOpen(true)}>
              <DocumentTextIcon className="w-5 h-5 mr-2" />
              텍스트로 생성
            </Button>
            <Button
              variant="teal"
              disabled={authorsToFuse.length < 2}
              onClick={() => setFusionModalOpen(true)}
            >
              <WandSparklesIcon className="w-5 h-5 mr-2" />
              융합 ({authorsToFuse.length})
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setEditingAuthor(null);
                setEditModalOpen(true);
              }}
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              새 작가 추가
            </Button>
          </div>

          {/* 모바일: 컴팩트 버튼 (라벨 유지, 크기 축소) */}
          <div className="grid grid-cols-3 md:hidden gap-1.5 w-full">
            <Button size="sm" variant="purple" onClick={() => setDirectorModalOpen(true)}>
              <ChatBubbleThoughtIcon className="w-3.5 h-3.5 mr-1" />
              클리오
            </Button>
            <Button size="sm" variant="purple" onClick={() => setClioMemoryModalOpen(true)}>
              <BrainIcon className="w-3.5 h-3.5 mr-1" />
              기억
            </Button>
            <Button size="sm" variant="gray" onClick={() => setIntegratedMemoryModalOpen(true)}>
              <ClipboardDocumentListIcon className="w-3.5 h-3.5 mr-1" />
              통합 기억
            </Button>
            <Button size="sm" variant="gray" onClick={handleExport}>
              <ArrowDownTrayIcon className="w-3.5 h-3.5 mr-1" />
              내보내기
            </Button>
            <Button size="sm" variant="gray" onClick={handleImportClick}>
              <ArrowUpTrayIcon className="w-3.5 h-3.5 mr-1" />
              JSON
            </Button>
            <Button size="sm" variant="gray" onClick={() => setWorkspaceImportOpen(true)}>
              <UserPlusIcon className="w-3.5 h-3.5 mr-1" />
              작가 불러오기
            </Button>
            <Button size="sm" variant="gray" onClick={() => setRandomGenModalOpen(true)}>
              <DiceIcon className="w-3.5 h-3.5 mr-1" />
              AI 추천
            </Button>
            <Button size="sm" variant="gray" onClick={() => setCreateFromTextModalOpen(true)}>
              <DocumentTextIcon className="w-3.5 h-3.5 mr-1" />
              텍스트 생성
            </Button>
            <Button size="sm" variant="teal" disabled={authorsToFuse.length < 2} onClick={() => setFusionModalOpen(true)}>
              <WandSparklesIcon className="w-3.5 h-3.5 mr-1" />
              융합 ({authorsToFuse.length})
            </Button>
            <Button size="sm" variant="primary" onClick={() => { setEditingAuthor(null); setEditModalOpen(true); }}>
              <PlusIcon className="w-3.5 h-3.5 mr-1" />
              새 작가
            </Button>
          </div>
        </div>

        {/* 태그 필터 */}
        <TagFilter
          categorizedTags={categorizedTags}
          selectedTags={selectedTags}
          onTagClick={toggleTag}
          onClearFilters={clearFilters}
          onReclassifyTag={reclassifyTag}
        />

        {/* 작가 목록 */}
        <div className="space-y-4">
          {filteredAuthors.map((author) => (
            <AuthorCard
              key={author.id}
              author={author}
              isSelected={authorsToFuse.includes(author.id)}
              onToggleSelect={() => handleFuseToggle(author.id)}
              onEdit={() => {
                setEditingAuthor(author);
                setEditModalOpen(true);
              }}
              onDelete={() => setAuthorToDelete(author)}
              onDuplicate={() => handleDuplicate(author)}
              onOpenMemory={() => setMemoryAuthor(author)}
              onOpenGeneralChat={() => setChattingAuthor({ author, type: 'general' })}
              onOpenMetaChat={() => setChattingAuthor({ author, type: 'meta' })}
            />
          ))}
        </div>
      </div>

      {/* 모달들 - Suspense로 lazy loading */}
      <Suspense fallback={<ModalChunkFallback />}>
        {isEditModalOpen && (
          <EditAuthorModal
            author={editingAuthor}
            onClose={() => setEditModalOpen(false)}
            onSave={handleSaveAuthor}
          />
        )}
      </Suspense>

      {authorToDelete && (
        <DeleteAuthorModal
          authorName={authorToDelete.name}
          onClose={() => setAuthorToDelete(null)}
          onConfirm={confirmDelete}
        />
      )}

      {pendingImport && (
        <Modal
          isOpen={true}
          onClose={() => setPendingImport(null)}
          title="작가 목록 가져오기"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-gray-300">
              파일에서 {pendingImport.length}명의 작가를 현재 목록에 추가합니다.
              ID가 중복되는 작가는 새로운 ID로 가져옵니다. 계속하시겠습니까?
            </p>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setPendingImport(null)}>
                취소
              </Button>
              <Button variant="primary" onClick={confirmImport}>
                확인
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {isWorkspaceImportOpen && (
        <WorkspaceAuthorImportModal onClose={() => setWorkspaceImportOpen(false)} />
      )}

      {/* 클리오 관련 모달 */}
      <Suspense fallback={<ModalChunkFallback />}>
        {isDirectorModalOpen && (
          <ClioDirectorModal
            onClose={() => setDirectorModalOpen(false)}
          />
        )}
      </Suspense>

      <Suspense fallback={<ModalChunkFallback />}>
        {isClioMemoryModalOpen && (
          <ClioMemoryModal
            onClose={() => setClioMemoryModalOpen(false)}
          />
        )}
      </Suspense>

      <Suspense fallback={<ModalChunkFallback />}>
        {isIntegratedMemoryModalOpen && (
          <IntegratedMemoryModal
            authors={authors}
            onClose={() => setIntegratedMemoryModalOpen(false)}
            onUpdateAuthors={onUpdateAuthors}
          />
        )}
      </Suspense>

      {/* 생성 관련 모달 */}
      <Suspense fallback={<ModalChunkFallback />}>
        {isRandomGenModalOpen && (
          <RandomGenModal
            onClose={() => setRandomGenModalOpen(false)}
            onCreateAuthor={onCreateAuthor}
          />
        )}
      </Suspense>

      <Suspense fallback={<ModalChunkFallback />}>
        {isCreateFromTextModalOpen && (
          <CreateFromTextModal
            onClose={() => setCreateFromTextModalOpen(false)}
            onCreateAuthor={onCreateAuthor}
          />
        )}
      </Suspense>

      <Suspense fallback={<ModalChunkFallback />}>
        {isFusionModalOpen && selectedAuthorsForFusion.length >= 2 && (
          <FusionModal
            selectedAuthors={selectedAuthorsForFusion}
            onClose={() => {
              setFusionModalOpen(false);
              setAuthorsToFuse([]);
            }}
            onCreateAuthor={onCreateAuthor}
          />
        )}
      </Suspense>

      {/* 작가별 모달 */}
      <Suspense fallback={<ModalChunkFallback />}>
        {memoryAuthor && (
          <AuthorMemoryModal
            author={memoryAuthor}
            onClose={() => setMemoryAuthor(null)}
            onUpdateAuthors={onUpdateAuthors}
            authors={authors}
          />
        )}
      </Suspense>

      <Suspense fallback={<ModalChunkFallback />}>
        {chattingAuthor && (
          <AuthorChatModal
            author={chattingAuthor.author}
            chatType={chattingAuthor.type}
            onClose={() => setChattingAuthor(null)}
            onUpdateAuthors={onUpdateAuthors}
            authors={authors}
          />
        )}
      </Suspense>
    </div>
  );
}
