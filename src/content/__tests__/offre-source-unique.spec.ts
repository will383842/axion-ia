// L'offre en source unique (`src/content/offre.ts`) — et aucun texte qui la contredit.
//
// Deux familles de vérifications :
//
// 1. Les FAITS de la source : prix lu dans `pricing.ts`, rendez-vous gratuit de 45 minutes,
//    cible « de 5 à 249 salariés », mention prudente de l'article 4, garantie reprise mot
//    pour mot de `journee-ia-commun.ts`.
// 2. Un BALAYAGE des textes publics, prompts, chatbot et e-mails : un prix de la Journée IA,
//    une durée du rendez-vous gratuit ou une cible d'effectif DIFFÉRENTS de la source font
//    rougir. Les valeurs attendues sont LUES dans la source, jamais recopiées ici.
//
// Les textes de l’accueil branchés sur la source sont vérifiés dans
// `src/app/[locale]/__tests__/accueil-offre-source-unique.spec.ts` (frontière de modules).
//
// 🔑 La garde ne porte pas la liste des fichiers : elle DÉRIVE ce qu'elle lit des racines
// (cf. `la-duree-de-l-appel-ne-diverge-plus.spec.ts`), avec un plancher de fichiers et des
// témoins positifs pour ne jamais devenir verte en ne regardant rien.
//
// Mesure du 2026-11-11 (4 534 fichiers, puis + src/lib/email et src/server/calendly) : 0 divergence sur le prix, 0 sur la durée.
// Sur la cible, un balayage SANS contexte rendait 15 parasites (statistiques locales des
// pages villes, « TPE de 1 à 9 salariés » au sens INSEE) : la règle exige donc que la
// phrase parle de l'offre (« Journée IA » ou « Axion-IA » dans les 200 caractères avant).

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

import {
  DUREE_RDV,
  DUREE_RDV_COURTE,
  EFFECTIF_CIBLE,
  MICRO_TEXTE_RDV,
  OFFRE_JOURNEE_IA,
  prixJourneeIa,
} from "@/content/offre";
import { CONDITION_GARANTIE, GARANTIE_PHRASE } from "@/content/journee-ia-commun";
import { JOURNEE_IA_TIER } from "@/content/pricing";
import { TYPES_RESERVABLES } from "@/server/calendly/types-reservables";
import { REGLES_FIXES } from "@/server/chatbot/generation/system-prompt";

describe("offre.ts — les faits de la source", () => {
  it("lit le prix dans pricing.ts (1 490 € HT, seul prix affiché)", () => {
    expect(OFFRE_JOURNEE_IA.prixHtEur).toBe(JOURNEE_IA_TIER.priceFlat);
    expect(OFFRE_JOURNEE_IA.prixHtEur).toBe(1490);
    expect(prixJourneeIa("fr").replace(/\s/g, " ")).toBe("1 490 € HT");
  });

  it("porte un rendez-vous gratuit UNIQUE de 45 minutes", () => {
    expect(OFFRE_JOURNEE_IA.rendezVous.dureeMinutes).toBe(45);
    expect(OFFRE_JOURNEE_IA.rendezVous.gratuit).toBe(true);
    expect(DUREE_RDV).toBe("45 minutes");
    expect(DUREE_RDV_COURTE).toBe("45 min");
    expect(MICRO_TEXTE_RDV).toBe(
      "Diagnostic IA gratuit · 45 minutes · en visio ou par téléphone · sans engagement",
    );
  });

  it("cible les PME et TPE de 5 à 249 salariés", () => {
    expect(EFFECTIF_CIBLE).toBe("de 5 à 249 salariés");
  });

  it("matin audit, après-midi formation", () => {
    expect(OFFRE_JOURNEE_IA.deroule.matin).toBe("audit");
    expect(OFFRE_JOURNEE_IA.deroule.apresMidi).toBe("formation");
  });

  it("mentionne l'article 4 avec prudence : « prennent des mesures pour favoriser », jamais une obligation de former", () => {
    expect(OFFRE_JOURNEE_IA.mentionArticle4).toContain("prennent des mesures pour favoriser");
    expect(OFFRE_JOURNEE_IA.mentionArticle4).not.toMatch(/obligation|oblig/i);
  });

  it("reprend la garantie mot pour mot, sans rien inventer", () => {
    expect(OFFRE_JOURNEE_IA.garantie.phrase).toBe(GARANTIE_PHRASE);
    expect(OFFRE_JOURNEE_IA.garantie.condition).toBe(CONDITION_GARANTIE);
    expect(OFFRE_JOURNEE_IA.garantie.brouillon).toBe(true);
  });
});

