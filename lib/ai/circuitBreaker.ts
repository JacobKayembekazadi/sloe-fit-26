/**
 * Circuit Breaker for Gemini 3 Flash
 *
 * Provides automatic fallback to Gemini 1.5 when Gemini 3 fails repeatedly.
 * Opens the circuit after consecutive failures, allowing recovery time.
 */

import { AI_CONFIG } from './config';

interface CircuitState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

// In-memory circuit state (resets on cold start, which is fine for serverless)
const circuits: Record<string, CircuitState> = {};

function getCircuit(name: string): CircuitState {
  if (!circuits[name]) {
    circuits[name] = { failures: 0, lastFailure: 0, state: 'closed' };
  }
  return circuits[name];
}

/**
 * Check if Gemini 3 should be bypassed due to circuit breaker
 */
export function shouldBypassGemini3(): boolean {
  // If Gemini 3 is disabled globally, this doesn't matter
  if (!AI_CONFIG.gemini3Enabled) {
    return false;
  }

  const circuit = getCircuit('gemini3');
  const { failureThreshold, recoveryTimeMs } = AI_CONFIG.circuitBreaker;

  if (circuit.state === 'open') {
    // Check if recovery time has passed
    if (Date.now() - circuit.lastFailure > recoveryTimeMs) {
      // Move to half-open: allow one test request
      circuit.state = 'half-open';
      console.log('[CircuitBreaker] Gemini 3 circuit half-open, testing recovery');
      return false;
    }
    // Still in recovery period, bypass Gemini 3
    return true;
  }

  return false;
}

/**
 * Record the result of a Gemini 3 call
 */
export function recordGemini3Result(success: boolean): void {
  const circuit = getCircuit('gemini3');
  const { failureThreshold } = AI_CONFIG.circuitBreaker;

  if (success) {
    // Reset on success
    if (circuit.state === 'half-open') {
      console.log('[CircuitBreaker] Gemini 3 recovered, circuit closed');
    }
    circuit.failures = 0;
    circuit.state = 'closed';
  } else {
    // Record failure
    circuit.failures++;
    circuit.lastFailure = Date.now();

    if (circuit.failures >= failureThreshold) {
      circuit.state = 'open';
      console.error(
        `[CircuitBreaker] Gemini 3 circuit OPEN after ${circuit.failures} failures. ` +
        `Falling back to Gemini 1.5 for ${AI_CONFIG.circuitBreaker.recoveryTimeMs / 1000}s`
      );
    }
  }
}

/**
 * Get current circuit state for monitoring
 */
export function getCircuitStatus(): {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailure: number | null;
  gemini3Enabled: boolean;
} {
  const circuit = getCircuit('gemini3');
  return {
    state: circuit.state,
    failures: circuit.failures,
    lastFailure: circuit.lastFailure || null,
    gemini3Enabled: AI_CONFIG.gemini3Enabled,
  };
}

/**
 * Reset circuit breaker (for testing or manual intervention)
 */
export function resetCircuitBreaker(): void {
  const circuit = getCircuit('gemini3');
  circuit.failures = 0;
  circuit.lastFailure = 0;
  circuit.state = 'closed';
  console.log('[CircuitBreaker] Gemini 3 circuit reset');
}
