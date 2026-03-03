'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Onboarding from '@/components/Onboarding';
import type { BusinessProfile } from '@/lib/types';

const PROFILE_KEY = 'runwayai_profile';

function OnboardingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // ?fresh=true → wipe everything and always show onboarding from scratch
    // Useful for demo links and reviewers so they don't need incognito
    const fresh = searchParams.get('fresh') === 'true';
    if (fresh) {
      localStorage.removeItem(PROFILE_KEY);
      localStorage.removeItem('runwayai_data');
      setReady(true);
      return;
    }

    const existing = localStorage.getItem(PROFILE_KEY);
    if (existing) {
      router.replace('/dashboard');
    } else {
      setReady(true);
    }
  }, [router, searchParams]);

  const handleComplete = (profile: BusinessProfile) => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    localStorage.removeItem('runwayai_data'); // reload fresh mock data on dashboard
    router.push('/dashboard');
  };

  if (!ready) return null;
  return <Onboarding onComplete={handleComplete} />;
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingInner />
    </Suspense>
  );
}
