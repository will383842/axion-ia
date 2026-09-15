/**
 * Qualiopi — émission et transmission d'une autofacture, SANS session.
 *
 * Le corps de `emettreAutofactureAction` et de `transmettreAutofactureAction`
 * (`server/actions/qualiopi/autofacture.ts`) vit ici depuis le 2026-09-15. Les
 * actions n'en restent que les enveloppes : garde d'habilitation, validation
 * des données, appel de ce module, et journal au nom de l'administrateur.
 *
 * ── POURQUOI CE MODULE EXISTE ────────────────────────────────────────────────
 *
 * 🔴 Le cron horaire `formation-crons.autofactures` rattrape les autofactures
 * dont l'émission automatique a échoué. Il appelait l'ACTION, dont la première
 * ligne est `requireHabilitation("remunerer_formateur")`. Le worker tourne
 * `tsx`, hors de Next : ni cookie, ni `headers()`. La garde levait, le `catch`
 * du cron comptait « refusée », et le rattrapage n'a jamais pu émettre une
 * seule pièce. Même famille que la facture du lendemain (#1097), même remède :
 * un service pur, deux appelants.
 *
 * ── CE QUI NE CHANGE PAS ─────────────────────────────────────────────────────
 *
 * Les quatre conditions de régularité, la série propre `AXI-AUTOF`, la garde
 * « facture conforme », le lien `autofactureDocumentId` et la règle « la
 * fenêtre de contestation ne s'ouvre QUE si l'envoi est parti » sont décrits
 * dans l'en-tête de l'action. Ils sont déplacés ici à l'identique, messages
 * compris.
 *
 * ── LE JOURNAL EST UN PARAMÈTRE ──────────────────────────────────────────────
 *
 * 🔑 Le journal d'émission s'écrit AU MÊME ENDROIT qu'avant — après
 * l'enregistrement de la pièce, avant la transmission — mais par une fonction
 * que l'appelant fournit. Le bouton passe `logQualiopiActivity` avec sa
 * session (administrateur, IP hachée, navigateur) ; le cron passe
 * `journalSysteme`, qui écrit `adminUserId: null` et `origine`. Écrire le
 * journal APRÈS l'appel du service aurait changé l'ordre des écritures du
 * bouton ; lire la session ici aurait réintroduit le défaut.
 *
 * ── UNE ÉMISSION À LA FOIS ───────────────────────────────────────────────────
 *
 * 🔴 Le bouton, la validation du relevé et le cron émettent tous par ici. La
 * relecture du relevé, le numéro, la pièce et l'écriture passent sous le verrou
 * consultatif de la série (`verrou-emission-autofacture.ts`) : sans lui, deux
 * émetteurs simultanés produisaient deux PDF et deux e-mails au même numéro.
 *
 * ⚠️ DETTE : un échec APRÈS la production du PDF (écriture du relevé) laisse une
 * pièce orpheline, et l'essai suivant en produit une autre au même numéro,
 * datée du nouvel essai. La réutiliser demanderait de retrouver la pièce sans
 * lien enregistré, donc par récence — ce que la garde des pièces jointes
 * interdit à juste titre.
 *
 * ⚠️ Ce module ne doit mener, par ses imports, ni à `server-only`, ni à
 * `next/headers`, ni à un fichier `"use server"`. Garde :
 * `autofacture-rattrapage.graphe-worker.spec.ts`.
 */

import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";
import { documentPdfKey } from "@/lib/r2-storage";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { nextNumero } from "@/server/qualiopi/numbering/allocate";
import { AutofactureHonorairesPdf } from "@/server/qualiopi/documents/templates/autofacture-honoraires";
import {
  dateLimiteContestation,
  LIBELLE_REFUS_AUTOFACTURE,
  verifierEligibiliteAutofacture,
} from "@/server/qualiopi/remuneration/autofacturation";
import { verifierTotauxConformes } from "@/server/qualiopi/remuneration/autofacture-pieces";
import { calculerEcheanceHonoraires } from "@/server/qualiopi/remuneration/echeance";
import { resoudreMandat } from "@/server/qualiopi/remuneration/mandat-source";
import {
  avecVerrouEmissionAutofacture,
  type IssueVerrouAutofacture,
} from "@/server/qualiopi/remuneration/verrou-emission-autofacture";

const dateFr = (d: Date): string => d.toLocaleDateString("fr-FR");
const euros = (cents: number): string =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

