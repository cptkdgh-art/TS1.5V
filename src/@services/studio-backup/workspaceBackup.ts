import type {
  AiAuthor,
  CharacterChatBackupData,
  DirectorClioBackupData,
  Novel,
  ProductionPackageReceipt,
  Series,
  StudioWorkspace,
} from '@core/types';
import { parseCharacterChatBackup } from '@services/character-chat';
import { parseDirectorClioBackup } from '@services/director-clio';
import {
  getRaw,
  getWorkspaceStorageKey,
  setManyRaw,
  STORAGE_KEYS,
} from '@services/storage';
import { notifyWorkspaceChanged, withWorkspaceWrite, workspaceLifecycleKey } from '@services/storage/workspaceCoordination';
import { withStorageLock, workspaceLockName } from '@services/storage/storageLocks';
import { validReceipts, validWorkspaceEntities } from './validation';

export const SINGLE_WORKSPACE_BACKUP_KIND = 'jinpok-workspace' as const;
export const ALL_WORKSPACES_BACKUP_KIND = 'jinpok-all-workspaces' as const;

export interface WorkspaceBackupContent {
  novels: Novel[];
  series: Series[];
  authors: AiAuthor[];
  characterChat?: CharacterChatBackupData;
  directorClio?: DirectorClioBackupData;
  productionPackageReceipts?: ProductionPackageReceipt[];
}

export interface SingleWorkspaceBackup extends WorkspaceBackupContent {
  kind: typeof SINGLE_WORKSPACE_BACKUP_KIND;
  version: '1.4';
  workspace: Pick<StudioWorkspace, 'id' | 'slot' | 'name'>;
  exportedAt: string;
}

export interface AllWorkspacesBackup {
  kind: typeof ALL_WORKSPACES_BACKUP_KIND;
  version: '2.0';
  exportedAt: string;
  workspaces: Array<{
    workspace: Pick<StudioWorkspace, 'id' | 'slot' | 'name'>;
    data: WorkspaceBackupContent;
  }>;
}

const migrateNovel = (novel: Novel): Novel => ({
  ...novel,
  targetChapterCount: novel.targetChapterCount ?? undefined,
  preventAutoEnding: novel.preventAutoEnding ?? false,
  targetedGenerationEnabled: novel.targetedGenerationEnabled !== false,
  chapterGenerationMode: novel.chapterGenerationMode ?? 'single',
  chapterTargetCharacters: novel.chapterTargetCharacters ?? 6000,
  maxTokens: novel.maxTokens ?? 16384,
  primaryGenre: novel.primaryGenre ?? undefined,
  subgenres: Array.isArray(novel.subgenres) ? novel.subgenres : [],
  themes: Array.isArray(novel.themes) ? novel.themes : [],
  foreshadowingSystem: novel.foreshadowingSystem ?? undefined,
  webnovelSettings: novel.webnovelSettings ?? undefined,
  openingStyle: novel.openingStyle ?? undefined,
  startingPoint: novel.startingPoint ?? undefined,
});

const migrateSeries = (series: Series): Series => ({
  ...series,
  blueprint: series.blueprint ?? undefined,
});

const migrateAuthor = (author: AiAuthor & { engine?: unknown }): AiAuthor => {
  const { engine: _engine, ...rest } = author;
  return rest;
};

export const parseWorkspaceBackupContent = (value: unknown): WorkspaceBackupContent | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.novels)
    || !Array.isArray(candidate.series)
    || !Array.isArray(candidate.authors)) {
    return null;
  }
  const records = [...candidate.novels, ...candidate.series, ...candidate.authors];
  if (records.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) return null;
  if (candidate.novels.some((item) => ['subgenres', 'themes'].some((key) =>
    item[key] != null && !Array.isArray(item[key])))) return null;
  const migrated = {
    novels: (candidate.novels as Novel[]).map(migrateNovel),
    series: (candidate.series as Series[]).map(migrateSeries),
    authors: (candidate.authors as Array<AiAuthor & { engine?: unknown }>).map(migrateAuthor),
  };
  if (!validWorkspaceEntities(migrated)
    || (candidate.productionPackageReceipts !== undefined && !validReceipts(candidate.productionPackageReceipts))) return null;

  const characterChat = candidate.characterChat === undefined
    ? undefined
    : parseCharacterChatBackup(candidate.characterChat) ?? null;
  if (characterChat === null) return null;

  const directorClio = candidate.directorClio === undefined
    ? undefined
    : parseDirectorClioBackup(candidate.directorClio) ?? null;
  if (directorClio === null) return null;

  return {
    ...migrated,
    characterChat,
    directorClio,
    ...(Array.isArray(candidate.productionPackageReceipts) ? {
      productionPackageReceipts: candidate.productionPackageReceipts as ProductionPackageReceipt[],
    } : {}),
  };
};

const readArray = async <T>(workspaceId: string, key: string): Promise<T[]> =>
  await getRaw<T[]>(getWorkspaceStorageKey(workspaceId, key)) ?? [];

