// src/components/quiz/QuizDisplay.tsx
'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'; // CardDescription 임포트
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Alert 컴포넌트 임포트
import { Terminal } from "lucide-react"; // Alert 아이콘용

// API 응답 및 내부 사용 타입 정의
interface Quiz {
  quizId: string;
  type: string;
  question: string;
}

interface QuizSetApiResponse {
  quizSetId: string;
  quizzes: Quiz[];
}

interface UserAnswerSubmission {
  quizId: string;
  submittedAnswer: string;
}

interface SubmitAnswerRequestBody {
  userId: string;
  answers: UserAnswerSubmission[];
}

interface AnswerResult {
  quizId: string;
  submittedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  feedback: string;
}

interface SubmitAnswerApiResponse {
  results: AnswerResult[];
}

interface QuizDisplayProps {
  quizSetId: string;
}

export function QuizDisplay({ quizSetId }: QuizDisplayProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!quizSetId) {
      setError('퀴즈 세트 ID가 유효하지 않습니다.');
      setLoading(false);
      return;
    }

    const fetchQuizzes = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/quizsets/${quizSetId}`);
        // API 응답이 QuizSetApiResponse 타입임을 명시
        const data: QuizSetApiResponse | { error: string } = await response.json();

        if (!response.ok) {
          const errorMessage = (data as { error: string }).error || '퀴즈 데이터를 불러오는데 실패했습니다.';
          throw new Error(errorMessage);
        }
        
        // 타입 단언을 통해 data가 QuizSetApiResponse임을 확신
        const quizData = data as QuizSetApiResponse;
        setQuizzes(quizData.quizzes);
        const initialAnswers: Record<string, string> = {};
        quizData.quizzes.forEach((quiz) => {
          initialAnswers[quiz.quizId] = '';
        });
        setUserAnswers(initialAnswers);

      } catch (err) {
        console.error('Failed to fetch quizzes:', err);
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('알 수 없는 오류가 발생했습니다.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchQuizzes();
  }, [quizSetId]);

  const handleAnswerChange = (quizId: string, value: string) => {
    setUserAnswers(prevAnswers => ({
      ...prevAnswers,
      [quizId]: value,
    }));
  };

  const handleSubmitAnswers = async (event: FormEvent) => {
    event.preventDefault();

    if (!user) {
      setError('사용자 인증 정보가 없습니다. 다시 로그인 해주세요.');
      setIsSubmitting(false); // 제출 중 상태 해제
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const answersToSubmit: UserAnswerSubmission[] = Object.entries(userAnswers).map(([quizId, submittedAnswer]) => ({
      quizId,
      submittedAnswer: submittedAnswer.trim(),
    }));

    const requestBody: SubmitAnswerRequestBody = {
      userId: user.id,
      answers: answersToSubmit,
    };

    try {
      const response = await fetch(`/api/quizsets/${quizSetId}/answers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // API 응답이 SubmitAnswerApiResponse 또는 에러 객체임을 명시
      const data: SubmitAnswerApiResponse | { error: string } = await response.json();

      if (!response.ok) {
        const errorMessage = (data as { error: string }).error || '답변 제출 중 오류가 발생했습니다.';
        throw new Error(errorMessage);
      }
      
      // 성공 시 결과 페이지로 이동 (결과 데이터는 Result 페이지에서 다시 fetch 할 수도 있음)
      router.push(`/result/${quizSetId}`);

    } catch (err) {
      console.error('Failed to submit answers:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('답변 제출 중 알 수 없는 오류가 발생했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return <div className="text-center py-10">퀴즈 데이터를 불러오는 중...</div>;
  }

  if (error) {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto">
        <Terminal className="h-4 w-4" />
        <AlertTitle>오류 발생</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (quizzes.length === 0 && !loading) { // 로딩 완료 후 퀴즈가 없을 때
       return <div className="text-center py-10">표시할 퀴즈가 없습니다.</div>;
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>퀴즈 풀이</CardTitle>
        <CardDescription>빈칸에 들어갈 알맞은 단어를 입력하세요.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmitAnswers} className="space-y-6">
          {quizzes.map((quiz, index) => (
            <div key={quiz.quizId} className="space-y-3">
              <Label htmlFor={`quiz-${quiz.quizId}`} className="text-base">
                {`${index + 1}. ${quiz.question.replace(/___/g, ' ______ ')}`}
              </Label>
              <Input
                id={`quiz-${quiz.quizId}`}
                type="text"
                placeholder="답변 입력"
                value={userAnswers[quiz.quizId] || ''}
                onChange={(e) => handleAnswerChange(quiz.quizId, e.target.value)}
                disabled={isSubmitting}
                className="text-base"
              />
              {index < quizzes.length - 1 && <Separator className="mt-6"/>}
            </div>
          ))}
          <Button type="submit" className="w-full mt-8 text-lg py-6" disabled={isSubmitting || quizzes.length === 0}>
            {isSubmitting ? '답변 제출 중...' : '답변 제출'}
          </Button>
        </form>
      </CardContent>
      <CardFooter>
        <p className="text-sm text-muted-foreground">퀴즈 세트 ID: {quizSetId}</p>
      </CardFooter>
    </Card>
  );
}
