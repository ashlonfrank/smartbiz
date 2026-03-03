'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Onboarding from '@/components/Onboarding';
import type { BusinessProfile } from '@/lib/types';

const PROFILE_KEY = 'runwayai_profile';

export default function OnboardingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const existing = localStorage.getItem(PROFILE_KEY);
    if (existing) {
      router.replace('/dashboard');
    } else {
      setReady(true);
    }
  }, [router]);

  const handleComplete = (profile: BusinessProfile) => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    // Clear stale data so dashboard loads fresh mock data
    localStorage.removeItem('runwayai_data');
    router.push('/dashboard');
  };

  if (!ready) return null;
  return <Onboarding onComplete={handleComplete} />;
}
