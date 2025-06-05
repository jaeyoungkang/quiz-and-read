        // src/app/text-input/page.tsx (신규 파일)
        import { TextInputForm } from '@/components/input/TextInputForm'; // 위에서 만들 컴포넌트 임포트
        import { createClient } from '@/lib/supabase/server';
        import { redirect } from 'next/navigation';

        // 미들웨어에서 보호하지만, 페이지 레벨에서도 인증 확인
        export default async function TextInputPage() {
             const supabase = await createClient();
             const { data: { user } } = await supabase.auth.getUser();

             if (!user) {
               redirect('/login'); // 로그인되지 않은 경우 리다이렉트 (미들웨어와 동일 로직)
             }

            return (
                <div className="container mx-auto p-4">
                    <h2>새로운 텍스트 입력</h2>
                    {/* 텍스트 입력 및 퀴즈 생성 로직을 가진 클라이언트 컴포넌트 */}
                    <TextInputForm />
                </div>
            );
        }
        