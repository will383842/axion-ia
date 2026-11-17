/**
 * Aucun e-mail ne parle de financement par un tiers (fiche L9, 2026-11-17).
 *
 * Décision du fondateur : l'entreprise n'a pas la certification qualité des
 * organismes de formation. Tant qu'elle ne l'a pas, aucun e-mail ne parle
 * d'un financeur tiers ni d'une « prise en charge ». Les deux gabarits
 * concernés sont EN SOMMEIL : leur code reste, leur émission est coupée par
 * `emailsFinancementTiersActifs()`.
 *
 * Trois gardes, chacune avec son témoin (une garde qui ne regarde rien est
 * verte pour de mauvaises raisons) :
 *  (a) drapeau éteint : chaque point d'émission refuse, sans écriture ni file ;
 *      drapeau allumé : le chemin est inchangé ;
 *  (b) le rendu de tous les autres gabarits, en fr et en, ne contient pas les
 *      mots du financement par un tiers ;
 *  (c) aucun nouveau fichier ne cite l'un des deux noms de gabarit.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  prismaCalls: [] as string[],
  enqueue: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const noeud = (chemin: string[]): unknown =>
    new Proxy(() => undefined, {
      get: (_c, prop) => (prop === "then" ? undefined : noeud([...chemin, String(prop)])),
      apply: () => {
        h.prismaCalls.push(chemin.join("."));
        const m = chemin[chemin.length - 1];
        return Promise.resolve(
          m === "count"
            ? 0
            : m === "findMany"
              ? []
              : m === "aggregate"
                ? { _count: { _all: 0 }, _avg: {}, _sum: {} }
                : null,
        );
      },
    });
  return { prisma: noeud([]) };
});
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: h.enqueue }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-1" }),
  logQualiopiActivity: vi.fn(),
}));

import { renderEmailTemplate, EMAIL_TEMPLATE_NAMES } from "@/lib/email/templates";
import { PAYLOAD_EXEMPLE, VARIANTES_EXEMPLE } from "@/server/email/apercu/payloads-exemple";
import { envoyerDossierEntreprise, envoyerRelance } from "../suivi-entreprise/envoi";
import { passerSuiviEntreprise } from "../suivi-entreprise/passage-quotidien";
import { preparerTransmissionRemboursementOpco } from "../transmission-remboursement-opco";
import { envoyerDossierEntrepriseAction } from "@/server/actions/qualiopi/suivi-entreprise-opco";
import {
  emailsFinancementTiersActifs,
  GABARITS_FINANCEMENT_TIERS_EN_SOMMEIL,
  MESSAGE_EMAIL_EN_SOMMEIL,
} from "../sommeil";

const DB_STUB = "postgresql://test:test@localhost:5432/test";
const UUID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  h.prismaCalls.length = 0;
  h.enqueue.mockReset();
  h.enqueue.mockResolvedValue({ enqueued: true });
  vi.stubEnv("OPCO_SUIVI_ENTREPRISE_ENABLED", "true");
  vi.stubEnv("DATABASE_URL", DB_STUB);
});
afterEach(() => vi.unstubAllEnvs());

// ── (a) Les points d'émission ──────────────────────────────────────────────

/** Le contexte minimal d'une relance : sans adresse, pour que le témoin n'écrive rien. */
const contexteRelance = {
  suivi: { id: "s1" },
  entreprise: { contactEmail: " " },
  brut: {},
} as never;
const relanceDue = { etape: "relance_depot", rang: 1 } as never;

describe("(a) drapeau éteint : rien n'est écrit ni envoyé", () => {
  beforeEach(() => vi.stubEnv("QUALIOPI_CERTIFICATION_OBTENUE", "false"));

  it("la fonction de sommeil rend faux", () => {
    expect(emailsFinancementTiersActifs()).toBe(false);
  });

  it("envoi du dossier (automatique et bouton de la console) : refus explicite", async () => {
    for (const mode of ["auto", "manuel"] as const) {
      const r = await envoyerDossierEntreprise({ dossierId: UUID, mode });
      expect(r).toMatchObject({
        ok: false,
        raison: "en_sommeil",
        message: MESSAGE_EMAIL_EN_SOMMEIL,
      });
    }
    expect(h.prismaCalls).toEqual([]);
    expect(h.enqueue).not.toHaveBeenCalled();
  });

  it("le bouton de la console affiche une phrase neutre", async () => {
    const r = await envoyerDossierEntrepriseAction({ dossierId: UUID });
    expect(r).toEqual({ error: "Cet e-mail est désactivé pour le moment." });
    expect(MESSAGE_EMAIL_EN_SOMMEIL).not.toMatch(/opco|certification|qualiopi|financ/i);
    expect(h.prismaCalls).toEqual([]);
    expect(h.enqueue).not.toHaveBeenCalled();
  });

  it("relance : refus, rien n'est écrit", async () => {
    expect(await envoyerRelance(contexteRelance, relanceDue, new Date())).toBe("en_sommeil");
    expect(h.prismaCalls).toEqual([]);
    expect(h.enqueue).not.toHaveBeenCalled();
  });

  it("passage quotidien : saute sans erreur, sans lire ni écrire", async () => {
    const bilan = await passerSuiviEntreprise(new Date("2026-11-18T07:30:00Z"));
    expect(bilan).toMatchObject({ enSommeil: true, envoisAuto: 0, relances: 0, echecs: 0 });
    expect(h.prismaCalls).toEqual([]);
    expect(h.enqueue).not.toHaveBeenCalled();
  });

  it("pièces de remboursement : refus, aucune ligne « à valider », aucune mise en file", async () => {
    expect(await preparerTransmissionRemboursementOpco("facture-1")).toEqual({
      statut: "en_sommeil",
      raison: "en_sommeil",
    });
    expect(h.prismaCalls).toEqual([]);
    expect(h.enqueue).not.toHaveBeenCalled();
  });
});

