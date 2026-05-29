const { config, assertSupabaseConfigured } = require('../config');

function authHeaders(prefer) {
  assertSupabaseConfigured();
  const headers = {
    apikey: config.supabase.serviceKey,
    Authorization: `Bearer ${config.supabase.serviceKey}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers.Prefer = prefer;
  return headers;
}

async function rest(method, path, { body, prefer } = {}) {
  const response = await fetch(`${config.supabase.url}/rest/v1/${path}`, {
    method,
    headers: authHeaders(prefer),
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase ${method} ${path} failed (${response.status}): ${text}`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text.trim() ? JSON.parse(text) : null;
}

async function rpc(functionName, args = {}) {
  const response = await fetch(`${config.supabase.url}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(args),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase RPC ${functionName} failed (${response.status}): ${text}`);
  }

  const text = await response.text();
  return text.trim() ? JSON.parse(text) : null;
}

module.exports = { rest, rpc };
