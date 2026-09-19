export interface StudioWorkspace {
  id: string;
  slot: number;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface WorkspaceRegistry {
  schemaVersion: 1;
  workspaces: StudioWorkspace[];
  legacyDataMigrated: boolean;
}

export interface WorkspaceBackupMetadata {
  id: string;
  slot: number;
  name: string;
}
