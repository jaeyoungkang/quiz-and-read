// types/supabase.ts

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// 1. Database 스키마 타입 정의
//    첨부된 Supabase 스키마 이미지를 참고하여 아래와 같이 테이블 타입을 정의합니다.
//    실제 운영 환경에 맞춰 컬럼이나 타입을 수정하셔도 됩니다.
// ─────────────────────────────────────────────────────────────────────────────

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      /** 사용자가 푼 답안 기록 */
      user_answers: {
        Row: {
          id: string                                // uuid (PK)
          created_at: string                        // timestamptz
          user_id: string                           // uuid (FK → auth.users.id)
          quiz_id: string                           // uuid (FK → quizzes.id)
          submitted_answer: string                  // text
          is_correct: boolean                       // bool
          feedback: string | null                   // text (nullable)
        }
        Insert: {
          id?: string                               // id는 보통 데이터베이스에서 생성되므로 선택적
          created_at?: string                       // created_at도 default 값으로 들어가면 선택적
          user_id: string                           // 필수
          quiz_id: string                           // 필수
          submitted_answer: string                  // 필수
          is_correct?: boolean                      // 기본값이 false일 수 있으므로 선택적
          feedback?: string | null                  // 선택적
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          quiz_id?: string
          submitted_answer?: string
          is_correct?: boolean
          feedback?: string | null
        }
      }

      /** 각 퀴즈 집합(세트)을 정의 */
      quiz_sets: {
        Row: {
          id: string                                // uuid (PK)
          created_at: string                        // timestamptz
          text_id: string                           // uuid (FK → texts.id)
          quiz_type: string                         // text
        }
        Insert: {
          id?: string
          created_at?: string
          text_id: string
          quiz_type: string
        }
        Update: {
          id?: string
          created_at?: string
          text_id?: string
          quiz_type?: string
        }
      }

      /** 실제 퀴즈(문제) 정의 */
      quizzes: {
        Row: {
          id: string                                // uuid (PK)
          created_at: string                        // timestamptz
          quiz_set_id: string                       // uuid (FK → quiz_sets.id)
          type: string                              // text  (예: "fill-in-the-blank", "multiple-choice" 등)
          question: string                          // text
          correct_answer: string                    // text
        }
        Insert: {
          id?: string
          created_at?: string
          quiz_set_id: string
          type: string
          question: string
          correct_answer: string
        }
        Update: {
          id?: string
          created_at?: string
          quiz_set_id?: string
          type?: string
          question?: string
          correct_answer?: string
        }
      }

      /** 텍스트(원문) 저장 */
      texts: {
        Row: {
          id: string                                // uuid (PK)
          created_at: string                        // timestamptz
          user_id: string                           // uuid (FK → auth.users.id)
          content: string                           // text
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          content: string
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          content?: string
        }
      }

      /** 유저 프로필 (auth.users 테이블과 1:1 관계) */
      profiles: {
        Row: {
          id: string                                // uuid (PK, FK → auth.users.id)
        }
        Insert: {
          id: string
        }
        Update: {
          id?: string
        }
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Supabase 클라이언트 인스턴스 생성
//    .env.local (또는 .env)에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정해야 합니다.
// ─────────────────────────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey
)
