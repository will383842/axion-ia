/**
 * 🔴 « ATTESTER » EST UN ACTE HABILITÉ — et la garde ne vit nulle part.
 *
 * ## Le constat, trouvé le 2026-08-17 en auditant le Lot 7
 *
 * L'invariant est écrit dans `auth/habilitations.ts` : émettre une attestation
 * **engage l'organisme**, c'est un acte réservé. Mais `genererAttestationPourEnrollment`
 * — la seule fonction qui produit réellement la pièce — **ne porte aucune garde**.
 * La protection est posée **à chaque site d'appel, un par un** :
 *
 *   · `actions/qualiopi/evaluations.ts` → `requireHabilitation("attester")` ✅
 *   · `queue/workers/qualiopi-formation-crons-worker.ts` → **aucune session, aucune
 *     habilitation** — et c'est LÉGITIME : le cron `attestations-auto` émet au nom
 *     du système, sous sa propre garde de chronologie.
 *
 * C'est exactement le défaut de duplication que le Lot 10 a fermé ailleurs :
 * *« une frontière recopiée à chaque appelant finit par diverger, et c'est
 * toujours celle qu'on a oublié de durcir qui sert »*.
 *
 * ## Pourquoi cette garde arrive MAINTENANT
 *
 * ⚠️ Le Lot 7 s'apprête à construire l'**espace formateur comme poste de
 * pilotage**. Le plan y interdit explicitement au formateur d'émettre une
 * attestation — mais rien, dans le code, ne l'en empêcherait : il suffirait
 * d'importer le service. Le trou n'est pas théorique, il est **déjà ouvert** :
 * le cron le franchit tous les jours, sans session.
 *
 * ## Pourquoi un test statique et pas un paramètre obligatoire
 *
 * Imposer une `origine` au service forcerait chaque appelant à déclarer son
 * autorité — plus fort, mais au prix de ~30 sites de test réécrits pour une
 * garde préventive. Ce test obtient le même effet : **il rougit le jour où un
 * module importe le service sans être ni un acte habilité, ni l'émetteur
 * automatique déclaré.** Et il se dérive du code : aucune liste à tenir.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE_SRC = resolve(process.cwd(), "src");
const SERVICE = "evaluations/attestation-service";

/**
 * Le SEUL émetteur automatique autorisé.
 *
 * 🔴 Une entrée ici est une exception à un acte engageant : elle se justifie,
 * elle ne se range pas. Le cron `attestations-auto` émet au nom du système et
 * porte sa PROPRE garde — il ne retient que les inscriptions d'une session
 * `realisee` ayant une évaluation `finale`. Cette garde-là est vérifiée plus
 * bas : sans elle, l'exception deviendrait un trou.
 */
const EMETTEURS_AUTOMATIQUES = ["server/queue/workers/qualiopi-formation-crons-worker.ts"];

/** Tous les fichiers `.ts`/`.tsx` de `src`, hors tests. */
function fichiersSource(dossier: string, acc: string[] = []): string[] {
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      if (entree === "__tests__" || entree === "node_modules") continue;
      fichiersSource(chemin, acc);
      continue;
    }
    if (!/\.tsx?$/.test(entree)) continue;
    if (/\.(spec|test)\.tsx?$/.test(entree)) continue;
    acc.push(chemin);
  }
  return acc;
}

const SOURCES = fichiersSource(RACINE_SRC);

/** Les modules de production qui importent le service d'attestation. */
const IMPORTATEURS = SOURCES.filter((f) => {
  const rel = relative(RACINE_SRC, f).replace(/\\/g, "/");
  if (rel.startsWith("server/qualiopi/evaluations/attestation-service")) return false;
  return readFileSync(f, "utf-8").includes(SERVICE);
}).map((f) => relative(RACINE_SRC, f).replace(/\\/g, "/"));

