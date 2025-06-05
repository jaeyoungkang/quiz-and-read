// src/components/layout/Header.tsx (예시)
import Link from 'next/link';
import { UserStatusDisplay } from '@/components/auth/UserStatusDisplay'; // UserStatusDisplay 임포트

export function Header() {
  return (
    <header className="p-4 border-b">
      <nav className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold">
          Read & Quiz
        </Link>
        <div>
          <UserStatusDisplay /> {/* 여기서 사용 */}
        </div>
      </nav>
    </header>
  );
}
