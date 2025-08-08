import { describe, it, expect } from 'vitest';

// Copy small pure functions for testing:
const log2 = x => Math.log(x)/Math.log(2);
const ev100From = (N,t) => log2((N*N)/t);
const tvFrom = (N, EV100) => (N*N)/Math.pow(2, EV100);
const avFrom = (t, EV100) => Math.sqrt(Math.pow(2, EV100) * t);

describe('EV math', () => {
  it('round-trip shutter', () => {
    const N = 8, EV = 12;
    const t = tvFrom(N, EV);
    const EV2 = ev100From(N, t);
    expect(Math.abs(EV - EV2)).toBeLessThan(1e-9);
  });

  it('round-trip aperture', () => {
    const t = 1/125, EV = 12;
    const N = avFrom(t, EV);
    const EV2 = ev100From(N, t);
    expect(Math.abs(EV - EV2)).toBeLessThan(1e-9);
  });
});
