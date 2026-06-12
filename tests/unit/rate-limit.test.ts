import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkRateLimit,
  decideQuota,
  defaultRateLimitPerMinute,
  resetRateLimitWindows,
  secondsUntilUtcMidnight,
  utcDay,
} from "@/lib/auth/rate-limit";

afterEach(() => {
  resetRateLimitWindows();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("allows up to the limit then rejects within the same window", () => {
    for (let i = 1; i <= 3; i++) {
      const d = checkRateLimit("key-1", 3);
      expect(d.allowed).toBe(true);
      expect(d.remaining).toBe(3 - i);
    }
    const fourth = checkRateLimit("key-1", 3);
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
    expect(fourth.limit).toBe(3);
  });

  it("isolates buckets per key", () => {
    checkRateLimit("key-a", 1);
    expect(checkRateLimit("key-a", 1).allowed).toBe(false);
    expect(checkRateLimit("key-b", 1).allowed).toBe(true);
  });

  it("resets after the 60-second window rolls over", () => {
    vi.useFakeTimers();
    expect(checkRateLimit("key-w", 1).allowed).toBe(true);
    expect(checkRateLimit("key-w", 1).allowed).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(checkRateLimit("key-w", 1).allowed).toBe(true);
  });

  it("reports resetAt as the end of the current window in epoch seconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T00:00:00.000Z"));
    const d = checkRateLimit("key-r", 5);
    expect(d.resetAt).toBe(Math.ceil((Date.now() + 60_000) / 1000));
  });
});

describe("defaultRateLimitPerMinute", () => {
  it("defaults to 60 and rejects non-positive or garbage values", () => {
    vi.stubEnv("PHARMACOPEIA_RATE_LIMIT_PER_MINUTE", "");
    expect(defaultRateLimitPerMinute()).toBe(60);
    vi.stubEnv("PHARMACOPEIA_RATE_LIMIT_PER_MINUTE", "abc");
    expect(defaultRateLimitPerMinute()).toBe(60);
    vi.stubEnv("PHARMACOPEIA_RATE_LIMIT_PER_MINUTE", "0");
    expect(defaultRateLimitPerMinute()).toBe(60);
    vi.stubEnv("PHARMACOPEIA_RATE_LIMIT_PER_MINUTE", "120");
    expect(defaultRateLimitPerMinute()).toBe(120);
  });
});

describe("decideQuota", () => {
  it("allows while usage is at or under the quota", () => {
    expect(decideQuota(100, 99)).toEqual({
      allowed: true,
      limit: 100,
      remaining: 1,
    });
    expect(decideQuota(100, 100)).toEqual({
      allowed: true,
      limit: 100,
      remaining: 0,
    });
    expect(decideQuota(100, 101)).toEqual({
      allowed: false,
      limit: 100,
      remaining: 0,
    });
  });
});

describe("utcDay / secondsUntilUtcMidnight", () => {
  it("buckets by UTC calendar day", () => {
    expect(utcDay(new Date("2026-06-11T23:59:59.999Z"))).toBe("2026-06-11");
    expect(utcDay(new Date("2026-06-12T00:00:00.000Z"))).toBe("2026-06-12");
  });

  it("counts seconds to the next UTC midnight, minimum 1", () => {
    expect(
      secondsUntilUtcMidnight(new Date("2026-06-11T23:59:00.000Z")),
    ).toBe(60);
    expect(
      secondsUntilUtcMidnight(new Date("2026-06-11T00:00:00.000Z")),
    ).toBe(86_400);
    expect(
      secondsUntilUtcMidnight(new Date("2026-06-11T23:59:59.999Z")),
    ).toBe(1);
  });
});
