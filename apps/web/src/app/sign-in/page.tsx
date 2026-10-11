import type { Metadata } from 'next';
import { PageTitle } from '@/components/ui';
import { SignInFlow } from './SignInFlow';

export const metadata: Metadata = { title: 'Sign in' };

function safeNext(next: string | undefined): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/account';
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="max-w-md">
      <PageTitle lead="Sign in or create your RunLime account.">Welcome</PageTitle>
      <SignInFlow next={safeNext(next)} />
    </div>
  );
}
