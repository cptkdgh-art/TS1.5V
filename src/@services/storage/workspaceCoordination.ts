import { getRaw } from '@services/storage';
import { withStorageLock, workspaceLockName } from './storageLocks';

export interface WorkspaceLifecycle {
  generation: string;
  deleted?: boolean;
}

export type WorkspaceChange = { workspaceId: string; kind: 'updated' | 'replaced' | 'deleted'; external?: boolean };
const sessions = new Map<string, string>();
const listeners = new Set<(change: WorkspaceChange) => void>();
let channel: BroadcastChannel | undefined;

export const workspaceLifecycleKey = (workspaceId: string): string =>
  `workspace-lifecycle:${workspaceId}`;

export class StaleWorkspaceError extends Error {
  constructor() {
    super('작업실이 복원되거나 삭제되어 이전 저장을 적용할 수 없어요. 작업실을 다시 열어 주세요.');
    this.name = 'StaleWorkspaceError';
  }
}

function getChannel(): BroadcastChannel | undefined {
  if (!channel && typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel('jinpok-workspace-changes');
    channel.onmessage = ({ data }: MessageEvent<WorkspaceChange>) => {
      if (typeof data?.workspaceId === 'string' && ['updated', 'replaced', 'deleted'].includes(data.kind)) {
        for (const listener of listeners) listener({ ...data, external: true });
        window.dispatchEvent(new CustomEvent('jinpok:workspace-changed', { detail: data }));
      }
    };
  }
  return channel;
}

export function subscribeWorkspaceChanges(listener: (change: WorkspaceChange) => void): () => void {
  listeners.add(listener);
  getChannel();
  return () => { listeners.delete(listener); };
}

export function notifyWorkspaceChanged(change: WorkspaceChange): void {
  getChannel()?.postMessage(change);
  for (const listener of listeners) listener(change);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('jinpok:workspace-changed', { detail: change }));
  }
}

/** Capture before starting asynchronous work; pass back as expectedGeneration on commit. */
export const getWorkspaceGeneration = (workspaceId: string): string => sessions.get(workspaceId) ?? 'legacy';

export function withWorkspaceWrite<T>(
  workspaceId: string,
  operation: () => Promise<T>,
  options: { refresh?: boolean; expectedGeneration?: string } = {},
): Promise<T> {
  const expected = options.expectedGeneration ?? sessions.get(workspaceId);
  return withStorageLock(workspaceLockName(workspaceId), async () => {
    const lifecycle = await getRaw<WorkspaceLifecycle>(workspaceLifecycleKey(workspaceId));
    const generation = lifecycle?.generation ?? 'legacy';
    if (lifecycle?.deleted || (!options.refresh && expected !== undefined && expected !== generation)) {
      throw new StaleWorkspaceError();
    }
    sessions.set(workspaceId, generation);
    return operation();
  });
}
