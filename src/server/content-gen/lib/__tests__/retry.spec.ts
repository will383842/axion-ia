/**
 * Sprint 1 Day 2 — Tests `withRetry` helper.
 */

import { describe, expect, it, vi } from "vitest";
import { withRetry } from "../retry";
import { ProviderError } from "../../providers/IProvider";

describe("withRetry — content-gen retry helper", () => {
  it("returns the value on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on retryable error and succeeds on 2nd attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new ProviderError("rate", "rate_limited", "openai", true))
      .mockResolvedValueOnce("ok");

    const result = await withRetry(fn, { delaysMs: [10, 30] });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry on non-retryable ProviderError", async () => {
    const fn = vi.fn().mockRejectedValue(new ProviderError("auth", "auth_failed", "openai", false));

    await expect(withRetry(fn, { delaysMs: [10, 30] })).rejects.toThrow(/auth/);
    expect(fn).toHaveBeenCalledTimes(1); // no retry
  });

  it("throws the last error after maxAttempts retryable failures", async () => {
    const fn = vi.fn().mockRejectedValue(new ProviderError("rate", "rate_limited", "openai", true));

    await expect(withRetry(fn, { maxAttempts: 3, delaysMs: [10, 10, 10] })).rejects.toThrow(/rate/);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("calls onRetry callback before each retry", async () => {
    const onRetry = vi.fn();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new ProviderError("timeout", "timeout", "openai", true))
      .mockResolvedValueOnce("ok");

    await withRetry(fn, { delaysMs: [10, 30], onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry.mock.calls[0]?.[0]).toBe(1); // attempt 1 retried
  });
});
