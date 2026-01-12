import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const userAgent = request.headers.get('user-agent')?.toLowerCase() || '';
  const url = request.nextUrl.clone();
  
  // Lista exaustiva de bots que geram previews
  const bots = [
    'facebookexternalhit',
    'whatsapp',
    'telegrambot',
    'twitterbot',
    'slackbot',
    'discordbot',
    'googlebot',
    'bingbot',
    'linkedinbot',
    'skypeuripreview'
  ];

  const isBot = bots.some(bot => userAgent.includes(bot));
  
  // Intercetamos apenas rotas de produto para o OG dinâmico
  if (isBot && url.pathname.includes('/product/')) {
    const productId = url.pathname.split('/').pop();
    if (productId && !isNaN(Number(productId))) {
      // Redirecionamento interno para o gerador de HTML
      url.pathname = `/api/og`;
      url.searchParams.set('id', productId);
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/product/:id*', '/'],
};
