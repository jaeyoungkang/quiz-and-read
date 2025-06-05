// src/app/quiz/[quizSetId]/page.tsx
import { QuizDisplay } from '@/components/quiz/QuizDisplay';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { User } from '@supabase/supabase-js'; // Supabase User 타입 임포트

interface QuizPageProps {
  params: {
    quizSetId: string;
  };
}

export default async function QuizPage({ params }: QuizPageProps) {
  const quizSetId = params.quizSetId;

  const supabase = await createClient();
  const { data: { user } }: { data: { user: User | null } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // quizSetId 유효성 검사는 QuizDisplay 컴포넌트 또는 API 레벨에서 수행
  // 서버 컴포넌트에서는 최소한의 로직만 유지하는 것이 좋음

  return (
    <div className="container mx-auto p-4">
      <QuizDisplay quizSetId={quizSetId} />
    </div>
  );
}
