import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';


export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
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

  // 세션 확인
  const { data: { session } } = await supabase.auth.getSession();

  // 보호된 라우트 목록 (예: /text-input, /quiz/*, /result/*)
  const protectedRoutes = ['/text-input', '/quiz', '/result'];
  const isProtectedRoute = protectedRoutes.some(route => request.nextUrl.pathname.startsWith(route));

  // 로그인되지 않은 사용자가 보호된 라우트에 접근 시 리다이렉트
  if (!session && isProtectedRoute) {
     const redirectUrl = new URL('/login', request.url); // 로그인 페이지 URL (향후 추가)
     redirectUrl.searchParams.set('redirected_from', request.nextUrl.pathname); // 로그인 후 원래 페이지로 리다이렉트 기능 추가 고려
     return NextResponse.redirect(redirectUrl);
  }

  return response; // 세션 쿠키가 업데이트된 응답 반환
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/auth/* (authentication API routes)
     * - auth/* (authentication related pages, e.g., callback)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/auth/|auth/).*)',
  ],
};