describe("offre.ts — les premiers consommateurs rendent EXACTEMENT le même texte", () => {
  it("promesse du Diagnostic IA (réservation)", () => {
    expect(TYPES_RESERVABLES.diagnostic.promesse).toBe(
      "Diagnostic IA gratuit, 45 minutes, en visio ou par téléphone, sans engagement",
    );
  });

  it("règles fixes du chatbot", () => {
    expect(REGLES_FIXES).toContain(
      "L'orientation par défaut est le Diagnostic IA gratuit de 45 minutes, sans engagement (un seul rendez-vous gratuit) ; cette durée est un fait que vous pouvez citer.",
    );
  });
});

// ── Balayage ────────────────────────────────────────────────────────────────

/** Les racines balayées. Une racine disparue fait ROUGIR, jamais taire. */
const RACINES = [
  "src/app",
  "src/components",
  "src/content",
  "src/messages",
  // Tout `src/server` : chatbot, prompts de génération, e-mails, réservation…
  "src/server",
  "src/lib/email",
  "public",
] as const;

const EXTENSIONS = /\.(ts|tsx|json|txt|md)$/;

/**
 * `src/app/tour-france-ia/**` est hors du périmètre de ce chantier (on n'y touche pas) ; les
 * tests portent des contre-exemples volontaires.
 */
function ignore(chemin: string, nom: string): boolean {
  return (
    nom === "node_modules" ||
    nom === "__tests__" ||
    /\.(test|spec)\.[tj]sx?$/.test(nom) ||
    chemin.includes("tour-france-ia")
  );
}

/** 4 534 fichiers mesurés le 2026-11-11 : un balayage cassé tombe bien en dessous. */
const PLANCHER_FICHIERS = 3_000;

function lister(dossier: string, sortie: string[]): void {
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (ignore(chemin, nom)) continue;
    if (statSync(chemin).isDirectory()) lister(chemin, sortie);
    else if (EXTENSIONS.test(nom)) sortie.push(chemin);
  }
}

const PRIX_ATTENDU = OFFRE_JOURNEE_IA.prixHtEur;
const DUREE_ATTENDUE = OFFRE_JOURNEE_IA.rendezVous.dureeMinutes;
const { effectifMin, effectifMax } = OFFRE_JOURNEE_IA.cible;

