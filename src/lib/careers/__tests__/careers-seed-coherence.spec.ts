// Cohérence entre le texte des annonces (`careers-gen/<slug>.json`) et les
// paramètres qui les accompagnent (`careers_seed_input.json`).
//
// Deux défauts réels, trouvés le 2026-09-02, que RIEN ne détectait :
//
//  1. Le corps de `monteur-video-motion` annonçait « 28 000 à 42 000 euros » là
//     où le fichier de paramètres portait 21 000. La page aurait affiché une
//     carte « 21k–42k » au-dessus d'un paragraphe promettant 28 000, et Google
//     for Jobs aurait reçu `minValue: 21000`. 39 offres étaient dans ce cas.
//  2. Neuf `metaDescription` dépassaient 160 caractères. Le seed les tronque
//     par `cut()` : la clause finale disparaissait des résultats de recherche,
//     silencieusement.
//
// Ces deux gardes portent sur TOUTES les offres, pas sur celles qu'on vient de
// corriger : c'est ce qui les rend utiles à la prochaine annonce écrite.

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../../../..");
const GEN = join(ROOT, "careers-gen");

interface Poste {
  slug: string;
  sal_min: number;
  sal_max: number;
}
interface Gen {
  titleFr: string;
  summaryFr: string;
  bodyFrHtml: string;
  metaTitle: string;
  metaDescription: string;
}

const POSTES: Poste[] = (
  JSON.parse(readFileSync(join(ROOT, "careers_seed_input.json"), "utf8")) as { postes: Poste[] }
).postes;

/** Offres dont le texte existe — les autres ne sont pas encore rédigées. */
const REDIGEES: Array<{ poste: Poste; gen: Gen }> = POSTES.filter((p) =>
  existsSync(join(GEN, `${p.slug}.json`)),
).map((poste) => ({
  poste,
  gen: JSON.parse(readFileSync(join(GEN, `${poste.slug}.json`), "utf8")) as Gen,
}));

/** Limites des colonnes DB, appliquées par `cut()` dans les scripts de seed. */
const LIMITES: Array<[keyof Gen, number]> = [
  ["titleFr", 160],
  ["summaryFr", 320],
  ["metaTitle", 70],
  ["metaDescription", 160],
];

/** « 28 000 à 42 000 euros », « 26 000 et 40 000 € »… */
const FOURCHETTE = /(\d{2})\s?(\d{3})\s*(?:à|et|–|-)\s*(\d{2})\s?(\d{3})\s*(?:euros|€)/;

function fourchetteDuCorps(html: string): [number, number] | null {
  const m = FOURCHETTE.exec(html.replace(/<[^>]+>/g, " "));
  if (!m) return null;
  return [Number(m[1]! + m[2]!), Number(m[3]! + m[4]!)];
}

describe("careers-gen — aucun texte tronqué au seed", () => {
  it.each(LIMITES)("%s tient dans %i caractères sur toutes les offres", (champ, limite) => {
    const trop = REDIGEES.filter(({ gen }) => gen[champ].length > limite).map(
      ({ poste, gen }) => `${poste.slug} (${gen[champ].length})`,
    );
    expect(trop, `dépassements de ${String(champ)} — cut() les amputerait`).toEqual([]);
  });
});

describe("careers-gen — le salaire écrit et le salaire structuré disent la même chose", () => {
  it("aucune offre n'annonce dans son corps une fourchette différente de la sienne", () => {
    const contradictions = REDIGEES.map(({ poste, gen }) => {
      const corps = fourchetteDuCorps(gen.bodyFrHtml);
      if (!corps) return null;
      if (corps[0] === poste.sal_min && corps[1] === poste.sal_max) return null;
      return `${poste.slug} : corps ${corps[0]}-${corps[1]}, paramètres ${poste.sal_min}-${poste.sal_max}`;
    }).filter((x): x is string => x !== null);
    expect(contradictions).toEqual([]);
  });

  // Une offre sans fourchette structurée n'affiche AUCUNE carte de rémunération :
  // annoncer un montant dans le corps y serait invisible du JSON-LD, donc du
  // filtre « salaire » de Google for Jobs. C'est le cas du monteur vidéo
  // freelance — rémunéré à la prestation, prix discuté de vive voix.
  it("une offre sans fourchette n'annonce pas de montant dans son corps", () => {
    const incoherentes = REDIGEES.filter(
      ({ poste, gen }) =>
        !poste.sal_min && !poste.sal_max && fourchetteDuCorps(gen.bodyFrHtml) !== null,
    ).map(({ poste }) => poste.slug);
    expect(incoherentes).toEqual([]);
  });
});
