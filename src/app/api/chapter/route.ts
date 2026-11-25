import { NextResponse } from 'next/server';
import { resolveAdapter } from '@/lib/extensions/registry';
import type { ExtensionManifest } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      sourceId: string;
      url: string;
      customManifest?: ExtensionManifest;
      baseUrlOverride?: string;
    };

    if (!body.sourceId || !body.url) {
      return NextResponse.json({ error: 'sourceId dan url wajib diisi' }, { status: 400 });
    }

    const adapter = resolveAdapter(body.sourceId, body.customManifest, body.baseUrlOverride);
    const chapter = await adapter.getChapterPages(body.url);
    return NextResponse.json({ chapter });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal memuat halaman chapter' },
      { status: 500 }
    );
  }
}
