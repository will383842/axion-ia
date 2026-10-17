/**
 * Lot L16 — CONCORDANCE DU SITE (NC2, NC3, NC6, NC7, NC15 ; exigence orale O9).
 *
 * 🔴 Le défaut : l'auditeur compare le site public, la fiche formation, le
 * programme remis et la convention. Chacun disait un effectif, un délai, un
 * format ou une modalité différents (jusqu'à 50 / jusqu'à 15 / de 2 à 15 ;
 * « dès 48 heures » ; « Sur mesure · 3 jours » ; un séminaire « présentiel
 * uniquement » ; une base qui écrivait « presentiel » en dur pour toutes les
 * formations). Décisions de Will du 2026-10-16, chacune lue ici depuis UNE
 * source et verrouillée :
 *
 *   effectif        → `effectif.ts`               (de 2 à 15 stagiaires par session)
 *   délai d'accès   → `delai-acces.ts`            (environ 2 semaines) — garde dédiée :
 *                                                  `delai-acces-une-seule-regle.spec.tsx`
 *   « 3 jours »     → `catalog-v2-meta.ts`        (mis de côté, jamais supprimé)
 *   modalité        → catalogue ET base           (présentiel ou distanciel ; hybride en base)
 *   tarif           → `conditions-tarifaires.ts`  (les conditions réelles, plus de slogan)
 *   réclamations    → plus de remplacement du formateur promis
 *   règlement       → l'émargement se signe à chaque demi-journée, le relevé ne le remplace pas
 *   visio           → Zoom « outil utilisé », sans prétendre à un compte ouvert
 *
 * Ce fichier ne lit pas la base : il vérifie que le contenu public dit la même
 * chose que ce qui s'écrit en base (`buildFormationImportData`).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { FORMATIONS_V2 } from "@/content/formations/catalog-v2";
import { getFormationEffectif, getFormationModalites } from "@/content/formations/catalog-v2-facts";
import { SUR_MESURE, SUR_MESURE_MIS_DE_COTE } from "@/content/formations/catalog-v2-meta";
import {
  CONDITIONS_TARIFAIRES_FR,
  CONDITIONS_TARIFAIRES_RESUME_FR,
  SLOGANS_TARIFAIRES_RETIRES,
} from "@/content/formations/conditions-tarifaires";
import {
  EFFECTIF_FORMES_RETIREES,
  EFFECTIF_MAX,
  EFFECTIF_MIN,
  EFFECTIF_PLAGE_FR,
  EFFECTIF_VALEUR_FR,
} from "@/content/formations/effectif";
import { VISIO_FORMATIONS_A_DISTANCE } from "@/content/formations/materiel";
import { getLegal, type LegalSlug } from "@/content/legal";
import { buildFormationImportData } from "@/server/qualiopi/formations/catalog-import";
import { ASSISTANCE_DISTANCE } from "@/server/qualiopi/legal/assistance-distance";

const RACINE = path.resolve(__dirname, "../../../..");

/** Lignes de code (hors commentaires) d'un fichier source. */
function lignesDeCode(source: string): string[] {
  return source.split("\n").filter((l) => {
    const t = l.trim();
    return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("{/*"));
  });
}

function fichiers(dir: string, ignores: ReadonlyArray<string> = []): string[] {
  const out: string[] = [];
  for (const nom of readdirSync(dir)) {
    const p = path.join(dir, nom);
    if (statSync(p).isDirectory()) {
      if (nom === "__tests__" || nom === "(admin)" || nom === "node_modules") continue;
      if (ignores.includes(nom)) continue;
      out.push(...fichiers(p, ignores));
    } else if (/\.(ts|tsx|json|md|mdx)$/.test(nom) && !/\.(spec|test)\.tsx?$/.test(nom)) {
      out.push(p);
    }
  }
  return out;
}

/** Le contenu PUBLIC : textes, pages et composants — jamais la console d'administration. */
const SURFACES_PUBLIQUES = ["src/content", "src/app", "src/components"].map((d) =>
  path.join(RACINE, d),
);

describe("L16 — effectif : de 2 à 15 stagiaires par session, partout", () => {
  it("la source unique dit de 2 à 15", () => {
    expect(EFFECTIF_MIN).toBe(2);
    expect(EFFECTIF_MAX).toBe(15);
    expect(EFFECTIF_PLAGE_FR).toBe("de 2 à 15 stagiaires par session");
  });

  it("aucune formation du catalogue — séminaire compris — ne surcharge l'effectif", () => {
    for (const f of FORMATIONS_V2) {
      expect(f.effectifFr, f.slugFr).toBeUndefined();
      expect(getFormationEffectif(f), f.slugFr).toBe(EFFECTIF_VALEUR_FR);
    }
  });

  it("aucune ligne de code du contenu public ne porte « jusqu'à 50 »", () => {
    const fautes: string[] = [];
    for (const dir of SURFACES_PUBLIQUES) {
      for (const f of fichiers(dir)) {
        for (const l of lignesDeCode(readFileSync(f, "utf8"))) {
          if (EFFECTIF_FORMES_RETIREES.some((re) => re.test(l))) {
            fautes.push(`${path.relative(RACINE, f)} : ${l.trim().slice(0, 120)}`);
          }
        }
      }
    }
    expect(fautes).toEqual([]);
  });

  it("la garde reconnaît bien l'ancien effectif (témoin)", () => {
    for (const t of [
      "Jusqu’à 50 participants, en tables de 6 à 8",
      "séminaire (jusqu'à 50 personnes)",
      "up to 50 people",
    ]) {
      expect(
        EFFECTIF_FORMES_RETIREES.some((re) => re.test(t)),
        t,
      ).toBe(true);
    }
  });
});

