/**
 * 🔴 L'ORDRE PERMANENT « TVA TOUJOURS FACTURÉE » EST DANS LE CODE, PAS SEULEMENT
 * DANS UN DOCUMENT — ET LE VERROU EST AU POINT DE **CRÉATION**.
 *
 * ## L'écart, tel qu'il a été trouvé
 *
 * Ordre permanent de Will : « TVA toujours facturée, jamais d'exonération ». Le
 * code disait autre chose — `exoneration_261` et `franchise_293b` étaient des
 * chemins de première classe, le régime relu depuis la config à CHAQUE émission
 * (huit sites), et un `tauxTvaPercent: 0` par ligne — **une saisie utilisateur**
 * (`FactureLibreForm`, champ « TVA % ») — court-circuitait tout.
 *
 * Le défaut était bien `assujetti`, donc rien de faux n'est parti. Mais rien ne
 * l'empêchait, et l'asymétrie compte : **une facture émise fige son régime**.
 * La corriger après coup ne se fait pas par une modification, mais par un avoir.
 *
 * ## 🔴 CE QUE LES TESTS EXISTANTS ONT CORRIGÉ DANS MA CONCEPTION
 *
 * Le premier jet posait le verrou au point d'**usage** — dans `tauxTvaLigne` et
 * `mentionTvaKey` — au motif que « tous les chemins y passent ». C'était
 * séduisant et **faux**, et neuf tests l'ont dit :
 *
 * > Ces fonctions servent DEUX moments qu'elles ne peuvent pas distinguer : le
 * > calcul d'une pièce qu'on CRÉE, et le RE-RENDU d'une pièce déjà émise.
 *
 * Y verrouiller réimprimait à 20 % une facture partie exonérée, et émettait un
 * avoir à 20 % contre elle — c'est-à-dire **falsifier un document opposable au
 * lieu d'empêcher un document futur**. Un avoir qui ne porte pas le régime de sa
 * facture ne l'annule plus : les deux pièces restent au registre en se
 * contredisant.
 *
 * Le verrou vit donc là où un régime est **CHOISI**, jamais là où il est
 * **REPRODUIT**. C'est l'invariant que ce fichier surveille, et il est plus fin
 * que « aucun chemin ne contourne » : il faut aussi que les chemins de
 * reproduction, eux, **ne soient pas verrouillés**.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const NL = String.fromCharCode(10);

function lire(relatif: string): string {
  return readFileSync(join(RACINE, ...relatif.split("/")), "utf8");
}

const TVA = lire("src/server/qualiopi/legal/tva.ts");
const LIGNES_PUR = lire("src/server/qualiopi/financements/facture-libre-pur.ts");

/** Les modules qui RÉSOLVENT un régime depuis la configuration — donc qui créent. */
const SITES_DE_CREATION = [
  "src/server/actions/qualiopi/devis.ts",
  "src/server/actions/qualiopi/factures-inter.ts",
  "src/server/actions/qualiopi/financements.ts",
  "src/server/qualiopi/coaching-1to1/facturation-1to1.ts",
  "src/server/qualiopi/financements/facturation-service.ts",
  "src/server/qualiopi/financements/facture-libre.ts",
  "src/server/qualiopi/financements/plan-recurrent.ts",
] as const;

