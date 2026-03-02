'use client';

import { useRouter } from 'next/navigation';
import Onboarding from '@/components/Onboarding';
import type { BusinessProfile } from '@/lib/types';

const PROFILE_KEY = 'runwayai_profile';

export default function OnboardingPage() {
  const router = useRouter();

  const handleComplete = (profile: BusinessProfile, mode: 'plaid' | 'demo') => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));

    if (mode === 'demo') {
      localStorage.removeItem('runwayai_data');
    }

    router.push('/dashboard');
  };

  return <Onboarding onComplete={handleComplete} />;
}
