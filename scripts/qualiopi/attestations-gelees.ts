/**
 * Qualiopi — Les inscriptions dont l'attestation est GELÉE (2026-09-05).
 *
 * ## Le défaut que ce script rattrape
 *
 * `genererAttestationPourEnrollment` posait `attestationGenereeAt` dans DEUX cas
 * qui ne produisent aucune pièce :
 *
 * 1. **le claim atomique** (étape 2c) écrit la colonne AVANT de rendre le PDF.
 *    Si la suite échoue sans passer par `genererOuLiberer`, la ligne reste
 *    « attestée » sans document ;
 * 2. **la branche « aucune »** — et c'est la plus vicieuse. `tauxPresencePct ?? 0`
 *    transformait un taux INCONNU en présence de 0 %, `classifierPresence`
 *    rendait « aucune », et la branche écrivait `attestationGenereeAt` en
 *    sortant SANS PIÈCE. Un taux inconnu n'est pas un taux de 0 %.
 *
 * Dans les deux cas la ligne est **gelée pour toujours** : le cron
 * `attestations-auto` sélectionne sur `attestationGenereeAt: null`, donc il ne
 * la reprend plus jamais. Et l'attestation de fin de formation est **due au
 * stagiaire** par l'article L.6353-1.
 *
 * Le code ne fabrique plus de nouveaux gelés (refus DUR avant le claim depuis le
 * 2026-09-05). Restent ceux d'avant, que personne ne peut voir : leur seul
 * symptôme est une ABSENCE — un stagiaire qui n'a rien reçu et ne le sait pas.
 *
 * ## Ce que le script fait, et ce qu'il ne fait pas
 *
 * Il RECENSE. Il ne régénère rien, même avec `--apply` : produire une
 * attestation engage l'organisme (`attester` est un acte engageant, réservé à la
 * direction), et un script ne pose pas cet acte à la place d'un humain.
 * `--apply` se contente de **relâcher le verrou** — remettre
 * `attestationGenereeAt` à `null` — pour que le cron reprenne le dossier
 * normalement, avec toutes ses gardes.
 *
 * ⚠️ Il ne relâche QUE les lignes qui portent une trace d'assiduité. Sans trace,
 * relâcher ferait crier le cron sans qu'il puisse rien produire : ces lignes-là
 * demandent une saisie de présence, pas un déverrouillage. Elles sont listées à
 * part, parce qu'elles existent et qu'il ne faut pas les oublier.
 *
 * Usage :
 *   pnpm tsx scripts/qualiopi/attestations-gelees.ts            # recensement seul
 *   pnpm tsx scripts/qualiopi/attestations-gelees.ts --apply    # relâche les verrous
 */

import { prisma } from "../../src/lib/prisma";
import {
  motifNonRelachable,
  peutRelacher,
  type EtatGelAttestation,
} from "../../src/server/qualiopi/evaluations/attestation-gel";

const APPLY = process.argv.includes("--apply");

interface LigneGelee {
  readonly enrollmentId: string;
  readonly stagiaire: string;
  readonly session: string;
  readonly resultat: string | null;
  readonly tauxPresencePct: number | null;
  readonly signatures: number;
  readonly creneauxImportes: number;
  /** `true` ⇒ le cron peut reprendre ; `false` ⇒ il faut d'abord saisir la présence. */
  readonly relachable: boolean;
  /** Pourquoi la ligne n'est pas relâchable — `null` si elle l'est. */
  readonly motif: string | null;
}

