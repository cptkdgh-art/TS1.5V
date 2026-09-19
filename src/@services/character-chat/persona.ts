import type {
  CharacterChatPersona,
  CharacterChatPersonaField,
  PersonaField,
} from '@core/types';

export function updatePersonaField(
  persona: CharacterChatPersona,
  field: CharacterChatPersonaField,
  value: string,
  origin: PersonaField['origin'] = 'user'
): CharacterChatPersona {
  return {
    ...persona,
    [field]: { value, origin },
    updatedAt: Date.now(),
  };
}

export function applyPersonaPatch(
  persona: CharacterChatPersona,
  patch: Partial<Record<CharacterChatPersonaField, string>>,
  selectedFields: CharacterChatPersonaField[]
): CharacterChatPersona {
  return selectedFields.reduce((current, field) => {
    const value = patch[field]?.trim();
    return value ? updatePersonaField(current, field, value, 'ai') : current;
  }, persona);
}