describe("(a) témoin — drapeau allumé : le chemin est inchangé", () => {
  beforeEach(() => vi.stubEnv("QUALIOPI_CERTIFICATION_OBTENUE", "true"));

  it("chaque point d'émission atteint la base (il ne refuse plus)", async () => {
    expect(emailsFinancementTiersActifs()).toBe(true);
    const envoi = await envoyerDossierEntreprise({ dossierId: UUID, mode: "manuel" });
    expect(envoi).toMatchObject({ ok: false, motif: "introuvable" });
    expect(h.prismaCalls.length).toBeGreaterThan(0);

    h.prismaCalls.length = 0;
    expect(await envoyerRelance(contexteRelance, relanceDue, new Date())).toBe("sans_contact");

    expect(await preparerTransmissionRemboursementOpco("facture-1")).toEqual({
      statut: "sans_objet",
    });
    expect(h.prismaCalls.length).toBeGreaterThan(0);

    h.prismaCalls.length = 0;
    await passerSuiviEntreprise(new Date("2026-11-18T07:30:00Z"));
    expect(h.prismaCalls.length).toBeGreaterThan(0);
  });
});

// ── (b) Le rendu de tous les autres gabarits ───────────────────────────────

const MOTS_INTERDITS: ReadonlyArray<readonly [string, RegExp]> = [
  ["OPCO", /opco/i],
  ["prise en charge", /pris(?:e|es)?\s+en\s+charge/i],
  ["funding agreement", /funding\s+agreement/i],
  ["financeur", /financeur/i],
  ["funding body", /funding\s+body/i],
];

/**
 * Exceptions : `gabarit` → mots autorisés, avec la raison. Vide aujourd'hui :
 * le balayage du 2026-11-17 n'a trouvé ces mots que dans les deux gabarits en
 * sommeil. Un mot légitime dans un autre gabarit s'ajoute ICI, avec sa raison.
 */
const EXCEPTIONS_RENDU: Readonly<Record<string, readonly string[]>> = {};

/** Les mots interdits trouvés dans un rendu (objet, texte, HTML). */
export function motsInterditsDans(gabarit: string, rendu: string): string[] {
  const permis = new Set(EXCEPTIONS_RENDU[gabarit] ?? []);
  return MOTS_INTERDITS.filter(([nom, re]) => re.test(rendu) && !permis.has(nom)).map(([n]) => n);
}

describe("(b) le rendu des gabarits ne parle pas de financement par un tiers", () => {
  it("le test du test : une chaîne inventée est repérée", () => {
    expect(motsInterditsDans("x", "Bonjour, votre OPCO")).toEqual(["OPCO"]);
    expect(motsInterditsDans("x", "Votre formation est prise en charge")).toEqual([
      "prise en charge",
    ]);
    expect(motsInterditsDans("x", "the funding agreement")).toEqual(["funding agreement"]);
    expect(motsInterditsDans("x", "Le Financeur a répondu")).toEqual(["financeur"]);
    expect(motsInterditsDans("x", "the Funding Body")).toEqual(["funding body"]);
    expect(motsInterditsDans("x", "Rien à signaler")).toEqual([]);
  });

  it("tous les gabarits sauf les deux en sommeil, en fr et en", async () => {
    const eveil = EMAIL_TEMPLATE_NAMES.filter(
      (n) => !(GABARITS_FINANCEMENT_TIERS_EN_SOMMEIL as readonly string[]).includes(n),
    );
    expect(eveil.length).toBe(
      EMAIL_TEMPLATE_NAMES.length - GABARITS_FINANCEMENT_TIERS_EN_SOMMEIL.length,
    );
    expect(eveil.length).toBeGreaterThan(50); // témoin : on a bien rendu quelque chose
    const fautifs: string[] = [];
    let rendus = 0;
    for (const nom of eveil) {
      for (const locale of ["fr", "en"] as const) {
        const variantes: ReadonlyArray<Record<string, unknown>> = [
          {},
          ...Object.values(VARIANTES_EXEMPLE[nom] ?? {}),
        ];
        for (const v of variantes) {
          const r = await renderEmailTemplate(nom, locale, { ...PAYLOAD_EXEMPLE, ...v });
          rendus++;
          const trouves = motsInterditsDans(nom, `${r.subject}\n${r.text}\n${r.html}`);
          if (trouves.length > 0) fautifs.push(`${nom} (${locale}) → ${trouves.join(", ")}`);
        }
      }
    }
    expect(rendus).toBeGreaterThanOrEqual(eveil.length * 2);
    expect(fautifs).toEqual([]);
  }, 120_000);

  it("témoin : les deux gabarits en sommeil, eux, contiennent bien ces mots", async () => {
    for (const nom of GABARITS_FINANCEMENT_TIERS_EN_SOMMEIL) {
      const r = await renderEmailTemplate(nom, "fr", { ...PAYLOAD_EXEMPLE });
      expect(motsInterditsDans(nom, `${r.subject}\n${r.text}\n${r.html}`).length).toBeGreaterThan(
        0,
      );
    }
  });
});

