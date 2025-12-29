import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Automatically redirect to dashboard
    router.push('/dashboard');
  }, []);

  return (
    <>
      <Head>
        <title>HebzConnect</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <img src="/hebzconnect-logo.png" alt="HebzConnect" className="w-48 h-48 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">HebzConnect</h1>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    </>
  );
}
