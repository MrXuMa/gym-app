import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";

type SupabaseStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

const hasBrowserLocalStorage = () =>
  typeof window !== 'undefined' &&
  typeof window.localStorage?.getItem === "function" &&
  typeof window.localStorage?.setItem === "function" &&
  typeof window.localStorage?.removeItem === "function";

const ExpoSecureStoreAdapter: SupabaseStorage = {
  getItem: (key: string) => {
    if (Platform.OS === 'web') {
      return hasBrowserLocalStorage() ? window.localStorage.getItem(key) : null;
    }

    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === 'web') {
      if (hasBrowserLocalStorage()) {
        window.localStorage.setItem(key, value);
      }

      return;
    }

    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    if (Platform.OS === 'web') {
      if (hasBrowserLocalStorage()) {
        window.localStorage.removeItem(key);
      }

      return;
    }

    return SecureStore.deleteItemAsync(key);
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase URL and Anon Key are missing. Check your .env file and restart the server.',
  );
}

export const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
