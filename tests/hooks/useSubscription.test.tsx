import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSubscription } from '../../hooks/useSubscription';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

describe('useSubscription', () => {
  it('allows access during active trial', () => {
    const { result } = renderHook(() =>
      useSubscription({
        userProfile: {
          subscription_status: 'trial',
          trial_started_at: new Date().toISOString(),
        },
      })
    );

    expect(result.current.subscription.canAccessPremium).toBe(true);
    expect(result.current.requireSubscription('Test')).toBe(true);
    expect(result.current.showPaywall).toBe(false);
  });

  it('shows paywall when trial expired', () => {
    const { result } = renderHook(() =>
      useSubscription({
        userProfile: {
          subscription_status: 'trial',
          trial_started_at: daysAgo(10),
        },
      })
    );

    expect(result.current.subscription.canAccessPremium).toBe(false);

    let allowed: boolean;
    act(() => {
      allowed = result.current.requireSubscription('AI Workouts');
    });

    expect(allowed!).toBe(false);
    expect(result.current.showPaywall).toBe(true);
    expect(result.current.paywallFeature).toBe('AI Workouts');
  });

  it('allows access with active subscription', () => {
    const { result } = renderHook(() =>
      useSubscription({
        userProfile: {
          subscription_status: 'active',
          subscription_provider: 'stripe',
          subscription_plan: 'monthly',
          subscription_ends_at: daysFromNow(30),
          trial_started_at: daysAgo(30),
        },
      })
    );

    expect(result.current.subscription.canAccessPremium).toBe(true);
    expect(result.current.subscription.provider).toBe('stripe');
  });

  it('handles null userProfile', () => {
    const { result } = renderHook(() =>
      useSubscription({ userProfile: null })
    );

    expect(result.current.subscription.status).toBe('none');
    expect(result.current.subscription.canAccessPremium).toBe(false);
  });

  it('can dismiss paywall', () => {
    const { result } = renderHook(() =>
      useSubscription({
        userProfile: {
          subscription_status: 'expired',
        },
      })
    );

    act(() => {
      result.current.requireSubscription('Feature');
    });
    expect(result.current.showPaywall).toBe(true);

    act(() => {
      result.current.setShowPaywall(false);
    });
    expect(result.current.showPaywall).toBe(false);
  });
});
