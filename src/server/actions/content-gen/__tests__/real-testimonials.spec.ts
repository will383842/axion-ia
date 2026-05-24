/**
 * Sprint v7 Phase 15 — Tests Real Testimonials marker + filter.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findUniqueMock = vi.fn();
const updateMock = vi.fn();
const findManyMock = vi.fn();
const revalidatePathMock = vi.fn();
const requireAdminWriteRateLimitedMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    testimonial: {
      findUnique: (args: unknown) => findUniqueMock(args),
      update: (args: unknown) => updateMock(args),
      findMany: (args: unknown) => findManyMock(args),
    },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePathMock(p) }));
vi.mock("../_auth", () => ({
  requireAdminWriteRateLimited: (id: string, opts: unknown) =>
    requireAdminWriteRateLimitedMock(id, opts),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const ADMIN_SESSION = { userId: "user-1", email: "a@axion-ia.com", role: "admin" };

beforeEach(() => {
  findUniqueMock.mockReset();
  updateMock.mockReset();
  findManyMock.mockReset();
  revalidatePathMock.mockReset();
  requireAdminWriteRateLimitedMock.mockReset();
  requireAdminWriteRateLimitedMock.mockResolvedValue(ADMIN_SESSION);
  delete process.env.DATABASE_URL;
});

import { markAsRealTestimonial, getRealTestimonialsOnly } from "../real-testimonials";

describe("Phase 15 — Real Testimonials", () => {
  it("RT1: markAsRealTestimonial throw 'testimonial_not_found' si id inconnu", async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    await expect(
      markAsRealTestimonial("missing", {
        source: "https://example.com/proof",
        consentDate: "2026-05-23T10:00:00.000Z",
      }),
    ).rejects.toThrow("testimonial_not_found");
  });

  it("RT2: markAsRealTestimonial injecte realMeta dans displayPages JSON", async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: "t-1",
      displayPages: { otherKey: "preserved" },
    });
    updateMock.mockResolvedValueOnce({});

    await markAsRealTestimonial("t-1", {
      source: "https://example.com/proof",
      consentDate: "2026-05-23T10:00:00.000Z",
      verifiedBy: "Will",
    });

    const updateCall = updateMock.mock.calls[0]?.[0] as {
      data: { displayPages: { otherKey: string; realMeta: { isReal: boolean; source: string } } };
    };
    expect(updateCall.data.displayPages.otherKey).toBe("preserved"); // préservé
    expect(updateCall.data.displayPages.realMeta.isReal).toBe(true);
    expect(updateCall.data.displayPages.realMeta.source).toBe("https://example.com/proof");
    expect(revalidatePathMock).toHaveBeenCalledWith("/fr/presse");
  });

  it("RT3: markAsRealTestimonial valide URL source via Zod", async () => {
    findUniqueMock.mockResolvedValueOnce({ id: "t-1", displayPages: null });
    await expect(
      markAsRealTestimonial("t-1", {
        source: "not-a-url",
        consentDate: "2026-05-23T10:00:00.000Z",
      }),
    ).rejects.toThrow(); // Zod validation fail
  });

  it("RT4: getRealTestimonialsOnly retourne [] en stub.invalid mode build", async () => {
    process.env.DATABASE_URL = "postgresql://stub:stub@stub.invalid:5432/stub";
    const result = await getRealTestimonialsOnly();
    expect(result).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("RT5: getRealTestimonialsOnly filtre uniquement les testimonials marqués isReal:true", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "t-1",
        firstName: "Alice",
        lastName: "Martin",
        role: "CTO",
        company: "Acme",
        shortQuoteFr: "Great",
        photoUrl: null,
        displayPages: {
          realMeta: {
            isReal: true,
            source: "https://acme.com/case",
            consentDate: "2026-01-01T00:00:00.000Z",
          },
        },
      },
      {
        id: "t-2",
        firstName: "Bob",
        lastName: "Dupont",
        role: "CEO",
        company: "Beta",
        shortQuoteFr: "Good",
        photoUrl: null,
        displayPages: null, // pas de realMeta → exclu
      },
      {
        id: "t-3",
        firstName: "Charlie",
        lastName: "Durand",
        role: "Dir",
        company: "Gamma",
        shortQuoteFr: "OK",
        photoUrl: null,
        displayPages: { realMeta: { isReal: false } }, // exclu
      },
    ]);

    const result = await getRealTestimonialsOnly();
    expect(result.length).toBe(1);
    expect(result[0]?.id).toBe("t-1");
    expect(result[0]?.realMeta.source).toBe("https://acme.com/case");
  });
});