// ── (c) Garde de source ────────────────────────────────────────────────────

/**
 * Les fichiers qui citent aujourd'hui l'un des deux noms de gabarit (ou la
 * constante d'émission). Un nouveau fichier qui les cite est un NOUVEAU point
 * d'émission possible : il doit tester `emailsFinancementTiersActifs()`, puis
 * être ajouté ici en connaissance de cause.
 */
const CONNUS: ReadonlySet<string> = new Set([
  "src/lib/email/templates/__tests__/e-mails-prospects-sans-montant.spec.ts",
  "src/lib/email/templates/__tests__/l-accuse-ne-salue-jamais-par-le-nom-complet.spec.tsx",
  "src/lib/email/templates/__tests__/opco-suivi-entreprise.spec.tsx",
  "src/lib/email/templates/index.tsx",
  "src/server/email/apercu/catalogue.ts",
  "src/server/email/apercu/payloads-exemple.spec.ts",
  "src/server/email/apercu/payloads-exemple.ts",
  "src/server/email/outbox-policy.ts",
  "src/server/qualiopi/dossier-session/classement.ts",
  "src/server/qualiopi/financements/suivi-entreprise/envoi.spec.ts",
  "src/server/qualiopi/financements/suivi-entreprise/envoi.ts",
  "src/server/qualiopi/financements/transmission-remboursement-opco.spec.ts",
  "src/server/qualiopi/financements/transmission-remboursement-opco.ts",
  "src/server/queue/types.ts",
  // L9 : la mise en sommeil et sa garde.
  "src/server/qualiopi/financements/sommeil.ts",
  "src/server/qualiopi/financements/__tests__/aucun-e-mail-ne-parle-de-financement-tiers.spec.tsx",
]);

const CITATION =
  /opco-suivi-entreprise|facture-pieces-remboursement-opco|TEMPLATE_TRANSMISSION_REMBOURSEMENT/;
const RACINES = ["src", "scripts", "tests", "prisma"];

function fichiersSource(dir: string, sortie: string[] = []): string[] {
  for (const nom of readdirSync(dir)) {
    if (nom === "node_modules" || nom === ".next") continue;
    const chemin = join(dir, nom);
    if (statSync(chemin).isDirectory()) fichiersSource(chemin, sortie);
    else if (/\.(ts|tsx|mts|js|mjs|json|md)$/.test(nom)) sortie.push(chemin);
  }
  return sortie;
}

/** Les fichiers (chemin → source) qui citent un des noms sans être dans la liste connue. */
export function citationsInconnues(sources: Readonly<Record<string, string>>): string[] {
  return Object.entries(sources)
    .filter(([chemin, src]) => CITATION.test(src) && !CONNUS.has(chemin))
    .map(([chemin]) => chemin);
}

describe("(c) aucun nouveau fichier ne cite les gabarits en sommeil", () => {
  it("le test du test : une chaîne inventée est repérée, un fichier connu ne l'est pas", () => {
    expect(
      citationsInconnues({
        "src/server/nouveau/envoi-inventé.ts": 'enqueueEmail("opco-suivi-entreprise", ...)',
      }),
    ).toEqual(["src/server/nouveau/envoi-inventé.ts"]);
    expect(
      citationsInconnues({ "src/server/nouveau/b.ts": "TEMPLATE_TRANSMISSION_REMBOURSEMENT" }),
    ).toHaveLength(1);
    expect(citationsInconnues({ "src/server/queue/types.ts": '"opco-suivi-entreprise"' })).toEqual(
      [],
    );
  });

  it("le dépôt : aucune citation hors de la liste connue", () => {
    const sources: Record<string, string> = {};
    for (const racine of RACINES) {
      try {
        for (const f of fichiersSource(join(process.cwd(), racine))) {
          sources[relative(process.cwd(), f).split(sep).join("/")] = readFileSync(f, "utf8");
        }
      } catch {
        /* dossier absent */
      }
    }
    expect(Object.keys(sources).length).toBeGreaterThan(1000); // témoin : on a bien lu le dépôt
    // Chaque entrée connue existe encore (liste non périmée).
    const perimes = [...CONNUS].filter((c) => !(c in sources));
    expect(perimes).toEqual([]);
    expect(citationsInconnues(sources)).toEqual([]);
  });
});
