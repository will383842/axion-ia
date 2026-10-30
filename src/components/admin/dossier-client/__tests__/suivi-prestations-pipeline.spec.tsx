/**
 * Lot B8 : écriture (bornes, vide = NULL), rendu HT + TTC, carte du Résumé, garde de rôle.
 * Base simulée ; horloge figée.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CID = "11111111-1111-4111-8111-111111111111";
const PID = "22222222-2222-4222-8222-222222222222";

const bd = vi.hoisted(() => ({
  projet: { findUnique: vi.fn(), findMany: vi.fn() },
  projetSuivi: { findUnique: vi.fn(), upsert: vi.fn(), findMany: vi.fn() },
  activityLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));
const acces = vi.hoisted(() => ({
  exigerAccesEchanges: vi.fn(),
  AccesRefuse: class AccesRefuse extends Error {},
}));
const queries = vi.hoisted(() => ({ lireProjetsDuClient: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: bd }));
vi.mock("@/features/dossier-client/acces", () => acces);
vi.mock("@/features/dossier-client/queries", () => queries);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/console/${p}` }));
vi.mock("@/features/dossier-client/message-de-retour", () => ({
  avecMessageDeRetour: (u: string, c: string, t: string) => `${u}&${c}=${t}`,
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { enregistrerSuiviPrestationAction } from "@/features/dossier-client/actions-prestations";
import { SuiviPrestations } from "@/components/admin/dossier-client/SuiviPrestations";
import { CartePrestationsResume } from "@/components/admin/dossier-client/fiche/CartePrestationsResume";
import { resumePrestations } from "@/components/admin/dossier-client/fiche/ResumePrestations";
import type { ContexteFiche } from "@/components/admin/dossier-client/fiche/contexte";
import {
  assemblerPrestations,
  lireSuivisDesProjets,
  type PrestationSuivie,
} from "@/features/dossier-client/suivi-prestations";

const formulaire = (o: Record<string, string>): FormData => {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ clientId: CID, projetId: PID, type: "audit", ...o })) {
    fd.set(k, v);
  }
  return fd;
};
const issue = async (fd: FormData): Promise<string> =>
  enregistrerSuiviPrestationAction(fd).then(
    () => "pas de redirection",
    (e: Error) => e.message,
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-30T10:00:00Z"));
  vi.clearAllMocks();
  bd.projet.findUnique.mockResolvedValue({ clientId: CID });
  bd.projetSuivi.upsert.mockResolvedValue({});
  bd.projetSuivi.findUnique.mockResolvedValue(null);
  bd.$transaction.mockImplementation(async (fn: (tx: typeof bd) => Promise<unknown>) => fn(bd));
  acces.exigerAccesEchanges.mockResolvedValue({ userId: "admin-1", role: "admin" });
});
afterEach(() => vi.useRealTimers());

describe("action : chances et clôture", () => {
  it("60 et 2026-12-15 sont écrits", async () => {
    const r = await issue(formulaire({ probabilitePct: "60", cloturePrevueLe: "2026-12-15" }));
    expect(r).toContain("message=Prestation enregistrée.");
    const arg = bd.projetSuivi.upsert.mock.calls[0]![0];
    expect(arg.update.probabilitePct).toBe(60);
    expect(arg.update.cloturePrevueLe).toEqual(new Date("2026-12-15T00:00:00.000Z"));
  });
  it("0 et 100 sont acceptés", async () => {
    for (const v of ["0", "100"]) {
      expect(await issue(formulaire({ probabilitePct: v }))).toContain("message=");
    }
  });
  it("101 et -1 sont refusés, rien n'est écrit", async () => {
    for (const v of ["101", "-1", "abc", "50,5"]) {
      expect(await issue(formulaire({ probabilitePct: v }))).toContain("erreur=");
    }
    expect(bd.projetSuivi.upsert).not.toHaveBeenCalled();
  });
  it("vide = NULL (non estimées, pas de date)", async () => {
    await issue(formulaire({ probabilitePct: "", cloturePrevueLe: "" }));
    const arg = bd.projetSuivi.upsert.mock.calls[0]![0];
    expect(arg.update.probabilitePct).toBeNull();
    expect(arg.update.cloturePrevueLe).toBeNull();
  });
  it("une date invalide est refusée", async () => {
    for (const v of ["2026-02-30", "15/12/2026", "demain"]) {
      expect(await issue(formulaire({ cloturePrevueLe: v }))).toContain("erreur=");
    }
    expect(bd.projetSuivi.upsert).not.toHaveBeenCalled();
  });
  it("champs absents du formulaire : les valeurs existantes ne sont pas touchées", async () => {
    await issue(formulaire({}));
    const arg = bd.projetSuivi.upsert.mock.calls[0]![0];
    expect("probabilitePct" in arg.update).toBe(false);
    expect("cloturePrevueLe" in arg.update).toBe(false);
  });
  it("le rôle est vérifié avant toute lecture ou écriture", async () => {
    acces.exigerAccesEchanges.mockRejectedValue(new Error("REFUS"));
    expect(await issue(formulaire({ probabilitePct: "60" }))).toBe("REFUS");
    expect(bd.projet.findUnique).not.toHaveBeenCalled();
    expect(bd.projetSuivi.upsert).not.toHaveBeenCalled();
  });
});

const presta = (o: Partial<PrestationSuivie> = {}): PrestationSuivie => ({
  projetId: PID,
  numero: "P-1",
  titre: "Audit IA",
  type: "audit",
  etape: "devis_envoye",
  etapeForcee: false,
  montantCents: 450000,
  probabilitePct: 60,
  cloturePrevueLe: "2026-12-15",
  ...o,
});

describe("lecture", () => {
  it("assemblerPrestations porte chances et clôture, null sinon", () => {
    const projets = [{ id: PID, numero: "P-1", titre: "A", statut: "en_cours", devis: [] }];
    const avec = assemblerPrestations(
      projets,
      new Map([
        [
          PID,
          {
            type: "audit",
            etapeForcee: null,
            montantCents: 100,
            probabilitePct: 0,
            cloturePrevueLe: "2026-12-15",
          },
        ],
      ]),
    );
    expect(avec[0]).toMatchObject({ probabilitePct: 0, cloturePrevueLe: "2026-12-15" });
    const sans = assemblerPrestations(projets, new Map());
    expect(sans[0]).toMatchObject({ probabilitePct: null, cloturePrevueLe: null });
  });
  it("lireSuivisDesProjets rend la clôture en AAAA-MM-JJ", async () => {
    bd.projetSuivi.findMany.mockResolvedValue([
      {
        projetId: PID,
        type: "audit",
        etapeForcee: null,
        montantCents: 1,
        probabilitePct: 5,
        cloturePrevueLe: new Date("2026-12-15T00:00:00.000Z"),
      },
    ]);
    const m = await lireSuivisDesProjets([PID]);
    expect(m?.get(PID)?.cloturePrevueLe).toBe("2026-12-15");
  });
});

describe("rendu de l'onglet Prestations", () => {
  const rendre = (p: PrestationSuivie): string =>
    renderToStaticMarkup(
      <SuiviPrestations
        clientId={CID}
        prestations={[p]}
        ficheHref="/fiche"
        message={null}
        erreur={null}
      />,
    );

  it("montant HT + TTC, chances, clôture et pondéré 2 700 € HT", () => {
    const h = rendre(presta());
    expect(h).toContain("4 500 € HT");
    expect(h).toMatch(new RegExp("<span>4 500 € HT</span><span[^>]*>5 400 € TTC</span></dd>"));
    expect(h).not.toContain("(5");
    expect(h).toContain("Chances de signer");
    expect(h).toContain("60 %");
    expect(h).toContain("15 déc.");
    expect(h).toContain("2 700 € HT");
    expect(h).toContain("3 240 € TTC");
    expect(h).not.toMatch(/Probabilité/);
  });
  it("En pause : hors frise, aucune étape courante", () => {
    const h = rendre(presta({ etape: "en_pause", etapeForcee: true }));
    expect(h).not.toContain("aria-current");
    expect(h).toContain("En pause");
  });
  it("sans montant ni chances : tirets et « non estimées », jamais 0 €", () => {
    const h = rendre(presta({ montantCents: null, probabilitePct: null, cloturePrevueLe: null }));
    expect(h).toContain("non estimées");
    expect(h).toContain("non estimée");
    expect(h).not.toContain("0 €");
  });
  it("Terminée ou perdue : pas de montant pondéré", () => {
    for (const etape of ["terminee", "perdue"] as const) {
      expect(rendre(presta({ etape }))).not.toContain("2\u00a0700");
    }
  });
  it("0 % : pondéré à 0 € HT", () => {
    const h = rendre(presta({ montantCents: 450000, probabilitePct: 0 }));
    expect(h).toMatch(
      /Montant pondéré<\/dt><dd><span>0[\s\u00a0\u202f]€[\s\u00a0\u202f]HT<\/span>/,
    );
  });
  it("champs du formulaire existant, zones tactiles et thème clair", () => {
    const h = rendre(presta());
    expect(h).toContain('name="probabilitePct"');
    expect(h).toContain('name="cloturePrevueLe"');
    expect(h).toContain("min-h-11");
    expect(h).not.toContain("dark:");
  });
});

describe("carte du Résumé", () => {
  it("une ligne par prestation en cours, terminées et perdues écartées", () => {
    const h = renderToStaticMarkup(
      <CartePrestationsResume
        ficheHref="/fiche"
        prestations={[
          presta(),
          presta({ projetId: "a", titre: "Finie", etape: "terminee" }),
          presta({ projetId: "b", titre: "Ratée", etape: "perdue" }),
        ]}
      />,
    );
    expect(h).toContain("Audit IA");
    expect(h).not.toContain("Finie");
    expect(h).not.toContain("Ratée");
    expect(h).toContain("4 500 € HT");
    expect(h).toContain("Chances de signer");
    expect(h).toContain('href="/fiche?onglet=prestations"');
    expect(h).toContain("Voir les prestations");
  });

  it("clôture non estimée : « Clôture prévue : non estimée », TTC affiché, pas de séparateur orphelin", () => {
    const h = renderToStaticMarkup(
      <CartePrestationsResume
        ficheHref="/fiche"
        prestations={[presta({ cloturePrevueLe: null })]}
      />,
    );
    expect(h).toContain("Clôture prévue : non estimée");
    expect(h).not.toContain("Clôture prévue le non estimée");
    expect(h).toContain("5 400 € TTC");
  });
});

describe("emplacement du Résumé", () => {
  const ctx = (voitEchanges: boolean): ContexteFiche =>
    ({
      clientId: CID,
      ficheHref: "/fiche",
      voitEchanges,
      maintenant: new Date(),
    }) as unknown as ContexteFiche;

  it("rôle sans accès : null, aucune lecture", async () => {
    expect(await resumePrestations(ctx(false))).toBeNull();
    expect(queries.lireProjetsDuClient).not.toHaveBeenCalled();
    expect(bd.projetSuivi.findMany).not.toHaveBeenCalled();
  });
  it("lecture en panne : « Lecture impossible », pas « rien »", async () => {
    queries.lireProjetsDuClient.mockRejectedValue(new Error("panne"));
    const el = await resumePrestations(ctx(true));
    expect(renderToStaticMarkup(el!)).toContain("Lecture impossible");
  });
  it("suivis illisibles : « Lecture impossible »", async () => {
    queries.lireProjetsDuClient.mockResolvedValue([
      { id: PID, numero: "P-1", titre: "A", statut: "en_cours", devis: [] },
    ]);
    bd.projetSuivi.findMany.mockRejectedValue(new Error("table absente"));
    const el = await resumePrestations(ctx(true));
    expect(renderToStaticMarkup(el!)).toContain("Lecture impossible");
  });
});
