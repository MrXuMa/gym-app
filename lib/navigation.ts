import { router } from 'expo-router';

/** Home dashboard with Welcome + widgets (`(tabs)/index` → `/`). */
export const HOME_PATH = '/' as const;

export function navigateToHome() {
  if (router.canDismiss()) {
    router.dismissAll();
  }
  router.replace(HOME_PATH);
}
