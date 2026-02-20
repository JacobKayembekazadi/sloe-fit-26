import { describe, it, expect } from 'vitest';
import {
  getTrialDaysRemaining,
  isTrialExpired,
  getSubscriptionStatus,
} from '../../services/paymentService';

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

describe('getTrialDaysRemaining', () => {
  it('returns 7 for a trial that just started', () => {
    expect(getTrialDaysRemaining(new Date().toISOString())).toBe(7);
  });

  it('returns 4 for a trial started 3 days ago', () => {
    expect(getTrialDaysRemaining(daysAgo(3))).toBe(4);
  });

  it('returns 0 for a trial started 7+ days ago', () => {
    expect(getTrialDaysRemaining(daysAgo(7))).toBe(0);
    expect(getTrialDaysRemaining(daysAgo(30))).toBe(0);
  });

  it('returns 0 for null trialStartedAt', () => {
    expect(getTrialDaysRemaining(null)).toBe(0);
  });

  it('returns 0 for invalid date string', () => {
    expect(getTrialDaysRemaining('not-a-date')).toBe(0);
  });

  it('never returns negative values', () => {
    expect(getTrialDaysRemaining(daysAgo(100))).toBe(0);
  });
});

describe('isTrialExpired', () => {
  it('returns false during active trial', () => {
    expect(isTrialExpired(new Date().toISOString())).toBe(false);
    expect(isTrialExpired(daysAgo(3))).toBe(false);
    expect(isTrialExpired(daysAgo(6))).toBe(false);
  });

  it('returns true after 7 days', () => {
    expect(isTrialExpired(daysAgo(7))).toBe(true);
    expect(isTrialExpired(daysAgo(14))).toBe(true);
  });

  it('returns true for null', () => {
    expect(isTrialExpired(null)).toBe(true);
  });
});

describe('getSubscriptionStatus', () => {
  it('returns canAccessPremium=true for active subscription', () => {
    const result = getSubscriptionStatus({
      subscription_status: 'active',
      subscription_ends_at: daysFromNow(30),
      trial_started_at: daysAgo(30),
    });
    expect(result.status).toBe('active');
    expect(result.canAccessPremium).toBe(true);
  });

  it('returns canAccessPremium=true during active trial', () => {
    const result = getSubscriptionStatus({
      subscription_status: 'trial',
      trial_started_at: new Date().toISOString(),
    });
    expect(result.status).toBe('trial');
    expect(result.canAccessPremium).toBe(true);
    expect(result.trialDaysRemaining).toBe(7);
  });

  it('returns canAccessPremium=false for expired trial', () => {
    const result = getSubscriptionStatus({
      subscription_status: 'trial',
      trial_started_at: daysAgo(10),
    });
    expect(result.canAccessPremium).toBe(false);
    expect(result.isTrialExpired).toBe(true);
  });

  it('returns canAccessPremium=false for explicit expired status', () => {
    const result = getSubscriptionStatus({
      subscription_status: 'expired',
    });
    expect(result.canAccessPremium).toBe(false);
  });

  it('catches webhook failure: active status but ends_at + grace period passed', () => {
    const result = getSubscriptionStatus({
      subscription_status: 'active',
      subscription_ends_at: daysAgo(5), // 5 days past end, > 3-day grace
    });
    expect(result.status).toBe('expired');
    expect(result.canAccessPremium).toBe(false);
  });

  it('allows grace period: active status with recently passed ends_at', () => {
    const result = getSubscriptionStatus({
      subscription_status: 'active',
      subscription_ends_at: daysAgo(1), // 1 day past, within 3-day grace
    });
    expect(result.status).toBe('active');
    expect(result.canAccessPremium).toBe(true);
  });

  it('defaults status to trial when not provided', () => {
    const result = getSubscriptionStatus({});
    expect(result.status).toBe('trial');
  });

  it('handles none status', () => {
    const result = getSubscriptionStatus({
      subscription_status: 'none',
    });
    expect(result.canAccessPremium).toBe(false);
  });
});