/**
 * « août 2026 » — la période que la facture rémunère.
 *
 * ⚠️ Les noms de mois sont dérivés d'`Intl`, jamais recopiés. Une liste écrite à
 * la main existe déjà dans `_labels.ts` côté écran ; en poser une SECONDE ici
 * ferait deux tables à tenir pour la même chose, et c'est ainsi qu'une pièce
 * comptable finit par nommer un mois autrement que l'écran qui l'a produite.
 */
function periodeLabel(year: number, month: number): string {
  const nom = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
  return `${nom} ${year}`;
}

/**
 * Désignation d'une ligne d'honoraires sur la pièce.
 *
 * ⚠️ Le sous-traitant doit RECONNAÎTRE ce qu'il a fait pour pouvoir contester
 * utilement. « forfait_prestation — 480,00 € » ne lui dit rien ; la nature de la
 * prestation et, quand elles existent, les heures animées, lui disent tout.
 */
function designationLigne(l: {
  prestationType: string;
  heures: { toNumber(): number } | null;
}): string {
  const nature =
    l.prestationType === "formation_collective"
      ? "Formation collective"
      : l.prestationType === "coaching_1to1"
        ? "Coaching individuel"
        : l.prestationType === "audit"
          ? "Audit"
          : l.prestationType;
  const h = l.heures === null ? null : l.heures.toNumber();
  return h !== null && h > 0
    ? `${nature} — ${h.toLocaleString("fr-FR")} h animées`
    : `${nature} — prestation réalisée`;
}

