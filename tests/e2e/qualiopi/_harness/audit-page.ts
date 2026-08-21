/**
 * Harnais d'audit de page — audit de certification Qualiopi 2026-07-25.
 *
 * Une seule implémentation, appliquée à une LISTE de routes : c'est ce qui rend
 * l'audit des 166 routes publiques et des 249 routes admin tenable, et surtout
 * REJOUABLE avant chaque audit de surveillance.
 *
 * Détecte l'objectivable — erreurs console, requêtes en échec, violations
 * d'accessibilité bloquantes, textes qui ne devraient jamais atteindre un
 * utilisateur, débordement horizontal. Ne juge ni le sens ni la logique métier :
 * ça reste du travail humain.
 */

import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

/** Motifs qui ne doivent JAMAIS apparaître dans un rendu utilisateur. */
const INTERDITS: ReadonlyArray<readonly [string, RegExp]> = [
  ["undefined", /\bundefined\b/],
  ["NaN", /\bNaN\b/],
  ["Invalid Date", /Invalid Date/],
  ["[object Object]", /\[object Object\]/],
  ["token de gabarit", /\{\{[^}]{1,60}\}\}/],
  ["donnée de démo", /\[DEMO\]/],
  ["lorem ipsum", /lorem ipsum/i],
  ["TODO visible", /\bTODO\b/],
  // Audit F13 : plus aucune affirmation de certification tant que
  // QUALIOPI_CERTIFICATION_OBTENUE !== "true".
  ["revendication Qualiopi", /certifi[ée]\s+Qualiopi|certification qualité a été délivrée/i],
];

export interface ResultatAudit {
  url: string;
  statut: number | null;
  erreursConsole: string[];
  requetesEnEchec: string[];
  axeBloquant: { id: string; help: string; noeuds: number }[];
  textesInterdits: string[];
  debordementA: number[];
  /**
   * Détail du débordement, par largeur fautive : les cinq éléments les plus à
   * droite, avec leur classe et leurs bornes. Vide quand rien ne déborde.
   *
   * Sans ce détail, l'échec dit « ça déborde » et rien d'autre — on ne peut ni
   * le corriger ni le réfuter.
   */
  debordementCoupables: {
    largeur: number;
    scrollWidth: number;
    clientWidth: number;
    fautifs: {
      tag: string;
      classe: string;
      gauche: number;
      droite: number;
      /** `pousse` = ne tient pas dans son parent. `suit` = son parent a grandi. */
      role: "pousse" | "suit";
      depasseSonParentDe: number;
    }[];
  }[];
  msChargement: number;
}

