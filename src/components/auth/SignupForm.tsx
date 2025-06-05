'use client'; // 클라이언트 컴포넌트

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

// shadcn/ui 컴포넌트 import (LoginForm과 동일)
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

// 폼 유효성 검사 스키마 정의 (비밀번호 확인 필드 추가 가능)
const formSchema = z.object({
  email: z.string().email({ message: '올바른 이메일 형식이 아닙니다.' }),
  password: z.string().min(6, { message: '비밀번호는 최소 6자 이상이어야 합니다.' }),
  // passwordConfirm: z.string().min(6, { message: '비밀번호를 다시 확인해주세요.' }),
})
// .refine((data) => data.password === data.passwordConfirm, {
//   message: "비밀번호가 일치하지 않습니다.",
//   path: ["passwordConfirm"], // 오류 메시지를 passwordConfirm 필드에 연결
// });

export function SignupForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
      // passwordConfirm: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    setError(null); // 이전 오류 초기화
    setSuccess(null); // 이전 성공 메시지 초기화

    try {
      // API 라우트로 회원가입 요청 전송
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: values.email, password: values.password }), // 비밀번호 확인 필드는 서버로 전송 안함
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '회원가입 중 오류가 발생했습니다.');
      }

      // 회원가입 성공 처리
      setSuccess(data.message || '회원가입이 완료되었습니다.');
      // 이메일 인증이 필요한 경우, 이메일 확인 메시지 표시 후 로그인 페이지로 리다이렉트 안내
      // 이메일 인증이 필요 없는 경우, 바로 로그인 처리 또는 로그인 페이지로 리다이렉트
      // router.push('/login'); // 예시: 회원가입 후 로그인 페이지로 이동
    } catch (err: any) {
      console.error('회원가입 실패:', err.message);
      setError(err.message); // 사용자에게 오류 메시지 표시
    } finally {
      setLoading(false);
    }
  }

  return (
     <Card className="w-[350px]">
       <CardHeader>
         <CardTitle>회원가입</CardTitle>
         <CardDescription>새로운 계정을 생성해주세요.</CardDescription>
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
             {/* 비밀번호 확인 필드 (필요 시 주석 해제) */}
             {/* <FormField
               control={form.control}
               name="passwordConfirm"
               render={({ field }) => (
                 <FormItem>
                   <FormLabel>비밀번호 확인</FormLabel>
                   <FormControl>
                     <Input placeholder="********" {...field} type="password" />
                   </FormControl>
                   <FormMessage />
                 </FormItem>
               )}
             /> */}
             {error && <p className="text-sm font-medium text-destructive">{error}</p>} {/* 오류 메시지 표시 */}
             {success && <p className="text-sm font-medium text-green-600">{success}</p>} {/* 성공 메시지 표시 */}
             <Button type="submit" className="w-full" disabled={loading}>
               {loading ? '가입 중...' : '회원가입'}
             </Button>
           </form>
         </Form>
       </CardContent>
       <CardFooter className="flex justify-center">
           {/* 로그인 페이지 링크 */}
          <p className="text-sm text-muted-foreground">
             이미 계정이 있으신가요? <a href="/login" className="underline">로그인</a>
          </p>
       </CardFooter>
     </Card>
  );
}
