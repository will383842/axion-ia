// Lot 6 : la console décide. Gardes statiques + règle pure des alertes (aucun IBAN entier nulle part).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const BASE = "src/app/[locale]/(admin)/[adminPrefix]/apporteurs/changements-de-compte";

const auth = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
const valider = vi.hoisted(() => vi.fn());
const refuser = vi.hoisted(() => vi.fn());
vi.mock("../changement-iban", () => ({ validerDemande: valider, refuserDemande: refuser }));

import { refuserChangementCompteAction, validerChangementCompteAction } from "../actions-changement-iban";

const UUID = "11111111-1111-4111-8111-111111111111";
const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

describe("les actions de décision", () => {
  it("refusent hors super_admin, sans appeler le cœur", async () => {
    auth.mockResolvedValue({ user: { id: "u", role: "admin" } });
    const r = await validerChangementCompteAction(fd({ demandeId: UUID, titulaire: "on", iban: "on", rappel: "on", ibanRecopie: "x" }));
    expect(r.ok).toBe(false);
    expect((await refuserChangementCompteAction(fd({ demandeId: UUID, motif: "RIB illisible" }))).ok).toBe(false);
    expect(valider).not.toHaveBeenCalled();
    expect(refuser).not.toHaveBeenCalled();
  });
  it("transmettent les trois cases et le rôle au cœur, qui garde la décision", async () => {
    auth.mockResolvedValue({ user: { id: "u", role: "super_admin" } });
    valider.mockResolvedValue({ ok: true });
    await validerChangementCompteAction(fd({ demandeId: UUID, titulaire: "on", ibanRecopie: "FR76" }));
    expect(valider).toHaveBeenCalledWith(
      expect.objectContaining({ cases: { titulaire: true, iban: false, rappel: false }, acteur: { id: "u", role: "super_admin" } }),
    );
  });
  it("une valeur de retour ne contient jamais l'IBAN recopié", async () => {
    valider.mockResolvedValue({ ok: false, message: "L'IBAN recopié n'est pas celui de la demande." });
    const r = await validerChangementCompteAction(fd({ demandeId: UUID, ibanRecopie: "FR7630006000011234567890189" }));
    expect(JSON.stringify(r)).not.toContain("FR7630006000011234567890189");
  });
  it("refusent un identifiant qui n'est pas un UUID", async () => {
    auth.mockResolvedValue({ user: { id: "u", role: "super_admin" } });
    expect((await refuserChangementCompteAction(fd({ demandeId: "x", motif: "abc" }))).ok).toBe(false);
  });
});

describe("la route du RIB de demande", () => {
  const src = lire(`${BASE}/[demandeId]/rib/route.ts`);
  it("est réservée au super_admin, exige le verdict antivirus et ne se met pas en cache", () => {
    expect(src).toMatch(/super_admin/);
    expect(src).toMatch(/analyserOctets/);
    expect(src).toMatch(/no-store/);
    expect(src).toMatch(/journaliser|journalSansIban/);
  });
});

describe("les écrans", () => {
  it("ne rendent aucun IBAN entier : jamais de lecture de la colonne chiffrée", () => {
    for (const f of [`${BASE}/page.tsx`, `${BASE}/[demandeId]/page.tsx`, "src/features/apporteurs-reseau/requetes-changements-iban.ts"]) {
      const s = lire(f);
      expect(s).not.toMatch(/decryptPii\([^)]*\.iban\b/);
      expect(s).not.toMatch(/select:\s*\{[^}]*\biban:\s*true/);
    }
  });
  it("sont gardés par la garde de pages et rendus à la demande", () => {
    for (const f of [`${BASE}/page.tsx`, `${BASE}/[demandeId]/page.tsx`]) {
      const s = lire(f);
      expect(s).toMatch(/gardePage\(/);
      expect(s).toMatch(/force-dynamic/);
    }
  });
});
