import { create } from 'zustand';
import type { StudioWorkspace } from '@core/types';
import {
  createWorkspace as createWorkspaceRecord,
  deleteWorkspace as deleteWorkspaceRecord,
  getWorkspaceUrl,
  initializeWorkspace,
  loadWorkspaceRegistry,
  renameWorkspace as renameWorkspaceRecord,
} from '@services/workspace';

interface WorkspaceState {
  workspaces: StudioWorkspace[];
  activeWorkspace: StudioWorkspace | null;
  isLoading: boolean;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  createWorkspace: (name: string) => Promise<StudioWorkspace>;
  deleteActiveWorkspace: () => Promise<StudioWorkspace>;
  renameActiveWorkspace: (name: string) => Promise<void>;
  switchWorkspace: (workspaceId: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((setState, getState) => ({
  workspaces: [],
  activeWorkspace: null,
  isLoading: true,

  initialize: async () => {
    const { registry, activeWorkspace } = await initializeWorkspace();
    setState({ workspaces: registry.workspaces, activeWorkspace, isLoading: false });
  },

  refresh: async () => {
    const registry = await loadWorkspaceRegistry();
    const activeId = getState().activeWorkspace?.id;
    const refreshedActive = registry.workspaces.find((workspace) => workspace.id === activeId);
    if (activeId && !refreshedActive) {
      const fallback = registry.workspaces[0];
      setState({ workspaces: registry.workspaces, activeWorkspace: fallback });
      window.location.replace(getWorkspaceUrl(fallback.id));
      return;
    }
    setState({
      workspaces: registry.workspaces,
      activeWorkspace: refreshedActive ?? getState().activeWorkspace,
    });
  },

  createWorkspace: async (name) => {
    const workspace = await createWorkspaceRecord(name);
    const registry = await loadWorkspaceRegistry();
    setState({ workspaces: registry.workspaces });
    return workspace;
  },

  deleteActiveWorkspace: async () => {
    const activeWorkspace = getState().activeWorkspace;
    if (!activeWorkspace) {
      throw new Error('현재 작업실을 찾지 못했어요.');
    }
    const { registry, nextWorkspace } = await deleteWorkspaceRecord(activeWorkspace.id);
    setState({ workspaces: registry.workspaces, activeWorkspace: nextWorkspace });
    return nextWorkspace;
  },

  renameActiveWorkspace: async (name) => {
    const activeWorkspace = getState().activeWorkspace;
    if (!activeWorkspace) return;
    const registry = await renameWorkspaceRecord(activeWorkspace.id, name);
    setState({
      workspaces: registry.workspaces,
      activeWorkspace: registry.workspaces.find((workspace) => workspace.id === activeWorkspace.id)
        ?? activeWorkspace,
    });
  },

  switchWorkspace: (workspaceId) => {
    if (workspaceId === getState().activeWorkspace?.id) return;
    window.location.assign(getWorkspaceUrl(workspaceId));
  },
}));
