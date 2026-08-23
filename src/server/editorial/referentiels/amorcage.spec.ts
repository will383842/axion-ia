/**
 * Console éditoriale — tests des référentiels d'amorçage (§1 bis, §8, §9).
 *
 * Ces tests gardent la FIDÉLITÉ du registre au plan. C'est leur seul rôle, et
 * il est réel : le §1 bis annonce onze comptes et deux marques, le §9 onze
 * règles d'alerte. Un registre qui dérive du plan sans que rien ne rougisse
 * est exactement le « témoin négatif qui ne vaut rien » du protocole.
 */

import { describe, it, expect } from "vitest";
import { ED_MARQUES, ED_COMPTES, ED_COMPTES_ATTENDUS } from "./comptes";
import { ED_REGLES_ALERTE, ED_REGLES_ALERTE_ATTENDUES, GRAVITE_ENVOI_IMMEDIAT } from "./alertes";
import { ED_FAMILLES, ED_SPECS_PLATEFORME, ALIAS_TEXTE_SEUL } from "./familles";

describe("les marques (§1 bis)", () => {
  it("en compte deux : Axion-IA et sa marque fille L'Étoffe", () => {
    expect(ED_MARQUES).toHaveLength(2);
    expect(ED_MARQUES.map((m) => m.slug).sort()).toEqual(["axion-ia", "letoffe"]);
  });

  it("n'a aucun slug en double", () => {
    const slugs = ED_MARQUES.map((m) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("les onze comptes (§1 bis)", () => {
  it("en compte exactement onze", () => {
    expect(ED_COMPTES).toHaveLength(ED_COMPTES_ATTENDUS);
  });

  it("n'a ni slug ni ordre en double", () => {
    expect(new Set(ED_COMPTES.map((c) => c.slug)).size).toBe(ED_COMPTES.length);
    expect(new Set(ED_COMPTES.map((c) => c.ordre)).size).toBe(ED_COMPTES.length);
  });

  it("numérote de 1 à 11, comme le tableau du plan", () => {
    expect(ED_COMPTES.map((c) => c.ordre)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("🔴 ne rattache une marque QU'AUX comptes professionnels", () => {
    // Un compte `perso` porteur d'une marque brouillerait la comparaison
    // perso/pro du §3, qui est un des objectifs de l'outil.
    for (const c of ED_COMPTES) {
      if (c.identite === "perso") {
        expect(c.marqueSlug, `compte ${c.slug}`).toBeNull();
      }
    }
  });

  it("ne référence que des marques qui existent", () => {
    const connues = new Set(ED_MARQUES.map((m) => m.slug));
    for (const c of ED_COMPTES) {
      if (c.marqueSlug) expect(connues.has(c.marqueSlug), `compte ${c.slug}`).toBe(true);
    }
  });

  it("rattache L'Étoffe au compte YouTube n°4 — décision §14 #6", () => {
    const letoffe = ED_COMPTES.filter((c) => c.marqueSlug === "letoffe");
    expect(letoffe).toHaveLength(1);
    expect(letoffe[0]!.ordre).toBe(4);
    expect(letoffe[0]!.plateforme).toBe("youtube");
  });

  it("n'ouvre que les trois comptes réellement actifs", () => {
    // LinkedIn profil, LinkedIn page, site. Tous les autres sont « à ouvrir » :
    // les déclarer actifs les ferait tous rougir en « canal muet » dès J+21.
    const actifs = ED_COMPTES.filter((c) => c.actif).map((c) => c.ordre);
    expect(actifs).toEqual([1, 2, 11]);
  });

  it("🔴 laisse le compte « site » actif mais SANS cadence — décision §14 #2", () => {
    // Le site publie déjà par sa propre chaîne. Lui donner une cadence
    // cible ici reviendrait à le piloter depuis deux endroits — la seconde
    // source de vérité que le §13 classe en risque rouge.
    const site = ED_COMPTES.find((c) => c.ordre === 11);
    expect(site?.plateforme).toBe("site");
    expect(site?.actif).toBe(true);
    expect(site?.cadenceCible).toBeNull();
  });

  it("garde l'emplacement TikTok sans l'activer — §1 bis, reporté", () => {
    const tiktok = ED_COMPTES.find((c) => c.plateforme === "tiktok");
    expect(tiktok).toBeDefined();
    expect(tiktok?.actif).toBe(false);
    expect(tiktok?.note).toMatch(/§14 #1/);
  });

  it("porte les deux comptes que l'import vise", () => {
    const slugs = ED_COMPTES.map((c) => c.slug);
    expect(slugs).toContain("linkedin-williams-jullin");
    expect(slugs).toContain("linkedin-page-axion-ia");
  });
});

describe("les onze règles d'alerte (§9)", () => {
  it("en compte exactement onze", () => {
    expect(ED_REGLES_ALERTE).toHaveLength(ED_REGLES_ALERTE_ATTENDUES);
  });

  it("n'a aucun code en double", () => {
    const codes = ED_REGLES_ALERTE.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("porte les seuils du §9, en base et non dans le code", () => {
    const p = new Map(ED_REGLES_ALERTE.map((r) => [r.code, r.parametres]));
    expect(p.get("asset-retard")?.jours).toBe(3);
    expect(p.get("non-programme")?.jours).toBe(1);
    expect(p.get("canal-muet")?.jours).toBe(21);
    expect(p.get("metriques-absentes")?.jours).toBe(7);
    expect(p.get("tournage-dormant")?.jours).toBe(14);
    expect(p.get("autorisation-manquante")?.jours).toBe(7);
    expect(p.get("derive-identite")?.ecartMaxPoints).toBe(10);
  });

  it("réserve le bloquant aux trois règles que le §9 y met", () => {
    const bloquantes = ED_REGLES_ALERTE.filter((r) => r.gravite === "bloquant").map((r) => r.code);
    expect(bloquantes.sort()).toEqual(["autorisation-manquante", "lien-sans-utm", "non-programme"]);
  });

  it("🔴 ne part immédiatement que sur bloquant — sinon le canal meurt", () => {
    // « Une alerte qui déclenche une notification à chaque fois finit en règle
    // de filtrage dans la boîte de réception — et ne sert plus. »
    expect(GRAVITE_ENVOI_IMMEDIAT).toBe("bloquant");
    const immediates = ED_REGLES_ALERTE.filter((r) => r.gravite === GRAVITE_ENVOI_IMMEDIAT);
    expect(immediates.length).toBeLessThanOrEqual(3);
  });

  it("🔴 ne réveille « canal muet » que sur un compte ACTIF", () => {
    // Huit des onze comptes sont « à ouvrir ». Sans ce garde-fou, l'alerte
    // rougirait huit fois dès le 21ᵉ jour, et on la couperait.
    expect(
      ED_REGLES_ALERTE.find((r) => r.code === "canal-muet")?.parametres.comptesActifsSeulement,
    ).toBe(true);
  });

  it("décrit chaque règle assez pour qu'on sache quoi faire du signal", () => {
    for (const r of ED_REGLES_ALERTE) {
      expect(r.description.length, `règle ${r.code}`).toBeGreaterThan(40);
    }
  });
});

describe("les familles et les specs", () => {
  it("n'a aucun slug de famille en double", () => {
    const slugs = ED_FAMILLES.map((f) => f.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("🔴 n'a aucun alias d'import partagé par deux familles", () => {
    // Un alias ambigu ferait tomber une ligne dans une famille au hasard,
    // selon l'ordre du tableau — un bug invisible et non déterministe.
    const vus = new Map<string, string>();
    for (const f of ED_FAMILLES) {
      for (const a of f.aliasImport) {
        const cle = a.toLowerCase();
        expect(vus.has(cle), `alias « ${a} » partagé avec « ${vus.get(cle)} »`).toBe(false);
        vus.set(cle, f.slug);
      }
    }
  });

  it("ne fait chevaucher aucun alias avec le format « texte seul »", () => {
    const texte = new Set(ALIAS_TEXTE_SEUL.map((a) => a.toLowerCase()));
    for (const f of ED_FAMILLES) {
      for (const a of f.aliasImport) {
        expect(texte.has(a.toLowerCase()), `alias « ${a} » de ${f.slug}`).toBe(false);
      }
    }
  });

  it("garde des durées cohérentes — min sous max", () => {
    for (const f of ED_FAMILLES) {
      if (f.dureeMinSec !== null && f.dureeMaxSec !== null) {
        expect(f.dureeMinSec, `famille ${f.slug}`).toBeLessThan(f.dureeMaxSec);
      }
    }
    for (const s of ED_SPECS_PLATEFORME) {
      if (s.dureeMinSec !== null && s.dureeMaxSec !== null) {
        expect(s.dureeMinSec, `spec ${s.plateforme}/${s.familleSlug}`).toBeLessThan(s.dureeMaxSec);
      }
    }
  });

  it("ne référence que des familles qui existent", () => {
    const connues = new Set(ED_FAMILLES.map((f) => f.slug));
    for (const s of ED_SPECS_PLATEFORME) {
      expect(connues.has(s.familleSlug), `spec ${s.plateforme}/${s.familleSlug}`).toBe(true);
    }
  });

  it("n'a aucun couple plateforme/famille en double — la base l'exige aussi", () => {
    const cles = ED_SPECS_PLATEFORME.map((s) => `${s.plateforme}::${s.familleSlug}`);
    expect(new Set(cles).size).toBe(cles.length);
  });

  it("plafonne le Short YouTube à 60 s, seuil au-delà duquel ce n'en est plus un", () => {
    const spec = ED_SPECS_PLATEFORME.find(
      (s) => s.plateforme === "youtube" && s.familleSlug === "short-vertical",
    );
    expect(spec?.dureeMaxSec).toBe(60);
    expect(spec?.ratio).toBe("9:16");
  });
});
