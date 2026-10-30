import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { STATUTS_FACTURE_OUVERTE as LOCAL } from "@/server/crm-sync/lire-dossier";
import { STATUTS_FACTURE_OUVERTE } from "@/server/qualiopi/financements/statuts-facture";

describe("statuts de facture ouverte : miroir de la synchro CRM", () => {
  it("la copie locale de la synchro égale l'original du domaine financements", () => {
    expect([...LOCAL].sort()).toEqual([...STATUTS_FACTURE_OUVERTE].sort());
  });
});