/** Le relevé, son formateur et ses lignes — tout ce que l'émission consomme. */
export async function lireReleveAutofacture(id: string) {
  return prisma.trainerStatement.findUnique({
    where: { id },
    select: {
      id: true,
      statut: true,
      tvaRegime: true,
      totalTtcCents: true,
      numeroFacture: true,
      autofactureAt: true,
      autofactureDocumentId: true,
      autofactureTransmiseAt: true,
      contestationAvantAt: true,
      contesteeAt: true,
      dateFacture: true,
      periodeYear: true,
      periodeMonth: true,
      trainerId: true,
      trainer: {
        select: {
          nom: true,
          prenom: true,
          email: true,
          siret: true,
          numeroTvaIntracom: true,
          adresseProfessionnelle: true,
          mandatAutofacturationSigneAt: true,
          mandatAutofacturationRevoqueAt: true,
        },
      },
      feeLines: {
        where: { nature: "honoraire_du" },
        select: { prestationType: true, heures: true, montantHtCents: true },
        orderBy: { montantHtCents: "desc" },
      },
    },
  });
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Journal — fourni par l'appelant
 * ────────────────────────────────────────────────────────────────────────────── */

/** Une entrée de journal, sans son auteur : c'est l'appelant qui le connaît. */
export interface EntreeJournalAutofacture {
  readonly action: string;
  readonly targetType: "TrainerStatement";
  readonly targetId: string;
  readonly changes: Record<string, unknown>;
}

export type JournalAutofacture = (entree: EntreeJournalAutofacture) => Promise<void>;

/** D'où vient un acte sans administrateur. Porté tel quel dans `changes.origine`. */
export type OrigineSysteme = "rattrapage_automatique";

/**
 * Journal SANS administrateur — `adminUserId: null`, ni IP ni navigateur.
 *
 * Best-effort, comme `logQualiopiActivity` : un journal raté n'annule pas une
 * pièce émise. Mais il ne se tait pas — un registre qui perd des lignes sans
 * rien dire est précisément ce que ce chantier ferme.
 */
export function journalSysteme(origine: OrigineSysteme): JournalAutofacture {
  return async (e) => {
    try {
      await prisma.activityLog.create({
        data: {
          adminUserId: null,
          action: e.action,
          targetType: e.targetType,
          targetId: e.targetId,
          changes: { ...e.changes, origine } as never,
          ipAddress: null,
          userAgent: null,
        },
      });
    } catch (err) {
      console.error(
        `[autofacture] journal « ${e.action} » non écrit pour le relevé ${e.targetId} :`,
        err instanceof Error ? err.message : String(err),
      );
    }
  };
}

/* ──────────────────────────────────────────────────────────────────────────────
 * 1. Émission
 * ────────────────────────────────────────────────────────────────────────────── */

/**
 * Pourquoi une émission n'a pas eu lieu.
 *
 * 🔑 C'est ce qui permet au cron de ne plus échouer en silence : un refus
 * MÉTIER (`ineligible`) est attendu et déjà porté par l'alerte
 * `autofacture_a_emettre` ; une ANOMALIE de données (`sans_lignes`,
 * `montant_incoherent`) et un échec TECHNIQUE (`technique`) ne sont portés par
 * rien d'autre que ce que le cron en fait. Le bouton, lui, n'affiche que
 * `error` — le code ne change rien à l'écran.
 */
export type CodeRefusAutofacture =
  | "introuvable"
  | "ineligible"
  | "sans_lignes"
  | "montant_incoherent"
  | "technique"
  /** Une autre émission tenait la série au-delà de l'attente : rien n'a été tenté. */
  | "verrou_pris";

/** L'étape où un échec technique s'est produit — c'est elle qu'on journalise. */
export type EtapeEmissionAutofacture = "verrou" | "preparation" | "numero" | "pdf" | "ecriture";

export interface RefusEmissionAutofacture {
  error: string;
  code: CodeRefusAutofacture;
  /** Renseignée pour `technique`. */
  etape?: EtapeEmissionAutofacture;
  /**
   * L'exception d'origine d'un échec technique. ⚠️ Son MESSAGE ne va jamais au
   * journal : Prisma y recopie les paramètres de la requête.
   */
  cause?: unknown;
}

export type ResultatEmissionAutofacture =
  { data: { numero: string; transmise: boolean } } | RefusEmissionAutofacture;

/** Ce que la section sous verrou rend quand la pièce est écrite. */
interface PieceEmise {
  readonly numero: string;
  readonly doc: { readonly id: string; readonly hashSha256: string };
  readonly mandatOrigine: unknown;
  readonly transmission: PieceATransmettre;
}

/**
 * Établit la facture d'honoraires au nom du sous-traitant, puis tente de la lui
 * transmettre.
 *
 * ⚠️ Aucune garde ici : l'habilitation est le travail de l'appelant. Le bouton
 * la vérifie avant d'appeler ; le cron n'a pas de session, et c'est
 * précisément pour lui que ce module existe.
 */
export async function emettreAutofacture(
  statementId: string,
  journaliser: JournalAutofacture,
): Promise<ResultatEmissionAutofacture> {
  // 🔴 SOUS VERROU : relecture du relevé, éligibilité, numéro, pièce, écriture.
  // Un second émetteur (bouton, validation, cron) attend, puis RELIT le relevé
  // et le trouve facturé (`facture_deja_presente`). Le verrou porte sur la
  // SÉRIE, pas sur le relevé : cf. `verrou-emission-autofacture.ts`.
  let issue: IssueVerrouAutofacture<PieceEmise | RefusEmissionAutofacture>;
  try {
    issue = await avecVerrouEmissionAutofacture(() => emettreSousVerrou(statementId));
  } catch (cause) {
    // La transaction a levé : délai dépassé ou connexion perdue. L'écriture a
    // PU aboutir — le message ne prétend pas le contraire, et l'essai suivant
    // relira le relevé sous verrou.
    return {
      error:
        "Erreur technique pendant l'émission de la facture. Rechargez le relevé avant de réessayer : la pièce a pu être enregistrée.",
      code: "technique",
      etape: "verrou",
      cause,
    };
  }
  if (!issue.acquis) {
    return {
      error:
        "Une autre émission d'autofacture est en cours. Réessayez dans un instant : les numéros sont attribués une facture à la fois.",
      code: "verrou_pris",
    };
  }
  const piece = issue.valeur;
  if ("error" in piece) return piece;

  // Hors verrou : le journal, puis la transmission — même ordre qu'avant
  // l'extraction : après l'écriture, avant l'envoi.
  await journaliser({
    action: "qualiopi.autofacture.emission",
    targetType: "TrainerStatement",
    targetId: statementId,
    changes: {
      numero: piece.numero,
      documentId: piece.doc.id,
      hashSha256: piece.doc.hashSha256,
      // 🔑 D'où venait le mandat au moment de l'émission. Sans cette trace, une
      // pièce émise sous mandat papier et une pièce émise sous mandat dérivé du
      // contrat sont indiscernables dans le registre — et c'est exactement ce
      // qu'un contrôle demanderait à établir.
      mandat: piece.mandatOrigine,
    },
  });

  const transmise = await transmettreAutofacture(piece.transmission, "emission");
  return { data: { numero: piece.numero, transmise } };
}

/** Tout ce qui décide et écrit — appelé UNIQUEMENT sous le verrou de série. */
async function emettreSousVerrou(
  statementId: string,
): Promise<PieceEmise | RefusEmissionAutofacture> {
  let releve: Awaited<ReturnType<typeof lireReleveAutofacture>>;
  let mandat: Awaited<ReturnType<typeof resoudreMandat>>;
  try {
    releve = await lireReleveAutofacture(statementId);
    if (releve === null) return { error: "Relevé introuvable.", code: "introuvable" };
    mandat = await resoudreMandat(releve.trainerId, releve.trainer);
  } catch (cause) {
    return {
      error: "Erreur technique pendant la lecture du relevé.",
      code: "technique",
      etape: "preparation",
      cause,
    };
  }

  const maintenant = new Date();

  // ── Les quatre conditions, refusées EN BLOC ────────────────────────────────
  //
  // 🔑 On rend TOUS les motifs, jamais le premier : un opérateur qui corrige un
  // obstacle, réessaie, en découvre un deuxième, corrige, réessaie… n'apprend
  // jamais combien il en reste.
  // 🔑 LE MANDAT PEUT VENIR DE DEUX ENDROITS, et le sous-traitant n'a signé
  // qu'une fois. Saisie manuelle sur la fiche (mandat papier, ou signé hors de
  // l'outil), ou article 4 bis du contrat de sous-traitance qu'il a signé
  // électroniquement. La saisie gagne toujours : voir `resoudreMandat`.
  const verdict = verifierEligibiliteAutofacture(
    releve,
    {
      ...releve.trainer,
      mandatAutofacturationSigneAt: mandat.signeAt,
      mandatAutofacturationRevoqueAt: mandat.revoqueAt,
    },
    maintenant,
  );
  if (!verdict.eligible) {
    return {
      error: verdict.refus.map((m) => LIBELLE_REFUS_AUTOFACTURE[m]).join("\n\n"),
      code: "ineligible",
    };
  }

  const lignes = releve.feeLines.map((l) => ({
    designation: designationLigne(l),
    montantHtCents: l.montantHtCents,
  }));
  if (lignes.length === 0) {
    return {
      error:
        "Aucune ligne d'honoraires rattachée à ce relevé : la facture serait vide. Relancez le calcul de la période.",
      code: "sans_lignes",
    };
  }

  // 🔴 LE POINT DE RENCONTRE DES DEUX CALCULS DE TVA. `calcul.ts` a chiffré le
  // relevé, `computeTotauxFacture` chiffre la pièce. Ils s'accordent aujourd'hui,
  // ce qui est exactement la situation où une divergence s'installe sans bruit.
  // Émettre une pièce qui réclame autre chose que ce qu'on doit fabriquerait le
  // désaccord au lieu de le constater — c'est la garde « facture conforme » du
  // paiement, appliquée à l'émission.
  const totaux = verifierTotauxConformes(lignes, releve.tvaRegime, releve.totalTtcCents);
  if (!totaux.conforme) {
    return {
      error: `Incohérence de montant : la facture calcule ${euros(totaux.calculeTtcCents)} TTC là où le relevé en doit ${euros(releve.totalTtcCents)}. Émission refusée — corrigez le relevé avant d'émettre une pièce qui réclamerait autre chose que la dette.`,
      code: "montant_incoherent",
    };
  }

  let identite: Awaited<ReturnType<typeof getOrganismeIdentite>>;
  try {
    identite = await getOrganismeIdentite();
  } catch (cause) {
    return {
      error: "Erreur technique pendant la lecture de l'identité de l'organisme.",
      code: "technique",
      etape: "preparation",
      cause,
    };
  }
  const sousTraitant = {
    nom: `${releve.trainer.prenom} ${releve.trainer.nom}`.trim(),
    // Non nuls : `verifierEligibiliteAutofacture` vient de les exiger.
    siret: releve.trainer.siret as string,
    numeroTvaIntracom: releve.trainer.numeroTvaIntracom,
    adresseProfessionnelle: releve.trainer.adresseProfessionnelle as string,
    email: releve.trainer.email,
  };

  // ── Numéro : série PROPRE, jamais celle des ventes ─────────────────────────
  //
  // `AXI-FACT` numérote ce que l'organisme vend. Une autofacture est une pièce
  // d'ACHAT : l'intercaler y ferait mentir la continuité que cette série existe
  // pour garantir.
  const annee = maintenant.getFullYear();
  let numero: string;
  try {
    numero = await nextNumero("autofacture", annee, async (prefixe) => {
      // `LecteurSerie` attend des lignes `{ numero }` ; la série vit ici sur
      // `numeroFacture`. On mappe plutôt qu'on ne force le type : la borne est
      // calculée numériquement par `nextNumero`, elle a besoin des vraies
      // valeurs.
      const rows = await prisma.trainerStatement.findMany({
        where: { numeroFacture: { startsWith: prefixe } },
        select: { numeroFacture: true },
      });
      return rows.map((r) => ({ numero: r.numeroFacture }));
    });
  } catch (cause) {
    return {
      error: "Impossible d'allouer un numéro de facture.",
      code: "technique",
      etape: "numero",
      cause,
    };
  }

  const echeance = calculerEcheanceHonoraires(maintenant);
  const contestationAvant = dateLimiteContestation(maintenant);

  // ── La pièce ───────────────────────────────────────────────────────────────
  let doc: { id: string; numero: string; hashSha256: string };
  try {
    const genere = await generateDocument({
      type: "autofacture_honoraires",
      identite,
      refs: { trainerId: releve.trainerId },
      buildElement: () =>
        AutofactureHonorairesPdf({
          data: {
            numero,
            dateEmission: dateFr(maintenant),
            dateEcheance: dateFr(echeance),
            contestationAvant: dateFr(contestationAvant),
            periodeLabel: periodeLabel(releve.periodeYear, releve.periodeMonth),
            sousTraitant,
            identite,
            lignes,
            regimeHonoraires: releve.tvaRegime,
          },
        }),
    });
    doc = { id: genere.id, numero: genere.numero, hashSha256: genere.hashSha256 };
  } catch (cause) {
    return {
      error: "Erreur lors de la production du PDF de la facture.",
      code: "technique",
      etape: "pdf",
      cause,
    };
  }

  // ── L'écriture ─────────────────────────────────────────────────────────────
  //
  // ⚠️ `autofactureTransmiseAt` et `contestationAvantAt` NE SONT PAS POSÉS ICI.
  // Le délai court depuis la transmission ; l'écrire à l'émission le ferait
  // courir sur une pièce que personne n'a reçue.
  try {
    await prisma.trainerStatement.update({
      where: { id: releve.id },
      data: {
        statut: "facture_recue",
        numeroFacture: numero,
        dateFacture: maintenant,
        echeanceAt: echeance,
        montantFactureTtcCents: releve.totalTtcCents,
        autofactureAt: maintenant,
        // 🔴 LE LIEN VERS LA PIÈCE. Sans lui, la transmission retrouvait le PDF
        // par heuristique — « le dernier de ce formateur » — et envoyait la
        // facture de septembre pour un rattrapage d'août.
        autofactureDocumentId: doc.id,
      },
    });
  } catch (cause) {
    return {
      error: "Erreur lors de l'enregistrement de la facture sur le relevé.",
      code: "technique",
      etape: "ecriture",
      cause,
    };
  }

  return {
    numero,
    doc: { id: doc.id, hashSha256: doc.hashSha256 },
    mandatOrigine: mandat.origine,
    transmission: {
      statementId: releve.id,
      numero,
      documentId: doc.id,
      trainerId: releve.trainerId,
      trainerNom: sousTraitant.nom,
      trainerEmail: sousTraitant.email,
      periodeYear: releve.periodeYear,
      periodeMonth: releve.periodeMonth,
      totalTtcCents: releve.totalTtcCents,
      echeance,
    },
  };
}

/* ──────────────────────────────────────────────────────────────────────────────
 * 2. Transmission — c'est ELLE qui ouvre les huit jours
 * ────────────────────────────────────────────────────────────────────────────── */

/**
 * Ce dont la transmission a besoin, PASSÉ et non relu.
 *
 * 🔴 La première écriture de ce module relisait le relevé en base juste après
 * l'avoir écrit. Ça « marchait », et c'était un défaut : une lecture
 * après-écriture crée une dépendance à la visibilité de la transaction
 * précédente, ajoute un aller-retour, et rend le chemin d'émission
 * indistinguable d'un chemin de reprise. Les deux appelants savent ce qu'ils
 * transmettent — ils le disent.
 */
export interface PieceATransmettre {
  readonly statementId: string;
  readonly numero: string;
  /**
   * Le PDF de CETTE facture. `null` pour les pièces émises avant le
   * 2026-09-12, qui n'ont pas de lien enregistré : elles partent alors SANS
   * pièce jointe plutôt qu'avec la mauvaise. Un e-mail sans PDF se rattrape ;
   * un e-mail portant la facture d'un autre mois, non.
   */
  readonly documentId: string | null;
  readonly trainerId: string;
  readonly trainerNom: string;
  readonly trainerEmail: string | null;
  readonly periodeYear: number;
  readonly periodeMonth: number;
  readonly totalTtcCents: number;
  readonly echeance: Date | null;
}

/**
 * Envoie la pièce au sous-traitant et ouvre la fenêtre de contestation.
 *
 * 🔴 LA FENÊTRE N'EST OUVERTE QUE SI L'ENVOI EST RÉELLEMENT PARTI. Un e-mail
 * garé pour validation, ou une file indisponible, laissent la pièce
 * « émise, non transmise » : aucun délai ne court, et l'écran le dit. Poser la
 * date malgré tout donnerait au formateur moins de huit jours — parfois zéro —
 * sur un délai que le contrat lui garantit.
 *
 * ⚠️ L'e-mail ne passe PAS par la corbeille de validation, et c'est un choix
 * (voir l'en-tête de l'action) : la relecture humaine, c'est la validation du
 * relevé, pas un second garage.
 *
 * Rend `true` si la fenêtre est ouverte, `false` sinon. N'échoue jamais : une
 * transmission ratée n'annule pas une émission valide, elle se réessaie.
 */
export async function transmettreAutofacture(
  p: PieceATransmettre,
  origine: "emission" | "reprise",
): Promise<boolean> {
  const releve = p;
  const to = releve.trainerEmail;
  if (!to) return false;

  // ⚠️ PAR IDENTIFIANT, jamais par heuristique. Le `findFirst` trié par date
  // qui vivait ici renvoyait « la dernière autofacture de ce formateur » : sur
  // un rattrapage d'août, c'était celle de septembre.
  const doc =
    releve.documentId === null
      ? null
      : await prisma.documentGenere.findUnique({
          where: { id: releve.documentId },
          select: { type: true, numero: true, createdAt: true },
        });

  const echeance = releve.echeance;
  const maintenant = new Date();
  const contestationAvant = dateLimiteContestation(maintenant);

  let parti = false;
  try {
    const { enqueued, garePourValidation = false } = await enqueueEmail(
      "autofacture-transmission",
      to,
      "fr",
      {
        sousTraitantNom: releve.trainerNom,
        numero: releve.numero,
        periodeLabel: periodeLabel(releve.periodeYear, releve.periodeMonth),
        montantLabel: `${euros(releve.totalTtcCents)} TTC`,
        ...(echeance !== null ? { dateEcheanceLabel: dateFr(echeance) } : {}),
        contestationAvantLabel: dateFr(contestationAvant),
      },
      {
        ...(doc !== null
          ? { attachments: [{ filename: `${releve.numero}.pdf`, r2Key: documentPdfKey(doc) }] }
          : {}),
        sujet: `Votre facture d'honoraires ${releve.numero} — Axion-IA`,
      },
    );
    // 🔑 `enqueued: false` peut vouloir dire « garé » : les deux drapeaux se
    // lisent ENSEMBLE. Un envoi garé n'est pas un envoi.
    parti = enqueued && !garePourValidation;
  } catch {
    parti = false;
  }

  if (!parti) return false;

  try {
    await prisma.trainerStatement.update({
      where: { id: releve.statementId },
      data: { autofactureTransmiseAt: maintenant, contestationAvantAt: contestationAvant },
    });
  } catch {
    // La pièce est partie mais la date n'a pas pu s'écrire : on rend `false`
    // plutôt que de prétendre le contraire. L'opérateur verra « non transmise »
    // et pourra réessayer — un doublon d'e-mail est moins grave qu'une fenêtre
    // qu'on croit ouverte et qui ne l'est pas.
    return false;
  }

  console.warn(
    `[autofacture] ${releve.numero} transmise (${origine}) — contestation jusqu'au ${dateFr(contestationAvant)}`,
  );
  return true;
}
