// src/app/api/quizsets/[quizSetId]/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server'; // Your server-side Supabase client
import { User, AuthError } from '@supabase/supabase-js'; // Import AuthError for specific typing

// It's highly recommended to use generated types for your Supabase schema
// e.g., import { Database } from '@/types/supabase';
// Then your SupabaseClient would be SupabaseClient<Database>

interface ApiContext {
  params: {
    quizSetId: string;
  };
}

// Define the expected structure of a quiz from Supabase
interface SupabaseQuiz {
  id: string;
  type: string;
  question: string;
  // Add other fields if your 'quizzes' table has them
}

// Define the expected structure of a quiz_set with its quizzes from Supabase
interface SupabaseQuizSet {
  id: string;
  quizzes: SupabaseQuiz[]; // Expecting an array of quiz objects
  // Add other fields if your 'quiz_sets' table has them
}

export async function GET(request: NextRequest, context: ApiContext) {
  const quizSetId = context.params.quizSetId;

  // The error "Property 'auth' does not exist on type 'Promise<SupabaseClient<...>>'"
  // strongly suggests your createClient() function is async.
  // If so, you MUST await its result.
  const supabase = await createClient(); // <-- Added await

  // Explicitly type the authError as AuthError | null
  const { data: { user }, error: authError }: { data: { user: User | null }; error: AuthError | null } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('Authentication error in GET /api/quizsets/[quizSetId]:', authError?.message);
    return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
  }

  try {
    // RLS policy should ensure user can only access their own data.
    // Specify the expected return type for .single<SupabaseQuizSet>()
    const { data: quizSetData, error: fetchError } = await supabase
      .from('quiz_sets')
      .select(`
        id,
        quizzes (
          id,
          type,
          question
        )
      `)
      .eq('id', quizSetId)
      .single<SupabaseQuizSet>(); // Type assertion for the expected data structure

    if (fetchError) {
      console.error(`Error fetching quiz set ${quizSetId}:`, fetchError.message);
      if (fetchError.code === 'PGRST116') { // PGRST116 usually means "Not found"
        return NextResponse.json({ error: '해당 퀴즈 세트를 찾을 수 없거나 접근 권한이 없습니다.' }, { status: 404 });
      }
      return NextResponse.json({ error: '퀴즈 세트 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }
    
    if (!quizSetData) {
      // This case might also be covered by PGRST116 if RLS prevents access or if it doesn't exist
      return NextResponse.json({ error: '해당 퀴즈 세트를 찾을 수 없습니다 (데이터 없음).' }, { status: 404 });
    }

    // Ensure quizzes property exists and is an array before mapping
    const formattedQuizzes = (quizSetData.quizzes || []).map(quiz => ({
      quizId: quiz.id,
      type: quiz.type,
      question: quiz.question,
    }));

    return NextResponse.json({
      quizSetId: quizSetData.id,
      quizzes: formattedQuizzes,
    }, { status: 200 });

  } catch (e: unknown) {
    // General catch block for unexpected errors
    const errorMessage = e instanceof Error ? e.message : '알 수 없는 서버 오류가 발생했습니다.';
    console.error('Unexpected error in GET /api/quizsets/[quizSetId]:', errorMessage);
    return NextResponse.json({ error: '퀴즈 데이터를 불러오는 중 서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
