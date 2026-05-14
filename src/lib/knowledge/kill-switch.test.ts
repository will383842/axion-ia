/**
 * KB V4 (Sprint KB-17) — Tests kill switch.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertKillSwitchInactive,
  getKillSwitchStatus,
  KillSwitchEngagedError,
} from "./kill-switch";

describe("kill switch", () => {
  let originalSwitch: string | undefined;
  let originalReason: string | undefined;

  beforeEach(() => {
    originalSwitch = process.env.KB_INGEST_KILL_SWITCH;
    originalReason = process.env.KB_INGEST_KILL_SWITCH_REASON;
  });

  afterEach(() => {
    if (originalSwitch === undefined) delete process.env.KB_INGEST_KILL_SWITCH;
    else process.env.KB_INGEST_KILL_SWITCH = originalSwitch;
    if (originalReason === undefined) delete process.env.KB_INGEST_KILL_SWITCH_REASON;
    else process.env.KB_INGEST_KILL_SWITCH_REASON = originalReason;
  });

  it("status engaged=false par défaut", () => {
    delete process.env.KB_INGEST_KILL_SWITCH;
    expect(getKillSwitchStatus().engaged).toBe(false);
  });

  it("status engaged=true si env=true", () => {
    process.env.KB_INGEST_KILL_SWITCH = "true";
    const s = getKillSwitchStatus();
    expect(s.engaged).toBe(true);
    expect(s.source).toBe("env");
  });

  it("status engaged=false si env=anything-else", () => {
    process.env.KB_INGEST_KILL_SWITCH = "yes"; // pas "true"
    expect(getKillSwitchStatus().engaged).toBe(false);
  });

  it("reason custom remonté", () => {
    process.env.KB_INGEST_KILL_SWITCH = "true";
    process.env.KB_INGEST_KILL_SWITCH_REASON = "Test rollback Sprint 25";
    const s = getKillSwitchStatus();
    expect(s.reason).toBe("Test rollback Sprint 25");
  });

  it("assertKillSwitchInactive NO-OP si inactif", () => {
    delete process.env.KB_INGEST_KILL_SWITCH;
    expect(() => assertKillSwitchInactive()).not.toThrow();
  });

  it("assertKillSwitchInactive throw KillSwitchEngagedError si engaged", () => {
    process.env.KB_INGEST_KILL_SWITCH = "true";
    expect(() => assertKillSwitchInactive()).toThrow(KillSwitchEngagedError);
  });

  it("KillSwitchEngagedError porte status=503", () => {
    const e = new KillSwitchEngagedError("env", "Test");
    expect(e.status).toBe(503);
    expect(e.source).toBe("env");
  });
});
