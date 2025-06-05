    import { NextResponse } from 'next/server';
    import { createClient } from '@/lib/supabase/server';

    export async function POST(request: Request) {
      const { email, password } = await request.json();
      const supabase = await createClient();

      // Supabase Auth를 사용하여 사용자 생성
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`, // 이메일 인증 리다이렉트 URL (필요 시)
        },
      });

      if (error) {
        console.error('회원가입 오류:', error.message);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      // 회원가입 성공 응답
      // 이메일 인증이 필요한 경우, 사용자에게 확인 이메일 발송 안내
      return NextResponse.json({ message: '회원가입 성공. 이메일을 확인해주세요.' });
      // 이메일 인증이 필요 없는 경우, 바로 로그인 처리 또는 로그인 페이지로 리다이렉트
    }
    