describe("L16 — « Sur mesure · 3 jours » : mis de côté, pas supprimé", () => {
  it("le site ne sert plus aucun sur-mesure de 3 jours", () => {
    expect(SUR_MESURE.some((s) => s.duree === "3j" || /3\s*jours/i.test(s.dureeFr))).toBe(false);
  });

  it("l'offre existe toujours, datée et motivée", () => {
    const o = SUR_MESURE_MIS_DE_COTE.find((s) => s.id === "transformation-sur-mesure");
    expect(o?.misDeCoteLe).toBe("2026-10-16");
    expect(o?.motifMiseDeCote).toBeTruthy();
  });

  it("la page tarifs formations lit SUR_MESURE (la liste filtrée), jamais la liste complète", () => {
    const page = readFileSync(
      path.join(RACINE, "src/app/[locale]/formations/tarifs/page.tsx"),
      "utf8",
    );
    expect(page).toContain("SUR_MESURE.map");
    expect(page).not.toContain("SUR_MESURE_MIS_DE_COTE");
  });
});

describe("L16 — modalité : toutes les formations en présentiel OU distanciel, au catalogue ET en base", () => {
  it("catalogue : chaque formation (4 h, 7 h, 14 h) se suit sur place ou à distance", () => {
    for (const f of FORMATIONS_V2) {
      const m = getFormationModalites(f);
      expect(m, f.slugFr).toContain("presentiel");
      expect(m, f.slugFr).toContain("distanciel");
    }
  });

  it("base : l'import écrit « hybride » (présentiel ou distanciel) pour chacune, jamais « presentiel » en dur", () => {
    for (const f of FORMATIONS_V2) {
      expect(buildFormationImportData(f, "offre-x").modalite, f.slugFr).toBe("hybride");
    }
  });

  it("base : les moyens techniques imprimés au programme disent la même visio que la fiche", () => {
    const { moyensTechniques } = buildFormationImportData(FORMATIONS_V2[0]!, "offre-x");
    expect(moyensTechniques).toContain("Zoom");
    for (const phrase of ["un ordinateur avec caméra et micro", "une connexion internet stable"]) {
      expect(moyensTechniques, phrase).toContain(phrase);
    }
  });

  it("la fiche rend la rubrique « à distance » avec l'assistance technique et pédagogique", () => {
    const fiche = readFileSync(
      path.join(RACINE, "src/components/formations/FormationDetailPage.tsx"),
      "utf8",
    );
    expect(fiche).toContain("ASSISTANCE_DISTANCE");
    expect(fiche).toContain("VISIO_FORMATIONS_A_DISTANCE");
    expect(ASSISTANCE_DISTANCE.length).toBeGreaterThanOrEqual(3);
  });
});

describe("L16 — visio : Zoom est l'outil utilisé, sans compte annoncé", () => {
  it("la phrase publique nomme Zoom, le navigateur, et rien à installer", () => {
    expect(VISIO_FORMATIONS_A_DISTANCE).toContain("Zoom");
    expect(VISIO_FORMATIONS_A_DISTANCE).toMatch(/outil utilisé pour les formations à distance/);
    expect(VISIO_FORMATIONS_A_DISTANCE).toMatch(/sans rien installer/);
  });

  it("🔴 elle ne prétend pas qu'un compte, un abonnement ou une licence existe déjà", () => {
    // ADR 0048 : l'abonnement Pro précède la première session à distance ;
    // `subprocessors.ts` déclare Zoom en attente d'activation.
    expect(VISIO_FORMATIONS_A_DISTANCE).not.toMatch(
      /notre compte|nos comptes|abonnement|licence|compte (?:zoom )?(?:est |déjà )?(?:ouvert|actif|existant)/i,
    );
  });
});

