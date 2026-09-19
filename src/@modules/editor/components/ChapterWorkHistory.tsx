import type { Chapter, Novel } from '@core/types';
import { buildChapterWorkExport } from '@services/novel/chapterWorkExport';
import { Button, toast } from '@shared/components';

export function ChapterWorkHistory({ novel, chapter, busy, onRestore }: {
  novel: Novel;
  chapter: Chapter;
  busy: boolean;
  onRestore: (revisionId: string) => void;
}) {
  const records = chapter.agentRevisions ?? [];
  function download(format: 'json' | 'txt') {
    try {
      const output = buildChapterWorkExport(novel, chapter.id!, format);
      const url = URL.createObjectURL(new Blob([output.content], { type: output.mimeType }));
      const link = document.createElement('a');
      link.href = url; link.download = output.filename;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : '작업 기록을 내보내지 못했어요.');
    }
  }
  return (
    <div className="space-y-4" data-testid="chapter-work-history">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-300">작업 기록 {records.length}개 · 원본은 계속 보관돼요.</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => download('json')} aria-label="작가 작업 기록 JSON 내보내기">JSON 내보내기</Button>
          <Button variant="secondary" onClick={() => download('txt')} aria-label="작가 작업 기록 TXT 내보내기">TXT 내보내기</Button>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-gray-400">전체 백업에도 함께 저장돼요. 여기서는 이 회차의 대화와 수정 전후 원고만 따로 꺼낼 수 있어요.</p>
      <details className="rounded-lg border border-gray-700 p-3">
        <summary className="cursor-pointer text-sm font-medium text-indigo-200">현재 원고 · {chapter.content.length.toLocaleString()}자</summary>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-gray-200">{chapter.content || '아직 원고가 없어요.'}</p>
      </details>
      {records.length === 0 && <p className="py-4 text-center text-sm text-gray-400">작가가 원고를 수정하면 이곳에 수정 전후 원고가 남아요.</p>}
      {[...records].reverse().map((record) => (
        <details key={record.id} className="rounded-lg border border-gray-700 bg-gray-900/40 p-3" data-testid="chapter-work-revision">
          <summary className="cursor-pointer break-words text-sm text-gray-200">
            <span className="mr-2 rounded bg-indigo-900/60 px-2 py-0.5 text-xs text-indigo-200">{record.kind === 'restore' ? '복원' : '수정'}</span>
            {record.summary}
            <span className="mt-1 block text-xs text-gray-400">{new Date(record.createdAt).toLocaleString('ko-KR')} · {record.authorName}</span>
          </summary>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm text-gray-300">지시: {record.instruction}</p>
          {record.grounding && (
            <div className="mt-3 space-y-2 rounded-lg border border-indigo-800/70 bg-indigo-950/20 p-3 text-sm leading-relaxed text-gray-300">
              <p><span className="font-medium text-indigo-200">왜 바꿨는가: </span>{record.grounding.reason}</p>
              <p><span className="font-medium text-indigo-200">살린 것: </span>{record.grounding.preserve.join(' · ')}</p>
              <p><span className="font-medium text-indigo-200">선택한 방향: </span>
                {record.grounding.selectedChoice.id.toUpperCase()} · {record.grounding.selectedChoice.label} — {record.grounding.selectedChoice.direction}
              </p>
              <p><span className="font-medium text-indigo-200">기대한 독자 효과: </span>{record.grounding.expectedEffect}</p>
            </div>
          )}
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="min-w-0 rounded-lg bg-gray-950/50 p-3">
              <h4 className="mb-2 text-sm font-medium text-amber-200">수정 전 · {record.before.title}</h4>
              <p className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-7 text-gray-300">{record.before.content || '(빈 원고)'}</p>
            </div>
            <div className="min-w-0 rounded-lg bg-gray-950/50 p-3">
              <h4 className="mb-2 text-sm font-medium text-emerald-200">수정 후 · {record.after.title}</h4>
              <p className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-7 text-gray-300">{record.after.content || '(빈 원고)'}</p>
            </div>
          </div>
          <Button variant="secondary" className="mt-3 min-h-10" disabled={busy} onClick={() => onRestore(record.id)}>이 작업 전으로 복원</Button>
        </details>
      ))}
    </div>
  );
}
