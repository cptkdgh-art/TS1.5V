const queues = new Map<string, Promise<unknown>>();

/** One queue per resource, including browsers without Web Locks. Never nest the same lock. */
export function withStorageLock<T>(name: string, operation: () => Promise<T>): Promise<T> {
  const pending = (queues.get(name) ?? Promise.resolve()).catch(() => undefined).then(async () => {
    const locks = globalThis.navigator?.locks;
    return locks ? await locks.request(name, operation) : await operation();
  });
  queues.set(name, pending);
  void pending.finally(() => {
    if (queues.get(name) === pending) queues.delete(name);
  }).catch(() => undefined);
  return pending;
}

export const workspaceLockName = (workspaceId: string): string => `jinpok:workspace:${workspaceId}:write`;
export const REGISTRY_LOCK_NAME = 'jinpok:workspace-registry:write';
