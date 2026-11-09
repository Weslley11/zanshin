import { getItem, removeItem, setItem } from "./storage";

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
const BASE = `${API_URL}/api/v1`;
const ACCESS = "fluent.access";
const REFRESH = "fluent.refresh";

export class ApiError extends Error {
  status: number;
  code?: string;
  detail: unknown;
  constructor(status: number, message: string, detail: unknown, code?: string) {
    super(message);
    this.status = status;
    this.detail = detail;
    this.code = code;
  }
}

type Tokens = { access_token: string; refresh_token: string };

let accessToken: string | null = null;
let markTokensLoaded: () => void = () => {};
const tokensLoaded = new Promise<void>((resolve) => (markTokensLoaded = resolve));
let onUnauthorized: (() => void) | null = null;
let refreshing: Promise<boolean> | null = null;

export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export async function loadTokens(): Promise<boolean> {
  accessToken = await getItem(ACCESS);
  markTokensLoaded();
  return !!(accessToken || (await getItem(REFRESH)));
}

export async function saveTokens(t: Tokens) {
  accessToken = t.access_token;
  markTokensLoaded();
  await setItem(ACCESS, t.access_token);
  await setItem(REFRESH, t.refresh_token);
}

export async function clearTokens() {
  accessToken = null;
  await removeItem(ACCESS);
  await removeItem(REFRESH);
}

export function authHeader(): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

async function refresh(): Promise<boolean> {
  const rt = await getItem(REFRESH);
  if (!rt) return false;
  const r = await fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: rt }),
  });
  if (!r.ok) {
    await clearTokens();
    return false;
  }
  await saveTokens(await r.json());
  return true;
}

function messageFrom(detail: unknown, fallback: string): { msg: string; code?: string } {
  if (typeof detail === "string") return { msg: detail };
  if (detail && typeof detail === "object") {
    const d = detail as Record<string, unknown>;
    if (Array.isArray(d)) return { msg: "Dados inválidos. Verifique os campos." };
    if (typeof d.message === "string") return { msg: d.message, code: typeof d.code === "string" ? d.code : undefined };
    if (Array.isArray(d.reasons_pt)) return { msg: (d.reasons_pt as string[]).join("\n"), code: d.code as string };
  }
  return { msg: fallback };
}

export async function api<T = any>(
  path: string,
  opts: { method?: string; body?: unknown; form?: FormData; auth?: boolean; raw?: boolean } = {},
): Promise<T> {
  const doFetch = () => {
    const headers: Record<string, string> = { ...(opts.auth === false ? {} : authHeader()) };
    let body: BodyInit | undefined;
    if (opts.form) body = opts.form as unknown as BodyInit;
    else if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.body);
    }
    return fetch(`${BASE}${path}`, { method: opts.method ?? (body ? "POST" : "GET"), headers, body });
  };

  if (opts.auth !== false) await tokensLoaded;
  let r: Response;
  try {
    r = await doFetch();
  } catch {
    throw new ApiError(0, "Sem conexão com o servidor. Verifique sua internet ou o endereço da API.", null, "network");
  }
  if (r.status === 401 && opts.auth !== false) {
    refreshing = refreshing ?? refresh().finally(() => (refreshing = null));
    if (await refreshing) r = await doFetch();
    else {
      onUnauthorized?.();
      throw new ApiError(401, "Sessão expirada. Entre novamente.", null);
    }
  }
  if (r.status === 204) return undefined as T;
  if (opts.raw) return r as unknown as T;
  const isJson = (r.headers.get("content-type") ?? "").includes("application/json");
  const data = isJson ? await r.json() : await r.text();
  if (!r.ok) {
    const detail = isJson ? (data as any).detail : data;
    const { msg, code } = messageFrom(detail, `Erro ${r.status}`);
    throw new ApiError(r.status, msg, detail, code);
  }
  return data as T;
}

export const auth = {
  async login(email: string, password: string) {
    await saveTokens(await api<Tokens>("/auth/login", { body: { email, password }, auth: false }));
  },
  async register(body: Record<string, unknown>) {
    await saveTokens(await api<Tokens>("/auth/register", { body, auth: false }));
  },
  async logout() {
    const rt = await getItem(REFRESH);
    if (rt) await api("/auth/logout", { body: { refresh_token: rt }, auth: false }).catch(() => {});
    await clearTokens();
  },
};
