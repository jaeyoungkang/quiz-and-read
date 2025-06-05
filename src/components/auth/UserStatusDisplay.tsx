'use client';
import { useAuth } from '@/components/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { LogoutButton } from '@/components/auth/LogoutButton'; // 로그아웃 버튼 컴포넌트

export function UserStatusDisplay() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>로딩 중...</div>;
  }

  if (user) {
    return (
      <div className="flex items-center space-x-2">
        <span>{user.email}님, 환영합니다!</span>
        <LogoutButton /> {/* 로그아웃 버튼 표시 */}
      </div>
    );
  }

  return (
    <div className="space-x-2">
      <Button variant="outline">로그인</Button> {/* 로그인 버튼 표시 */}
      <Button>회원가입</Button> {/* 회원가입 버튼 표시 */}
    </div>
  );
}
