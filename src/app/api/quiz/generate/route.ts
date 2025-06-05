// src/app/api/quiz/generate/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// Constants from before (can be adjusted or removed if Gemini handles them)
const NUMBER_OF_QUIZZES = 3; // Gemini will be asked for this many

// Gemini API Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL_NAME = "gemini-2.0-flash-lite";

if (!GEMINI_API_KEY) {
  console.error("Gemini API key is missing. Please set GEMINI_API_KEY environment variable.");
  // Potentially throw an error here or handle it gracefully if the API is optional
}

// Initialize Gemini Client (do this once if possible, or per request if config changes)
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

export async function POST(request: Request) {
  if (!genAI) {
    return NextResponse.json({ error: 'Gemini API client not initialized. Check API key.' }, { status: 500 });
  }

   // ← 여기서 await를 추가했습니다
   const supabase = await createClient();
   const {
     data: { user },
     error: userError
   } = await supabase.auth.getUser();

   if (userError || !user) {
    console.error('인증 오류:', userError?.message);
    return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
  }
  const userId = user.id;

  // 요청 본문 파싱
  let requestBody: { text?: unknown };
  try {
    requestBody = await request.json();
  } catch (parseError: unknown) {
    if (parseError instanceof Error) {
      console.error('JSON 파싱 오류:', parseError.message);
      return NextResponse.json({ error: '잘못된 요청 형식입니다. JSON 본문이 필요합니다.' }, { status: 400 });
    }
    console.error('Unknown parse error:', parseError);
    return NextResponse.json({ error: '요청 본문 파싱 중 예기치 못한 오류가 발생했습니다.' }, { status: 400 });
  }

  const text = typeof requestBody.text === 'string' ? requestBody.text.trim() : null;
  if (!text) {
    return NextResponse.json({ error: '요청 본문에 유효한 "text" 필드가 필요합니다.' }, { status: 400 });
  }

  // 3. 원문 텍스트 저장
  let textId: string;
  try {
    const { data, error } = await supabase
      .from('texts')
      .insert({ user_id: userId, content: text })
      .select('id')
      .single();

    if (error) {
      // SupabaseError (ApiError)라면 error 타입이 ApiError이므로 message를 바로 쓸 수 있음
      console.error('텍스트 저장 오류:', error.message);
      throw error;
    }
    if (!data) {
      throw new Error('텍스트 저장 결과를 찾을 수 없습니다.');
    }
    textId = data.id;
  } catch (dbError: unknown) {
    if (dbError instanceof Error) {
      console.error('텍스트 저장 중 오류:', dbError.message);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }
    console.error('텍스트 저장 중 예기치 못한 오류 발생:', dbError);
    return NextResponse.json({ error: '텍스트 저장 중 예기치 못한 오류가 발생했습니다.' }, { status: 500 });
  }

  // 4. 퀴즈 세트 생성
  let quizSetId: string;
  try {
    const { data, error } = await supabase
      .from('quiz_sets')
      .insert({ text_id: textId, quiz_type: 'fill_in_the_blank' })
      .select('id')
      .single();

    if (error) {
      console.error('퀴즈 세트 저장 오류:', error.message);
      // 롤백: text 삭제
      await supabase.from('texts').delete().eq('id', textId);
      throw error;
    }
    if (!data) {
      throw new Error('퀴즈 세트 생성 결과를 찾을 수 없습니다.');
    }
    quizSetId = data.id;
  } catch (dbError: unknown) {
    if (dbError instanceof Error) {
      await supabase.from('texts').delete().eq('id', textId);
      console.error('퀴즈 세트 생성 중 오류:', dbError.message);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }
    await supabase.from('texts').delete().eq('id', textId);
    console.error('퀴즈 세트 생성 중 예기치 못한 오류 발생:', dbError);
    return NextResponse.json({ error: '퀴즈 세트 생성 중 예기치 못한 오류가 발생했습니다.' }, { status: 500 });
  }

  // 5. 퀴즈 생성 로직
  let generatedQuizzes: { question: string; correctAnswer: string }[];
  try {
    generatedQuizzes = await generateQuizzesWithGemini(text, NUMBER_OF_QUIZZES);

    if (generatedQuizzes.length === 0) {
      await supabase.from('quiz_sets').delete().eq('id', quizSetId);
      await supabase.from('texts').delete().eq('id', textId);
      return NextResponse.json(
        { error: 'Gemini API가 유효한 퀴즈를 생성하지 못했거나, 제공된 텍스트에서 퀴즈를 만들 수 없습니다.' },
        { status: 422 }
      );
    }
  } catch (quizGenError: unknown) {
    if (quizGenError instanceof Error) {
      console.error('Gemini API 퀴즈 생성 오류:', quizGenError.message);
    } else {
      console.error('예기치 못한 Gemini 오류 발생:', quizGenError);
    }
    await supabase.from('quiz_sets').delete().eq('id', quizSetId);
    await supabase.from('texts').delete().eq('id', textId);
    return NextResponse.json(
      { error: quizGenError instanceof Error ? quizGenError.message : '퀴즈 생성 중 Gemini API 처리 오류가 발생했습니다.' },
      { status: 500 }
    );
  }

  // 6. 생성된 퀴즈들을 quizzes 테이블에 저장
  const quizInserts = generatedQuizzes.map((quiz) => ({
    quiz_set_id: quizSetId,
    type: 'fill_in_the_blank',
    question: quiz.question,
    correct_answer: quiz.correctAnswer,
  }));

  let savedQuizzes: { id: string; question: string; type: string }[];
  try {
    const { data, error } = await supabase
      .from('quizzes')
      .insert(quizInserts)
      .select('id, question, type');

    if (error) {
      console.error('퀴즈 저장 오류:', error.message);
      await supabase.from('quizzes').delete().eq('quiz_set_id', quizSetId);
      await supabase.from('quiz_sets').delete().eq('id', quizSetId);
      await supabase.from('texts').delete().eq('id', textId);
      throw error;
    }
    if (!data) {
      throw new Error('퀴즈 저장 결과를 찾을 수 없습니다.');
    }
    savedQuizzes = data;
  } catch (dbError: unknown) {
    if (dbError instanceof Error) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }
    return NextResponse.json({ error: '퀴즈 저장 중 예기치 못한 오류가 발생했습니다.' }, { status: 500 });
  }

  // 7. 성공 응답 반환
  const quizzesResponse = savedQuizzes.map((quiz) => ({
    quizId: quiz.id,
    type: quiz.type,
    question: quiz.question,
  }));

  return NextResponse.json(
    {
      quizSetId: quizSetId,
      quizzes: quizzesResponse,
    },
    { status: 200 }
  );
}


