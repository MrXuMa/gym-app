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

/**
 * SecureStore has a ~2 KB per-item soft limit. The Supabase session JSON
 * (JWT + refresh token + user) exceeds that, so we transparently shard the
 * value across `key.0`, `key.1`, ... with a small JSON header stored at `key`.
 */
const CHUNK_SIZE = 1800;
const CHUNK_HEADER_PREFIX = '__chunked__:';

function buildChunkHeader(chunkCount: number): string {
  return `${CHUNK_HEADER_PREFIX}${JSON.stringify({ chunks: chunkCount })}`;
}

function parseChunkHeader(raw: string | null): { chunks: number } | null {
  if (!raw || !raw.startsWith(CHUNK_HEADER_PREFIX)) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw.slice(CHUNK_HEADER_PREFIX.length));
    if (typeof parsed?.chunks === 'number' && parsed.chunks > 0) {
      return { chunks: parsed.chunks };
    }
  } catch {
    return null;
  }

  return null;
}

async function readChunkedSecureStore(key: string): Promise<string | null> {
  const head = await SecureStore.getItemAsync(key);
  const header = parseChunkHeader(head);

  if (!header) {
    return head;
  }

  const parts: string[] = [];
  for (let index = 0; index < header.chunks; index += 1) {
    const part = await SecureStore.getItemAsync(`${key}.${index}`);
    if (part == null) {
      return null;
    }
    parts.push(part);
  }

  return parts.join('');
}

async function clearChunkedSecureStore(key: string): Promise<void> {
  const head = await SecureStore.getItemAsync(key);
  const header = parseChunkHeader(head);

  if (header) {
    for (let index = 0; index < header.chunks; index += 1) {
      await SecureStore.deleteItemAsync(`${key}.${index}`);
    }
  }

  await SecureStore.deleteItemAsync(key);
}

async function writeChunkedSecureStore(key: string, value: string): Promise<void> {
  await clearChunkedSecureStore(key);

  if (value.length <= CHUNK_SIZE) {
    await SecureStore.setItemAsync(key, value);
    return;
  }

  const chunkCount = Math.ceil(value.length / CHUNK_SIZE);
  for (let index = 0; index < chunkCount; index += 1) {
    const slice = value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE);
    await SecureStore.setItemAsync(`${key}.${index}`, slice);
  }

  await SecureStore.setItemAsync(key, buildChunkHeader(chunkCount));
}

const ExpoSecureStoreAdapter: SupabaseStorage = {
  getItem: (key: string) => {
    if (Platform.OS === 'web') {
      return hasBrowserLocalStorage() ? window.localStorage.getItem(key) : null;
    }

    return readChunkedSecureStore(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === 'web') {
      if (hasBrowserLocalStorage()) {
        window.localStorage.setItem(key, value);
      }

      return;
    }

    return writeChunkedSecureStore(key, value);
  },
  removeItem: (key: string) => {
    if (Platform.OS === 'web') {
      if (hasBrowserLocalStorage()) {
        window.localStorage.removeItem(key);
      }

      return;
    }

    return clearChunkedSecureStore(key);
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