async function recenser(): Promise<LigneGelee[]> {
  // 🔴 Le critère : la colonne dit « attestée », et il n'y a PAS de document.
  // C'est le seul énoncé qui distingue un gel d'une attestation normale — et il
  // ne dépend d'aucune date, donc il rattrape aussi les gels anciens.
  const candidates = await prisma.enrollment.findMany({
    where: {
      attestationGenereeAt: { not: null },
      attestationDocumentId: null,
    },
    select: {
      id: true,
      attestationResultat: true,
      tauxPresencePct: true,
      trainee: { select: { nom: true, prenom: true } },
      session: { select: { numero: true } },
    },
    orderBy: { id: "asc" },
  });

  const lignes: LigneGelee[] = [];
  for (const e of candidates) {
    // Mêmes requêtes que la garde des preuves du service : si elles divergeaient,
    // le script relâcherait des dossiers que le cron refuserait aussitôt, et on
    // aurait remplacé un gel silencieux par une boucle d'échecs.
    const signatures = await prisma.emargementSignature.count({
      where: { enrollmentId: e.id, revokedAt: null },
    });
    const creneauxImportes = await prisma.presenceCreneau.count({
      where: {
        enrollmentId: e.id,
        source: { in: ["import_zoom", "import_teams", "import_meet"] },
        importId: { not: null },
      },
    });
    // La règle vit dans `attestation-gel.ts`, module PUR et éprouvé. La
    // réécrire ici en ferait une seconde copie — et c'est exactement ainsi que
    // deux gardes jumelles finissent par diverger.
    const etat: EtatGelAttestation = {
      marqueeAttestee: true,
      documentPresent: false,
      tauxPresencePct: e.tauxPresencePct,
      signaturesNonRevoquees: signatures,
      creneauxImportes,
    };
    lignes.push({
      enrollmentId: e.id,
      stagiaire: `${e.trainee.prenom} ${e.trainee.nom}`.trim(),
      session: e.session.numero,
      resultat: e.attestationResultat,
      tauxPresencePct: e.tauxPresencePct,
      signatures,
      creneauxImportes,
      relachable: peutRelacher(etat),
      motif: motifNonRelachable(etat),
    });
  }
  return lignes;
}

async function main(): Promise<void> {
  const lignes = await recenser();

  if (lignes.length === 0) {
    // ⚠️ Zéro admet DEUX explications : « rien à réparer » et « la sonde ne
    // mesure rien ». On dit laquelle on a vérifiée.
    const total = await prisma.enrollment.count();
    console.log(
      `Aucune attestation gelée. (${total} inscriptions balayées — si ce nombre ` +
        "est nul lui aussi, c'est la BASE qui est vide, pas le défaut qui est absent.)",
    );
    return;
  }

  const relachables = lignes.filter((l) => l.relachable);
  const bloquees = lignes.filter((l) => !l.relachable);

  console.log(`\n${lignes.length} inscription(s) GELÉE(S) — « attestée » sans document :\n`);
  for (const l of lignes) {
    const etat = l.relachable ? "RELÂCHABLE" : (l.motif ?? "?");
    console.log(
      `  ${l.session}  ${l.stagiaire.padEnd(28)}  résultat=${String(l.resultat).padEnd(10)} ` +
        `taux=${l.tauxPresencePct ?? "—"}  signatures=${l.signatures}  ` +
        `créneaux=${l.creneauxImportes}  → ${etat}`,
    );
  }

  console.log(
    `\n  ${relachables.length} relâchable(s) · ${bloquees.length} demandant d'abord ` +
      "une saisie de présence.\n",
  );

  if (!APPLY) {
    console.log("Recensement seul. Relancer avec --apply pour relâcher les verrous.\n");
    return;
  }

  if (relachables.length === 0) {
    console.log("Rien à relâcher.\n");
    return;
  }

  const r = await prisma.enrollment.updateMany({
    where: { id: { in: relachables.map((l) => l.enrollmentId) } },
    // On remet AUSSI `attestationResultat` à null : le laisser à « aucune »
    // ferait relire au cron un verdict calculé sur un taux qu'on conteste.
    data: { attestationGenereeAt: null, attestationResultat: null },
  });
  console.log(
    `${r.count} verrou(x) relâché(s). Le cron « attestations-auto » reprendra ces ` +
      "dossiers à son prochain passage, avec TOUTES ses gardes — ce script ne " +
      "produit aucune attestation lui-même.\n",
  );
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
