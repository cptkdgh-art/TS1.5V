import { useState } from 'react';
import type {
  CharacterChatCandidate,
  CharacterChatModel,
  CharacterChatPersona,
  CharacterChatSource,
  CharacterChatUserPersona,
} from '@core/types';
import { useNovelStore } from '@stores/novelStore';
import { useSeriesStore } from '@stores/seriesStore';
import { useCharacterChatStore } from '@stores/characterChatStore';
import { candidateToPersona, parseRoleplayResponse } from '@services/character-chat';
import { Spinner, toast, useConfirmDialog } from '@shared/components';
import { CharacterChatHome } from './components/CharacterChatHome';
import { SourceImportView } from './components/SourceImportView';
import { PersonaEditor } from './components/PersonaEditor';
import { ChatRoom } from './components/ChatRoom';
import { UserPersonaSetupModal } from './components/UserPersonaSetupModal';

type CharacterChatView = 'home' | 'import' | 'persona' | 'chat';

interface CharacterChatAppProps {
  onExit: () => void;
}

export function CharacterChatApp({ onExit }: CharacterChatAppProps) {
  const novels = useNovelStore((state) => state.novels);
  const series = useSeriesStore((state) => state.seriesList);
  const sources = useCharacterChatStore((state) => state.sources);
  const personas = useCharacterChatStore((state) => state.personas);
  const sessions = useCharacterChatStore((state) => state.sessions);
  const userPersonas = useCharacterChatStore((state) => state.userPersonas);
  const isLoading = useCharacterChatStore((state) => state.isLoading);
  const upsertSource = useCharacterChatStore((state) => state.upsertSource);
  const upsertPersona = useCharacterChatStore((state) => state.upsertPersona);
  const upsertUserPersona = useCharacterChatStore((state) => state.upsertUserPersona);
  const deleteUserPersona = useCharacterChatStore((state) => state.deleteUserPersona);
  const duplicatePersona = useCharacterChatStore((state) => state.duplicatePersona);
  const deletePersona = useCharacterChatStore((state) => state.deletePersona);
  const createSession = useCharacterChatStore((state) => state.createSession);
  const appendMessage = useCharacterChatStore((state) => state.appendMessage);
  const confirm = useConfirmDialog();

  const [view, setView] = useState<CharacterChatView>('home');
  const [draftPersona, setDraftPersona] = useState<CharacterChatPersona | null>(null);
  const [draftSource, setDraftSource] = useState<CharacterChatSource | null>(null);
  const [selectedPersonaId, setSelectedPersonaId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [editorReturnView, setEditorReturnView] = useState<'home' | 'chat' | 'import'>('home');
  const [pendingChatPersona, setPendingChatPersona] = useState<CharacterChatPersona | null>(null);

  const createNewSession = async (
    persona: CharacterChatPersona,
    userPersona: CharacterChatUserPersona,
    saveForReuse: boolean
  ) => {
    if (saveForReuse && userPersona.id !== 'default-self') {
      await upsertUserPersona(userPersona);
    }
    const session = await createSession(persona.id, persona.defaultModel, userPersona);
    if (persona.greeting.value.trim()) {
      const greeting = parseRoleplayResponse(persona.greeting.value.trim());
      await appendMessage(session.id, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: greeting.content,
        blocks: greeting.blocks,
        emotion: greeting.emotion,
        createdAt: Date.now(),
      });
    }
    setSelectedPersonaId(persona.id);
    setSelectedSessionId(session.id);
    setView('chat');
    setPendingChatPersona(null);
  };

  const requestNewSession = (persona: CharacterChatPersona) => {
    setPendingChatPersona(persona);
  };

  const openPersonaChat = async (personaId: string, forceNew = false) => {
    const persona = useCharacterChatStore.getState().personas.find((item) => item.id === personaId);
    if (!persona) return;
    const latest = useCharacterChatStore.getState().sessions
      .filter((session) => session.personaId === personaId)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (forceNew || !latest) {
      requestNewSession(persona);
      return;
    }
    setSelectedPersonaId(personaId);
    setSelectedSessionId(latest.id);
    setView('chat');
  };

  const openSession = (sessionId: string) => {
    const session = useCharacterChatStore.getState().sessions.find((item) => item.id === sessionId);
    if (!session) return;
    setSelectedPersonaId(session.personaId);
    setSelectedSessionId(session.id);
    setView('chat');
  };

  const handleCandidate = (
    source: CharacterChatSource,
    candidate: CharacterChatCandidate,
    model: CharacterChatModel
  ) => {
    setDraftSource(source);
    setDraftPersona({ ...candidateToPersona(source, candidate), defaultModel: model });
    setEditorReturnView('import');
    setView('persona');
  };

  const editPersona = (personaId: string, returnView: 'home' | 'chat' = 'home') => {
    const persona = useCharacterChatStore.getState().personas.find((item) => item.id === personaId);
    const source = persona
      ? useCharacterChatStore.getState().sources.find((item) => item.id === persona.sourceId)
      : undefined;
    if (!persona || !source) return;
    setDraftPersona(persona);
    setDraftSource(source);
    setEditorReturnView(returnView);
    setView('persona');
  };

  const savePersona = async (persona: CharacterChatPersona, startChat: boolean) => {
    if (!draftSource) return;
    await Promise.all([upsertSource(draftSource), upsertPersona(persona)]);
    setDraftPersona(persona);
    toast.success('캐릭터 페르소나를 저장했어.');
    if (startChat) {
      await openPersonaChat(persona.id);
    } else {
      setView(editorReturnView === 'import' ? 'home' : editorReturnView);
    }
  };

  const handleDeletePersona = async (personaId: string) => {
    const persona = personas.find((item) => item.id === personaId);
    if (!persona) return;
    const approved = await confirm({
      title: '캐릭터 삭제',
      message: <p><b>{persona.name}</b> 캐릭터의 모든 대화 기록도 함께 삭제됩니다.</p>,
      confirmText: '삭제',
      variant: 'danger',
    });
    if (approved) {
      await deletePersona(personaId);
      toast.success('캐릭터와 연결된 대화를 삭제했어.');
    }
  };

  const handleDuplicatePersona = async (personaId: string) => {
    const copy = await duplicatePersona(personaId);
    if (copy) toast.success(`${copy.name}을 새 캐릭터로 복제했어.`);
  };

  const roleSetupModal = pendingChatPersona ? (
    <UserPersonaSetupModal
      characterName={pendingChatPersona.name}
      personas={userPersonas}
      onClose={() => setPendingChatPersona(null)}
      onStart={(userPersona, saveForReuse) => createNewSession(pendingChatPersona, userPersona, saveForReuse)}
      onDelete={deleteUserPersona}
    />
  ) : null;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#141215] text-zinc-300">
        <div className="text-center"><Spinner size="lg" /><p className="mt-3 text-sm text-zinc-500">캐릭터챗을 불러오는 중...</p></div>
      </div>
    );
  }

  if (view === 'import') {
    return <SourceImportView novels={novels} series={series} onBack={() => setView('home')} onSelect={handleCandidate} />;
  }

  if (view === 'persona' && draftPersona && draftSource) {
    return (
      <>
        <PersonaEditor
          initialPersona={draftPersona}
          source={draftSource}
          onCancel={() => setView(editorReturnView)}
          onSave={savePersona}
        />
        {roleSetupModal}
      </>
    );
  }

  if (view === 'chat' && selectedPersonaId && selectedSessionId) {
    return (
      <>
        <ChatRoom
          personaId={selectedPersonaId}
          sessionId={selectedSessionId}
          onBack={() => setView('home')}
          onEditPersona={(personaId) => editPersona(personaId, 'chat')}
          onNewChat={() => {
            const target = useCharacterChatStore.getState().personas.find((item) => item.id === selectedPersonaId);
            if (target) requestNewSession(target);
          }}
          onSwitchSession={(sessionId) => {
            const target = useCharacterChatStore.getState().sessions.find((item) => item.id === sessionId);
            if (target) setSelectedPersonaId(target.personaId);
            setSelectedSessionId(sessionId);
          }}
        />
        {roleSetupModal}
      </>
    );
  }

  return (
    <>
      <CharacterChatHome
        personas={personas}
        sources={sources}
        sessions={sessions}
        onBack={onExit}
        onImport={() => setView('import')}
        onOpenSession={openSession}
        onStartChat={(personaId) => { void openPersonaChat(personaId); }}
        onNewChat={(personaId) => { void openPersonaChat(personaId, true); }}
        onEditPersona={(personaId) => editPersona(personaId)}
        onDuplicatePersona={(personaId) => { void handleDuplicatePersona(personaId); }}
        onDeletePersona={(personaId) => { void handleDeletePersona(personaId); }}
      />
      {roleSetupModal}
    </>
  );
}
