/**
 * Un échange formateur indépendant n'est JAMAIS traité comme un client
 * (chantier « formateurs freelance », lot F-CAL-1, 2026-10-09).
 *
 * Le compte Calendly porte un type « Échange formateur indépendant (20 min) ».
 * Avant ce lot, tout type qui n'était ni apporteur ni salon tombait dans la
 * famille CLIENT : e-mails « appel de découverte » (confirmation, J-1, H-1),
 * envoi au CRM des ventes, entrée au dossier client et à la visio enregistrée.
 *
 * Ce fichier n'importe QUE des modules qui existaient avant le lot : il rougit
 * sur l'ancienne base en EXÉCUTANT les gardes, pas en échouant à l'import.
 *
 * Ce qu'il fixe, sur toutes les combinaisons type classé × nom (`null`
 * compris), par la colonne ET par le nom seul (repli du worker) :
 *   1. un nom qui contient « formateur » ne reçoit AUCUN jeu de messages ;
 *   2. un nom qui contient les deux mots reste « apporteur » ;
 *   3. tout le reste garde exactement sa population d'avant (`typeEffectif`) ;
 *   4. le CRM ne reçoit rien pour un échange formateur, et reçoit toujours
 *      « Formation IA – diagnostic » ;
 *   5. le dossier client (donc la visio enregistrée) ne l'accueille jamais.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { calendlyEvent: { findMany: vi.fn(async () => []), update: vi.fn() } },
}));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));

const enfilerCrm = vi.fn(async (..._a: unknown[]) => "evt");
vi.mock("@/server/crm-sync/enqueue", () => ({
  enqueueCrmSyncEvent: (...a: unknown[]) => enfilerCrm(...a),
  newCrmEventId: () => "id-1",
}));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string) => (e ? `h-${e}` : null),
  normalizeEmail: (e: string) => e.trim().toLowerCase(),
}));

import { PASSAGES } from "../rappels-appel";
import { TYPES_RENDEZ_VOUS, type TypeRendezVous } from "../type-rendez-vous";
import { typeEffectif } from "../type-effectif";
import { syncCalendlyEventToCrm } from "@/server/crm-sync";
import { estRendezVousDuDossier, estTypeDuDossier } from "@/server/visio/liste-blanche-types";
import { CHOIX_PUBLICS, choixDuTypeRendezVous } from "../types-reservables";

interface Ligne {
  readonly typeRendezVous: TypeRendezVous | null;
  readonly eventTypeName: string;
}

/**
 * Interprète une clause `where` Prisma, limité aux formes employées : AND, OR,
 * NOT, égalité (dont `null` = IS NULL), `in`, `contains` insensible à la casse.
 * Sémantique SQL : `in` sur NULL est faux. (Même interprète que
 * `un-type-classe-garde-les-memes-populations.spec.ts`.)
 */
function evalue(clause: unknown, l: Ligne): boolean {
  if (Array.isArray(clause)) return clause.every((c) => evalue(c, l));
  const o = clause as Record<string, unknown>;
  return Object.entries(o).every(([cle, v]) => {
    if (cle === "AND") return (v as unknown[]).every((c) => evalue(c, l));
    if (cle === "OR") return (v as unknown[]).some((c) => evalue(c, l));
    if (cle === "NOT") return !evalue(v, l);
    const valeur = l[cle as keyof Ligne];
    if (v === null) return valeur === null;
    if (typeof v === "string") return valeur === v;
    const op = v as { in?: string[]; contains?: string; mode?: string };
    if (op.in) return valeur !== null && op.in.includes(valeur);
    if (op.contains !== undefined) {
      if (valeur === null) return false;
      return op.mode === "insensitive"
        ? valeur.toLowerCase().includes(op.contains.toLowerCase())
        : valeur.includes(op.contains);
    }
    throw new Error(`forme de clause non prévue par l'interprète : ${cle}`);
  });
}

const NOMS_CLIENTS_OU_SALON = [
  "Discutons de votre projet IA",
  "Diagnostic IA",
  "premier-contact",
  "Formation IA – diagnostic",
  "Rendez-vous perso",
  "Rencontre au salon GOFAB — 13 octobre",
];
const NOMS_APPORTEUR = [
  "Échange apporteur d'affaires (15 min)",
  "echange-apporteur",
  // Les deux mots : reste « apporteur ».
  "Échange apporteur — formateur",
];
const NOMS_FORMATEUR = [
  "Échange formateur indépendant (20 min)",
  "echange-formateur-independant",
  "ÉCHANGE FORMATEUR",
  "Diagnostic IA formateur",
  "Rencontre au salon — formateurs",
];
const NOMS = [...NOMS_CLIENTS_OU_SALON, ...NOMS_APPORTEUR, ...NOMS_FORMATEUR];

const LIGNES: Ligne[] = NOMS.flatMap((eventTypeName) =>
  [null, ...TYPES_RENDEZ_VOUS].map((typeRendezVous) => ({ typeRendezVous, eventTypeName })),
);

type Population = "client" | "apporteur" | "salon";

function populations(l: Ligne, parNom: boolean): Population[] {
  const out = new Set<Population>();
  for (const p of PASSAGES) {
    if (evalue(parNom ? p.filtresParNom : p.filtres, l)) out.add(p.destinataire);
  }
  return [...out].sort();
}

const estNomFormateur = (n: string) => /formateur/i.test(n);
const estNomApporteur = (n: string) => /apporteur/i.test(n);

/** La population ATTENDUE, colonne lue. */
function attendu(l: Ligne): Population[] {
  if (l.typeRendezVous === "apporteur" || estNomApporteur(l.eventTypeName)) return ["apporteur"];
  if (estNomFormateur(l.eventTypeName)) return [];
  const t = typeEffectif(l);
  return [t === "salon" ? "salon" : "client"];
}

