import {
  PRODUCTION_PACKAGE_KIND,
  type ProductionPackage,
  type ProductionPackageSectionSelection,
} from '@core/types';
import { PRODUCTION_PACKAGE_SECTIONS } from './constants';
import {
  validChapterAgentPendingProposal,
  validChapterAgentRevisions,
} from '@services/studio-backup/validation';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSections(value: unknown): value is ProductionPackageSectionSelection {
  return isRecord(value)
    && PRODUCTION_PACKAGE_SECTIONS.every((section) => typeof value[section] === 'boolean');
}

export function parseProductionPackage(value: unknown): ProductionPackage | null {
  if (!isRecord(value)
    || value.kind !== PRODUCTION_PACKAGE_KIND
    || value.schemaVersion !== 1
    || !isRecord(value.package)
    || !isRecord(value.sourceWorkspace)
    || !isRecord(value.manifest)
    || !isRecord(value.payload)) return null;

  const metadata = value.package;
  const sourceWorkspace = value.sourceWorkspace;
  const manifest = value.manifest;
  const payload = value.payload;

  if (typeof metadata.packageId !== 'string'
    || typeof metadata.lineageId !== 'string'
    || !Number.isInteger(metadata.revision)
    || Number(metadata.revision) < 1
    || typeof metadata.title !== 'string'
    || typeof metadata.createdAt !== 'string'
    || metadata.sourceApp !== 'jinpok-stido'
    || metadata.sourceSchema !== '1.5'
    || typeof sourceWorkspace.id !== 'string'
    || typeof sourceWorkspace.name !== 'string'
    || !isSections(manifest.sections)
    || !Array.isArray(payload.authors)
    || !Array.isArray(payload.series)
    || !Array.isArray(payload.novels)) return null;

  const authors = payload.authors as Array<{ id?: unknown; name?: unknown }>;
  const series = payload.series as Array<{ id?: unknown; title?: unknown; novelIds?: unknown }>;
  const novels = payload.novels as Array<{ id?: unknown; title?: unknown; chapters?: unknown }>;
  if (authors.some((item) => typeof item?.id !== 'string' || typeof item?.name !== 'string')
    || series.some((item) => typeof item?.id !== 'string' || typeof item?.title !== 'string' || !Array.isArray(item?.novelIds))
    || novels.some((item) => typeof item?.id !== 'string' || typeof item?.title !== 'string' || !Array.isArray(item?.chapters))) {
    return null;
  }

  const ids = [
    ...authors.map((item) => item.id),
    ...series.map((item) => item.id),
    ...novels.map((item) => item.id),
  ];
  if (new Set(ids).size !== ids.length) return null;

  // Older packages have no agent history. New records must be intact before import.
  if (novels.some((novel) => (novel.chapters as unknown[]).some((chapter) =>
    !isRecord(chapter)
    || (chapter.agentPendingProposal !== undefined && !validChapterAgentPendingProposal(chapter.agentPendingProposal))
    || (chapter.agentRevisions !== undefined && !validChapterAgentRevisions(chapter.agentRevisions))))) return null;

  return value as unknown as ProductionPackage;
}
