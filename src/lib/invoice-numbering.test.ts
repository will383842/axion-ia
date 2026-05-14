// Tests Vitest unit pour invoice-numbering helpers.
//
// Pas de DB réelle ici (les concurrence tests vivent en intégration, à
// faire en X.10b avec stripe-mock). Couvre `parseInvoiceNumber` + format
// du numéro retourné par `nextInvoiceNumber` via mock Prisma.

import { describe, it, expect, vi } from "vitest";
import { nextInvoiceNumber, parseInvoiceNumber, INVOICE_PREFIX } from "./invoice-numbering";

describe("parseInvoiceNumber", () => {
  it("parses AXION-2026-0001", () => {
    expect(parseInvoiceNumber("AXION-2026-0001")).toEqual({ year: 2026, sequence: 1 });
  });

  it("parses AXION-2026-9999", () => {
    expect(parseInvoiceNumber("AXION-2026-9999")).toEqual({ year: 2026, sequence: 9999 });
  });

  it("supports 5-digit pivot AXION-2026-10000", () => {
    expect(parseInvoiceNumber("AXION-2026-10000")).toEqual({ year: 2026, sequence: 10000 });
  });

  it("returns null on invalid format", () => {
    expect(parseInvoiceNumber("INVOICE-2026-0001")).toBeNull();
    expect(parseInvoiceNumber("AXION-26-0001")).toBeNull();
    expect(parseInvoiceNumber("AXION-2026-")).toBeNull();
    expect(parseInvoiceNumber("")).toBeNull();
  });

  it("INVOICE_PREFIX is the canonical prefix", () => {
    expect(INVOICE_PREFIX).toBe("AXION");
  });
});

describe("nextInvoiceNumber (mocked tx)", () => {
  it("returns AXION-YYYY-0001 when no existing rows", async () => {
    const tx = {
      $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
      $queryRaw: vi.fn().mockResolvedValue([{ max: null }]),
    } as unknown as Parameters<typeof nextInvoiceNumber>[0];

    const num = await nextInvoiceNumber(tx, 2026);
    expect(num).toBe("AXION-2026-0001");
  });

  it("increments correctly from AXION-2026-0042 → 0043", async () => {
    const tx = {
      $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
      $queryRaw: vi.fn().mockResolvedValue([{ max: "AXION-2026-0042" }]),
    } as unknown as Parameters<typeof nextInvoiceNumber>[0];

    const num = await nextInvoiceNumber(tx, 2026);
    expect(num).toBe("AXION-2026-0043");
  });

  it("resets per-year (year 2027 starts at 0001 even if 2026 has data)", async () => {
    const tx = {
      $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
      $queryRaw: vi.fn().mockResolvedValue([{ max: null }]),
    } as unknown as Parameters<typeof nextInvoiceNumber>[0];

    const num = await nextInvoiceNumber(tx, 2027);
    expect(num).toBe("AXION-2027-0001");
  });

  it("acquires advisory lock before reading max", async () => {
    const tx = {
      $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
      $queryRaw: vi.fn().mockResolvedValue([{ max: null }]),
    } as unknown as Parameters<typeof nextInvoiceNumber>[0];

    await nextInvoiceNumber(tx, 2026);
    // executeRawUnsafe is called before queryRaw
    const lockCall =
      (tx.$executeRawUnsafe as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0] ?? Infinity;
    const readCall =
      (tx.$queryRaw as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0] ?? -Infinity;
    expect(lockCall).toBeLessThan(readCall);
    expect(tx.$executeRawUnsafe).toHaveBeenCalledOnce();
    const callArg = (tx.$executeRawUnsafe as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(callArg).toContain("pg_advisory_xact_lock");
    expect(callArg).toContain("invoice_seq_2026");
  });
});
