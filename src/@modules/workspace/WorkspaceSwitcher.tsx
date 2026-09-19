import { useEffect, useRef, useState } from 'react';
import { useWorkspaceStore } from '@stores/workspaceStore';
import { getWorkspaceUrl } from '@services/workspace';
import { DEFAULT_WORKSPACE_ID } from '@services/storage';
import {
  ArchiveBoxIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  Input,
  Modal,
  PencilIcon,
  PlusIcon,
  CubeIcon,
  TrashIcon,
  toast,
} from '@shared/components';

type WorkspaceModal = 'create' | 'rename' | 'delete' | 'backup' | null;

interface WorkspaceSwitcherProps {
  onExportStudio: (scope: string | 'all') => void;
  onImportStudioFile: (
    event: React.ChangeEvent<HTMLInputElement>,
    targetWorkspaceId: string | 'new',
  ) => void;
  onOpenProductionPackage: () => void;
}

export function WorkspaceSwitcher({
  onExportStudio,
  onImportStudioFile,
  onOpenProductionPackage,
}: WorkspaceSwitcherProps) {
  const {
    workspaces,
    activeWorkspace,
    createWorkspace,
    deleteActiveWorkspace,
    renameActiveWorkspace,
    switchWorkspace,
    refresh,
  } = useWorkspaceStore();
  const [modal, setModal] = useState<WorkspaceModal>(null);
  const [name, setName] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [exportScope, setExportScope] = useState<string | 'all'>('all');
  const [importTarget, setImportTarget] = useState<string | 'new'>('new');
  const backupImportRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleFocus = () => void refresh();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refresh]);

  useEffect(() => {
    if (!activeWorkspace) return;
    if (exportScope !== 'all' && !workspaces.some((item) => item.id === exportScope)) {
      setExportScope(activeWorkspace.id);
    }
    if (importTarget !== 'new' && !workspaces.some((item) => item.id === importTarget)) {
      setImportTarget(activeWorkspace.id);
    }
  }, [activeWorkspace, exportScope, importTarget, workspaces]);

  if (!activeWorkspace) return null;

  const openCreateModal = () => {
    const nextSlot = Math.max(0, ...workspaces.map((workspace) => workspace.slot)) + 1;
    setName(`새 작업실 ${nextSlot}`);
    setModal('create');
  };

  const openRenameModal = () => {
    setName(activeWorkspace.name);
    setModal('rename');
  };

  const openDeleteModal = () => {
    setDeleteConfirmation('');
    setModal('delete');
  };

  const openBackupModal = async () => {
    await refresh();
    setModal('backup');
  };

  const closeModal = () => {
    if (!isSubmitting) setModal(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (modal === 'rename') {
        await renameActiveWorkspace(trimmedName);
        toast.success(`작업실 이름을 "${trimmedName}"(으)로 바꿨어요.`);
      } else if (modal === 'create') {
        const popup = window.open('', '_blank');
        if (popup) {
          popup.document.title = '새 작업실 준비 중';
          popup.document.body.style.cssText = 'margin:0;background:#111827;color:#d1d5db;font-family:sans-serif;display:grid;place-items:center;min-height:100vh';
          popup.document.body.textContent = '새 작업실을 준비하고 있어요...';
        }

        const workspace = await createWorkspace(trimmedName);
        if (popup) {
          popup.location.replace(getWorkspaceUrl(workspace.id));
        } else {
          toast.error('새 창이 차단됐어요. 위 작업실 목록에서 새 작업실을 선택해 주세요.');
        }
      }
      setModal(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '작업실을 처리하지 못했어요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmation !== activeWorkspace.name || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const nextWorkspace = await deleteActiveWorkspace();
      window.location.replace(getWorkspaceUrl(nextWorkspace.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '작업실을 삭제하지 못했어요.');
      setIsSubmitting(false);
    }
  };

  const canDeleteWorkspace = activeWorkspace.id !== DEFAULT_WORKSPACE_ID && workspaces.length > 1;

  return (
    <>
      <div
        className="mt-3 flex min-h-12 w-full items-center gap-2 border-t border-gray-800 pt-3"
        data-testid="workspace-switcher"
      >
        <span className="hidden shrink-0 text-xs font-semibold text-gray-500 sm:inline">작업실</span>
        <select
          aria-label="작업실 선택"
          data-testid="workspace-select"
          value={activeWorkspace.id}
          onChange={(event) => switchWorkspace(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-100 outline-none transition-colors hover:border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
        >
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.slot} · {workspace.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label="새 작업실 만들기"
          title="새 작업실 만들기"
          data-testid="workspace-create-button"
          onClick={openCreateModal}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-600 text-white transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <PlusIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="현재 작업실 이름 변경"
          title="현재 작업실 이름 변경"
          onClick={openRenameModal}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gray-800 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <PencilIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="현재 작업실 삭제"
          title={canDeleteWorkspace ? '현재 작업실 삭제' : '기본 작업실은 삭제할 수 없어요'}
          data-testid="workspace-delete-button"
          onClick={openDeleteModal}
          disabled={!canDeleteWorkspace}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gray-800 text-gray-300 transition-colors hover:bg-red-950 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-gray-800 disabled:hover:text-gray-300"
        >
          <TrashIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="작업실 백업 관리"
          title="작업실 백업 관리"
          data-testid="workspace-backup-button"
          onClick={() => void openBackupModal()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gray-800 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <ArchiveBoxIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="제작 패키지 센터"
          title="제작 패키지 센터"
          data-testid="production-package-button"
          onClick={onOpenProductionPackage}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-700 text-white transition-colors hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          <CubeIcon className="h-5 w-5" />
        </button>
      </div>

      <Modal
        isOpen={modal !== null}
        onClose={closeModal}
        title={modal === 'create'
          ? '새 작업실'
          : modal === 'rename'
            ? '작업실 이름 변경'
            : modal === 'delete'
              ? '작업실 삭제'
              : '작업실 백업 관리'}
        size={modal === 'backup' ? 'md' : 'sm'}
        isDismissible={!isSubmitting}
      >
        {modal === 'backup' ? (
          <div className="space-y-6">
            <input
              ref={backupImportRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(event) => {
                onImportStudioFile(event, importTarget);
                setModal(null);
              }}
            />
            <section className="space-y-3" aria-labelledby="workspace-export-title">
              <div>
                <h3 id="workspace-export-title" className="font-semibold text-white">내보내기</h3>
                <p className="mt-1 text-xs text-gray-400">한 작업실만 고르거나 모든 작업실을 한 파일로 묶을 수 있어요.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  aria-label="내보낼 작업실 범위"
                  data-testid="backup-export-scope"
                  value={exportScope}
                  onChange={(event) => setExportScope(event.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm font-semibold text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.slot} · {workspace.name}
                    </option>
                  ))}
                  <option value="all">모든 작업실</option>
                </select>
                <button
                  type="button"
                  onClick={() => onExportStudio(exportScope)}
                  className="flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-500"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  내보내기
                </button>
              </div>
            </section>

            <section className="space-y-3 border-t border-gray-700 pt-5" aria-labelledby="workspace-import-title">
              <div>
                <h3 id="workspace-import-title" className="font-semibold text-white">가져오기</h3>
                <p className="mt-1 text-xs text-gray-400">단일 백업은 선택한 번호에 넣고, 전체 백업은 기존 자료를 지우지 않고 새 번호들로 추가해요.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  aria-label="가져올 작업실 위치"
                  data-testid="backup-import-target"
                  value={importTarget}
                  onChange={(event) => setImportTarget(event.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm font-semibold text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.slot} · {workspace.name}에 덮어쓰기
                    </option>
                  ))}
                  <option value="new">+ 새 작업실로 추가</option>
                </select>
                <button
                  type="button"
                  onClick={() => backupImportRef.current?.click()}
                  className="flex h-10 items-center justify-center gap-2 rounded-lg bg-gray-700 px-4 text-sm font-semibold text-white hover:bg-gray-600"
                >
                  <ArrowUpTrayIcon className="h-4 w-4" />
                  파일 선택
                </button>
              </div>
            </section>
          </div>
        ) : modal === 'delete' ? (
          <div className="space-y-5">
            <div className="rounded-lg border border-red-900/70 bg-red-950/30 p-4 text-sm text-red-100">
              <p className="font-semibold">{activeWorkspace.slot} · {activeWorkspace.name}</p>
              <p className="mt-2 leading-6 text-red-200/80">
                이 작업실의 소설, 작가, 시리즈, 캐시와 대화 자료가 모두 삭제됩니다. 삭제한 자료는 되돌릴 수 없어요.
              </p>
            </div>
            <Input
              label="삭제할 작업실 이름 확인"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              placeholder={activeWorkspace.name}
              autoFocus
              data-testid="workspace-delete-confirmation"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={isSubmitting}
                className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-600 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleteConfirmation !== activeWorkspace.name || isSubmitting}
                data-testid="workspace-delete-confirm-button"
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSubmitting ? '삭제 중...' : '작업실 영구 삭제'}
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="작업실 이름"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={40}
            autoFocus
            data-testid="workspace-name-input"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeModal}
              disabled={isSubmitting}
              className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-600 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              data-testid="workspace-submit-button"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? '처리 중...' : modal === 'create' ? '새 창에서 만들기' : '이름 바꾸기'}
            </button>
          </div>
        </form>
        )}
      </Modal>
    </>
  );
}
