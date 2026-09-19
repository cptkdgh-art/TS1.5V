import { useEffect, useMemo, useState } from 'react';
import type { AiAuthor } from '@core/types';
import { copyAuthorToWorkspace, readWorkspaceAuthors } from '@services/author-transfer';
import { useAuthorStore } from '@stores/authorStore';
import { useWorkspaceStore } from '@stores/workspaceStore';
import { Button, Modal, toast } from '@shared/components';

interface WorkspaceAuthorImportModalProps {
  onClose: () => void;
  onImported?: (author: AiAuthor) => void;
}

export function WorkspaceAuthorImportModal({
  onClose,
  onImported,
}: WorkspaceAuthorImportModalProps) {
  const { workspaces, activeWorkspace } = useWorkspaceStore();
  const { authors, addAuthor } = useAuthorStore();
  const sourceWorkspaces = useMemo(
    () => workspaces.filter((workspace) => workspace.id !== activeWorkspace?.id),
    [activeWorkspace?.id, workspaces],
  );
  const [sourceWorkspaceId, setSourceWorkspaceId] = useState(sourceWorkspaces[0]?.id ?? '');
  const [sourceAuthors, setSourceAuthors] = useState<AiAuthor[]>([]);
  const [selectedAuthorId, setSelectedAuthorId] = useState('');
  const [includeMemory, setIncludeMemory] = useState(true);
  const [includeChats, setIncludeChats] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (!sourceWorkspaces.some((workspace) => workspace.id === sourceWorkspaceId)) {
      setSourceWorkspaceId(sourceWorkspaces[0]?.id ?? '');
    }
  }, [sourceWorkspaceId, sourceWorkspaces]);

  useEffect(() => {
    let cancelled = false;
    if (!sourceWorkspaceId) {
      setSourceAuthors([]);
      setSelectedAuthorId('');
      return () => { cancelled = true; };
    }

    setIsLoading(true);
    void readWorkspaceAuthors(sourceWorkspaceId)
      .then((loadedAuthors) => {
        if (cancelled) return;
        setSourceAuthors(loadedAuthors);
        const firstAvailable = loadedAuthors.find(
          (author) => !(author.isDefault && authors.some((item) => item.id === author.id)),
        );
        setSelectedAuthorId(firstAvailable?.id ?? '');
      })
      .catch(() => {
        if (!cancelled) toast.error('선택한 작업실의 작가 목록을 읽지 못했어요.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [authors, sourceWorkspaceId]);

  const sourceWorkspace = sourceWorkspaces.find((workspace) => workspace.id === sourceWorkspaceId);
  const selectedAuthor = sourceAuthors.find((author) => author.id === selectedAuthorId);

  const handleImport = async () => {
    if (!selectedAuthor || !sourceWorkspace || isImporting) return;
    setIsImporting(true);
    try {
      const copied = copyAuthorToWorkspace(selectedAuthor, authors, {
        includeMemory,
        includeChats,
        sourceWorkspaceName: sourceWorkspace.name,
      });
      await addAuthor(copied);
      onImported?.(copied);
      toast.success(`'${copied.name}' 작가를 현재 작업실로 불러왔어요.`);
      onClose();
    } catch {
      toast.error('작가를 현재 작업실에 저장하지 못했어요.');
      setIsImporting(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="다른 작업실 작가 불러오기" size="md" isDismissible={!isImporting}>
      <div className="space-y-5" data-testid="workspace-author-import-modal">
        <label className="block text-sm font-semibold text-gray-200">
          작업실
          <select
            value={sourceWorkspaceId}
            onChange={(event) => setSourceWorkspaceId(event.target.value)}
            data-testid="author-source-workspace"
            className="mt-2 h-11 w-full rounded-lg border border-gray-600 bg-gray-900 px-3 text-white outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {sourceWorkspaces.length === 0 && <option value="">다른 작업실이 없습니다</option>}
            {sourceWorkspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.slot} · {workspace.name}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-gray-200">작가</legend>
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/60 p-2">
            {isLoading ? (
              <p className="p-4 text-center text-sm text-gray-400">작가 목록을 읽는 중...</p>
            ) : sourceAuthors.length === 0 ? (
              <p className="p-4 text-center text-sm text-gray-400">불러올 작가가 없습니다.</p>
            ) : sourceAuthors.map((author) => {
              const alreadyHasDefault = !!author.isDefault && authors.some((item) => item.id === author.id);
              return (
                <label
                  key={author.id}
                  className={`flex items-start gap-3 rounded-md border p-3 ${alreadyHasDefault ? 'cursor-not-allowed border-gray-800 opacity-45' : 'cursor-pointer border-gray-700 hover:border-indigo-500'}`}
                >
                  <input
                    type="radio"
                    name="workspace-author"
                    value={author.id}
                    checked={selectedAuthorId === author.id}
                    disabled={alreadyHasDefault}
                    onChange={() => setSelectedAuthorId(author.id)}
                    className="mt-1"
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold text-white">{author.name}</span>
                    <span className="block truncate text-xs text-gray-400">
                      {author.specialty || '전문 분야 없음'}{alreadyHasDefault ? ' · 현재 작업실에 있는 기본 작가' : ''}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-md bg-gray-800 p-3 text-sm text-gray-200">
            <input type="checkbox" checked={includeMemory} onChange={(event) => setIncludeMemory(event.target.checked)} />
            축적 기억 포함
          </label>
          <label className="flex items-center gap-2 rounded-md bg-gray-800 p-3 text-sm text-gray-200">
            <input type="checkbox" checked={includeChats} onChange={(event) => setIncludeChats(event.target.checked)} />
            작가 대화 포함
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isImporting}>취소</Button>
          <Button
            variant="primary"
            onClick={() => void handleImport()}
            disabled={!selectedAuthor || isImporting}
            data-testid="workspace-author-import-confirm"
          >
            {isImporting ? '불러오는 중...' : '현재 작업실로 불러오기'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
