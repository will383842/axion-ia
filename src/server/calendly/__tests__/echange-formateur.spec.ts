/**
 * La règle « échange formateur » et le prédicat commun « hors clients »
 * (chantier « formateurs freelance », lot F-CAL-1, 2026-10-09).
 *
 * Toutes les combinaisons type classé × nom, `null` compris :
 *   · `estEchangeFormateurParNom` — même normalisation que `estAppelApporteur`
 *     (NFD, sans accents, minuscules) ;
 *   · `estEchangeFormateur` — type « formateur » OU nom ;
 *   · `estEchangeHorsClients` — apporteur OU formateur ;
 *   · les clauses Prisma `HORS_ECHANGES_HORS_CLIENTS(_PAR_NOM)` disent la même
 *     chose que le prédicat en mémoire ;
 *   · `HORS_APPELS_APPORTEUR(_PAR_NOM)` n'est plus qu'un ALIAS déprécié.
 */
import { describe, it, expect } from "vitest";

import {
  estEchangeFormateur,
  estEchangeFormateurParNom,
  MOT_CLE_TYPE_ECHANGE_FORMATEUR,
} from "../echange-formateur";
import {
  estEchangeHorsClients,
  estEchangeHorsClientsParNom,
  estRendezVousApporteur,
  HORS_APPELS_APPORTEUR,
  HORS_APPELS_APPORTEUR_PAR_NOM,
  HORS_ECHANGES_HORS_CLIENTS,
  HORS_ECHANGES_HORS_CLIENTS_PAR_NOM,
  SEULS_APPELS_APPORTEUR,
} from "../appel-apporteur";
import { TYPES_RENDEZ_VOUS, type TypeRendezVous } from "../type-rendez-vous";

interface Ligne {
  readonly typeRendezVous: TypeRendezVous | null;
  readonly eventTypeName: string | null;
}

/** Même interprète que `un-type-classe-garde-les-memes-populations.spec.ts`. */
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

const NOMS: (string | null)[] = [
  null,
  "",
  "Diagnostic IA",
  "Échange projet",
  "Formation IA – diagnostic",
  "Rencontre au salon GOFAB — 13 octobre",
  "Échange apporteur d'affaires (15 min)",
  "Échange formateur indépendant (20 min)",
  "echange-formateur-independant",
  "ÉCHANGE FORMATEUR",
  "Échange apporteur — formateur",
];

const LIGNES: Ligne[] = NOMS.flatMap((eventTypeName) =>
  [null, ...TYPES_RENDEZ_VOUS].map((typeRendezVous) => ({ typeRendezVous, eventTypeName })),
);

const nomme = (l: Ligne) => `${l.typeRendezVous ?? "NULL"} / « ${l.eventTypeName ?? "null"} »`;

describe("estEchangeFormateurParNom", () => {
  it("le mot-clé est « formateur »", () => {
    expect(MOT_CLE_TYPE_ECHANGE_FORMATEUR).toBe("formateur");
  });

  it.each([
    "Échange formateur indépendant (20 min)",
    "echange-formateur-independant",
    "ÉCHANGE FORMATEUR",
    "Formateurs",
    // Accent posé sur le mot-clé : la normalisation NFD le retire.
    "Échange FORMATÉUR",
  ])("« %s » est un échange formateur", (nom) => {
    expect(estEchangeFormateurParNom(nom)).toBe(true);
  });

  it.each(["Formation IA – diagnostic", "Diagnostic IA", "Échange apporteur", "", null, undefined])(
    "« %s » n'en est pas un",
    (nom) => {
      expect(estEchangeFormateurParNom(nom)).toBe(false);
    },
  );
});

describe("estEchangeFormateur — type OU nom", () => {
  it("type « formateur », nom neutre", () => {
    expect(
      estEchangeFormateur({ typeRendezVous: "formateur", eventTypeName: "Échange 20 min" }),
    ).toBe(true);
  });
  it("type classé autre, nom formateur", () => {
    expect(
      estEchangeFormateur({ typeRendezVous: "autre", eventTypeName: "Échange formateur" }),
    ).toBe(true);
  });
  it("tout absent", () => {
    expect(estEchangeFormateur({})).toBe(false);
    expect(estEchangeFormateur({ typeRendezVous: null, eventTypeName: null })).toBe(false);
  });
});

describe("estEchangeHorsClients — apporteur OU formateur", () => {
  it.each(LIGNES.map((l) => [nomme(l), l] as const))("%s", (_n, l) => {
    const attendu =
      l.typeRendezVous === "apporteur" ||
      /apporteur/i.test(l.eventTypeName ?? "") ||
      /formateur/i.test(l.eventTypeName ?? "");
    expect(estEchangeHorsClients(l)).toBe(attendu);
  });

  it("par le nom seul", () => {
    for (const nom of NOMS) {
      expect(estEchangeHorsClientsParNom(nom), `« ${nom} »`).toBe(
        /apporteur|formateur/i.test(nom ?? ""),
      );
    }
  });

  it("les deux mots : apporteur reste vrai (rien ne change pour les apporteurs)", () => {
    expect(estRendezVousApporteur({ eventTypeName: "Échange apporteur — formateur" })).toBe(true);
  });
});

describe("clauses Prisma — même verdict que le prédicat en mémoire", () => {
  it.each(LIGNES.filter((l) => l.eventTypeName !== null).map((l) => [nomme(l), l] as const))(
    "HORS_ECHANGES_HORS_CLIENTS : %s",
    (_n, l) => {
      expect(evalue(HORS_ECHANGES_HORS_CLIENTS, l)).toBe(!estEchangeHorsClients(l));
    },
  );

  it("HORS_ECHANGES_HORS_CLIENTS_PAR_NOM : nom seul", () => {
    for (const nom of NOMS.filter((n): n is string => n !== null)) {
      expect(
        evalue(HORS_ECHANGES_HORS_CLIENTS_PAR_NOM, { typeRendezVous: null, eventTypeName: nom }),
        `« ${nom} »`,
      ).toBe(!estEchangeHorsClientsParNom(nom));
    }
  });

  it("SEULS_APPELS_APPORTEUR inchangé : les deux mots restent apporteur", () => {
    expect(
      evalue(SEULS_APPELS_APPORTEUR, {
        typeRendezVous: null,
        eventTypeName: "Échange apporteur — formateur",
      }),
    ).toBe(true);
  });

  it("⚠️ jamais `typeRendezVous: { not: … }` : une ligne non classée et neutre reste dedans", () => {
    expect(
      evalue(HORS_ECHANGES_HORS_CLIENTS, { typeRendezVous: null, eventTypeName: "Diagnostic IA" }),
    ).toBe(true);
  });
});

describe("alias dépréciés", () => {
  it("HORS_APPELS_APPORTEUR est HORS_ECHANGES_HORS_CLIENTS", () => {
    expect(HORS_APPELS_APPORTEUR).toBe(HORS_ECHANGES_HORS_CLIENTS);
  });
  it("HORS_APPELS_APPORTEUR_PAR_NOM est HORS_ECHANGES_HORS_CLIENTS_PAR_NOM", () => {
    expect(HORS_APPELS_APPORTEUR_PAR_NOM).toBe(HORS_ECHANGES_HORS_CLIENTS_PAR_NOM);
  });
});
