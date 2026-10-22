import { uid } from './constants';
import { getToken } from '../services/api';

/**
 * IndexedDB storage for offline & instant local audio caching
 * Matches database "mydeepwork" and store "audio"
 */
export const IDB = (() => {
  let dbp = null;

  const open = () =>
    dbp ||
    (dbp = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return reject(new Error('IndexedDB not supported'));
      }
      const req = window.indexedDB.open('mydeepwork', 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('audio')) {
          req.result.createObjectStore('audio');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbp = null;
        reject(req.error);
      };
    }));

  const tx = async (mode, fn) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction('audio', mode);
      const q = fn(t.objectStore('audio'));
      t.oncomplete = () => resolve(q && q.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  };

  return {
    put: (k, v) => tx('readwrite', s => s.put(v, k)),
    get: k => tx('readonly', s => s.get(k)),
    del: k => tx('readwrite', s => s.delete(k))
  };
})();

/**
 * Format duration in seconds to M:SS
 */
export const fmtDur = (s) => {
  s = Math.max(0, Math.round(s || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Detect best supported audio mime type for recording
 */
export function pickMime() {
  if (typeof window === 'undefined' || !window.MediaRecorder || !MediaRecorder.isTypeSupported) {
    return '';
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/ogg;codecs=opus'
  ];
  return candidates.find(t => {
    try {
      return MediaRecorder.isTypeSupported(t);
    } catch {
      return false;
    }
  }) || '';
}

/**
 * Convert Blob to Base64 data URL
 */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Store audio note: uploads to backend /api/audio/upload, and caches in IndexedDB
 */
export async function storeAudio(blob, dur) {
  if (blob.size > 25 * 1024 * 1024) {
    const err = new Error('That audio is too large. Keep audio notes under 20 minutes.');
    err.userMsg = err.message;
    throw err;
  }

  const baseType = (blob.type || '').split(';')[0].toLowerCase() || 'audio/webm';
  const duration = Math.max(0, Math.round(dur || 0));
  const localKey = 'a' + (uid() + uid()).replace(/[^a-z0-9]/g, '');

  // 1. Try uploading to backend so audio is synced across all devices & shared users
  try {
    const base64Data = await blobToBase64(blob);
    const token = getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    const res = await fetch('/api/audio/upload', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        data: base64Data,
        dur: duration,
        type: baseType,
        name: `audio-${Date.now()}.${baseType.includes('mp4') ? 'm4a' : 'webm'}`
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.src) {
        // Cache locally in IDB for instant playback
        try { await IDB.put(data.src, blob); } catch {}
        return {
          src: data.src,
          dur: data.dur !== undefined ? data.dur : duration,
          type: data.type || baseType
        };
      }
    }
  } catch (netErr) {
    console.warn('Backend audio upload failed, falling back to local IndexedDB storage:', netErr);
  }

  // 2. Fallback to local IndexedDB
  try {
    await IDB.put(localKey, blob);
  } catch {
    const err = new Error("Couldn't save the audio on this device. Free up some space and try again.");
    err.userMsg = err.message;
    throw err;
  }

  return {
    src: 'idb:' + localKey,
    dur: duration,
    type: baseType
  };
}

const audioURLs = {};

/**
 * Resolve audio src (either idb: key or /api/audio/... URL) to a playable URL
 */
export async function audioURL(src) {
  if (!src) return '';
  if (audioURLs[src]) return audioURLs[src];

  if (src.startsWith('idb:')) {
    const key = src.slice(4);
    const b = await IDB.get(key);
    if (!b) throw new Error('missing');
    return (audioURLs[src] = URL.createObjectURL(b));
  }

  // Check if cached in IDB by src path
  try {
    const cached = await IDB.get(src);
    if (cached instanceof Blob) {
      return (audioURLs[src] = URL.createObjectURL(cached));
    }
  } catch {}

  // Otherwise direct backend or external URL
  return src;
}

/**
 * Validate and clean audio metadata
 */
export function cleanAudio(a) {
  if (!a || typeof a !== 'object' || typeof a.src !== 'string') return null;
  const src = a.src.trim();
  if (
    !/^\/api\/audio\/[A-Za-z0-9_-]+$/.test(src) &&
    !/^idb:[a-z0-9]{6,64}$/.test(src) &&
    !/^\/_blob\/[A-Za-z0-9_-]{8,64}$/.test(src) &&
    !/^https?:\/\//.test(src) &&
    !/^data:audio\//.test(src)
  ) {
    return null;
  }
  return {
    src,
    dur: Math.max(0, Math.min(36000, Math.round(+a.dur || 0))),
    type: String(a.type || 'audio/webm').slice(0, 40)
  };
}