describe("🔴 le verrou TVA est au point de CRÉATION", () => {
  it("le verrou existe, rend toujours `assujetti`, et le DIT", () => {
    const depart = TVA.indexOf("export function regimeTvaApplique");
    expect(depart, "`regimeTvaApplique` a disparu").toBeGreaterThan(-1);
    const v = TVA.slice(depart, depart + 900);
    expect(
      v,
      "`regimeTvaApplique` ne rend plus `assujetti` de façon inconditionnelle : " +
        "l'ordre permanent redevient un document que le code ne fait pas.",
    ).toContain('return "assujetti"');
    expect(
      v,
      "le verrou ne dit plus rien quand il corrige : un verrou muet laisse croire " +
        "que la configuration a été prise en compte.",
    ).toContain("console.error");
  });

  it("🔴 CHAQUE site qui résout un régime depuis la config passe par le verrou", () => {
    // C'est l'invariant central. Un site ajouté demain qui écrirait
    // `isRegimeTva(x) ? x : REGIME_TVA_DEFAUT` rouvrirait le trou en silence.
    // ⚠️ Une résolution SANS verrou reste légitime sur un chemin de reproduction
    // (avoir, re-rendu d'une pièce émise). Mais elle doit être DÉCLARÉE, jamais
    // devinée : on exige la mention `ADR 0050` dans les lignes qui précèdent.
    // Sans cette exigence, la garde aurait dû choisir entre épingler des
    // exemptions légitimes et laisser passer les vraies fautes — c'est-à-dire
    // ne rien garder du tout.
    const fautifs: string[] = [];
    for (const chemin of SITES_DE_CREATION) {
      const src = lire(chemin);
      if (!src.includes("regimeTvaDepuisConfig")) {
        fautifs.push(`${chemin} (verrou absent)`);
      }
      const lignes = src.split(NL);
      lignes.forEach((ligne, i) => {
        if (!/isRegimeTva\([^)]*\)/.test(ligne)) return;
        // On remonte le BLOC DE COMMENTAIRE contigu, pas un nombre arbitraire de
        // lignes : une fenêtre fixe rougit dès qu'une justification s'allonge
        // d'une phrase — c'est-à-dire qu'elle sanctionne l'explication. La
        // frontière naturelle de la déclaration est le commentaire lui-même.
        let debut = i;
        while (debut > 0 && lignes[debut - 1]!.trim().startsWith("//")) debut--;
        const contexte = lignes.slice(debut, i).join(NL);
        if (!contexte.includes("ADR 0050")) {
          fautifs.push(`${chemin}:${i + 1} (résolution non verrouillée, non déclarée)`);
        }
      });
    }
    expect(
      fautifs,
      "ces modules résolvent un régime de TVA sans passer par `regimeTvaDepuisConfig` : " +
        "un `regime_tva` mal saisi y produirait de nouveau des factures à 0 %.",
    ).toEqual([]);
  });

  it("🔴 les chemins de REPRODUCTION ne sont PAS verrouillés — et c'est voulu", () => {
    // La moitié que mon premier jet avait cassée, et que neuf tests ont
    // rattrapée. Une pièce déjà émise doit se re-rendre TELLE QU'ELLE EST.
    const avoir = lire("src/server/qualiopi/financements/facture-libre.ts");
    expect(
      /origine\.regimeTva\)\s*\n?\s*\?\s*origine\.regimeTva|isRegimeTva\(origine\.regimeTva\)/.test(
        avoir,
      ),
      "l'avoir passe par le verrou : il porterait 20 % contre une facture émise " +
        "exonérée, et cesserait de l'annuler. Une facture émise fige son régime — " +
        "c'est ce qui la rend opposable.",
    ).toBe(true);

    for (const nom of ["tauxTvaLigne", "mentionTvaKey"]) {
      const depart = TVA.indexOf(`export function ${nom}`);
      const suite = TVA.indexOf("\nexport ", depart + 10);
      const corps = TVA.slice(depart, suite === -1 ? TVA.length : suite);
      expect(
        corps.includes("regimeTvaApplique("),
        `\`${nom}\` applique le verrou. Or elle sert AUSSI à re-rendre une pièce ` +
          "déjà émise, qu'elle ne peut pas distinguer d'une pièce en cours de " +
          "création : elle réimprimerait à 20 % une facture partie exonérée.",
      ).toBe(false);
    }
  });

  it("🔴 la moitié DISCRÈTE : le taux de ligne est borné À LA CRÉATION", () => {
    // Le régime est visible — config, écran, audit. Un `tauxTvaPercent: 0` posé
    // sur une ligne ne l'est pas, et c'est une SAISIE UTILISATEUR. Il
    // court-circuitait le régime et toute lecture d'écran.
    expect(TVA, "le clamp de création a disparu du module TVA").toContain(
      "export function clampTauxLigneCreation",
    );
    expect(
      LIGNES_PUR,
      "`normaliserLignesPourActivite` n'applique plus le clamp : un taux de ligne " +
        "saisi à 0 % redevient une exonération silencieuse que rien ne montre.",
    ).toContain("clampTauxLigneCreation(");
  });

  it("le clamp borne vers le BAS seulement — il ne fige pas un taux", () => {
    // Sans ce témoin, quelqu'un « simplifierait » le clamp en une égalité et
    // fermerait les taux supérieurs sans s'en apercevoir. Le verrou existe pour
    // ne jamais SOUS-facturer, pas pour interdire un autre taux.
    const depart = TVA.indexOf("export function clampTauxLigneCreation");
    expect(
      TVA.slice(depart, depart + 400),
      "le clamp ne compare plus au standard : il fige au lieu de borner.",
    ).toContain("taux >= tauxStandard");
  });

  it("🔴 AUCUNE porte dérobée par variable d'environnement", () => {
    // Décision de l'ADR 0050 : un drapeau est une porte, et un incident de
    // configuration l'ouvre. L'ordre est absolu, le verrou doit l'être. La levée
    // passe par une attestation DREETS, un ADR et une fonction — jamais par un
    // réglage.
    expect(
      /process\.env|TVA_EXONERATION|AUTORIS/i.test(TVA),
      "une échappatoire par variable d'environnement est apparue dans `tva.ts` : " +
        "l'ADR 0050 l'a explicitement rejetée.",
    ).toBe(false);
  });
});
