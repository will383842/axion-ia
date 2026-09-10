/**
 * Qualiopi — Émission, transmission et contestation d'une autofacture.
 *
 * Lot 2 du chantier « payer les formateurs ». Le lot 1 a livré ce qui DÉCIDE
 * (`autofacturation.ts`) et ce qui SE REND (`autofacture-pieces.ts`, le gabarit
 * PDF) ; ce module est la chaîne qui les relie à un geste d'opérateur.
 *
 * ── LES QUATRE CONDITIONS, ET OÙ CHACUNE EST TENUE ───────────────────────────
 *
 * Une facture d'autofacturation est régulière si, et seulement si, elle réunit
 * un mandat écrit et PRÉALABLE, la mention « Autofacturation », l'émission au
 * nom et pour le compte du sous-traitant, et un droit de contestation. Il en
 * manque UNE SEULE et la pièce est irrégulière : la TVA qu'elle porte n'est pas
 * déductible, et on l'apprend au contrôle, des mois plus tard.
 *
 *   1. mandat préalable → `verifierEligibiliteAutofacture`, qui REFUSE ici ;
 *   2. mention « Autofacturation » → portée par le gabarit depuis la constante
 *      `MENTION_AUTOFACTURATION`, jamais retapée ;
 *   3. au nom et pour le compte → l'inversion vendeur/acheteur du gabarit et du
 *      CII, éprouvée par mutation dans le lot 1 ;
 *   4. droit de contestation → OUVERT PAR LA TRANSMISSION, jamais par
 *      l'émission. C'est la seule des quatre qui dépende d'un envoi qui aboutit,
 *      et c'est ce que ce module protège le plus soigneusement.
 *
 * ── POURQUOI ÉMISSION ET TRANSMISSION SONT DEUX ACTES ────────────────────────
 *
 * 🔑 Le délai de huit jours court « à compter de la transmission ». Une pièce
 * émise et jamais transmise ne fait courir AUCUN délai — sinon la fenêtre se
 * refermerait sur un formateur qui n'a rien reçu, et la contrepartie que le
 * mandat promet serait vidée de son sens. `emettreAutofactureAction` tente donc
 * la transmission dans la foulée, mais n'ouvre la fenêtre QUE si l'envoi est
 * réellement parti. S'il échoue, la pièce existe, la fenêtre reste fermée, et
 * `transmettreAutofactureAction` permet de réessayer.
 *
 * ⚠️ L'e-mail ne passe PAS par la corbeille de validation, et c'est un choix.
 * La corbeille existe pour relire un e-mail COMMERCIAL avant qu'il n'atteigne un
 * client. Cette pièce n'est pas commerciale : son contenu est intégralement
 * dérivé d'un relevé déjà validé par un humain, elle part à un sous-traitant qui
 * a signé le mandat, et la garer raccourcirait un délai légal. La relecture
 * humaine, c'est le clic sur « Émettre » — pas un second garage.
 */

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireHabilitation, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
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

type ActionResult<T> = { data: T } | { error: string };

const uuid = z.string().uuid();

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
async function lireReleve(id: string) {
  return prisma.trainerStatement.findUnique({
    where: { id },
    select: {
      id: true,
      statut: true,
      tvaRegime: true,
      totalTtcCents: true,
      numeroFacture: true,
      autofactureAt: true,
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
 * 1. Émission
 * ────────────────────────────────────────────────────────────────────────────── */

/**
 * Établit la facture d'honoraires au nom du sous-traitant, puis tente de la lui
 * transmettre.
 *
 * Acte ENGAGEANT : émettre une facture au nom d'un tiers engage l'organisme
 * autant qu'émettre la sienne. Même habilitation que le paiement des honoraires.
 */
export async function emettreAutofactureAction(
  input: z.input<typeof schemaEmission>,
): Promise<ActionResult<{ numero: string; transmise: boolean }>> {
  const session = await requireHabilitation("remunerer_formateur");
  const parsed = schemaEmission.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { statementId } = parsed.data;

  const releve = await lireReleve(statementId);
  if (releve === null) return { error: "Relevé introuvable." };

  const maintenant = new Date();

  // ── Les quatre conditions, refusées EN BLOC ────────────────────────────────
  //
  // 🔑 On rend TOUS les motifs, jamais le premier : un opérateur qui corrige un
  // obstacle, réessaie, en découvre un deuxième, corrige, réessaie… n'apprend
  // jamais combien il en reste.
  const verdict = verifierEligibiliteAutofacture(releve, releve.trainer, maintenant);
  if (!verdict.eligible) {
    return {
      error: verdict.refus.map((m) => LIBELLE_REFUS_AUTOFACTURE[m]).join("\n\n"),
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
    };
  }

  const identite = await getOrganismeIdentite();
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
  } catch {
    return { error: "Impossible d'allouer un numéro de facture." };
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
  } catch {
    return { error: "Erreur lors de la production du PDF de la facture." };
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
      },
    });
  } catch {
    return { error: "Erreur lors de l'enregistrement de la facture sur le relevé." };
  }

  await logQualiopiActivity({
    action: "qualiopi.autofacture.emission",
    targetType: "TrainerStatement",
    targetId: releve.id,
    changes: { numero, documentId: doc.id, hashSha256: doc.hashSha256 },
    session,
  });

  const transmise = await transmettre(
    {
      statementId: releve.id,
      numero,
      trainerId: releve.trainerId,
      trainerNom: sousTraitant.nom,
      trainerEmail: sousTraitant.email,
      periodeYear: releve.periodeYear,
      periodeMonth: releve.periodeMonth,
      totalTtcCents: releve.totalTtcCents,
      echeance,
    },
    "emission",
  );
  return { data: { numero, transmise } };
}