describe("L16 — prix : les conditions réelles remplacent « prix fixe, sans surprise »", () => {
  const FICHIERS_FORMATION = [
    "src/app/[locale]/formations/tarifs/page.tsx",
    "src/app/[locale]/formations/page.tsx",
    "src/app/[locale]/tarifs/page.tsx",
    "src/components/formations/FormationDetailPage.tsx",
    "src/components/formations/FormationFormatCard.tsx",
    "src/components/formations/FormationCategorieListing.tsx",
  ];

  it("aucun slogan retiré dans les pages et composants des formations", () => {
    const fautes: string[] = [];
    for (const rel of FICHIERS_FORMATION) {
      for (const l of lignesDeCode(readFileSync(path.join(RACINE, rel), "utf8"))) {
        if (SLOGANS_TARIFAIRES_RETIRES.some((re) => re.test(l))) {
          fautes.push(`${rel} : ${l.trim().slice(0, 120)}`);
        }
      }
    }
    expect(fautes).toEqual([]);
    const catalogue = JSON.stringify(FORMATIONS_V2);
    expect(SLOGANS_TARIFAIRES_RETIRES.filter((re) => re.test(catalogue))).toEqual([]);
  });

  it("la fiche et la page tarifs lisent les conditions de la source unique", () => {
    const fiche = readFileSync(
      path.join(RACINE, "src/components/formations/FormationDetailPage.tsx"),
      "utf8",
    );
    const tarifs = readFileSync(
      path.join(RACINE, "src/app/[locale]/formations/tarifs/page.tsx"),
      "utf8",
    );
    expect(fiche).toContain("CONDITIONS_TARIFAIRES_RESUME_FR");
    expect(tarifs).toContain("CONDITIONS_TARIFAIRES_FR");
    expect(CONDITIONS_TARIFAIRES_RESUME_FR).toContain(EFFECTIF_PLAGE_FR);
  });

  it("🔴 chaque seuil de la liste est celui des conditions générales de vente (opposables)", () => {
    const cgv = getLegal("conditions-generales");
    const texte = cgv.fr.sections.map((s) => `${s.title} ${s.body}`).join("\n");
    // Les CGV disent ces seuils ; si elles changent, la liste doit suivre.
    expect(texte).toMatch(/inférieures à 5 000 € HT, le paiement intervient à la commande/);
    expect(texte).toMatch(/à plus de 15 jours ouvrés, aucune somme n'est due/);
    expect(texte).toMatch(/entre 8 et 15 jours ouvrés, 50 % du prix HT restent dus/);
    expect(texte).toMatch(/à moins de 8 jours ouvrés, le prix HT reste dû en totalité/);
    expect(texte).toMatch(/reportable une fois sans frais/);
    const liste = CONDITIONS_TARIFAIRES_FR.map((c) => c.texte)
      .join("\n")
      .toLowerCase();
    expect(liste).toContain("5 000 € ht");
    expect(liste).toContain("15 jours ouvrés");
    expect(liste).toContain("entre 8 et 15 jours ouvrés, 50 % du prix ht");
    expect(liste).toContain("moins de 8 jours ouvrés");
    expect(liste).toContain("reportable une fois sans frais");
  });
});

describe("L16 — textes légaux : réclamations et règlement intérieur", () => {
  const corps = (slug: LegalSlug, lang: "fr" | "en"): string =>
    getLegal(slug)
      [lang].sections.map((s) => `${s.title}\n${s.body}`)
      .join("\n");

  it("🔴 /reclamations ne promet plus le remplacement du formateur", () => {
    const t = corps("reclamations", "fr");
    expect(t).toContain("report de la séquence ou de la session sans frais pour le client");
    expect(t).not.toMatch(/remplacement du formateur/i);
    expect(t).not.toMatch(/intervenant de compétences équivalentes/i);
  });

  it("🔴 le règlement intérieur ne dit plus que le relevé de connexion tient lieu d'émargement", () => {
    for (const lang of ["fr", "en"] as const) {
      const t = corps("reglement-interieur", lang);
      expect(t, lang).not.toMatch(/fait office de justificatif de présence/i);
      expect(t, lang).not.toMatch(/serves as proof of attendance/i);
    }
    expect(corps("reglement-interieur", "fr")).toContain(
      "La feuille d'émargement se signe pendant chaque demi-journée",
    );
    expect(corps("reglement-interieur", "en")).toContain(
      "The attendance sheet is signed during each half-day",
    );
  });

  it("le PDF du règlement et le livret d'accueil disent la même chose que la page", () => {
    const pdf = readFileSync(
      path.join(RACINE, "src/server/qualiopi/documents/templates/reglement-interieur.tsx"),
      "utf8",
    ).replace(/\s+/g, " ");
    expect(pdf).toContain("La feuille d'émargement se signe pendant chaque demi-journée");
    expect(pdf).not.toMatch(/fait office de justificatif de présence/);
    const livret = readFileSync(
      path.join(RACINE, "src/server/qualiopi/documents/templates/livret-accueil.tsx"),
      "utf8",
    );
    expect(livret).not.toMatch(/relevé de connexion automatique fait office d'émargement/);
    expect(livret).toContain("L'émargement se signe pendant chaque demi-journée");
  });
});
