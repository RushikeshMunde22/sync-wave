import { describe, it, expect } from 'vitest';

function calculateClockOffset(t0: number, ts: number, t1: number): number {
  const rtt = t1 - t0;
  const oneWayLatency = rtt / 2;
  return (ts + oneWayLatency) - t1;
}

function getExpectedPositionMs(
  state: { isPlaying: boolean; positionMs: number; serverTimeMs: number },
  clientNow: number,
  clockOffset: number
): number {
  if (!state.isPlaying) {
    return state.positionMs;
  }
  const estimatedServerNow = clientNow + clockOffset;
  const elapsed = Math.max(0, estimatedServerNow - state.serverTimeMs);
  return state.positionMs + elapsed;
}

function classifyDriftTier(driftMs: number): { tier: 1 | 2 | 3; playbackRate: number; seekRequired: boolean } {
  const abs = Math.abs(driftMs);
  if (abs > 1000) {
    return { tier: 3, playbackRate: 1.0, seekRequired: true };
  }
  if (abs >= 150) {
    const playbackRate = driftMs < 0 ? 1.05 : 0.95;
    return { tier: 2, playbackRate, seekRequired: false };
  }
  return { tier: 1, playbackRate: 1.0, seekRequired: false };
}

describe('SyncWave NTP & Drift Synchronization Math', () => {
  it('correctly calculates clock offset with symmetric network latency', () => {
    // Client sends at t0 = 1000
    // Server receives and responds at ts = 1050 (server is 30ms ahead: server_real = client + 30)
    // Client receives response at t1 = 1040 (RTT = 40ms, latency = 20ms)
    // Server time at t1 is 1050 + 20 = 1070 -> offset = 1070 - 1040 = +30ms
    const t0 = 1000;
    const ts = 1050;
    const t1 = 1040;
    const offset = calculateClockOffset(t0, ts, t1);
    expect(offset).toBe(30);
  });

  it('correctly calculates negative clock offset when server clock is behind client', () => {
    // Client t0 = 2000, t1 = 2060 (RTT = 60ms, latency = 30ms)
    // Server ts = 1980 (server is 50ms behind client)
    // Server time at t1 = 1980 + 30 = 2010 -> offset = 2010 - 2060 = -50ms
    const t0 = 2000;
    const ts = 1980;
    const t1 = 2060;
    const offset = calculateClockOffset(t0, ts, t1);
    expect(offset).toBe(-50);
  });

  it('computes static position when audio is paused', () => {
    const state = {
      isPlaying: false,
      positionMs: 42000,
      serverTimeMs: 1700000000000,
    };
    const clientNow = 1700000005000;
    const offset = 0;
    const expected = getExpectedPositionMs(state, clientNow, offset);
    expect(expected).toBe(42000);
  });

  it('computes elapsed server position when audio is playing', () => {
    const state = {
      isPlaying: true,
      positionMs: 10000,
      serverTimeMs: 100000,
    };
    // Client is at 105000, clock offset is +500 (server time is 105500)
    // Elapsed = 105500 - 100000 = 5500ms
    // Expected position = 10000 + 5500 = 15500ms
    const clientNow = 105000;
    const offset = 500;
    const expected = getExpectedPositionMs(state, clientNow, offset);
    expect(expected).toBe(15500);
  });

  describe('3-Tier Drift Classification', () => {
    it('categorizes drift < 150ms as Tier 1 (nominal sync)', () => {
      const res = classifyDriftTier(80);
      expect(res.tier).toBe(1);
      expect(res.playbackRate).toBe(1.0);
      expect(res.seekRequired).toBe(false);
    });

    it('categorizes drift between 150ms and 1000ms as Tier 2 (micro rate adjustment)', () => {
      // Audio is behind by 300ms -> should speed up to 1.05x
      const behind = classifyDriftTier(-300);
      expect(behind.tier).toBe(2);
      expect(behind.playbackRate).toBe(1.05);
      expect(behind.seekRequired).toBe(false);

      // Audio is ahead by 400ms -> should slow down to 0.95x
      const ahead = classifyDriftTier(400);
      expect(ahead.tier).toBe(2);
      expect(ahead.playbackRate).toBe(0.95);
      expect(ahead.seekRequired).toBe(false);
    });

    it('categorizes drift > 1000ms as Tier 3 (hard resync seek)', () => {
      const hugeLag = classifyDriftTier(-2500);
      expect(hugeLag.tier).toBe(3);
      expect(hugeLag.playbackRate).toBe(1.0);
      expect(hugeLag.seekRequired).toBe(true);

      const hugeLead = classifyDriftTier(3200);
      expect(hugeLead.tier).toBe(3);
      expect(hugeLead.playbackRate).toBe(1.0);
      expect(hugeLead.seekRequired).toBe(true);
    });
  });
});
