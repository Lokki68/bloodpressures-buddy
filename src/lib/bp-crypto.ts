/**
 * Chiffrement local (AES-GCM 256) des données d'automesure.
 * La clé est générée sur l'appareil, non exportable, et conservée dans
 * IndexedDB : le contenu du localStorage est donc illisible tel quel.
 */

const DB_NAME = "bp-secure";
const STORE = "keys";
const KEY_ID = "bp-aes-key";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbDelete(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

let cached: Promise<CryptoKey> | null = null;

function getKey(): Promise<CryptoKey> {
  if (!cached) {
    cached = (async () => {
      const db = await openDb();
      const existing = await idbGet(db, KEY_ID);
      if (existing instanceof CryptoKey) return existing;
      const key = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        false, // non exportable
        ["encrypt", "decrypt"],
      );
      await idbPut(db, KEY_ID, key);
      return key;
    })();
  }
  return cached;
}

const toBase64 = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};

const fromBase64 = (value: string) =>
  Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

export const CIPHER_PREFIX = "enc:v1:";

export function isSupported() {
  return (
    typeof window !== "undefined" &&
    typeof indexedDB !== "undefined" &&
    !!window.crypto?.subtle
  );
}

export async function encryptString(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plaintext),
    ),
  );
  const payload = new Uint8Array(iv.length + ct.length);
  payload.set(iv, 0);
  payload.set(ct, iv.length);
  return CIPHER_PREFIX + toBase64(payload);
}

export async function decryptString(stored: string): Promise<string> {
  const key = await getKey();
  const payload = fromBase64(stored.slice(CIPHER_PREFIX.length));
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: payload.subarray(0, 12) },
    key,
    payload.subarray(12),
  );
  return new TextDecoder().decode(plain);
}

/** Détruit la clé locale : les anciennes données chiffrées deviennent illisibles. */
export async function destroyKey() {
  cached = null;
  if (!isSupported()) return;
  try {
    const db = await openDb();
    await idbDelete(db, KEY_ID);
  } catch {
    /* ignore */
  }
}
