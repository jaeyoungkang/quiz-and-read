import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';

export async function createClient() {
  // Next.js 15+: cookies()는 비동기 함수이므로 await
  const cookieStore = await cookies();

  return createServerClient<Database>(
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
}

// (선택) “읽기 전용” 버전: setAll을 빈 함수로 두어 쿠키 쓰기를 비활성화
export async function createReadOnlyClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // 읽기 전용이므로 아무 동작도 하지 않음
        },
      },
    }
  );
}
