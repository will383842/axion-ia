/**
 * aucune-promesse-d-espace-apporteur.spec.ts
 *
 * 🔴 POURQUOI CE FICHIER EXISTE.
 *
 * La copy publique de `/devenir-commercial-ia` répondait ceci à la question
 * « Comment suis-je sûr de toucher mes commissions ? » :
 *
 *   « Chaque entreprise démarchée est enregistrée sur VOTRE DASHBOARD à votre nom.
 *     Toute vente signée [...] déclenche votre commission, tracée de bout en bout. »
 *
 * Ce tableau de bord n'existe pas. Il est le projet **Axion Partners**, dépôt
 * séparé : au 2026-09-07 la zone « espace » y compte 43 tâches pour 38,25 jours,
 * TOUTES `a_faire`. Les deux écrans exactement promis sont `UX-P1-05`
 * (« Mes entreprises ») et `UX-P2-01` (« Mes commissions »).
 *
 * 🔑 CE N'ÉTAIT PAS UN ORNEMENT. Le dashboard était présenté comme LE MÉCANISME
 * qui protège l'apporteur, en réponse directe à sa question sur la sécurité de sa
 * rémunération — et le bouton « Postuler » est ouvert.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POURQUOI CETTE GARDE A ÉTÉ RÉÉCRITE — c'est la vraie leçon.
 *
 * Sa PREMIÈRE version (PR #1021) importait CINQ exports nommés d'UN seul module,
 * `commercial-offer.ts`. Elle est passée VERTE, et la promesse est restée EN
 * LIGNE dans deux autres fichiers :
 *
 *   · `src/app/[locale]/devenir-commercial-ia/page.tsx` — le JSON-LD `JobPosting`,
 *     « suivre les comptes sur un dashboard », lu par Google ;
 *   · `src/components/services/devenir-commercial/CommercialHowItWorks.tsx` — le
 *     résumé accessible, « 03 vous tracez vos entreprises sur votre dashboard ».
 *
 * Cause racine : la recherche initiale utilisait des globs de chemin
 * (`src/components/recrutement/**`, `src/app/[locale]/**` à crochets échappés).
 * Le composant fautif vit sous `src/components/services/devenir-commercial/`, et
 * le glob ne matchait rien. **La recherche n'a pas échoué : elle a été AVEUGLE**,
 * ce qui est indiscernable d'un « rien à signaler ».
 *
 * > **Un périmètre écrit à la main ne protège que ce dont on se souvient.**
 * > Celui-ci est DÉRIVÉ DU DISQUE : tout fichier ajouté au parcours apporteur
 * > entre dans la garde sans que personne ait à y penser.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ce que cette garde tient : tant que l'espace n'est pas EN LIGNE, la copy décrit
 * le processus réel (une déclaration à l'équipe) et n'annonce aucun outil en
 * libre-service. Le jour où `UX-P1-05` et `UX-P2-01` sont déployées, elle se
 * RETIRE — c'est un cliquet contre l'annonce d'un outil AU PRÉSENT, pas une
 * interdiction permanente.
 *
 * ⚠️ Elle ne remplace pas `JUR-T29` (« copy publique de rémunération en formulation
 * indicative »), qui traite un défaut DIFFÉRENT — la fermeté des montants.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Les racines du parcours apporteur. Chacune est BALAYÉE RÉCURSIVEMENT : on ne
 * nomme pas des fichiers, on nomme des territoires.
 */
const RACINES = [
  "src/content/recrutement",
  "src/components/recrutement",
  "src/components/services/devenir-commercial",
  "src/app/[locale]/devenir-commercial-ia",
  "src/app/[locale]/apporteur-affaires-independant-formation-ia-entreprise",
] as const;

const EXTENSIONS = [".ts", ".tsx"];

function fichiersDe(racine: string): string[] {
  let entrees: string[];
  try {
    entrees = readdirSync(racine);
  } catch {
    // 🔑 Une racine disparue est un ÉCHEC, pas un silence : si le parcours est
    // renommé, la garde doit le dire au lieu de balayer le vide et verdir.
    throw new Error(
      `Racine introuvable : « ${racine} ». Le parcours apporteur a été déplacé ou renommé — ` +
        "mettre à jour RACINES, sinon cette garde ne lit plus rien et verdit sur n'importe quoi.",
    );
  }
  const out: string[] = [];
  for (const e of entrees) {
    const p = join(racine, e);
    if (statSync(p).isDirectory()) out.push(...fichiersDe(p));
    else if (EXTENSIONS.some((x) => p.endsWith(x)) && !p.includes("__tests__")) out.push(p);
  }
  return out;
}