export async function auditerPage(page: Page, url: string): Promise<ResultatAudit> {
  const erreursConsole: string[] = [];
  const requetesEnEchec: string[] = [];

  page.on("console", (m) => {
    if (m.type() === "error") erreursConsole.push(m.text().slice(0, 200));
  });
  page.on("requestfailed", (r) => {
    const t = r.failure()?.errorText ?? "";
    // ERR_ABORTED = navigation annulée, bruit d'instrumentation, pas un défaut.
    if (!t.includes("ERR_ABORTED")) requetesEnEchec.push(`${r.url().slice(0, 90)} — ${t}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400) requetesEnEchec.push(`${r.status()} ${r.url().slice(0, 90)}`);
  });

  const t0 = Date.now();
  const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
  const msChargement = Date.now() - t0;
  await page.waitForTimeout(400); // laisse l'hydratation émettre ses avertissements

  const corps = (
    await page
      .locator("body")
      .innerText()
      .catch(() => "")
  ).slice(0, 200_000);
  const textesInterdits = INTERDITS.filter(([, re]) => re.test(corps)).map(([label]) => label);

  // 🔴 2026-08-21 — CE CONTRÔLE DISAIT « ça déborde » SANS DIRE DE QUOI.
  //
  // La première exécution réelle de la suite (run 32447074166, après réparation
  // de l'ordre des étapes de Gate B) a rendu 167 échecs de débordement, tous au
  // seul viewport 1440 px, sur ~56 routes. Impossible d'en faire quoi que ce
  // soit : le contrôle rend un booléen. Rejoué en local sous `next dev
  // --webpack` sur `/fr`, `/fr/a-propos`, `/fr/audit` et
  // `/fr/formations/entreprise`, aux TROIS protocoles (chargement direct en
  // 1440, protocole exact du harnais, puis après stabilisation) : aucun
  // débordement. Le constat n'est donc pas reproductible hors du build de
  // production, et déclarer 56 pages en défaut sur cette base serait
  // sur-déclarer — la faute que cet audit s'est déjà faite une fois.
  //
  // On ne touche donc PAS au seuil : on rend la mesure DIAGNOSTIQUABLE. Le
  // prochain run nommera les éléments fautifs, leurs classes et leurs bornes,
  // et la question se tranchera sur des faits plutôt que sur des hypothèses.
  const debordementA: number[] = [];
  const debordementCoupables: ResultatAudit["debordementCoupables"] = [];
  for (const w of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(150);
    const mesure = await page.evaluate(() => {
      const racine = document.documentElement;
      const deborde = racine.scrollWidth > racine.clientWidth + 1;
      if (!deborde) return null;
      const limite = racine.clientWidth + 1;

      // 🔴 CORRECTION 2026-08-21, second tour — la première version disait qu'elle
      // écartait les éléments clippés, et ne le faisait PAS. Elle triait par bord
      // droit décroissant : sur `/fr`, le bandeau défilant des logos (`w-max`,
      // 7 172 px, découpé par un `overflow-hidden`) occupait les cinq places et
      // enterrait le vrai coupable, qui n'excède la limite que de 5 px. Un
      // diagnostic qui remonte toujours le même innocent ne vaut pas mieux que
      // pas de diagnostic. On remonte donc réellement les ancêtres.
      const estDecoupe = (el: Element): boolean => {
        let p = el.parentElement;
        while (p !== null && p !== racine) {
          const ox = getComputedStyle(p).overflowX;
          if (ox === "hidden" || ox === "clip" || ox === "auto" || ox === "scroll") return true;
          p = p.parentElement;
        }
        return false;
      };

      // 🔴 TROISIÈME TOUR — « le plus à droite » n'est pas « le coupable ».
      //
      // Les deux versions précédentes triaient par bord droit décroissant. Sur les
      // 454 mesures du premier relevé complet, elles ont invariablement désigné le
      // groupe de CTA du header — qui porte `ml-auto` et se colle donc au bord droit
      // de son conteneur, QUEL QU'IL SOIT. Sa position ne mesure pas une marge :
      // elle rapporte la largeur du document. Le header n'était pas la cause du
      // débordement mais son symptôme, et sur cette lecture j'ai failli remonter
      // `--breakpoint-nav` — c'est-à-dire faire basculer le site en menu tiroir sur
      // les portables les plus répandus, pour un défaut dont il n'est pas l'auteur.
      //
      // Un élément POUSSE quand il ne tient pas dans SON PROPRE PARENT. Il SUIT
      // quand il y tient et que c'est le parent qui a grandi. Seule cette
      // distinction remonte à l'origine.
      type Fautif = {
        tag: string;
        classe: string;
        gauche: number;
        droite: number;
        role: "pousse" | "suit";
        depasseSonParentDe: number;
      };
      const pousseurs: Fautif[] = [];
      const suiveurs: Fautif[] = [];

      for (const el of Array.from(document.querySelectorAll("*"))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.right <= limite && r.left >= -1) continue;
        // Ce qu'un ancêtre découpe ne pousse pas `scrollWidth`.
        if (estDecoupe(el)) continue;

        const p = el.parentElement;
        const pr = p === null ? null : p.getBoundingClientRect();
        const debord = pr === null ? 0 : Math.round(Math.max(r.right - pr.right, pr.left - r.left));
        const commun = {
          tag: el.tagName.toLowerCase(),
          classe: String((el as HTMLElement).className || "").slice(0, 120),
          gauche: Math.round(r.left),
          droite: Math.round(r.right),
          depasseSonParentDe: debord,
        };
        if (debord > 1) pousseurs.push({ ...commun, role: "pousse" });
        else suiveurs.push({ ...commun, role: "suit" });
      }

      return {
        scrollWidth: racine.scrollWidth,
        clientWidth: racine.clientWidth,
        // Les POUSSEURS d'abord — ce sont eux qui expliquent. Les suiveurs ne sont
        // rendus qu'en repli : si rien ne déborde de son parent, la cause est
        // ailleurs (largeur minimale héritée, table, image intrinsèque) et mieux
        // vaut un contexte que le silence.
        fautifs: (pousseurs.length > 0
          ? pousseurs.sort((a, b) => b.depasseSonParentDe - a.depasseSonParentDe)
          : suiveurs.sort((a, b) => b.droite - a.droite)
        ).slice(0, 5),
      };
    });
    if (mesure !== null) {
      debordementA.push(w);
      debordementCoupables.push({ largeur: w, ...mesure });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  let axeBloquant: ResultatAudit["axeBloquant"] = [];
  try {
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    axeBloquant = axe.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => ({ id: v.id, help: v.help, noeuds: v.nodes.length }));
  } catch {
    // axe peut échouer sur une page en erreur : on ne masque pas le reste.
  }

  return {
    url,
    statut: resp?.status() ?? null,
    erreursConsole,
    requetesEnEchec,
    axeBloquant,
    textesInterdits,
    debordementA,
    debordementCoupables,
    msChargement,
  };
}

/** Vrai si la page coche toute la grille §8 du prompt d'audit. */
export function estParfaite(r: ResultatAudit): boolean {
  return (
    r.statut === 200 &&
    r.erreursConsole.length === 0 &&
    r.requetesEnEchec.length === 0 &&
    r.axeBloquant.length === 0 &&
    r.textesInterdits.length === 0 &&
    r.debordementA.length === 0
  );
}
