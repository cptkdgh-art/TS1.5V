import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import type { Novel } from '@core/types';
import { generateChapterId } from '@services/ai';
import { createChapterTrace, getChapterDisplayId, prepareChapterRemoval, reviseChapter, type ChapterRemovalMode } from '@services/novel';
import { toast } from '@shared/components';
import type { EditingChapter } from '../types';

interface DeleteChapterRequest {
  index: number;
  chapterId: string;
  displayId: string;
  title: string;
}

interface UseChapterActionsOptions {
  novel: Novel;
  onUpdateNovel: (updatedNovel: Novel) => Promise<void>;
  onMutateNovel: (id: string, updater: (current: Novel) => Novel) => Promise<Novel | undefined>;
  setCurrentVisibleChapter: Dispatch<SetStateAction<number>>;
  onChapterSaved: (updatedNovel: Novel) => void;
}

export function useChapterActions({
  novel,
  onUpdateNovel,
  onMutateNovel,
  setCurrentVisibleChapter,
  onChapterSaved,
}: UseChapterActionsOptions) {
  const [editingChapter, setEditingChapter] = useState<EditingChapter | null>(null);
  const [deleteChapterModal, setDeleteChapterModal] = useState<DeleteChapterRequest | null>(null);
  const [isRemovingChapter, setIsRemovingChapter] = useState(false);

  const saveEditedChapter = useCallback(async () => {
    if (!editingChapter || !novel.chapters[editingChapter.index]) {
      return;
    }

    const updatedChapters = [...novel.chapters];
    updatedChapters[editingChapter.index] = reviseChapter(
      updatedChapters[editingChapter.index],
      { content: editingChapter.content },
    );

    const updatedNovel = { ...novel, chapters: updatedChapters };
    try {
      await onUpdateNovel(updatedNovel);
      setEditingChapter(null);
      onChapterSaved(updatedNovel);
    } catch (error) {
      console.error('챕터 저장 실패:', error);
      toast.error('챕터를 저장하지 못했습니다. 편집 내용을 유지한 채 다시 시도해주세요.');
    }
  }, [editingChapter, novel, onChapterSaved, onUpdateNovel]);

  const requestDeleteChapter = useCallback((index: number, title: string) => {
    const chapter = novel.chapters[index];
    if (!chapter) return;
    setDeleteChapterModal({
      index,
      chapterId: chapter.id || `legacy-index-${index}`,
      displayId: getChapterDisplayId(chapter),
      title,
    });
  }, [novel.chapters]);

  const confirmDeleteChapter = useCallback(async (mode: ChapterRemovalMode) => {
    if (!deleteChapterModal || isRemovingChapter) return;

    setIsRemovingChapter(true);
    try {
      const updatedNovel = await onMutateNovel(novel.id, (currentNovel) => prepareChapterRemoval(
        currentNovel,
        deleteChapterModal.chapterId,
        deleteChapterModal.index,
        mode,
      ));
      if (!updatedNovel) throw new Error('작품을 찾지 못했습니다.');

      if (editingChapter) {
        if (
          mode === 'rollback'
          ? editingChapter.index >= deleteChapterModal.index
          : editingChapter.index === deleteChapterModal.index
        ) {
          setEditingChapter(null);
        } else if (mode === 'delete' && editingChapter.index > deleteChapterModal.index) {
          setEditingChapter({ ...editingChapter, index: editingChapter.index - 1 });
        }
      }
      setCurrentVisibleChapter((current) => {
        if (mode === 'rollback') return Math.max(0, updatedNovel.chapters.length - 1);
        if (current > deleteChapterModal.index) return current - 1;
        return Math.max(0, Math.min(current, updatedNovel.chapters.length - 1));
      });
      setDeleteChapterModal(null);
      toast.success(mode === 'rollback'
        ? `${deleteChapterModal.index + 1}화 직전으로 되돌렸습니다. 자동 복구 스냅샷도 저장했습니다.`
        : `'${deleteChapterModal.title}' 회차만 삭제했습니다. 자동 복구 스냅샷도 저장했습니다.`);
    } catch (error) {
      console.error('회차 정리 저장 실패:', error);
      toast.error('회차 정리를 저장하지 못했습니다. 기존 원고는 유지됩니다.');
    } finally {
      setIsRemovingChapter(false);
    }
  }, [deleteChapterModal, editingChapter, isRemovingChapter, novel.id, onMutateNovel, setCurrentVisibleChapter]);

  const updateChapterTitle = useCallback(async (index: number, title: string) => {
    if (!novel.chapters[index]) {
      return;
    }

    const updatedChapters = [...novel.chapters];
    updatedChapters[index] = {
      ...updatedChapters[index],
      title,
    };

    try {
      await onUpdateNovel({ ...novel, chapters: updatedChapters });
      toast.success('제목이 변경되었습니다');
    } catch (error) {
      console.error('챕터 제목 저장 실패:', error);
      toast.error('챕터 제목을 저장하지 못했습니다.');
    }
  }, [novel, onUpdateNovel]);

  const addEmptyChapter = useCallback(async () => {
    const newChapter = {
      id: generateChapterId(),
      title: `${novel.chapters.length + 1}화`,
      content: '',
      trace: createChapterTrace('manual'),
    };

    const updatedNovel = { ...novel, chapters: [...novel.chapters, newChapter] };
    try {
      await onUpdateNovel(updatedNovel);
      setEditingChapter({ index: novel.chapters.length, content: '' });
      toast.success('새 챕터가 추가되었습니다. 내용을 작성해주세요.');
    } catch (error) {
      console.error('새 챕터 저장 실패:', error);
      toast.error('새 챕터를 저장하지 못했습니다. 다시 시도해주세요.');
    }
  }, [novel, onUpdateNovel]);

  const updateChapterContent = useCallback(async (index: number, content: string) => {
    if (!novel.chapters[index]) {
      return;
    }

    const updatedChapters = [...novel.chapters];
    updatedChapters[index] = reviseChapter(updatedChapters[index], { content });

    try {
      await onUpdateNovel({ ...novel, chapters: updatedChapters });
      toast.success('자동 교정이 적용되었습니다');
    } catch (error) {
      console.error('교정 본문 저장 실패:', error);
      toast.error('교정된 본문을 저장하지 못했습니다.');
    }
  }, [novel, onUpdateNovel]);

  return {
    editingChapter,
    setEditingChapter,
    deleteChapterModal,
    setDeleteChapterModal,
    isRemovingChapter,
    saveEditedChapter,
    requestDeleteChapter,
    confirmDeleteChapter,
    updateChapterTitle,
    addEmptyChapter,
    updateChapterContent,
  };
}
