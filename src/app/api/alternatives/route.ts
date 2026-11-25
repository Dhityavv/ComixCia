import { NextResponse } from 'next/server';
import { resolveAdapter } from '@/lib/extensions/registry';
import type { ComicSummary, ExtensionManifest } from '@/lib/types';

export interface AlternativeSourceMatch {
  sourceId: string;
  sourceName: string;
  comic: ComicSummary;
  chapterCount: number;
  latestChapter?: string;
}

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/^komik\s+/i, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;

  const wordsA = new Set(na.split(' ').filter((w) => w.length > 1));
  const wordsB = new Set(nb.split(' ').filter((w) => w.length > 1));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  return overlap / Math.max(wordsA.size, wordsB.size);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      title: string;
      currentSourceId: string;
      sourceIds?: string[];
      customExtensions?: ExtensionManifest[];
      baseUrlOverrides?: Record<string, string>;
    };

    if (!body.title?.trim()) {
      return NextResponse.json({ alternatives: [] });
    }

    const cleanQuery = body.title.replace(/^komik\s+/i, '').trim();
    const targetSources = (body.sourceIds || []).filter(
      (id) => id !== body.currentSourceId
    );
    const customMap = new Map(
      (body.customExtensions || []).map((ext) => [ext.id, ext])
    );

    const tasks = targetSources.map(
      async (sourceId): Promise<AlternativeSourceMatch | null> => {
        try {
          const adapter = resolveAdapter(
            sourceId,
            customMap.get(sourceId),
            body.baseUrlOverrides?.[sourceId]
          );
          const searchRes = await adapter.search(cleanQuery, { page: 1 });
          if (!searchRes.items.length) return null;

          // Pick best matching title
          let bestItem: ComicSummary | null = null;
          let bestScore = 0;
          for (const item of searchRes.items.slice(0, 8)) {
            const score = titleSimilarity(cleanQuery, item.title);
            if (score > bestScore) {
              bestScore = score;
              bestItem = item;
            }
          }

          if (!bestItem || bestScore < 0.5) return null;

          const detail = await adapter.getDetail(bestItem.url);
          if (!detail.chapters.length) return null;

          return {
            sourceId: adapter.manifest.id,
            sourceName: adapter.manifest.name,
            comic: {
              ...bestItem,
              coverUrl: detail.coverUrl || bestItem.coverUrl,
              latestChapter: detail.chapters[0]?.title || bestItem.latestChapter,
            },
            chapterCount: detail.chapters.length,
            latestChapter: detail.chapters[0]?.title,
          };
        } catch {
          return null;
        }
      }
    );

    const settled = await Promise.allSettled(tasks);
    const alternatives = settled
      .map((s) => (s.status === 'fulfilled' ? s.value : null))
      .filter((v): v is AlternativeSourceMatch => v !== null)
      .sort((a, b) => b.chapterCount - a.chapterCount);

    return NextResponse.json({ alternatives });
  } catch {
    return NextResponse.json({ alternatives: [] });
  }
}