/** La population ATTENDUE par le nom seul (repli du worker, colonne absente). */
function attenduParNom(nom: string): Population[] {
  return attendu({ typeRendezVous: null, eventTypeName: nom });
}

const nomme = (l: Ligne) => `${l.typeRendezVous ?? "NULL"} / « ${l.eventTypeName} »`;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRM_SYNC_ENABLED = "true";
});

describe("rappels — un échange formateur ne reçoit aucun e-mail client", () => {
  it.each(LIGNES.map((l) => [nomme(l), l] as const))("colonne lue : %s", (_n, l) => {
    expect(populations(l, false)).toEqual(attendu(l));
  });

  it.each(NOMS.map((n) => [n] as const))("nom seul (repli du worker) : « %s »", (nom) => {
    expect(populations({ typeRendezVous: null, eventTypeName: nom }, true)).toEqual(
      attenduParNom(nom),
    );
  });

  it("🔴 « Échange formateur indépendant (20 min) », non classé : pas de famille client", () => {
    const l = { typeRendezVous: null, eventTypeName: "Échange formateur indépendant (20 min)" };
    expect(populations(l, false)).not.toContain("client");
    expect(populations(l, true)).not.toContain("client");
  });

  it("🔴 classé « autre » par l'URI (le type formateur n'a pas de valeur d'enum) : pas client", () => {
    const l = { typeRendezVous: "autre" as const, eventTypeName: "Échange formateur indépendant" };
    expect(populations(l, false)).toEqual([]);
  });

  it("TÉMOIN — « Formation IA – diagnostic » reste client (formation ≠ formateur)", () => {
    const l = { typeRendezVous: null, eventTypeName: "Formation IA – diagnostic" };
    expect(populations(l, false)).toEqual(["client"]);
    expect(populations(l, true)).toEqual(["client"]);
  });
});

describe("CRM des ventes — un échange formateur n'y entre jamais", () => {
  const personne = { email: "camille@exemple.test", fullName: "Camille", phone: null };

  it.each(
    NOMS_FORMATEUR.flatMap((nom) =>
      [undefined, "diagnostic", "echange_projet", "salon", "autre"].map((t) => [nom, t] as const),
    ),
  )("🔴 « %s » (type %s) : rien ne part", async (eventTypeName, typeRendezVous) => {
    await syncCalendlyEventToCrm({
      kind: "booked",
      subjectRef: "site:calendly_event:f",
      person: personne,
      payload: { eventTypeName, ...(typeRendezVous ? { typeRendezVous } : {}) },
    });
    expect(enfilerCrm).not.toHaveBeenCalled();
  });

  it.each(["completed", "canceled", "no_show"] as const)(
    "🔴 « %s » d'un échange formateur : rien ne part non plus",
    async (kind) => {
      await syncCalendlyEventToCrm({
        kind,
        subjectRef: "site:calendly_event:f",
        person: personne,
        payload: { eventTypeName: "Échange formateur indépendant (20 min)" },
      });
      expect(enfilerCrm).not.toHaveBeenCalled();
    },
  );

  it("TÉMOIN — « Formation IA – diagnostic » part au CRM, inchangé", async () => {
    await syncCalendlyEventToCrm({
      kind: "booked",
      subjectRef: "site:calendly_event:d",
      person: personne,
      payload: { eventTypeName: "Formation IA – diagnostic", typeRendezVous: "diagnostic" },
    });
    expect(enfilerCrm).toHaveBeenCalledTimes(1);
  });

  it("TÉMOIN — les deux mots : reste apporteur, rien ne part (inchangé)", async () => {
    await syncCalendlyEventToCrm({
      kind: "booked",
      subjectRef: "site:calendly_event:a",
      person: personne,
      payload: { eventTypeName: "Échange apporteur — formateur" },
    });
    expect(enfilerCrm).not.toHaveBeenCalled();
  });
});

describe("dossier client et visio enregistrée — jamais un échange formateur", () => {
  it("🔴 classé diagnostic mais nommé formateur : hors dossier", () => {
    expect(
      estRendezVousDuDossier({
        typeRendezVous: "diagnostic",
        eventTypeName: "Diagnostic IA formateur",
      }),
    ).toBe(false);
  });

  it("🔴 nom seul, début de nom client mais « formateur » : hors dossier", () => {
    expect(estTypeDuDossier("Échange projet — formateur indépendant")).toBe(false);
    expect(estRendezVousDuDossier({ eventTypeName: "Diagnostic IA formateur" })).toBe(false);
  });

  it("le nom du type formateur, non classé : hors dossier", () => {
    expect(
      estRendezVousDuDossier({ eventTypeName: "Échange formateur indépendant (20 min)" }),
    ).toBe(false);
  });

  it("TÉMOIN — « Diagnostic IA » et « Échange projet » restent au dossier", () => {
    expect(estRendezVousDuDossier({ eventTypeName: "Diagnostic IA" })).toBe(true);
    expect(
      estRendezVousDuDossier({ typeRendezVous: "echange_projet", eventTypeName: "Échange projet" }),
    ).toBe(true);
  });
});

describe("TÉMOINS — le parcours public /appel ne bouge pas", () => {
  it("CHOIX_PUBLICS inchangé", () => {
    expect(CHOIX_PUBLICS).toEqual(["diagnostic", "projet"]);
  });

  it.each([
    ["diagnostic", "diagnostic"],
    ["echange_projet", "projet"],
    ["apporteur", "apporteur"],
    ["salon", "salon"],
    ["autre", null],
    [null, null],
  ] as const)("choixDuTypeRendezVous(%s) → %s", (type, attendu) => {
    expect(choixDuTypeRendezVous(type)).toBe(attendu);
  });
});