const schemaEmission = z.object({ statementId: uuid });

/* ──────────────────────────────────────────────────────────────────────────────
 * 2. Transmission — c'est ELLE qui ouvre les huit jours
 * ────────────────────────────────────────────────────────────────────────────── */

/**
 * Envoie la pièce au sous-traitant et ouvre la fenêtre de contestation.
 *
 * 🔴 LA FENÊTRE N'EST OUVERTE QUE SI L'ENVOI EST RÉELLEMENT PARTI. Un e-mail
 * garé pour validation, ou une file indisponible, laissent la pièce
 * « émise, non transmise » : aucun délai ne court, et l'écran le dit. Poser la
 * date malgré tout donnerait au formateur moins de huit jours — parfois zéro —
 * sur un délai que le contrat lui garantit.
 *
 * Rend `true` si la fenêtre est ouverte, `false` sinon. N'échoue jamais : une
 * transmission ratée n'annule pas une émission valide, elle se réessaie.
 */
async function transmettre(
  p: PieceATransmettre,
  origine: "emission" | "reprise",
): Promise<boolean> {
  const releve = p;
  const to = releve.trainerEmail;
  if (!to) return false;

  const doc = await prisma.documentGenere.findFirst({
    where: { type: "autofacture_honoraires", trainerId: releve.trainerId },
    orderBy: { createdAt: "desc" },
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
interface PieceATransmettre {
  readonly statementId: string;
  readonly numero: string;
  readonly trainerId: string;
  readonly trainerNom: string;
  readonly trainerEmail: string | null;
  readonly periodeYear: number;
  readonly periodeMonth: number;
  readonly totalTtcCents: number;
  readonly echeance: Date | null;
}

/** Réessaie la transmission d'une pièce émise mais non transmise. */
export async function transmettreAutofactureAction(
  input: z.input<typeof schemaEmission>,
): Promise<ActionResult<{ transmise: boolean }>> {
  const session = await requireHabilitation("remunerer_formateur");
  const parsed = schemaEmission.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };

  const releve = await lireReleve(parsed.data.statementId);
  if (releve === null) return { error: "Relevé introuvable." };
  if (releve.autofactureAt === null) {
    return { error: "Aucune autofacture émise pour ce relevé : il n'y a rien à transmettre." };
  }
  if (releve.autofactureTransmiseAt !== null) {
    return { error: "Cette facture a déjà été transmise." };
  }
  if (!releve.trainer.email) {
    return {
      error: "Le formateur n'a pas d'adresse e-mail : impossible de lui transmettre la pièce.",
    };
  }

  const transmise = await transmettre(
    {
      statementId: releve.id,
      numero: releve.numeroFacture as string,
      trainerId: releve.trainerId,
      trainerNom: `${releve.trainer.prenom} ${releve.trainer.nom}`.trim(),
      trainerEmail: releve.trainer.email,
      periodeYear: releve.periodeYear,
      periodeMonth: releve.periodeMonth,
      totalTtcCents: releve.totalTtcCents,
      echeance: releve.dateFacture !== null ? calculerEcheanceHonoraires(releve.dateFacture) : null,
    },
    "reprise",
  );
  await logQualiopiActivity({
    action: "qualiopi.autofacture.transmission",
    targetType: "TrainerStatement",
    targetId: releve.id,
    changes: { transmise },
    session,
  });

  if (!transmise) {
    return { error: "L'envoi n'a pas pu partir. La fenêtre de contestation reste fermée." };
  }
  return { data: { transmise } };
}

/* ──────────────────────────────────────────────────────────────────────────────
 * 3. Contestation — elle BLOQUE le paiement
 * ────────────────────────────────────────────────────────────────────────────── */

const schemaContestation = z.object({
  statementId: uuid,
  motif: z.string().min(1).max(2000),
});

/**
 * Consigne une contestation reçue du sous-traitant.
 *
 * 🔴 Elle BLOQUE le paiement, et c'est le même raisonnement que la garde
 * « facture conforme » : payer une pièce contestée reviendrait à acter un
 * désaccord au lieu de le régler. Le blocage vit dans
 * `transitionStatementAction` — ici on ne fait qu'enregistrer le fait.
 *
 * ⚠️ On enregistre une contestation même HORS DÉLAI. Le délai de huit jours dit
 * qu'au-delà la facture est « réputée acceptée » ; il ne dit pas que le
 * désaccord n'existe pas. Refuser de le consigner effacerait un fait, et
 * laisserait partir un virement sur une pièce que le formateur conteste — le
 * pire des deux mondes. L'arbitrage reste humain ; l'outil ne le préempte pas.
 */
export async function contesterAutofactureAction(
  input: z.input<typeof schemaContestation>,
): Promise<ActionResult<{ horsDelai: boolean }>> {
  const session = await requireHabilitation("remunerer_formateur");
  const parsed = schemaContestation.safeParse(input);
  if (!parsed.success) return { error: "Motif de contestation requis." };
  const { statementId, motif } = parsed.data;

  const releve = await lireReleve(statementId);
  if (releve === null) return { error: "Relevé introuvable." };
  if (releve.autofactureAt === null) {
    return { error: "Aucune autofacture émise pour ce relevé." };
  }
  if (releve.contesteeAt !== null) {
    return { error: "Une contestation est déjà enregistrée sur cette facture." };
  }

  const maintenant = new Date();
  const horsDelai =
    releve.contestationAvantAt !== null &&
    releve.contestationAvantAt.getTime() < maintenant.getTime();

  try {
    await prisma.trainerStatement.update({
      where: { id: statementId },
      data: { contesteeAt: maintenant, contestationMotif: motif },
    });
  } catch {
    return { error: "Erreur lors de l'enregistrement de la contestation." };
  }

  await logQualiopiActivity({
    action: "qualiopi.autofacture.contestation",
    targetType: "TrainerStatement",
    targetId: statementId,
    changes: { motif, horsDelai },
    session,
  });

  return { data: { horsDelai } };
}

/* ──────────────────────────────────────────────────────────────────────────────
 * 4. Formulaires (Server Actions liées aux boutons)
 * ────────────────────────────────────────────────────────────────────────────── */

function champ(formData: FormData, nom: string): string {
  const v = formData.get(nom);
  return typeof v === "string" ? v : "";
}

/** Bouton « Émettre l'autofacture ». Redirige vers la fiche avec un bandeau. */
export async function emettreAutofactureFormAction(formData: FormData): Promise<void> {
  const statementId = champ(formData, "statementId");
  const retour = champ(formData, "retour");
  const res = await emettreAutofactureAction({ statementId });
  const q =
    "error" in res
      ? `?erreur=${encodeURIComponent(res.error)}`
      : `?ok=${encodeURIComponent(
          res.data.transmise
            ? `Facture ${res.data.numero} émise et transmise au formateur.`
            : `Facture ${res.data.numero} émise, mais l'envoi n'est pas parti : la fenêtre de contestation n'est PAS ouverte. Utilisez « Transmettre » pour réessayer.`,
        )}`;
  revalidatePath(retour);
  const { redirect } = await import("next/navigation");
  redirect(`${retour}${q}`);
}

/** Bouton « Transmettre » (reprise d'un envoi qui n'est pas parti). */
export async function transmettreAutofactureFormAction(formData: FormData): Promise<void> {
  const statementId = champ(formData, "statementId");
  const retour = champ(formData, "retour");
  const res = await transmettreAutofactureAction({ statementId });
  const q =
    "error" in res
      ? `?erreur=${encodeURIComponent(res.error)}`
      : `?ok=${encodeURIComponent("Facture transmise. La fenêtre de contestation de 8 jours est ouverte.")}`;
  revalidatePath(retour);
  const { redirect } = await import("next/navigation");
  redirect(`${retour}${q}`);
}

/** Bouton « Enregistrer une contestation ». */
export async function contesterAutofactureFormAction(formData: FormData): Promise<void> {
  const statementId = champ(formData, "statementId");
  const retour = champ(formData, "retour");
  const res = await contesterAutofactureAction({ statementId, motif: champ(formData, "motif") });
  const q =
    "error" in res
      ? `?erreur=${encodeURIComponent(res.error)}`
      : `?ok=${encodeURIComponent(
          res.data.horsDelai
            ? "Contestation enregistrée (reçue APRÈS le délai de 8 jours — la facture était réputée acceptée, l'arbitrage vous revient). Le paiement est bloqué."
            : "Contestation enregistrée. Le paiement est bloqué tant qu'elle n'est pas levée.",
        )}`;
  revalidatePath(retour);
  const { redirect } = await import("next/navigation");
  redirect(`${retour}${q}`);
}
