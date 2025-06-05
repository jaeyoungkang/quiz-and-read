// src/app/api/quizsets/[quizSetId]/answers/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server'; // Your server-side Supabase client
import { User, AuthError } from '@supabase/supabase-js'; // Import AuthError

// Again, using generated Supabase types is highly recommended.
// import { Database } from '@/types/supabase';

interface ApiContext {
  params: {
    quizSetId: string;
  };
}

interface SubmittedAnswerPayload {
    quizId: string;
    submittedAnswer: string;
}

interface RequestBodyPayload {
    userId: string; 
    answers: SubmittedAnswerPayload[];
}

interface SupabaseQuizForGrading {
  id: string;
  correct_answer: string | null;
  quiz_sets: { // Assuming !inner join makes quiz_sets non-null
    id: string; // quiz_set_id, though we already have it from context
    text_id: { // Assuming !inner join makes text_id non-null
      user_id: string;
    } | null; // text_id could still be null if relationship allows and not !inner
  } | null; // quiz_sets could be null if not !inner
}

interface UserAnswerInsert {
    user_id: string;
    quiz_id: string;
    submitted_answer: string;
    is_correct: boolean;
    feedback: string;
    // quiz_set_id?: string; // Optional: if you decide to store it in user_answers
}


export async function POST(request: NextRequest, context: ApiContext) {
  const quizSetId = context.params.quizSetId;

  // Apply the same fix: await createClient() if it's async
  const supabase = await createClient(); // <-- Added await

  const { data: { user }, error: authError }: { data: { user: User | null }; error: AuthError | null } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('Authentication error in POST /api/quizsets/[quizSetId]/answers:', authError?.message);
    return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
  }
  const authenticatedUserId = user.id;

  let requestBody: RequestBodyPayload;
  try {
    requestBody = await request.json();
  } catch (parseError: unknown) {
    const error = parseError instanceof Error ? parseError : new Error('Invalid JSON payload');
    console.error('JSON parsing error:', error.message);
    return NextResponse.json({ error: '잘못된 요청 형식입니다. JSON 본문이 필요합니다.' }, { status: 400 });
  }

  const { userId: clientUserId, answers } = requestBody;

  if (!clientUserId || clientUserId !== authenticatedUserId) {
    console.error(`User ID mismatch: client=${clientUserId}, server=${authenticatedUserId}`);
    return NextResponse.json({ error: '사용자 인증 정보가 일치하지 않습니다.' }, { status: 403 });
  }

  if (!answers || !Array.isArray(answers) || answers.length === 0) {
    return NextResponse.json({ error: '요청 본문에 유효한 "answers" 배열이 필요합니다.' }, { status: 400 });
  }
  const isValidAnswersFormat = answers.every(
    answer => typeof answer.quizId === 'string' && answer.quizId.length > 0 && typeof answer.submittedAnswer === 'string'
  );
  if (!isValidAnswersFormat) {
    return NextResponse.json({ error: 'answers 배열의 형식이 잘못되었습니다.' }, { status: 400 });
  }

  const quizIds = answers.map(answer => answer.quizId);
  const correctAnswersMap: Record<string, string> = {};

  try {
    // Adjust the select query and SupabaseQuizForGrading type carefully based on your actual schema and RLS.
    // Using !inner assumes the related records exist and RLS allows access.
    const { data: quizzesData, error: fetchQuizzesError } = await supabase
      .from('quizzes')
      .select('id, correct_answer, quiz_sets!inner(id, text_id!inner(user_id))')
      .in('id', quizIds)
      .eq('quiz_set_id', quizSetId) // Ensure quizzes belong to the specified quizSetId
      .returns<SupabaseQuizForGrading[]>(); // Specify the expected return type

    if (fetchQuizzesError) {
      console.error('Error fetching correct answers for grading:', fetchQuizzesError.message);
      return NextResponse.json({ error: '정답 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }
    if (!quizzesData || quizzesData.length !== quizIds.length) {
      // This could mean some quizIds were invalid, didn't belong to the quizSetId, or RLS blocked access.
      console.error('Mismatch in fetched quizzes count for grading. Submitted:', quizIds.length, 'Fetched:', quizzesData?.length);
      return NextResponse.json({ error: '제출된 일부 퀴즈 ID가 유효하지 않거나 접근 권한이 없습니다.' }, { status: 400 });
    }
    
    for (const quiz of quizzesData) {
      // The !inner join in the query should ensure quiz_sets and text_id.user_id are present if RLS allows.
      // However, a defensive check is good.
      if (quiz.quiz_sets?.text_id?.user_id !== authenticatedUserId) {
          console.error(`Security alert: Quiz ID ${quiz.id} user_id mismatch. Expected ${authenticatedUserId}, got ${quiz.quiz_sets?.text_id?.user_id}. RLS check needed.`);
          // This is a critical issue if it happens, might indicate RLS bypass or misconfiguration.
          return NextResponse.json({ error: '내부 보안 검증 오류: 퀴즈 소유권 불일치.' }, { status: 500 }); // Or 403
      }
      correctAnswersMap[quiz.id] = quiz.correct_answer || ''; // Default to empty string if correct_answer is null
    }

    // Ensure all submitted quiz IDs were processed and found.
     if (Object.keys(correctAnswersMap).length !== quizIds.length) {
        console.error('Failed to build complete correctAnswersMap. Some submitted quiz IDs were not found or processed.');
        return NextResponse.json({ error: '제출된 답변 중 일부를 처리할 수 없습니다. 유효하지 않은 퀴즈가 포함되어 있을 수 있습니다.' }, { status: 400 });
    }

  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error('An unknown error occurred during answer fetching/validation');
    console.error('Error processing correct answers:', error.message);
    // If the error was a security validation error thrown above, it will be caught here.
    if (error.message.startsWith('내부 보안 검증 오류')) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: '정답 조회 또는 검증 중 서버 오류가 발생했습니다.' }, { status: 500 });
  }

  const results = answers.map(submittedAnswerData => {
    const quizId = submittedAnswerData.quizId;
    const correctAnswerText = correctAnswersMap[quizId] ?? ''; 
    const submittedAnswerText = submittedAnswerData.submittedAnswer.trim().toLowerCase();
    const originalCorrectAnswerText = correctAnswerText.trim();
    const comparableCorrectAnswerText = originalCorrectAnswerText.toLowerCase();

    const isCorrect = submittedAnswerText === comparableCorrectAnswerText;
    const feedback = isCorrect ? '정답입니다!' : `오답입니다. 정답은 "${originalCorrectAnswerText}" 입니다.`;

    return {
      quizId,
      submittedAnswer: submittedAnswerData.submittedAnswer,
      correctAnswer: originalCorrectAnswerText,
      isCorrect,
      feedback,
    };
  });

  const userAnswersInserts: UserAnswerInsert[] = results.map(result => ({
    user_id: authenticatedUserId,
    quiz_id: result.quizId,
    submitted_answer: result.submittedAnswer,
    is_correct: result.isCorrect,
    feedback: result.feedback,
    // ...(quizSetId && { quiz_set_id: quizSetId }) // If user_answers table has quiz_set_id
  }));

  try {
    const { error: insertError } = await supabase
      .from('user_answers')
      .insert(userAnswersInserts);

    if (insertError) {
      console.error('Error saving user answers:', insertError.message);
      return NextResponse.json({ error: `답변 결과 저장에 실패했습니다: ${insertError.message}` }, { status: 500 });
    }
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error('An unknown error occurred during answer saving');
    console.error('Database error during user_answers insert:', error.message);
    return NextResponse.json({ error: '답변 결과 저장 중 서버 오류가 발생했습니다.' }, { status: 500 });
  }

  // Return only the necessary fields for the client's result page
  const clientResponseResults = results.map(r => ({
    quizId: r.quizId,
    submittedAnswer: r.submittedAnswer,
    correctAnswer: r.correctAnswer,
    isCorrect: r.isCorrect,
    feedback: r.feedback,
  }));

  return NextResponse.json({ results: clientResponseResults }, { status: 200 });
}
