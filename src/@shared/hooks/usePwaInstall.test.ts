import { afterEach, expect, it, vi } from 'vitest';

const subscriptions = vi.hoisted(() => [] as (() => void)[]);
vi.mock('react', () => ({
  useSyncExternalStore: (subscribe: (fn: () => void) => () => void, getSnapshot: () => unknown) => {
    subscriptions.push(subscribe(() => undefined));
    return getSnapshot();
  },
}));
afterEach(() => { subscriptions.splice(0).forEach((unsubscribe) => unsubscribe()); vi.unstubAllGlobals(); });

it('R18 keeps the prompt and installed events while every route subscriber is unmounted', async () => {
  const target = new EventTarget();
  vi.stubGlobal('window', Object.assign(target, { matchMedia: () => ({ matches: false }) }));
  vi.stubGlobal('navigator', {});
  const { usePwaInstall } = await import('./usePwaInstall');
  expect(usePwaInstall().canInstall).toBe(false);
  subscriptions.splice(0).forEach((unsubscribe) => unsubscribe());
  const prompt = vi.fn(async () => undefined);
  target.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt, userChoice: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
  }));
  const remounted = usePwaInstall();
  expect(remounted.canInstall).toBe(true);
  const first = remounted.install();
  expect(await remounted.install()).toBe('unavailable');
  expect(await first).toBe('dismissed');
  expect(prompt).toHaveBeenCalledTimes(1);
  subscriptions.splice(0).forEach((unsubscribe) => unsubscribe());
  target.dispatchEvent(new Event('appinstalled'));
  expect(usePwaInstall().isInstalled).toBe(true);
});
