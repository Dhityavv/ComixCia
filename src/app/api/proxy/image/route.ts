import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const imageUrl = req.nextUrl.searchParams.get('url');
  const referer = req.nextUrl.searchParams.get('referer');

  if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
    return new Response('Invalid image URL', { status: 400 });
  }

  try {
    const target = new URL(imageUrl);
    const isMangaDex = target.hostname.includes('mangadex.');
    const isWebtoonCdn =
      target.hostname.includes('pstatic.net') || target.hostname.includes('webtoons.com');

    const headers: Record<string, string> = isMangaDex
      ? {
          'User-Agent': 'ComixCia/1.0',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        }
      : {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          Referer: isWebtoonCdn ? 'https://www.webtoons.com/' : referer || `${target.origin}/`,
        };

    const upstream = await fetch(target.toString(), {
      headers,
      signal: AbortSignal.timeout(15000),
    });

    if (!upstream.ok || !upstream.body) {
      return new Response(`Upstream error ${upstream.status}`, { status: upstream.status || 502 });
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch {
    return new Response('Image proxy failed', { status: 502 });
  }
}
