import type { CharacterChatPersona, CharacterChatSession, CharacterChatSource } from '@core/types';
import {
  ArrowLeftIcon,
  ChatBubbleThoughtIcon,
  DocumentDuplicateIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from '@shared/components';

interface CharacterChatHomeProps {
  personas: CharacterChatPersona[];
  sources: CharacterChatSource[];
  sessions: CharacterChatSession[];
  onBack: () => void;
  onImport: () => void;
  onOpenSession: (sessionId: string) => void;
  onStartChat: (personaId: string) => void;
  onNewChat: (personaId: string) => void;
  onEditPersona: (personaId: string) => void;
  onDuplicatePersona: (personaId: string) => void;
  onDeletePersona: (personaId: string) => void;
}

export function CharacterChatHome({
  personas,
  sources,
  sessions,
  onBack,
  onImport,
  onOpenSession,
  onStartChat,
  onNewChat,
  onEditPersona,
  onDuplicatePersona,
  onDeletePersona,
}: CharacterChatHomeProps) {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const personaById = new Map(personas.map((persona) => [persona.id, persona]));
  const recentSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);

  return (
    <div className="min-h-screen bg-[#fff7fa] text-[#44363d]">
      <header className="border-b border-[#f0dce3] bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="rounded-md p-2 text-[#a58c96] hover:bg-[#fff0f4] hover:text-[#b7466b]"
              title="소설 스튜디오로"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff0f4] text-[#d85e84] shadow-sm">
              <ChatBubbleThoughtIcon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold">캐릭터챗</h1>
              <p className="truncate text-xs text-[#9a838d]">소설과 TXT에서 꺼낸 나만의 1:1 캐릭터</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onImport}
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-[#ec668f] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#d9507b]"
          >
            <PlusIcon className="h-4 w-4" />
            <span className="hidden sm:inline">캐릭터 가져오기</span>
            <span className="sm:hidden">가져오기</span>
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-10 px-4 py-7 sm:px-6">
        {recentSessions.length > 0 && (
          <section aria-labelledby="recent-chat-title">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h2 id="recent-chat-title" className="text-lg font-semibold">최근 대화</h2>
                <p className="text-sm text-[#9a838d]">멈춘 자리에서 바로 이어갈 수 있어.</p>
              </div>
            </div>
            <div className="divide-y divide-[#f0dce3] border-y border-[#f0dce3] bg-white">
              {recentSessions.map((session) => {
                const persona = personaById.get(session.personaId);
                if (!persona) return null;
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => onOpenSession(session.id)}
                    className="flex w-full items-center gap-3 px-2 py-3 text-left hover:bg-[#fff3f7]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#ffd2df] bg-[#fff0f4] text-sm font-bold text-[#c9587c]">
                      {persona.portrait
                        ? <img src={persona.portrait} alt="" className="h-full w-full object-cover" />
                        : persona.name.slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-[#4d3a43]">{persona.name}</p>
                      <p className="truncate text-sm text-[#9a838d]">{session.messages[session.messages.length - 1]?.content || '새 대화'}</p>
                    </div>
                    <span className="hidden text-xs text-[#b19ba4] sm:block">
                      {new Date(session.updatedAt).toLocaleDateString('ko-KR')}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section aria-labelledby="persona-list-title">
          <div className="mb-4">
            <h2 id="persona-list-title" className="text-lg font-semibold">내 캐릭터</h2>
            <p className="text-sm text-[#9a838d]">각 캐릭터는 원본과 분리된 페르소나로 저장돼.</p>
          </div>

          {personas.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center border-y border-[#f0dce3] bg-white py-12 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#fff0f4] text-[#d85e84]"><ChatBubbleThoughtIcon className="h-7 w-7" /></div>
              <h3 className="text-lg font-semibold">아직 데려온 캐릭터가 없어</h3>
              <p className="mt-1 max-w-md text-sm text-[#9a838d]">내 소설을 고르거나 TXT를 분석해 첫 캐릭터를 만들어보자.</p>
              <button
                type="button"
                onClick={onImport}
                className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#ec668f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d9507b]"
              >
                <PlusIcon className="h-4 w-4" />
                첫 캐릭터 가져오기
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {personas.map((persona) => {
                const source = sourceById.get(persona.sourceId);
                const chatCount = sessions.filter((session) => session.personaId === persona.id).length;
                return (
                  <article key={persona.id} className="overflow-hidden rounded-md border border-[#efd6df] bg-white shadow-sm">
                    <button
                      type="button"
                      onClick={() => onStartChat(persona.id)}
                      className="flex w-full gap-4 p-4 text-left hover:bg-[#fff5f8]"
                    >
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#ffd2df] bg-[#fff0f4] text-2xl font-bold text-[#c9587c]">
                        {persona.portrait
                          ? <img src={persona.portrait} alt={`${persona.name} 일러스트`} className="h-full w-full object-cover" />
                          : persona.name.slice(0, 1)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-semibold">{persona.name}</h3>
                        <p className="mt-0.5 truncate text-xs font-semibold text-[#3f8b76]">{source?.title || '직접 생성'}</p>
                        <p className="mt-2 line-clamp-2 text-sm leading-5 text-[#806b74]">{persona.personality.value || '성격을 채워주세요.'}</p>
                      </div>
                    </button>
                    <div className="flex items-center justify-between border-t border-[#f0dce3] bg-[#fffafc] px-3 py-2">
                      <span className="text-xs text-[#a58c96]">대화 {chatCount}개</span>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => onNewChat(persona.id)} className="rounded-md p-2 text-[#a58c96] hover:bg-[#fff0f4] hover:text-[#b7466b]" title="새 대화">
                          <PlusIcon className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => onEditPersona(persona.id)} className="rounded-md p-2 text-[#a58c96] hover:bg-[#fff0f4] hover:text-[#6e4f5b]" title="캐릭터 수정">
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => onDuplicatePersona(persona.id)} className="rounded-md p-2 text-[#a58c96] hover:bg-[#eaf8f3] hover:text-[#3f8b76]" title="캐릭터 복제">
                          <DocumentDuplicateIcon className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => onDeletePersona(persona.id)} className="rounded-md p-2 text-[#b9a3ab] hover:bg-red-50 hover:text-red-500" title="캐릭터 삭제">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
