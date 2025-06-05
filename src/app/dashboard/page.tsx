// src/app/dashboard/page.tsx

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server'; // 서버용 Supabase 클라이언트
import Link from 'next/link'; // 페이지 이동을 위한 Link 컴포넌트
import { Button } from '@/components/ui/button'; // shadcn/ui 버튼 (예시)

// DashboardPage 함수는 async 함수로 정의하여 서버 컴포넌트에서 데이터 페칭 가능
export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 사용자가 로그인하지 않았다면 로그인 페이지로 리다이렉트
  if (!user) {
    redirect('/login'); // 로그인 페이지 경로
  }

  // 예시: 사용자의 텍스트 목록을 가져오는 로직 (이전 예제와 동일)
  const { data: texts, error: textsError } = await supabase
    .from('texts') // 'texts' 테이블 (프로젝트에 맞게 수정)
    .select('id, content, created_at') // 필요한 컬럼 선택
    .eq('user_id', user.id) // 현재 로그인된 사용자의 user_id와 일치하는 데이터만 선택
    .order('created_at', { ascending: false }); // 최신순으로 정렬

  if (textsError) {
    console.error('Error fetching texts:', textsError.message);
    // 사용자에게 오류 메시지를 보여주거나, 로깅 처리
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">환영합니다, {user.email}님!</h1>
      <p className="mb-6">이곳은 당신의 대시보드입니다. 생성한 퀴즈 목록을 확인하거나 새로운 퀴즈를 만들 수 있습니다.</p>

      <div className="mb-6">
        <Link href="/text-input">
          <Button>새로운 퀴즈 만들기 (텍스트 입력)</Button>
        </Link>
      </div>

      <h2 className="text-xl font-semibold mb-3">나의 텍스트/퀴즈 목록</h2>
      {texts && texts.length > 0 ? (
        <ul className="space-y-3">
          {texts.map((text) => (
            <li key={text.id} className="p-3 border rounded-md shadow-sm">
              <p className="font-medium truncate">{text.content.substring(0, 100)}...</p>
              <p className="text-sm text-gray-500">
                생성일: {new Date(text.created_at).toLocaleDateString()}
              </p>
              {/* 각 텍스트/퀴즈 상세 보기 또는 결과 보기 링크 추가 가능 */}
              {/* 예: <Link href={`/quiz/result/${text.quiz_id_if_any}`}>결과 보기</Link> */}
            </li>
          ))}
        </ul>
      ) : (
        <p>아직 생성한 텍스트나 퀴즈가 없습니다. 지금 바로 새로운 퀴즈를 만들어보세요!</p>
      )}
    </div>
  );
}
