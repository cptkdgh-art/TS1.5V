import type {
  DirectorAuthorProposal,
  DirectorClioBackupData,
  DirectorClioReadMode,
  DirectorClioSession,
} from '@core/types';
import { parseDirectorAuthorProposal } from './authorProposal';

const READ_MODES = new Set<DirectorClioReadMode>(['overview', 'recent', 'full']);

function isContentArray(value: unknown): value is DirectorClioSession['history'] {
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const candidate = item as { role?: unknown; parts?: unknown };
    return (candidate.role === 'user' || candidate.role === 'model') && Array.isArray(candidate.parts);
  });
}

function parseAuthorProposalArray(value: unknown): DirectorAuthorProposal[] | null {
  if (!Array.isArray(value)) return null;
  const proposals: DirectorAuthorProposal[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const candidate = item as Partial<DirectorAuthorProposal>;
    const draft = parseDirectorAuthorProposal(candidate, { preserveIdentityMetadata: true });
    const validMetadata = draft !== null
      && typeof candidate.id === 'string'
      && candidate.id.length > 0
      && typeof candidate.createdAt === 'number'
      && Number.isFinite(candidate.createdAt)
      && Number.isInteger(candidate.afterMessageIndex)
      && Number(candidate.afterMessageIndex) >= 0
      && (candidate.sourceNovelId === null || typeof candidate.sourceNovelId === 'string')
      && (candidate.createdAuthorId === undefined || typeof candidate.createdAuthorId === 'string')
      && (candidate.assignedNovelId === undefined || typeof candidate.assignedNovelId === 'string');
    if (!validMetadata || !draft) return null;
    proposals.push({
      ...draft,
      id: candidate.id!,
      createdAt: candidate.createdAt!,
      afterMessageIndex: candidate.afterMessageIndex!,
      sourceNovelId: candidate.sourceNovelId!,
      createdAuthorId: candidate.createdAuthorId,
      assignedNovelId: candidate.assignedNovelId,
    });
  }
  return proposals;
}

export function parseDirectorClioBackup(value: unknown): DirectorClioBackupData | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<DirectorClioBackupData>;
  if (candidate.schemaVersion !== 1) return null;
  if (!Array.isArray(candidate.memories) || !candidate.memories.every((item) => typeof item === 'string')) return null;
  if (!candidate.sessions || typeof candidate.sessions !== 'object' || Array.isArray(candidate.sessions)) return null;
  if (candidate.activeNovelId !== null && typeof candidate.activeNovelId !== 'string') return null;
  if (
    candidate.legacyMigrationCompleted !== undefined
    && typeof candidate.legacyMigrationCompleted !== 'boolean'
  ) return null;

  const sessions: Record<string, DirectorClioSession> = {};
  for (const [key, session] of Object.entries(candidate.sessions)) {
    if (!session || typeof session !== 'object') return null;
    if (session.novelId !== null && typeof session.novelId !== 'string') return null;
    if (key !== (session.novelId || 'studio')) return null;
    if (!isContentArray(session.history)) return null;
    const authorProposals = session.authorProposals === undefined
      ? undefined
      : parseAuthorProposalArray(session.authorProposals);
    if (session.authorProposals !== undefined && !authorProposals) return null;
    if (session.summary !== undefined && typeof session.summary !== 'string') return null;
    if (!READ_MODES.has(session.readMode)) return null;
    if (typeof session.updatedAt !== 'number' || !Number.isFinite(session.updatedAt)) return null;
    sessions[key] = {
      novelId: session.novelId,
      history: session.history,
      authorProposals: authorProposals ?? undefined,
      summary: session.summary,
      readMode: session.readMode,
      updatedAt: session.updatedAt,
    };
  }

  return {
    schemaVersion: 1,
    memories: [...candidate.memories],
    sessions,
    activeNovelId: candidate.activeNovelId,
    legacyMigrationCompleted: candidate.legacyMigrationCompleted,
  };
}
