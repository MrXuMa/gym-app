type Listener = () => void;

let addListener: Listener | null = null;

export function registerBulletinAddListener(listener: Listener | null) {
  addListener = listener;
}

export function requestBulletinAdd() {
  addListener?.();
}
