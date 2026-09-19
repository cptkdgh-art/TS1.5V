import type { AiAuthor } from './author.types';
import type { Novel } from './novel.types';
import type { Series } from './series.types';

export const PRODUCTION_PACKAGE_KIND = 'jinpok-production-package' as const;

export type ProductionPackagePurpose =
  | 'planning'
  | 'commission'
  | 'continuation'
  | 'delivery'
  | 'settings-share';

export type ProductionPackageSection =
  | 'authors'
  | 'workCore'
  | 'planning'
  | 'worldbuilding'
  | 'manuscript'
  | 'memory'
  | 'collaboration'
  | 'assets';

export type ProductionPackageSectionSelection = Record<ProductionPackageSection, boolean>;

export interface ProductionPackageIdMap {
  authors: Record<string, string>;
  series: Record<string, string>;
  volumes: Record<string, string>;
  novels: Record<string, string>;
  chapters: Record<string, string>;
  characters: Record<string, string>;
  foreshadowings: Record<string, string>;
  snapshots: Record<string, string>;
}

export interface ProductionPackageReceipt {
  lineageId: string;
  packageId: string;
  revision: number;
  importedAt: number;
  targetWorkspaceId: string;
  mode: 'copy' | 'merge' | 'export';
  idMap: ProductionPackageIdMap;
}

export interface ProductionPackage {
  kind: typeof PRODUCTION_PACKAGE_KIND;
  schemaVersion: 1;
  package: {
    packageId: string;
    lineageId: string;
    revision: number;
    parentPackageId: string | null;
    title: string;
    purpose: ProductionPackagePurpose;
    publisher: string;
    createdAt: string;
    sourceApp: 'jinpok-stido';
    sourceSchema: '1.5';
  };
  sourceWorkspace: {
    id: string;
    name: string;
  };
  manifest: {
    sections: ProductionPackageSectionSelection;
    counts: {
      authors: number;
      series: number;
      novels: number;
      chapters: number;
      characters: number;
      worldviewFiles: number;
    };
    omittedSensitiveFields: string[];
    assetBytes: number;
  };
  payload: {
    authors: AiAuthor[];
    series: Series[];
    novels: Novel[];
  };
}

export interface ProductionPackageImportOptions {
  targetWorkspaceId: string;
  mode: 'copy' | 'merge';
  sections: ProductionPackageSectionSelection;
  selectedAuthorIds: string[];
  selectedNovelIds: string[];
  targetNovelId?: string;
  manuscriptMode?: 'append' | 'replace';
}

export interface ProductionPackageImportResult {
  importedAuthors: number;
  importedSeries: number;
  importedNovels: number;
  mergedNovelTitle?: string;
  receipt: ProductionPackageReceipt;
}
