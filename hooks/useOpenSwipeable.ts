import { useRef } from 'react';
import type { Swipeable } from 'react-native-gesture-handler';

/** Ensures only one swipe-to-reveal row stays open at a time within a list or screen. */
export function useOpenSwipeable() {
  const openRef = useRef<Swipeable | null>(null);

  function close() {
    openRef.current?.close();
    openRef.current = null;
  }

  function onWillOpen(ref: Swipeable) {
    if (openRef.current && openRef.current !== ref) {
      openRef.current.close();
    }
    openRef.current = ref;
  }

  return { close, onWillOpen };
}
