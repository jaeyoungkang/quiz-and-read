import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const { email, password } = await request.json();
  const supabase = await createClient();

  // Supabase Auth를 사용하여 이메일/비밀번호 로그인
  const { error, data } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('로그인 오류:', error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // 로그인 성공 응답
  // data.user, data.session 정보 포함 (필요 시 클라이언트에 전달)
  return NextResponse.json({ message: '로그인 성공', user: data.user });
}
