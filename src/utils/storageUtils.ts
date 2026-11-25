import type { ViewState } from '../types';

const DB_NAME = 'ImageComparisonDB';
const DB_VERSION = 1;
const STORE_NAME = 'viewState';

/**
 * 開啟 IndexedDB
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * 儲存 ViewState 到 IndexedDB
 */
export async function saveViewState(state: Partial<ViewState>): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // 序列化 Set 為 Array
    const serialized = {
      ...state,
      selectedCards: state.selectedCards ? Array.from(state.selectedCards) : []
    };
    
    store.put(serialized, 'currentState');
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error('Failed to save view state:', error);
  }
}

/**
 * 從 IndexedDB 載入 ViewState
 */
export async function loadViewState(): Promise<Partial<ViewState> | null> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get('currentState');
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close();
        const data = request.result;
        if (data) {
          // 反序列化 Array 為 Set
          data.selectedCards = new Set(data.selectedCards || []);
        }
        resolve(data || null);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Failed to load view state:', error);
    return null;
  }
}

/**
 * 清除儲存的 ViewState
 */
export async function clearViewState(): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete('currentState');
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error('Failed to clear view state:', error);
  }
}

/**
 * 請求持久化儲存權限
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      console.log(`Persistent storage: ${isPersisted ? 'granted' : 'denied'}`);
      return isPersisted;
    } catch (error) {
      console.error('Failed to request persistent storage:', error);
      return false;
    }
  }
  return false;
}

/**
 * 防抖函數 (debounce)
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
