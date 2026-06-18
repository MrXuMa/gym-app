import { Alert, Platform } from 'react-native';

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

function combine(title: string, message?: string) {
  return message ? `${title}\n\n${message}` : title;
}

/**
 * Show an informational message. React Native's Alert.alert is a no-op on
 * react-native-web, so fall back to window.alert on web.
 */
export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.alert(combine(title, message));
    }
    return;
  }

  Alert.alert(title, message);
}

/**
 * Cross-platform confirmation dialog. Resolves true when the user confirms,
 * false when they cancel or dismiss. On web, Alert.alert button callbacks never
 * fire, so use window.confirm instead.
 */
export function confirmAsync({
  title,
  message,
  confirmText = 'OK',
  cancelText = 'Cancel',
  destructive = false,
}: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') {
      return Promise.resolve(false);
    }
    return Promise.resolve(window.confirm(combine(title, message)));
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmText,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
