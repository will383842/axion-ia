// @vitest-environment node

/**
 * Verrou — une alerte sur la panne du canal ne repart pas par le canal.
 *
 * ## Ce qui s'est passé, mesuré en production le 2026-09-17
 *
 * `server/email/health.ts` affirme en en-tête que `notifierAlerteInterne()`
 * n'est « volontairement PAS appelé ici ». Vrai du site d'appel, faux du
 * système : la sonde crée une alerte `critique`, et `notifierAlertesGroupees`
 * ramasse toute alerte critique non notifiée pour l'envoyer… par e-mail.
 *
 * Trace relevée : une alerte `emails_en_echec` du 16/09 08:20, `resolue=false`,
 * `notified_at = 17/09 07:00` — et l'e-mail `qualiopi-alerte-interne`
 * correspondant en `failed` au même horodatage. `enqueueEmail` ayant réussi
 * (Redis vivant, seul SMTP mort), le claim n'a pas été relâché : la sélection du
 * tour suivant exigeant `notifiedAt: null`, l'alerte était condamnée au silence
 * définitif, même après réparation.
 *
 * ## Pourquoi ce test DÉRIVE au lieu de comparer deux listes
 *
 * `catalogue.spec.ts` porte une liste tenue à la main ; elle est restée fausse
 * quinze jours sans que rien ne rougisse. Ce fichier-ci lit la SONDE, en extrait
 * les codes qu'elle passe à `leverAlerte`, et exige que chacun soit hors bande.
 * Un sixième code ajouté demain rougira le jour où il sera écrit.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CODES_HORS_BANDE, estHorsBande } from "./hors-bande";
import { ALERTE_CATALOGUE } from "./catalogue";

const SONDE = "src/server/email/health.ts";
const ENVOI_GROUPE = "src/server/qualiopi/alertes/envoi-groupe.ts";

function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

function codesLeves(code: string): string[] {
  const trouves = new Set<string>();
  for (const m of code.matchAll(/leverAlerte\(\s*(?:\n\s*)?"([a-z_]+)"/g)) {
    trouves.add(m[1] as string);
  }
  return [...trouves].sort();
}

const sourceSonde = readFileSync(join(process.cwd(), SONDE), "utf8");
const codes = codesLeves(sansCommentaires(sourceSonde));
const sourceEnvoi = readFileSync(join(process.cwd(), ENVOI_GROUPE), "utf8");

describe("les alertes de la sonde e-mail ne repartent pas par e-mail", () => {
  it("🔑 la lecture de la sonde trouve bien des codes", () => {
    // Contre-témoin indispensable : si le motif cessait de mordre, la boucle
    // ci-dessous tournerait à vide et ce fichier serait vert en ne mesurant
    // rien — le travers que ce dépôt nomme « un contrôle vert qui ne regarde
    // rien », et qu'il a déjà rencontré sur ce même motif.
    expect(codes.length).toBeGreaterThanOrEqual(5);
  });

  it("🔴 CHAQUE code levé par la sonde est déclaré hors bande", () => {
    const dedans = codes.filter((c) => !estHorsBande(c));
    expect(
      dedans,
      `ces codes décrivent la panne du canal e-mail et repartiraient PAR e-mail : ` +
        `${dedans.join(", ")}. L'envoi réussit (Redis vivant), donc le claim n'est pas ` +
        `relâché, et l'alerte n'est plus jamais notifiée — même après réparation.`,
    ).toEqual([]);
  });

  it("🔴 l'envoi groupé EXCLUT réellement ces codes de sa sélection", () => {
    // Déclarer la liste ne suffit pas : il faut que l'appelant la lise. Sans
    // cette assertion, `hors-bande.ts` pourrait être un fichier mort et le test
    // précédent resterait vert.
    const code = sansCommentaires(sourceEnvoi);
    expect(code).toContain("CODES_HORS_BANDE");
    expect(code, "l'exclusion doit porter sur la REQUÊTE de sélection").toMatch(
      /code:\s*\{\s*notIn:\s*\[\.\.\.CODES_HORS_BANDE\]\s*\}/,
    );
  });

  it("🔑 CONTRE-TÉMOIN : la liste n'avale pas les alertes qui DOIVENT partir par e-mail", () => {
    // Une liste qui contiendrait tout éteindrait la notification de TOUTES les
    // alertes critiques — une réparation pire que le défaut. On vérifie qu'un
    // échantillon de codes critiques sans rapport avec l'e-mail reste dedans.
    for (const c of ["emargement_manquant", "qualiopi_expire", "facture_impayee_j60"]) {
      expect(c in ALERTE_CATALOGUE, `code de contrôle absent du catalogue : ${c}`).toBe(true);
      expect(estHorsBande(c), `« ${c} » ne doit PAS être hors bande`).toBe(false);
    }
  });

  it("chaque code hors bande existe au catalogue", () => {
    const fantomes = CODES_HORS_BANDE.filter((c) => !(c in ALERTE_CATALOGUE));
    expect(fantomes, `codes hors bande inconnus du catalogue : ${fantomes.join(", ")}`).toEqual([]);
  });
});