const REGLES: ReadonlyArray<{
  nom: string;
  motif: RegExp;
  diverge: (m: RegExpMatchArray) => boolean;
}> = [
  {
    nom: "prix de la Journée IA",
    motif: /Journée IA.{0,80}?(\d[\d\s.,]*)\s?(?:€|EUR\b|euros?\b)/gi,
    // « 1 490,00 € » : les centimes ne comptent pas dans le montant comparé.
    // « la commission de la Journée IA (500 € HT) » (apporteurs, #1900) n'est pas un prix.
    diverge: (m) =>
      !/commission/i.test(
        (m.input ?? "").slice(Math.max(0, (m.index ?? 0) - 40), (m.index ?? 0) + m[0].length),
      ) && Number((m[1] ?? "").replace(/[,.]\d{2}\s*$/, "").replace(/\D/g, "")) !== PRIX_ATTENDU,
  },
  {
    nom: "durée du rendez-vous gratuit",
    motif:
      /(?:rendez-vous gratuit|diagnostic IA gratuit|diagnostic gratuit|appel découverte|échange gratuit|premier échange)[^.\n]{0,60}?\b(\d+)\s?-?\s?(?:min\b|minutes?\b)/gi,
    diverge: (m) => Number(m[1]) !== DUREE_ATTENDUE,
  },
  {
    nom: "durée du rendez-vous gratuit (durée avant)",
    motif:
      /\b(\d+)\s?-?\s?(?:min\b|minutes?\b)[^.\n]{0,40}?(?:rendez-vous gratuit|diagnostic IA gratuit|diagnostic gratuit|appel découverte)/gi,
    diverge: (m) => Number(m[1]) !== DUREE_ATTENDUE,
  },
  {
    nom: "cible d'effectif de l'offre",
    motif:
      /(?:Journée IA|Axion-IA)[^\n]{0,200}?(?:PME|TPE)[^.\n]{0,60}?\b(?:de )?(\d+) à (\d+) salariés/gi,
    diverge: (m) => Number(m[1]) !== effectifMin || Number(m[2]) !== effectifMax,
  },
];

/** Les échappements écrits dans la source (` `, ` `) comptent comme des espaces. */
function normaliser(texte: string): string {
  return texte.replace(/\\u(?:202f|00a0)/gi, " ");
}

function divergences(brut: string): string[] {
  const texte = normaliser(brut);
  const out: string[] = [];
  for (const regle of REGLES) {
    for (const m of texte.matchAll(regle.motif)) {
      if (regle.diverge(m)) out.push(`${regle.nom} : « ${m[0].slice(0, 140)} »`);
    }
  }
  return out;
}

describe("offre.ts — aucun texte public, prompt ou e-mail ne contredit la source", () => {
  it("les témoins : chaque règle attrape un vrai défaut et laisse passer la bonne valeur", () => {
    expect(divergences("La Journée IA à 2 450 € HT, dans vos locaux.")).toHaveLength(1);
    expect(divergences("La Journée IA à 1 490 € HT, dans vos locaux.")).toHaveLength(0);
    expect(divergences("Réservez votre Diagnostic IA gratuit de 30 minutes.")).toHaveLength(1);
    expect(divergences("Réservez votre Diagnostic IA gratuit de 45 minutes.")).toHaveLength(0);
    expect(divergences("Un appel de 60 min, diagnostic gratuit et sans engagement.")).toHaveLength(
      1,
    );
    expect(divergences("Un webinaire de 60 minutes, gratuit.")).toHaveLength(0);
    expect(divergences("La Journée IA\\u202f: 2\\u202f450\\u00a0€ HT.")).toHaveLength(1);
    expect(divergences("La Journée IA à 1 490,00 € HT.")).toHaveLength(0);
    expect(divergences("La Journée IA (commission de 500 € HT).")).toHaveLength(0);
    expect(divergences("Allumé : la commission de la Journée IA (500 € HT).")).toHaveLength(0);
    expect(divergences("La Journée IA pour les PME (10 à 249 salariés).")).toHaveLength(1);
    expect(divergences("La Journée IA pour les PME (5 à 249 salariés).")).toHaveLength(0);
    expect(divergences("Axion-IA aide les PME de 10 à 249 salariés.")).toHaveLength(1);
    expect(divergences("Axion-IA aide les PME et les TPE, de 5 à 249 salariés.")).toHaveLength(0);
  });

  it("aucune divergence dans les racines balayées", () => {
    const fichiers: string[] = [];
    for (const racine of RACINES) {
      expect(existsSync(racine), `racine disparue : ${racine}`).toBe(true);
      lister(racine, fichiers);
    }
    expect(fichiers.length).toBeGreaterThanOrEqual(PLANCHER_FICHIERS);

    const fautes: string[] = [];
    for (const fichier of fichiers) {
      for (const d of divergences(readFileSync(fichier, "utf8"))) fautes.push(`${fichier} — ${d}`);
    }
    expect(fautes).toEqual([]);
  });
});