describe("🔴 émettre une attestation reste un acte habilité", () => {
  it("l'inventaire des importateurs n'est pas vide", () => {
    // Sans ceci, un changement de chemin du service viderait la liste et TOUS
    // les tests ci-dessous passeraient au vert en ne vérifiant plus rien.
    // Une garde qui ne garde rien est pire qu'une garde absente : elle rassure.
    expect(IMPORTATEURS.length).toBeGreaterThan(0);
  });

  it.each(IMPORTATEURS)(
    "%s : soit il exige l'habilitation « attester », soit il est l'émetteur automatique déclaré",
    (rel) => {
      if (EMETTEURS_AUTOMATIQUES.includes(rel)) return;
      const source = readFileSync(join(RACINE_SRC, rel), "utf-8");
      expect(
        source.includes('requireHabilitation("attester")'),
        `« ${rel} » importe le service d'attestation SANS exiger l'habilitation ` +
          `« attester ». Émettre une attestation engage l'organisme (voir ` +
          `auth/habilitations.ts). Si ce module doit émettre automatiquement, ` +
          `inscris-le dans EMETTEURS_AUTOMATIQUES **avec sa propre garde** — ` +
          `l'exception se justifie, elle ne se range pas.`,
      ).toBe(true);
    },
  );

  it("l'exception automatique reste UNIQUE", () => {
    // 🔴 Une liste d'exceptions qui s'allonge sans qu'on la regarde finit par
    // désarmer la garde qu'elle sert. La compter ici force à la voir.
    expect(EMETTEURS_AUTOMATIQUES).toHaveLength(1);
  });
});

describe("🔴 l'émetteur automatique porte SA garde de chronologie", () => {
  /**
   * 🔴 COMMENTAIRES DÉPOUILLÉS — et ce n'est pas une précaution théorique.
   *
   * La première version de ce bloc lisait le fichier brut. J'ai désarmé la
   * garde du cron pour vérifier qu'elle rougissait : **elle est restée verte**.
   * La raison : le commentaire de la ligne 367 CITE la clause qu'il explique
   * (`evaluations: { some: { type: "finale" } }`), et le test trouvait sa
   * propre citation. Un test statique qui lit ses commentaires ne garde rien —
   * il se relit lui-même.
   */
  const CRON = readFileSync(join(RACINE_SRC, EMETTEURS_AUTOMATIQUES[0]!), "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  it("le dépouillement n'a pas tout mangé", () => {
    // Si un jour la forme des commentaires change et emporte le code avec elle,
    // les trois tests suivants passeraient au vert sur un fichier vide.
    expect(CRON.length).toBeGreaterThan(2000);
    expect(CRON).toContain("handleAttestationsAuto");
  });

  it("n'émet que sur une session RÉALISÉE", () => {
    expect(CRON).toContain('session: { statut: "realisee" }');
  });

  it("n'émet que si une évaluation FINALE existe", () => {
    // 🔴 Le défaut constaté sur `AXI-ATT-2026-003` : la pièce certifiait que la
    // stagiaire « en a satisfait les exigences » et affichait deux lignes plus
    // bas « Évaluation des acquis non réalisée ». Une attestation qui se
    // contredit elle-même. La chronologie rendait le défaut SYSTÉMATIQUE :
    // clôture à J+1 08:00, attestation à J+1 09:00, alerte « évaluation
    // manquante » à J+2 07:00 — l'organisme prévenu 22 h APRÈS avoir délivré.
    expect(CRON).toContain('evaluations: { some: { type: "finale" } }');
  });

  it("exclut les inscriptions qui ont déjà leur attestation", () => {
    // L'idempotence fait partie de la garde : sans elle, le cron réémettrait
    // chaque jour, et chaque réémission consommerait un numéro de la série
    // légale — qui ne se réattribue jamais.
    expect(CRON).toContain("attestationGenereeAt: null");
  });
});

describe("🔴 aucune surface FORMATEUR n'atteint le service", () => {
  it("l'espace formateur n'importe pas le service d'attestation", () => {
    // ⚠️ Le Lot 7 va enrichir cet espace. Le plan y interdit au formateur
    // d'émettre une attestation — mais rien, dans le code, ne l'en empêcherait :
    // il suffirait d'importer le service. Ce test transforme l'interdit écrit
    // en interdit tenu, AVANT que la surface ne grossisse.
    const formateur = IMPORTATEURS.filter(
      (f) => f.includes("formateur") || f.includes("espace-formateur"),
    );
    expect(
      formateur,
      `Une surface formateur importe le service d'attestation. Émettre une ` +
        `attestation engage l'organisme : le formateur constate, il n'atteste pas.`,
    ).toEqual([]);
  });
});
