import type { ExtensionManifest } from '@/lib/types';
import type { ComicExtensionAdapter } from '@/lib/extensions/types';
import { createHtmlSiteAdapter } from '@/lib/extensions/adapters/html-site';

export function createCustomCssAdapter(
  manifest: ExtensionManifest,
  baseUrlOverride?: string
): ComicExtensionAdapter {
  const cfg = manifest.customConfig;
  if (!cfg) {
    throw new Error(`Custom extension ${manifest.id} is missing customConfig`);
  }

  return createHtmlSiteAdapter(
    {
      manifest,
      popularPath: cfg.popularUrl,
      latestPath: cfg.latestUrl || cfg.popularUrl,
      searchPath: (query) => cfg.searchUrl.replace('{query}', encodeURIComponent(query)),
      itemSelectors: [cfg.itemSelector],
      titleSelectors: [cfg.titleSelector],
      linkSelectors: [cfg.urlSelector],
      coverSelectors: [cfg.coverSelector],
      typeSelectors: [],
      latestChapterSelectors: [],
      detailTitleSelectors: ['h1', '.entry-title', '.post-title'],
      detailCoverSelectors: ['.thumb img', '.summary_image img', 'img'],
      detailSynopsisSelectors: ['.entry-content', '.summary__content', 'p'],
      detailGenreSelectors: ['.mgen a', '.genres-content a'],
      detailStatusSelectors: ['.tsinfo', '.post-status'],
      detailTypeSelectors: ['.tsinfo'],
      chapterListSelectors: [cfg.chapterListSelector],
      pageImageSelectors: [cfg.pageImageSelector],
    },
    baseUrlOverride
  );
}
