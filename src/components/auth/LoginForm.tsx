'use client'; // 클라이언트 컴포넌트

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

// shadcn/ui 컴포넌트 import
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

// 폼 유효성 검사 스키마 정의
const formSchema = z.object({
  email: z.string().email({ message: '올바른 이메일 형식이 아닙니다.' }),
  password: z.string().min(6, { message: '비밀번호는 최소 6자 이상이어야 합니다.' }),
});

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // react-hook-form 설정
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // 폼 제출 핸들러
  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    setError(null); // 이전 오류 초기화

    try {
      // API 라우트로 로그인 요청 전송
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok) {
        // API 라우트에서 반환된 오류 처리
        throw new Error(data.error || '로그인 중 오류가 발생했습니다.');
      }

      // 로그인 성공 시 리다이렉트
      router.push('/text-input'); // 텍스트 입력 페이지로 이동 (MVP1 핵심 기능)
      router.refresh(); // 세션 쿠키를 다시 읽어오도록 페이지 새로고침
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 서버 오류가 발생했습니다.';
      console.error('로그인 실패:', errorMessage);
      setError(errorMessage); // 사용자에게 오류 메시지 표시
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>로그인</CardTitle>
        <CardDescription>서비스 이용을 위해 로그인 해주세요.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>이메일</FormLabel>
                  <FormControl>
                    <Input placeholder="name@example.com" {...field} type="email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>비밀번호</FormLabel>
                  <FormControl>
                    <Input placeholder="********" {...field} type="password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error && <p className="text-sm font-medium text-destructive">{error}</p>} {/* 오류 메시지 표시 */}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '로그인 중...' : '로그인'}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-center">
          {/* 회원가입 페이지 링크 (향후 추가) */}
         <p className="text-sm text-muted-foreground">
            계정이 없으신가요? <a href="/signup" className="underline">회원가입</a>
         </p>
      </CardFooter>
    </Card>
  );
}
