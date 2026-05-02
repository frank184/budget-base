const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? "/api" : "http://127.0.0.1:3001");
const EXPIRY_SKEW_MS = 30_000;

const listeners = new Set();

const sessionState = {
  accessToken: null,
  accessTokenExpiresAt: 0,
  user: null,
  bootstrapPromise: null,
  refreshPromise: null
};

function notify() {
  listeners.forEach((listener) =>
    listener({
      accessToken: sessionState.accessToken,
      user: sessionState.user
    })
  );
}

function parseJwtExpiry(token) {
  try {
    const [, payload] = token.split(".");
    const decoded = JSON.parse(window.atob(payload.replaceAll("-", "+").replaceAll("_", "/")));
    return typeof decoded.exp === "number" ? decoded.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

function applySession(payload) {
  sessionState.accessToken = payload?.accessToken || null;
  sessionState.accessTokenExpiresAt = payload?.accessToken ? parseJwtExpiry(payload.accessToken) : 0;
  sessionState.user = payload?.user || null;
  notify();
  return sessionState.user;
}

async function postSession(path) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    credentials: "include"
  });

  if (response.status === 401) {
    applySession(null);
    return null;
  }

  if (!response.ok) {
    throw new Error(`Auth request failed with status ${response.status}.`);
  }

  return applySession(await response.json());
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export function getGoogleLoginUrl() {
  return `${API_BASE_URL}/auth/google/start`;
}

export function getAccessToken() {
  return sessionState.accessToken;
}

export function getCurrentUser() {
  return sessionState.user;
}

export function subscribeToSession(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function bootstrapSession() {
  if (!sessionState.bootstrapPromise) {
    sessionState.bootstrapPromise = postSession("/auth/session").finally(() => {
      sessionState.bootstrapPromise = null;
    });
  }

  return sessionState.bootstrapPromise;
}

export async function refreshSession() {
  if (!sessionState.refreshPromise) {
    sessionState.refreshPromise = postSession("/auth/refresh").finally(() => {
      sessionState.refreshPromise = null;
    });
  }

  return sessionState.refreshPromise;
}

export async function ensureValidAccessToken() {
  if (!sessionState.accessToken) {
    return null;
  }

  if (sessionState.accessTokenExpiresAt - EXPIRY_SKEW_MS > Date.now()) {
    return sessionState.accessToken;
  }

  await refreshSession();
  return sessionState.accessToken;
}

export async function logoutSession() {
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: "include"
    });
  } finally {
    applySession(null);
  }
}
