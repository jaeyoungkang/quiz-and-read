'use client';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client'; // 클라이언트 클라이언트 임포트
import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();
  const supabase = createClient(); // 클라이언트 클라이언트 생성

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      router.push('/'); // 로그아웃 후 메인 페이지로 리다이렉트
      router.refresh(); // 상태 새로고침
    } else {
      console.error('로그아웃 오류:', error);
      // 오류 처리 로직 추가
    }
  };

  return <Button variant="outline" onClick={handleLogout}>로그아웃</Button>;
}
