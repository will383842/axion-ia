/**
 * 🔴 L'alerte `contrat_cdd_non_remis` prescrit un geste — ce geste doit EXISTER.
 *
 * ## Le défaut que cette garde rend impossible, et il a déjà eu lieu
 *
 * Le 2026-09-06, `exemplaire_signe_non_transmis` a été livrée : `critique`,
 * `resolutionAuto: true`, et son message ordonnait « Rouvrez la pièce et
 * relancez la remise ». Le geste n'existait pas pour le stock déjà signé.
 * Résultat : une alerte critique, **inextinguible**, qui ordonnait l'impossible
 * — c'est-à-dire du bruit permanent en tête d'un tableau dont la seule fonction
 * est qu'on regarde les critiques.
 *
 * `contrat_cdd_non_remis` est exactement dans la même configuration :
 *
 *   · `critique` — une requalification de CDD en CDI ne se rattrape pas ;
 *   · `resolutionAuto: true` — elle ne s'éteint QUE si `contratRemisAt` se pose ;
 *   · son message prescrit « consignez la date sur sa fiche ».
 *
 * Si rien n'écrit `contratRemisAt`, l'alerte reste levée pour toujours sur un
 * salarié dont le contrat a peut-être été remis le jour même. Une colonne que
 * personne ne remplit n'est pas une fonctionnalité à moitié faite : ici, c'est
 * une alerte critique définitive.
 *
 * ## 🔑 Pourquoi une garde PROPRE à cette alerte
 *
 * La garde du 06/09 (`l-alerte-prescrit-un-geste-qui-existe.spec.ts`) vérifie la
 * même propriété — prescription ↔ geste disponible — mais elle est écrite pour
 * UNE alerte, en nommant ses fichiers. Elle ne se généralise pas : relier
 * automatiquement une phrase française à l'action qui la satisfait n'est pas
 * quelque chose qu'un test sait faire.
 *
 * Faute de pouvoir généraliser, on RÉPÈTE — une garde par alerte de cette forme.
 * C'est fastidieux et c'est le bon compromis : le coût est d'écrire un fichier,
 * le défaut évité est un dispositif d'alerte qui se détruit lui-même.
 *
 * ⚠️ Cette garde est volontairement écrite AVANT l'écrivain, et elle a d'abord
 * été ROUGE. C'est ce qui a forcé la colonne, l'alerte et son geste à voyager
 * dans la même livraison — au lieu de laisser le geste « pour la prochaine ».
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();

function lire(relatif: string): string {
  return readFileSync(join(RACINE, ...relatif.split("/")), "utf8");
}

const EVALUATEUR = lire("src/server/qualiopi/alertes/evaluateur.ts");
const MODULE_PUR = lire("src/server/rh/remise-contrat.ts");
const ACTION = lire("src/server/actions/qualiopi/trainer-contrat.ts");
const PANNEAU = lire("src/components/admin/qualiopi/TrainerContratTravailPanel.tsx");

describe("🔴 la remise d'un CDD a un geste qui existe", () => {
  it("l'alerte prescrit bien de CONSIGNER une date — sinon cette garde surveille autre chose", () => {
    // Témoin de prémisse. Sans lui, une reformulation du message ferait passer
    // tout le fichier sur du vide, et le lien prescription ↔ geste serait rompu
    // sans que rien ne rougisse.
    expect(
      MODULE_PUR,
      "le message de `contrat_cdd_non_remis` ne prescrit plus de consigner la date. " +
        "Si la prescription a changé, cette garde doit changer avec elle : elle " +
        "vérifie qu'un geste PRESCRIT est un geste DISPONIBLE.",
    ).toMatch(/consignez la date/i);
  });

  it("l'alerte est bien branchée dans l'évaluateur", () => {
    expect(EVALUATEUR).toContain('{ nom: "contrat_cdd_non_remis", fn: regleContratCddNonRemis }');
    expect(EVALUATEUR).toContain("remiseCddEnSouffrance(");
  });

  it("🔴 UNE ACTION ÉCRIT `contratRemisAt` — sans elle l'alerte est inextinguible", () => {
    // LE test. `resolutionAuto: true` veut dire que l'alerte ne s'éteint que si
    // la donnée change. Si rien ne l'écrit, elle reste critique pour toujours,
    // sur un salarié dont le contrat a peut-être été remis le jour même.
    expect(
      ACTION,
      "aucune action n'écrit `contratRemisAt`. L'alerte `contrat_cdd_non_remis` est " +
        "`critique` et `resolutionAuto: true` : elle ne s'éteint QUE si cette colonne " +
        "se pose. Sans écrivain, elle ordonne un geste impossible — exactement le " +
        "défaut du 2026-09-06 sur `exemplaire_signe_non_transmis`.",
    ).toContain("contratRemisAt");
    expect(
      ACTION,
      "l'action qui consigne la remise n'est pas exportée sous le nom attendu.",
    ).toContain("export async function consignerRemiseContratAction");
  });

  it("le geste est une action d'ADMINISTRATION, gardée", () => {
    const depart = ACTION.indexOf("export async function consignerRemiseContratAction");
    expect(depart).toBeGreaterThan(-1);
    const corps = ACTION.slice(depart, depart + 4000);
    expect(
      corps,
      "consigner une remise est un fait OPPOSABLE — c'est elle qu'on produirait " +
        "devant un conseil de prud'hommes. Elle ne peut pas être ouverte à tout compte.",
    ).toMatch(/requireHabilitation\(|requireAdminWrite\(/);
  });

  it("🔑 l'ÉCRAN offre le geste — une action sans surface n'est pas un geste", () => {
    // Le pendant exact du défaut symétrique : une action complète qu'aucun
    // écran n'appelle est aussi inatteignable qu'une action absente. L'opérateur
    // qui lit l'alerte doit trouver le bouton là où la fiche parle du contrat.
    expect(
      PANNEAU,
      "le panneau du contrat n'appelle pas `consignerRemiseContratAction` : " +
        "l'alerte prescrirait un geste que personne ne peut poser depuis l'écran.",
    ).toContain("consignerRemiseContratAction");
  });
});
