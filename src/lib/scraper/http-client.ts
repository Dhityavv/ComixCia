import * as cheerio from 'cheerio';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class MemoryTTLCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private readonly maxEntries = 400;

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
}

export const scraperCache = new MemoryTTLCache();

export interface DirectFetchOptions {
  ttlMs?: number;
  bypassCache?: boolean;
  referer?: string;
}

export interface DirectFetchResult {
  html: string;
  finalUrl: string;
  engineUsed: 'direct-html' | 'cache';
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
];

function pickUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export async function fetchHtmlDirect(
  url: string,
  options: DirectFetchOptions = {}
): Promise<DirectFetchResult> {
  const ttlMs = options.ttlMs ?? 5 * 60 * 1000;
  const cacheKey = `html:${url}`;

  if (!options.bypassCache) {
    const cached = scraperCache.get<DirectFetchResult>(cacheKey);
    if (cached) {
      return { ...cached, engineUsed: 'cache' };
    }
  }

  const timeoutMs = Number(process.env.SCRAPER_TIMEOUT_MS) || 15000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': pickUserAgent(),
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        ...(options.referer ? { Referer: options.referer } : {}),
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} saat mengakses ${url}`);
    }

    const html = await res.text();
    const result: DirectFetchResult = {
      html,
      finalUrl: res.url || url,
      engineUsed: 'direct-html',
    };

    scraperCache.set(cacheKey, result, ttlMs);
    return result;
  } finally {
    clearTimeout(timer);
  }
}

export function loadHtml(html: string) {
  return cheerio.load(html);
}

export function resolveUrl(baseUrl: string, maybeRelative?: string | null): string {
  if (!maybeRelative) return '';
  const trimmed = maybeRelative.trim();
  if (!trimmed || trimmed.startsWith('data:')) return trimmed;
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return trimmed;
  }
}
