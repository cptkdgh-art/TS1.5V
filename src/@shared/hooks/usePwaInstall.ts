import { useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function detectStandalone(): boolean {
  const iosNavigator = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || iosNavigator.standalone === true;
}

let installPrompt: BeforeInstallPromptEvent | null = null;
let isInstalled = typeof window !== 'undefined' && detectStandalone();
const listeners = new Set<() => void>();
let snapshot = { canInstall: false, isInstalled };

function notify() {
  snapshot = { canInstall: Boolean(installPrompt) && !isInstalled, isInstalled };
  listeners.forEach((listener) => listener());
}

// Browser events belong to the application lifetime, not the home route.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    isInstalled = true;
    notify();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

async function install(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const prompt = installPrompt;
  if (!prompt || isInstalled) return 'unavailable';
  installPrompt = null;
  notify();
  await prompt.prompt();
  const choice = await prompt.userChoice;
  if (choice.outcome === 'accepted') {
    isInstalled = true;
    installPrompt = null;
  }
  notify();
  return choice.outcome;
}

export function usePwaInstall() {
  const state = useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
  return { ...state, install };
}
