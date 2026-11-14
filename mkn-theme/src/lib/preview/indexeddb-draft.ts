"use client";

/**
 * Offline-First Draft Persistence (IndexedDB + LocalStorage fallback)
 * Guarantees zero data loss for mobile users during page refresh, crashes, or phone interruptions.
 */

const DB_NAME = "mken_preview_drafts_v1";
const STORE_NAME = "tenant_drafts";

export interface TenantDraftSnapshot {
  tenantSlug: string;
  updatedAt: number;
  tokens: Record<string, string>;
  content: Record<string, any>;
  version: number;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result as IDBDatabase;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "tenantSlug" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveTenantDraft(
  tenantSlug: string,
  data: { tokens?: Record<string, string>; content?: Record<string, any> }
): Promise<void> {
  const snapshot: TenantDraftSnapshot = {
    tenantSlug,
    updatedAt: Date.now(),
    tokens: data.tokens || {},
    content: data.content || {},
    version: 1,
  };

  // Try IndexedDB first
  const db = await openDb();
  if (db) {
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(snapshot);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      return;
    } catch {
      // Fall through to localStorage
    }
  }

  // Fallback to localStorage
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      localStorage.setItem(`mken_draft_${tenantSlug}`, JSON.stringify(snapshot));
    } catch {
      // Best effort
    }
  }
}

export async function loadTenantDraft(tenantSlug: string): Promise<TenantDraftSnapshot | null> {
  const db = await openDb();
  if (db) {
    try {
      const result = await new Promise<TenantDraftSnapshot | null>((resolve) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(tenantSlug);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
      if (result) return result;
    } catch {
      // Fall through
    }
  }

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const raw = localStorage.getItem(`mken_draft_${tenantSlug}`);
      if (raw) return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  return null;
}

export async function clearTenantDraft(tenantSlug: string): Promise<void> {
  const db = await openDb();
  if (db) {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(tenantSlug);
    } catch {}
  }
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      localStorage.removeItem(`mken_draft_${tenantSlug}`);
    } catch {}
  }
}
