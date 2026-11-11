/** Banco local (no aparelho): um documento JSON persistido com AsyncStorage (localStorage no navegador/PWA). */
const KEY = "fluent.local.db.v1";

type Storage = { getItem(k: string): Promise<string | null>; setItem(k: string, v: string): Promise<void>; removeItem(k: string): Promise<void> };
let storage: Storage | null = null;

async function store(): Promise<Storage> {
  if (!storage) storage = (await import("@react-native-async-storage/async-storage")).default as unknown as Storage;
  return storage;
}

/** Permite trocar o armazenamento (testes). */
export function setStorage(s: Storage) {
  storage = s;
}

export type Row = Record<string, any>;
export type DB = {
  version: 1;
  user: Row | null;
  profiles: Record<string, Row>;
  items: Record<string, Row>;
  cards: Record<string, Row>;
  reviews: Row[];
  sessions: Record<string, Row>;
  errors: Record<string, Row>;
  activities: Row[];
  assessments: Record<string, Row>;
  plans: Record<string, Row>;
};

export const emptyDB = (): DB => ({ version: 1, user: null, profiles: {}, items: {}, cards: {}, reviews: [], sessions: {},
  errors: {}, activities: [], assessments: {}, plans: {} });

let db: DB | null = null;
let loading: Promise<DB> | null = null;

export async function getDB(): Promise<DB> {
  if (db) return db;
  loading = loading ?? (async () => {
    try {
      const raw = await (await store()).getItem(KEY);
      db = raw ? { ...emptyDB(), ...JSON.parse(raw) } : emptyDB();
    } catch {
      db = emptyDB();
    }
    return db!;
  })();
  return loading;
}

export async function saveDB(): Promise<void> {
  if (!db) return;
  try {
    await (await store()).setItem(KEY, JSON.stringify(db));
  } catch {
    /* armazenamento cheio ou indisponível: os dados continuam em memória nesta sessão */
  }
}

export async function replaceDB(next: DB): Promise<void> {
  db = { ...emptyDB(), ...next };
  await saveDB();
}

export async function resetDB(): Promise<void> {
  db = emptyDB();
  await (await store()).removeItem(KEY);
}

/** Apenas para testes. */
export function setMemoryDB(next: DB | null) {
  db = next;
  loading = null;
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
export const nowIso = () => new Date().toISOString();
export const todayIso = () => new Date().toISOString().slice(0, 10);