function parcoursApporteur(): { chemin: string; texte: string }[] {
  return RACINES.flatMap(fichiersDe).map((chemin) => ({
    chemin,
    texte: readFileSync(chemin, "utf8"),
  }));
}

/**
 * Les tournures qui annoncent un outil APPARTENANT à l'apporteur, ou un suivi
 * automatique qui n'existe pas.
 *
 * ⚠️ On vise la POSSESSION et l'USAGE, jamais le mot seul : Axion-IA vend par
 * ailleurs des tableaux de bord à ses clients (`automatisations.ts`,
 * `sites-web-capabilities.ts`, la page d'accueil), et ces pages-là sont
 * LÉGITIMES. Une garde qui interdirait « dashboard » partout forcerait à retirer
 * du texte vrai — et une garde qu'on doit contourner est une garde morte.
 */
const PROMESSES_D_OUTIL: readonly (readonly [RegExp, string])[] = [
  [/votre dashboard/i, "possession — « votre dashboard »"],
  [/sur un dashboard/i, "usage — « sur un dashboard » (JSON-LD JobPosting)"],
  [/your dashboard/i, "possession (EN)"],
  [/on a dashboard/i, "usage (EN)"],
  [/sur votre (?:tableau de bord|espace)/i, "possession — variante FR"],
  [/votre espace (?:apporteur|personnel|commercial)/i, "possession — « votre espace »"],
  [/trac[ée]e? de bout en bout/i, "traçabilité automatique inexistante"],
];

describe("le parcours apporteur n'annonce aucun espace en libre-service tant qu'il n'existe pas", () => {
  it("ne promet aucun outil possédé par l'apporteur, dans AUCUN fichier du parcours", () => {
    const fautes: string[] = [];
    for (const { chemin, texte } of parcoursApporteur()) {
      for (const [motif, famille] of PROMESSES_D_OUTIL) {
        const m = texte.match(motif);
        if (m) fautes.push(`${chemin} — [${famille}] « ${m[0]} »`);
      }
    }
    expect(
      fautes,
      "Axion Partners n'est pas déployé : `UX-P1-05` (« Mes entreprises ») et " +
        "`UX-P2-01` (« Mes commissions ») sont `a_faire`. Décrire le processus réel " +
        "— l'apporteur DÉCLARE ses entreprises, l'équipe les enregistre — ou déployer " +
        "l'espace avant de l'annoncer.",
    ).toEqual([]);
  });

  /**
   * 🔑 TÉMOIN POSITIF — sans lui, le test ci-dessus verdirait aussi bien sur un
   * périmètre VIDE. « Je n'ai rien trouvé » et « je n'ai rien lu » sont deux
   * phrases différentes, et une seule autorise à conclure.
   *
   * Les deux fichiers nommés ici sont EXACTEMENT ceux que la première version de
   * cette garde ne voyait pas : elle échoue désormais si on cesse de les lire.
   */
  it("lit bien tout le parcours, et pas une poignée de fichiers", () => {
    const lus = parcoursApporteur();
    expect(lus.length).toBeGreaterThanOrEqual(18);
    expect(lus.reduce((n, f) => n + f.texte.length, 0)).toBeGreaterThan(200_000);
    expect(lus.map((f) => f.chemin.replace(/\\/g, "/"))).toEqual(
      expect.arrayContaining([
        expect.stringContaining("devenir-commercial-ia/page.tsx"),
        expect.stringContaining("CommercialHowItWorks.tsx"),
        expect.stringContaining("commercial-offer.ts"),
      ]),
    );
  });

  it("décrit le processus qui existe vraiment", () => {
    const tout = parcoursApporteur()
      .map((f) => f.texte)
      .join("\n");
    expect(tout).toMatch(/vous nous déclarez les entreprises démarchées/i);
    expect(tout).toMatch(/enregistrée à votre nom par notre équipe/i);
    expect(tout).toMatch(/cette déclaration fait foi/i);
    expect(tout).toMatch(/vous nous déclarez vos entreprises à votre nom/i);
  });
});
