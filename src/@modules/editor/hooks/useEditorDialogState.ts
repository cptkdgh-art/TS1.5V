import { useState } from 'react';
import type { Character, Novel, Snapshot } from '@core/types';
import type { ConfirmationModalProps } from '../components';

interface RewriteSelectionState {
  text: string;
  chapterIndex: number;
  context: string;
}

interface ReconstructingChapterState {
  index: number;
  title: string;
  content: string;
}

export function useEditorDialogState() {
  const [confirmationModal, setConfirmationModal] = useState<ConfirmationModalProps | null>(null);
  const [novelToDelete, setNovelToDelete] = useState<Novel | null>(null);
  const [snapshotToDelete, setSnapshotToDelete] = useState<Snapshot | null>(null);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [readingRoomChapterIndex, setReadingRoomChapterIndex] = useState(0);
  const [interviewingCharacter, setInterviewingCharacter] = useState<Character | null>(null);
  const [chattingChapterId, setChattingChapterId] = useState<string | null>(null);
  const [rewriteSelection, setRewriteSelection] = useState<RewriteSelectionState | null>(null);
  const [reconstructingChapter, setReconstructingChapter] = useState<ReconstructingChapterState | null>(null);
  const [editorFeedbackChapterIndex, setEditorFeedbackChapterIndex] = useState<number | null>(null);

  return {
    confirmationModal,
    setConfirmationModal,
    novelToDelete,
    setNovelToDelete,
    snapshotToDelete,
    setSnapshotToDelete,
    editingCharacter,
    setEditingCharacter,
    readingRoomChapterIndex,
    setReadingRoomChapterIndex,
    interviewingCharacter,
    setInterviewingCharacter,
    chattingChapterId,
    setChattingChapterId,
    rewriteSelection,
    setRewriteSelection,
    reconstructingChapter,
    setReconstructingChapter,
    editorFeedbackChapterIndex,
    setEditorFeedbackChapterIndex,
  };
}
