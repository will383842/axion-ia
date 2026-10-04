// Le type classé ne change AUCUNE population apporteur ni salon (2026-10-04).
//
// Chantier « Types de rendez-vous », lot L3. Les clauses Prisma qui bornent
// les e-mails (`rappels-appel.ts`) et le contrôle CRM (`reconcile.ts`) lisent
// désormais la colonne `typeRendezVous`, avec repli sur le nom quand elle est
// NULL. Ce fichier ÉVALUE ces clauses — un petit interprète des seules formes
// qu'elles emploient — sur toutes les combinaisons type × nom, et vérifie :
//
//   1. partition : chaque rendez-vous reçoit UN jeu de messages, jamais deux,
//      jamais zéro ;
//   2. NULL : sans type classé, les populations sont EXACTEMENT celles d'avant
//      (clauses sur le nom seul) ;
//   3. type cohérent avec le nom : mêmes populations qu'avant ;
//   4. un nom qui contient « apporteur » n'est JAMAIS client (double verrou) ;
//   5. les clauses disent la même chose que `typeEffectif` (écrans, alertes).

import { describe, it, expect } from "vitest";
import {
  HORS_APPELS_APPORTEUR,
  HORS_APPELS_APPORTEUR_PAR_NOM,
  SEULS_APPELS_APPORTEUR,
  SEULS_APPELS_APPORTEUR_PAR_NOM,
} from "../appel-apporteur";
import {
  HORS_RDV_SALON,
  HORS_RDV_SALON_PAR_NOM,
  SEULS_RDV_SALON,
  SEULS_RDV_SALON_PAR_NOM,
} from "../rdv-salon";
import { classerParNom, TYPES_RENDEZ_VOUS, type TypeRendezVous } from "../type-rendez-vous";
import { typeEffectif } from "../type-effectif";
import { PASSAGES } from "../rappels-appel";

interface Ligne {
  readonly typeRendezVous: TypeRendezVous | null;
  readonly eventTypeName: string;
}

/**
 * Interprète une clause `where` Prisma, limité aux formes employées : AND, OR,
 * NOT, égalité (dont `null` = IS NULL), `in`, `contains` insensible à la casse.
 * Sémantique SQL : `in` sur NULL est faux.
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

const NOMS = [
  "Discutons de votre projet IA",
  "Échange projet",
  "Diagnostic IA",
  "premier-contact",
  "Échange apporteur d'affaires (15 min)",
  "APPORTEUR",
  "Rencontre au salon GOFAB — 13 octobre",
  "Apporteur au salon",
  "Rendez-vous perso",
];

const LIGNES: Ligne[] = NOMS.flatMap((eventTypeName) =>
  [null, ...TYPES_RENDEZ_VOUS].map((typeRendezVous) => ({ typeRendezVous, eventTypeName })),
);

type Population = "client" | "apporteur" | "salon";

/** Les populations des passages courants (colonne + repli nom). */
function populations(l: Ligne): Population[] {
  const out: Population[] = [];
  if (evalue([HORS_APPELS_APPORTEUR, HORS_RDV_SALON], l)) out.push("client");
  if (evalue([SEULS_APPELS_APPORTEUR], l)) out.push("apporteur");
  if (evalue([SEULS_RDV_SALON, HORS_APPELS_APPORTEUR], l)) out.push("salon");
  return out;
}

/** Les populations d'AVANT (nom seul) — la référence de non-régression. */
function populationsAvant(l: Ligne): Population[] {
  const out: Population[] = [];
  if (evalue([HORS_APPELS_APPORTEUR_PAR_NOM, HORS_RDV_SALON_PAR_NOM], l)) out.push("client");
  if (evalue([SEULS_APPELS_APPORTEUR_PAR_NOM], l)) out.push("apporteur");
  if (evalue([SEULS_RDV_SALON_PAR_NOM, HORS_APPELS_APPORTEUR_PAR_NOM], l)) out.push("salon");
  return out;
}

const nomme = (l: Ligne) => `${l.typeRendezVous ?? "NULL"} / « ${l.eventTypeName} »`;

describe("populations des e-mails — colonne d'abord, nom en repli", () => {
  it.each(LIGNES.map((l) => [nomme(l), l] as const))(
    "partition : %s reçoit exactement un jeu de messages",
    (_n, l) => {
      expect(populations(l)).toHaveLength(1);
    },
  );

  it("type NULL : populations STRICTEMENT identiques à celles d'avant", () => {
    for (const l of LIGNES.filter((x) => x.typeRendezVous === null)) {
      expect(populations(l), nomme(l)).toEqual(populationsAvant(l));
    }
  });

  it("type classé cohérent avec le nom : mêmes populations qu'avant", () => {
    for (const eventTypeName of NOMS) {
      const l = { eventTypeName, typeRendezVous: classerParNom(eventTypeName) };
      expect(populations(l), nomme(l)).toEqual(populationsAvant(l));
    }
  });

  it("un nom qui contient « apporteur » n'est JAMAIS client, quel que soit le type", () => {
    for (const l of LIGNES.filter((x) => /apporteur/i.test(x.eventTypeName))) {
      expect(populations(l), nomme(l)).toEqual(["apporteur"]);
    }
  });

  it("classé apporteur sans le mot-clé (type renommé) : reste apporteur", () => {
    expect(populations({ typeRendezVous: "apporteur", eventTypeName: "Échange 15 min" })).toEqual([
      "apporteur",
    ]);
  });

  it("classé salon : messages salon, même si le nom ne dit plus « salon »", () => {
    expect(populations({ typeRendezVous: "salon", eventTypeName: "Rencontre GOFAB" })).toEqual([
      "salon",
    ]);
  });

  it("les clauses disent la même chose que `typeEffectif` (écrans, alertes)", () => {
    for (const l of LIGNES) {
      const t = typeEffectif(l);
      const attendu: Population =
        t === "apporteur" ? "apporteur" : t === "salon" ? "salon" : "client";
      expect(populations(l), nomme(l)).toEqual([attendu]);
    }
  });
});

describe("PASSAGES — chaque passage porte son repli sur le nom", () => {
  it("le repli d'un passage est la clause historique de SA population", () => {
    const attendu: Record<string, unknown[]> = {
      client: [HORS_APPELS_APPORTEUR_PAR_NOM, HORS_RDV_SALON_PAR_NOM],
      apporteur: [SEULS_APPELS_APPORTEUR_PAR_NOM],
      salon: [SEULS_RDV_SALON_PAR_NOM, HORS_APPELS_APPORTEUR_PAR_NOM],
    };
    for (const p of PASSAGES) {
      expect(p.filtresParNom, `${p.job}`).toEqual(attendu[p.destinataire]);
    }
  });
});
