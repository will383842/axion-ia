/**
 * Garde — les raisons écrites dans `TYPES_HORS_LOT_DOCUMENTS_AUTO` sont VRAIES.
 *
 * ## Le défaut que cette garde ferme (2026-09-05)
 *
 * Le commentaire de `production-au-jalon.ts` rangeait `certificat_realisation`
 * avec les deux attestations et justifiait l'exclusion des trois d'un seul mot :
 * « leur circuit automatique EXISTE (`attestation-service` + cron
 * `attestations-auto`) ».
 *
 * C'était vrai des attestations. **Faux du certificat** : `attestation-service`
 * ne produit que `attestation` et `attestation_partielle`, aucun worker ni cron
 * ne l'émet, et le seul producteur est une Server Action — donc un clic admin.
 *
 * Un commentaire qui justifie une exclusion par un câblage inexistant est pire
 * que pas de commentaire : il ferme la question au lecteur suivant, qui n'ira
 * pas vérifier. Et il ferait passer une pièce jamais émise pour une pièce
 * automatique — exactement le genre d'erreur qu'un auditeur relève, puisqu'il
 * demande où sont les certificats que le logiciel est censé produire seul.
 *
 * ## Ce que cette garde mesure, et ce qu'elle ne mesure pas
 *
 * Un commentaire ne se teste pas. Ce qui se teste, ce sont les DEUX FAITS sur
 * lesquels il repose — et ce sont eux qui pourraient pourrir sans bruit.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { TYPES_HORS_LOT_DOCUMENTS_AUTO } from "./production-au-jalon";

const RACINE = process.cwd();
const ATTESTATION_SERVICE = join(
  RACINE,
  "src",
  "server",
  "qualiopi",
  "evaluations",
  "attestation-service.ts",
);
const WORKERS_DIR = join(RACINE, "src", "server", "queue", "workers");
const ACTION_CERTIFICAT = join(RACINE, "src", "server", "actions", "qualiopi", "documents.ts");

/** Émission d'une pièce : `type: "<valeur>"` passé à `generateDocument`. */
function emetLaPiece(source: string, type: string): boolean {
  return new RegExp(`type:\\s*"${type}"`).test(source);
}

describe("les exclusions de la production au jalon disent la vérité", () => {
  it("les quatre types annoncés hors lot le sont réellement", () => {
    expect([...TYPES_HORS_LOT_DOCUMENTS_AUTO].sort()).toEqual([
      "attestation",
      "attestation_partielle",
      "certificat_realisation",
      "releve_connexion",
    ]);
  });

  it("TÉMOIN POSITIF — le circuit automatique des ATTESTATIONS existe bel et bien", () => {
    // Sans ce témoin, la vérification suivante ne distinguerait pas « le
    // certificat n'a pas de circuit » de « la sonde ne trouve aucun circuit ».
    const source = readFileSync(ATTESTATION_SERVICE, "utf8");
    expect(source).toContain('const docType = resultat === "complete"');
    expect(source).toContain('"attestation"');
    expect(source).toContain('"attestation_partielle"');
  });

  it("TÉMOIN POSITIF — la sonde SAIT reconnaître une émission de certificat", () => {
    // Elle en trouve une, là où elle doit s'en trouver une : la Server Action.
    // C'est ce témoin qui rend interprétable le zéro du test suivant.
    const source = readFileSync(ACTION_CERTIFICAT, "utf8");
    expect(emetLaPiece(source, "certificat_realisation")).toBe(true);
  });

  it("AUCUN worker ni cron n'émet le certificat de réalisation — clic admin seulement", () => {
    const coupables = readdirSync(WORKERS_DIR)
      .filter((f) => f.endsWith(".ts") && !f.includes(".spec."))
      .filter((f) =>
        emetLaPiece(readFileSync(join(WORKERS_DIR, f), "utf8"), "certificat_realisation"),
      );

    expect(
      coupables,
      "un worker émet désormais le certificat de réalisation. Sa garde (taux mesuré + " +
        "trace vérifiable) vit dans la Server Action : la brancher ailleurs en fait une " +
        "SECONDE copie, et deux gardes jumelles divergent le jour où l'on corrige l'une. " +
        "Faire descendre la garde dans un service partagé D'ABORD, puis mettre à jour le " +
        "commentaire de TYPES_HORS_LOT_DOCUMENTS_AUTO.",
    ).toEqual([]);
  });

  it("`attestation-service` n'émet PAS le certificat, contrairement à ce que le commentaire disait", () => {
    const source = readFileSync(ATTESTATION_SERVICE, "utf8");
    expect(emetLaPiece(source, "certificat_realisation")).toBe(false);
  });
});
