import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { code } = Object.fromEntries(requestUrl.searchParams);

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          // Supabase가 첫 번째로 호출하는 메서드: 쿠키 전체를 배열로 반환해야 합니다
          getAll() {
            return cookieStore.getAll();
          },
          // Supabase가 토큰 갱신 등으로 새로운 쿠키를 설정할 때 호출합니다
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                // options은 Supabase가 전달하는 SerializeOptions 형태이고,
                // Next.js cookieStore.set()도 동일한 필드를 받아들입니다.
                cookieStore.set(name, value, options as CookieOptions)
              );
            } catch (error) {
              // Server Component에서 setAll이 호출될 수 있는데, 이 경우
              // Next.js에서는 실제로 쿠키를 설정할 수 없으므로
              // 개발 모드에서만 경고를 띄우도록 처리합니다.
              if (process.env.NODE_ENV === 'development') {
                console.warn('Failed to set cookies:', error);
              }
            }
          },
        },
      }
    );
    await supabase.auth.exchangeCodeForSession(code);
  }

  // 로그인 또는 인증 후 리다이렉트할 URL 지정
  return NextResponse.redirect(requestUrl.origin);
}