// Gemini API를 사용하여 퀴즈 생성
async function generateQuizzesWithGemini(text: string, count: number): Promise<{ question: string, correctAnswer: string }[]> {
  if (!genAI) {
    throw new Error("Gemini AI Client not initialized.");
  }

  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL_NAME,
    // It's good practice to set safety settings, especially with user-provided text
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ],
    generationConfig: {
        // responseMimeType: "application/json", // Enable if your model version supports it and you adjust the prompt
        temperature: 1, // Lower for more factual, higher for more creative. Quizzes should be more factual.
        maxOutputTokens: 1024, // Adjust as needed
    }
  });

  // A more robust prompt asking for JSON output
  const prompt = `
    당신은 한국인에게 외국어를 가르치는 영어 교사입니다.
    다음 텍스트에서 영어 학습에 의미 있는 문장 3개를 선별하여 빈칸 채우기 퀴즈를 만드세요
    텍스트:
    """
        ${text}
    """


    각 퀴즈마다:
    1. "question"에는 선별된 문장을  언더스코어들로  대체하세요.
    2. "correctAnswer"에는 대체된 문장을 넣으세요
    3. “hint” 에는 correctAnswer 내용의 한국어 번역을 넣으세요.
    4. “explain” 에는 왜 이 문장이 선별되었는지 설명을 넣으세요.
    중요: 유효한 JSON 객체 배열로만 응답하세요. 배열의 각 객체는 두 개의 문자열 속성인 "question"과 "correctAnswer”,  “hint”, “explain”만 가져야 합니다. JSON 배열 외에는 어떠한 소개 문구, 설명 또는 마크다운 형식을 포함하지 마세요.
    예시 JSON 형식:
    [
    {
        "question": 
        "
        /“Annie, look at this!/” Jack called. /“Look what I found!/”
        Annie had gone up to the hilltop.
        ____________________________
        /“Annie, look! A medallion!/”
        ",
        “correctAnswer”: “She was busy picking a flower from the magnolia tree.”,
        “hint”:”그녀는 목련나무에서 꽃을 꺾느라 바빴다.”,	“explain”: “흔히 사용하는 문장이라서 선정됨”
    }
    ]
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;

    // (1) 블록 사유 확인
    if (response.promptFeedback?.blockReason) {
      const blockReason = response.promptFeedback.blockReason;
      const blockMessage = response.promptFeedback.blockReasonMessage ?? "No additional details provided.";
      console.error(
        `Gemini API blocked the prompt: ${blockReason}. Message: ${blockMessage}`
      );
      console.error(
        "Safety ratings:",
        JSON.stringify(response.promptFeedback.safetyRatings, null, 2)
      );
      throw new Error(
        `Quiz generation failed: Content policy violation (${blockReason}). ${blockMessage}`
      );
    }

    // (2) 후보가 있는지 확인
    if (
      !response.candidates ||
      response.candidates.length === 0 ||
      !response.candidates[0].content
    ) {
      console.error("Gemini API returned no valid candidates in the response.");
      console.error("Full API Response (if available):", JSON.stringify(response, null, 2));
      throw new Error("Gemini API returned no content or an unexpected response structure.");
    }

    // (3) 응답 텍스트 추출
    const responseText = response.text();
    console.log("Raw Gemini API Response Text:", responseText);

    // (4) 공통 LLM 아티팩트 정리
    let cleanedResponseText = responseText.trim();
    if (cleanedResponseText.startsWith("json")) {
      cleanedResponseText = cleanedResponseText.substring(7).trim();
    }
    if (cleanedResponseText.endsWith("")) {
      cleanedResponseText = cleanedResponseText.slice(0, -3).trim();
    }

    // (5) 빈 배열로 반환된 경우
    if (cleanedResponseText === "[]") {
      console.warn("Gemini API indicated no suitable quizzes could be generated (returned '[]').");
      return [];
    }

    // (6) JSON 파싱
    let parsedRaw: unknown;
    try {
      parsedRaw = JSON.parse(cleanedResponseText);
    } catch (firstParseError: unknown) {
      if (firstParseError instanceof Error) {
        console.error("Failed to parse Gemini response as JSON. Error:", firstParseError.message);
      } else {
        console.error("Failed to parse Gemini response as JSON. Unknown error:", firstParseError);
      }
      console.error("Cleaned response text that failed parsing:", cleanedResponseText);

      // (6-1) 문자열 내부에 JSON이 숨어있을 수 있으므로 추출 시도
      const jsonMatch = cleanedResponseText.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
      if (jsonMatch && jsonMatch[0]) {
        console.log("Attempting to parse extracted JSON-like segment...");
        try {
          parsedRaw = JSON.parse(jsonMatch[0]);
          console.log("Successfully parsed extracted segment.");
        } catch (secondParseError: unknown) {
          if (secondParseError instanceof Error) {
            console.error(
              "Failed to parse extracted JSON segment as well. Error:",
              secondParseError.message
            );
          } else {
            console.error("Failed to parse extracted JSON segment as well. Unknown error:", secondParseError);
          }
          throw new Error(
            "Gemini API returned a non-JSON or malformed JSON response, and extraction failed."
          );
        }
      } else {
        throw new Error("Gemini API returned a non-JSON or malformed JSON response.");
      }
    }

    // (7) 배열인지 확인
    if (!Array.isArray(parsedRaw)) {
      console.error("Parsed response is not an array:", parsedRaw);
      throw new Error("Gemini API did not return a JSON array as expected.");
    }

    // (8) 각 항목 검증 및 구조화
    const parsedQuizzes = parsedRaw as unknown[];
    const validatedQuizzes: { question: string; correctAnswer: string }[] = [];

    for (const item of parsedQuizzes) {
      if (
        typeof item === "object" &&
        item !== null
      ) {
        const record = item as Record<string, unknown>;
        const rawQuestion = record["question"];
        const rawAnswer = record["correctAnswer"];

        if (
          typeof rawQuestion === "string" &&
          rawQuestion.trim() !== "" &&
          typeof rawAnswer === "string" &&
          rawAnswer.trim() !== ""
        ) {
          const questionText = rawQuestion.trim();
          const answerText = rawAnswer.trim();

          if (!questionText.includes("____")) {
            console.warn("Generated question does not contain '____'. Skipping:", questionText);
            continue;
          }

          validatedQuizzes.push({
            question: questionText,
            correctAnswer: answerText,
          });
        } else {
          console.warn("Invalid or missing 'question' / 'correctAnswer' fields:", record);
        }
      } else {
        console.warn("Parsed item is not an object. Skipping:", item);
      }
    }

    if (validatedQuizzes.length === 0 && parsedQuizzes.length > 0) {
      console.error("Gemini API returned items, but none passed validation:", parsedQuizzes);
      throw new Error(
        "Gemini API returned quiz items in an unexpected structure or with missing fields."
      );
    }

    // (9) 필요한 수만큼 자르고 반환
    return validatedQuizzes.slice(0, count);
  } catch (unknownError: unknown) {
    let message = "Failed to generate quizzes using Gemini API.";
    if (unknownError instanceof Error) {
      console.error("Error during Gemini API call or processing its response:", unknownError.message);

      // 오류 객체에 추가 정보가 있을 경우 확인
      const responseCandidate = (unknownError as unknown) as Record<string, unknown>;
      if (
        "response" in responseCandidate &&
        typeof responseCandidate["response"] === "object" &&
        responseCandidate["response"] !== null
      ) {
        // responseCandidate["response"]가 object일 때 inspect
        console.error(
          "Gemini Prompt Feedback:",
          JSON.stringify(responseCandidate["response"], null, 2)
        );
      }

      message = `Failed to generate quizzes using Gemini API: ${unknownError.message}`;
    } else {
      console.error("Unknown error during Gemini processing:", unknownError);
    }
    throw new Error(message);
  }
}
