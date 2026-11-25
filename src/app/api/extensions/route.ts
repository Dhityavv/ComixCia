import { NextResponse } from 'next/server';
import { getAllBuiltinManifests } from '@/lib/extensions/registry';
import type { ExtensionManifest } from '@/lib/types';

export async function GET() {
  return NextResponse.json({
    extensions: getAllBuiltinManifests(),
    engineInfo: {
      mode: 'direct-and-rest-api',
      requiresApiKey: false,
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { repoUrl?: string };
    if (!body.repoUrl) {
      return NextResponse.json({ error: 'repoUrl wajib diisi' }, { status: 400 });
    }

    const res = await fetch(body.repoUrl, {
      headers: { 'User-Agent': 'ComixCia/1.0', Accept: 'application/json' },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Gagal mengambil repo JSON (HTTP ${res.status})` },
        { status: 400 }
      );
    }

    const data = (await res.json()) as ExtensionManifest[] | { extensions?: ExtensionManifest[] };
    const list = Array.isArray(data) ? data : data.extensions || [];

    const valid = list
      .filter((ext) => ext.id && ext.name && ext.baseUrl)
      .map((ext) => ({
        ...ext,
        isCustom: true,
        isPreinstalled: false,
        scraperEngine: ext.scraperEngine || 'custom-css',
        accentColor: ext.accentColor || '#6366F1',
      }));

    return NextResponse.json({ extensions: valid });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal memproses repo URL' },
      { status: 500 }
    );
  }
}
