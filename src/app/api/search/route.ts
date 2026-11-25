import { NextResponse } from 'next/server';
import { resolveAdapter } from '@/lib/extensions/registry';
import { isExactTitleMatch, isExplicit18Plus } from '@/lib/content-filter';
import type {
  ExtensionManifest,
  SearchFilters,
  SourceSearchResult,
} from '@/lib/types';

interface SearchRequestBody {
  mode?: 'search' | 'popular' | 'latest';
  query?: string;
  sourceIds?: string[];
  filters?: SearchFilters;
  customExtensions?: ExtensionManifest[];
  baseUrlOverrides?: Record<string, string>;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SearchRequestBody;
    const mode = body.mode || (body.query?.trim() ? 'search' : 'popular');
    const query = body.query?.trim() || '';
    const sourceIds = body.sourceIds?.length ? body.sourceIds : ['mangadex', 'comick'];
    const customMap = new Map(
      (body.customExtensions || []).map((ext) => [ext.id, ext])
    );

    const tasks = sourceIds.map(async (sourceId): Promise<SourceSearchResult> => {
      const customManifest = customMap.get(sourceId);
      const baseUrlOverride = body.baseUrlOverrides?.[sourceId];
      try {
        const adapter = resolveAdapter(sourceId, customManifest, baseUrlOverride);

        // Filter by language if specified
        if (
          body.filters?.lang &&
          body.filters.lang !== 'all' &&
          adapter.manifest.lang !== 'multi' &&
          adapter.manifest.lang !== body.filters.lang
        ) {
          return {
            sourceId: adapter.manifest.id,
            sourceName: adapter.manifest.name,
            lang: adapter.manifest.lang,
            items: [],
          };
        }

        const page = body.filters?.page || 1;
        const res =
          mode === 'latest'
            ? await adapter.getLatest(page)
            : mode === 'search' && query
              ? await adapter.search(query, body.filters)
              : await adapter.getPopular(page, body.filters);

        const filteredItems = res.items.filter((comic) => {
          if (!isExplicit18Plus(comic)) return true;
          return mode === 'search' && isExactTitleMatch(query, comic.title);
        });

        return {
          sourceId: adapter.manifest.id,
          sourceName: adapter.manifest.name,
          lang: adapter.manifest.lang,
          engineUsed: res.engineUsed,
          items: filteredItems,
        };
      } catch (err) {
        return {
          sourceId,
          sourceName: customManifest?.name || sourceId,
          lang: customManifest?.lang || 'id',
          items: [],
          error: err instanceof Error ? err.message : 'Gagal mengambil data',
        };
      }
    });

    const settled = await Promise.allSettled(tasks);
    const results: SourceSearchResult[] = settled
      .map((s, idx) =>
        s.status === 'fulfilled'
          ? s.value
          : {
              sourceId: sourceIds[idx],
              sourceName: sourceIds[idx],
              lang: 'id' as const,
              items: [],
              error: 'Request gagal',
            }
      )
      .filter((r) => {
        if (!body.filters?.lang || body.filters.lang === 'all') return true;
        return r.lang === 'multi' || r.lang === body.filters.lang;
      });

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Search error' },
      { status: 500 }
    );
  }
}
