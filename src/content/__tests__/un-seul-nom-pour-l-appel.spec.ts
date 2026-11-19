// Garde « un seul nom pour l'appel » (lot V1-19, chantier GEO) : « Diagnostic IA, 45 min ».
//
// Le rendez-vous gratuit qui ouvre toute relation s'appelle « Diagnostic IA » PARTOUT où le
// public le lit : boutons, FAQ, JSON-LD, e-mails de réservation, chatbot. « Score » reste réservé
// à l'outil de diagnostic en ligne ; « appel de cadrage » (quand il désigne l'appel de 45 min),
// « diagnostic gratuit de 45 minutes » (sans « IA ») et « appel découverte » sont d'anciens noms
// qui ne doivent pas revenir (décision du 18/11 : le nom reste « Diagnostic IA »).
//
// Ce que la garde ne regarde pas : les commentaires ; `src/server/calendly/type-rendez-vous.ts`
// et les alertes internes, qui reconnaissent le NOM d'un type d'événement TEL QUE CALENDLY le
// porte (renommer l'événement côté Calendly est un geste manuel) ; le catalogue de mots-clés ;
// la page /diagnostic (l'outil en ligne, pas l'appel) ; le Tour France IA (autre rendez-vous).

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { OFFRE_JOURNEE_IA, MICRO_TEXTE_RDV, DUREE_RDV_COURTE } from "@/content/offre";
import { TYPES_RESERVABLES } from "@/server/calendly/types-reservables";

const NOM = "Diagnostic IA";

const ANCIENS_NOMS =
  /appel\s+(?:de\s+)?cadrage|diagnostic\s+gratuit\s+de\s+45|appel\s+(?:de\s+)?d[ée]couverte|appel\s+strat[ée]gique|cadrage\s+45|[ée]change\s+d[ée]couverte|(?:réserver|reserver|lancer)\s+(?:le|mon|votre)\s+diagnostic\s+gratuit/i;

const RACINES = [
  "src/app",
  "src/components",
  "src/content",
  "src/lib/email",
  "src/server/chatbot",
  "src/server/calendly",
  "src/messages",
  "public",
];

/** Fichiers où l'ancien nom est SANS objet, avec la raison. */
const HORS_PERIMETRE: ReadonlyArray<RegExp> = [
  /(^|\/)admin(\/|$)/, // console interne : libellés de saisie, pas un texte public
  /(^|\/)keywords\//, // catalogue de requêtes de recherche, pas un texte affiché
  /src\/app\/\[locale\]\/diagnostic\//, // l'outil en ligne (Score), pas l'appel
  /src\/content\/lp\/diagnostic\.ts$/,
  /src\/app\/tour-france-ia\//, // autre rendez-vous (visio de 30 min)
  /src\/server\/calendly\/type-rendez-vous\.ts$/,
  /src\/server\/calendly\/(?:rappels-appel|choix-rendez-vous|urls-par-defaut)\.ts$/,
  // EXCEPTIONS PERMANENTES : « appel de cadrage » y désigne une AUTRE étape que l'appel gratuit de
  // 45 min, l'échange que l'équipe a avec le client APRÈS une demande de devis qualifiée.
  /src\/app\/\[locale\]\/demande-devis\/page\.tsx$/,
  /src\/app\/\[locale\]\/demande-devis\/confirmation\/page\.tsx$/,
  /src\/lib\/email\/templates\/quote-request-received\.tsx$/,
  // EN ATTENTE (même appel de 45 min, à passer en « Diagnostic IA ») : ces fichiers sont modifiés par
  // d'autres PR ouvertes (réécriture ou lots anciens) ; les toucher ici créerait des conflits.
  // À VIDER, une fois ces PR fusionnées : transversal.ts, secteurs/[secteur]/page.tsx, kb/un-a-un.ts,
  // kb/interventions-formations.ts, kb/sites-web-augmentes.ts, category-hub-content.ts.
  /src\/content\/transversal\.ts$/,
  /src\/app\/\[locale\]\/secteurs\/\[secteur\]\/page\.tsx$/,
  /src\/server\/content[-]gen\/kb\/(?:un-a-un|interventions-formations|sites-web-augmentes)\.ts$/,
  /src\/server\/content[-]gen\/lib\/category-hub-content\.ts$/,
  // EN ATTENTE de fusion de PR ouvertes (à vider, une fois fusionnées) : PR 2134 (implantations),
  // PR 2136 (accueil, a-propos), PR 2137 (positionnement du générateur).
  /src\/app\/\[locale\]\/implantations\/page\.tsx$/,
  /src\/app\/\[locale\]\/_accueil\/contenu\.ts$/,
  /src\/app\/\[locale\]\/a-propos\/page\.tsx$/,
  /brand\/positionnement\.ts$/,
];

function lister(dossier: string, sortie: string[]): void {
  for (const nom of readdirSync(dossier)) {
    const p = join(dossier, nom);
    if (nom === "node_modules" || nom === "__tests__" || /\.(test|spec)\./.test(nom)) continue;
    if (statSync(p).isDirectory()) lister(p, sortie);
    else if (/\.(ts|tsx|json|md|txt)$/.test(nom)) sortie.push(p);
  }
}

const FICHIERS: string[] = [];
for (const r of RACINES) lister(r, FICHIERS);

describe("V1-19 — un seul nom pour l'appel : « Diagnostic IA, 45 min »", () => {
  it("lit bien les fichiers (plancher)", () => {
    expect(FICHIERS.length).toBeGreaterThan(1_500);
  });

  it("témoin positif : le motif voit les anciens noms", () => {
    for (const ancien of [
      "Appel de cadrage",
      "appel de cadrage gratuit",
      "diagnostic gratuit de 45 minutes",
      "appel découverte",
      "Appel de découverte",
      "Réserver mon diagnostic gratuit",
      "Cadrage 45 min",
      "un échange découverte",
    ]) {
      expect(ANCIENS_NOMS.test(ancien), ancien).toBe(true);
    }
    expect(ANCIENS_NOMS.test("Diagnostic IA, 45 min")).toBe(false);
    expect(ANCIENS_NOMS.test("un Diagnostic IA gratuit de 45 minutes")).toBe(false);
  });

  it("la source unique et la réservation portent le nom", () => {
    expect(OFFRE_JOURNEE_IA.rendezVous.nom).toBe(NOM);
    expect(TYPES_RESERVABLES.diagnostic.nom).toBe(NOM);
    expect(MICRO_TEXTE_RDV.startsWith(NOM)).toBe(true);
    expect(DUREE_RDV_COURTE).toBe("45 min");
  });

  it("aucun ancien nom dans un texte lu par le public, le chatbot ou un e-mail", () => {
    const fautes: string[] = [];
    for (const f of FICHIERS) {
      const chemin = f.replace(/\\/g, "/");
      if (HORS_PERIMETRE.some((re) => re.test(chemin))) continue;
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((ligne, i) => {
          if (/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(ligne)) return;
          if (ANCIENS_NOMS.test(ligne))
            fautes.push(`${chemin}:${i + 1} → ${ligne.trim().slice(0, 110)}`);
        });
    }
    expect(fautes, fautes.join("\n")).toEqual([]);
  });
});
