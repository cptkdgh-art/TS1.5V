import type { CharacterChatUserPersona } from '@core/types';

export function createDefaultUserPersona(now = Date.now()): CharacterChatUserPersona {
  return {
    id: 'default-self',
    name: '나',
    role: '',
    personality: '',
    speakingStyle: '',
    background: '',
    goal: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function snapshotUserPersona(persona?: CharacterChatUserPersona): CharacterChatUserPersona {
  const source = persona || createDefaultUserPersona();
  return { ...source };
}