export const readWorkspaceBackupContent = async (
  workspaceId: string,
): Promise<WorkspaceBackupContent> => withStorageLock(workspaceLockName(workspaceId), async () => {
  const [novels, series, authors, sources, personas, userPersonas, sessions, directorClio, productionPackageReceipts] =
    await Promise.all([
      readArray<Novel>(workspaceId, STORAGE_KEYS.NOVELS),
      readArray<Series>(workspaceId, STORAGE_KEYS.SERIES),
      readArray<AiAuthor>(workspaceId, STORAGE_KEYS.AUTHORS),
      readArray<CharacterChatBackupData['sources'][number]>(workspaceId, STORAGE_KEYS.CHARACTER_CHAT_SOURCES),
      readArray<CharacterChatBackupData['personas'][number]>(workspaceId, STORAGE_KEYS.CHARACTER_CHAT_PERSONAS),
      readArray<CharacterChatBackupData['userPersonas'][number]>(workspaceId, STORAGE_KEYS.CHARACTER_CHAT_USER_PERSONAS),
      readArray<CharacterChatBackupData['sessions'][number]>(workspaceId, STORAGE_KEYS.CHARACTER_CHAT_SESSIONS),
      getRaw<DirectorClioBackupData>(getWorkspaceStorageKey(workspaceId, STORAGE_KEYS.DIRECTOR_CLIO)),
      readArray<ProductionPackageReceipt>(workspaceId, STORAGE_KEYS.PRODUCTION_PACKAGE_RECEIPTS),
    ]);

  return {
    novels,
    series,
    authors,
    characterChat: { schemaVersion: 2, sources, personas, userPersonas, sessions },
    directorClio: directorClio ?? {
      schemaVersion: 1,
      memories: [],
      sessions: {},
      activeNovelId: null,
      legacyMigrationCompleted: false,
    },
    productionPackageReceipts,
  };
});

export const writeWorkspaceBackupContent = async (
  workspaceId: string,
  content: WorkspaceBackupContent,
): Promise<void> => {
  const validated = parseWorkspaceBackupContent(structuredClone(content));
  if (!validated) throw new Error('손상된 작업실 백업은 복원할 수 없어요.');
  content = validated;
  await withWorkspaceWrite(workspaceId, async () => {
  const entries: Array<readonly [string, unknown]> = [
    [workspaceLifecycleKey(workspaceId), { generation: crypto.randomUUID() }],
    [getWorkspaceStorageKey(workspaceId, STORAGE_KEYS.NOVELS), content.novels],
    [getWorkspaceStorageKey(workspaceId, STORAGE_KEYS.SERIES), content.series],
    [getWorkspaceStorageKey(workspaceId, STORAGE_KEYS.AUTHORS), content.authors],
  ];

  if (content.characterChat) {
    entries.push(
      [getWorkspaceStorageKey(workspaceId, STORAGE_KEYS.CHARACTER_CHAT_SOURCES), content.characterChat.sources],
      [getWorkspaceStorageKey(workspaceId, STORAGE_KEYS.CHARACTER_CHAT_PERSONAS), content.characterChat.personas],
      [getWorkspaceStorageKey(workspaceId, STORAGE_KEYS.CHARACTER_CHAT_USER_PERSONAS), content.characterChat.userPersonas],
      [getWorkspaceStorageKey(workspaceId, STORAGE_KEYS.CHARACTER_CHAT_SESSIONS), content.characterChat.sessions],
    );
  }
  if (content.directorClio) {
    entries.push([
      getWorkspaceStorageKey(workspaceId, STORAGE_KEYS.DIRECTOR_CLIO),
      content.directorClio,
    ]);
  }
  if (content.productionPackageReceipts) {
    entries.push([
      getWorkspaceStorageKey(workspaceId, STORAGE_KEYS.PRODUCTION_PACKAGE_RECEIPTS),
      content.productionPackageReceipts,
    ]);
  }

  await setManyRaw(entries);
  }, { refresh: true });
  notifyWorkspaceChanged({ workspaceId, kind: 'replaced' });
};

export const createSingleWorkspaceBackup = async (
  workspace: StudioWorkspace,
): Promise<SingleWorkspaceBackup> => ({
  kind: SINGLE_WORKSPACE_BACKUP_KIND,
  version: '1.4',
  workspace: { id: workspace.id, slot: workspace.slot, name: workspace.name },
  ...await readWorkspaceBackupContent(workspace.id),
  exportedAt: new Date().toISOString(),
});

export const createAllWorkspacesBackup = async (
  workspaces: StudioWorkspace[],
): Promise<AllWorkspacesBackup> => ({
  kind: ALL_WORKSPACES_BACKUP_KIND,
  version: '2.0',
  exportedAt: new Date().toISOString(),
  workspaces: await Promise.all(workspaces.map(async (workspace) => ({
    workspace: { id: workspace.id, slot: workspace.slot, name: workspace.name },
    data: await readWorkspaceBackupContent(workspace.id),
  }))),
});

export const parseAllWorkspacesBackup = (value: unknown): AllWorkspacesBackup | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<AllWorkspacesBackup>;
  if (candidate.kind !== ALL_WORKSPACES_BACKUP_KIND || !Array.isArray(candidate.workspaces)) {
    return null;
  }

  const parsed = candidate.workspaces.map((item) => {
    const content = parseWorkspaceBackupContent(item?.data);
    if (!item?.workspace || typeof item.workspace.name !== 'string'
      || typeof item.workspace.id !== 'string' || !item.workspace.id.trim()
      || !Number.isInteger(item.workspace.slot) || item.workspace.slot < 1 || !content) return null;
    return { workspace: item.workspace, data: content };
  });
  if (parsed.some((item) => item === null)) return null;
  if (new Set(parsed.map((item) => item!.workspace.id)).size !== parsed.length
    || new Set(parsed.map((item) => item!.workspace.slot)).size !== parsed.length) return null;

  return {
    kind: ALL_WORKSPACES_BACKUP_KIND,
    version: '2.0',
    exportedAt: typeof candidate.exportedAt === 'string'
      ? candidate.exportedAt
      : new Date().toISOString(),
    workspaces: parsed as AllWorkspacesBackup['workspaces'],
  };
};
