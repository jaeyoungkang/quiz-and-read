'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
// ... 필요한 shadcn/ui 컴포넌트 임포트

// useAuth는 여기서는 필요 없지만, 다른 인증 관련 기능에 필요할 수 있습니다.
// import { useAuth } from '@/components/providers/AuthProvider';

export function TextInputForm() { // 예시 컴포넌트
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    // const { user } = useAuth(); // 사용자 ID는 API에서 서버측 세션으로 확인

    const handleGenerateQuiz = async () => {
        if (!text.trim()) {
            setError('텍스트를 입력해주세요.');
            return;
        }
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/quiz/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // user ID는 서버에서 createClient().auth.getUser()로 가져오므로, 클라이언트에서 명시적으로 보낼 필요 없습니다.
                body: JSON.stringify({ text: text.trim() }),
            });

            const data = await response.json();
            console.log("data")

            if (!response.ok) {
                throw new Error(data.error || '퀴즈 생성에 실패했습니다.');
            }

            // API 응답에서 quizSetId를 받아 퀴즈 풀이 페이지로 리다이렉트
            const quizSetId = data.quizSetId;
            router.push(`/quiz/${quizSetId}`);

        } catch (err: unknown) {
            console.error('퀴즈 생성 오류:', err);
            if(err instanceof Error){
                setError(err.message || '퀴즈 생성 중 오류가 발생했습니다.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        // ... UI 구조 (Textarea, Button 등)
        <div>
            {/* Textarea */}
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="여기에 텍스트를 붙여넣으세요"></textarea>
            {/* Button */}
            <button onClick={handleGenerateQuiz} disabled={loading}>
                {loading ? '생성 중...' : '퀴즈 생성'}
            </button>
            {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
    );
}
