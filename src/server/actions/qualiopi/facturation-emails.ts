/**
 * Hub facturation — envoi MANUEL par email des devis et factures (PDF joint).
 *
 * Ces actions sont déclenchées par un clic admin. Le PDF n'est jamais mis dans
 * Redis : on passe la clé R2, le worker email télécharge puis attache.
 *
 * ⚠️ 2026-09-15 — la facture d'une session réalisée est désormais générée
 * automatiquement le lendemain de sa fin, et son e-mail PRÉPARÉ par le même
 * chemin (`facture-envoi-email.ts`), toujours GARÉ en « E-mails à valider » :
 * rien ne part à un client sans validation (ordre permanent de Will). Aucun
 * envoi automatique n'existe pour autant.
 *
 * Journal des envois : ActivityLog (SSOT audit existant) via
 * logQualiopiActivity — actions `facturation.email.devis` /
 * `facturation.email.facture` (numéro + hash du PDF, destinataire pour la facture ; jamais
 * l'adresse pour le devis : le `targetId` suffit).
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { publicUrl } from "@/lib/public-url";
import {
  creerTokenDocument,
  revoquerJetonPrecis,
  TokenDocumentError,
} from "@/server/qualiopi/documents/signature/token-document";
import { salutationPourPayload } from "@/server/qualiopi/crm/salutation-payload";
import {
  formulesDepuisMetadata,
  nomPourSalutationDevis,
  payloadDevisEnvoi,
} from "@/server/qualiopi/devis/email-devis-envoi";
import { resoudreMode } from "@/server/email/outbox-service";
import { CLE_MARQUEUR } from "@/server/qualiopi/documents/signature/lien-a-l-envoi";
import { rendreLienPrecedent } from "@/server/qualiopi/documents/signature/lien-precedent";
import { formulesActives } from "@/server/qualiopi/devis/interrupteur-formules";
import {
  emailDevisEnAttente,
  GABARIT_DEVIS_ENVOI,
} from "@/server/qualiopi/devis/email-devis-en-attente";
import {
  SELECT_SIGNATURES_PIECE,
  signatureClientDuDevis,
} from "@/server/qualiopi/devis/signature-client-du-devis";
import { preparerEnvoiFactureEmail } from "@/server/qualiopi/financements/facture-envoi-email";

const eur = (cents: number): string =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
const dateFr = (d: Date): string => d.toLocaleDateString("fr-FR");

const MSG_RENVOI_DEJA_GARE =
  "Un e-mail de ce devis attend déjà dans Emails → À valider : validez-le ou refusez-le avant de renvoyer.";
const MSG_ENVOI_EN_COURS = "Un envoi de ce devis est déjà en cours, réessayez dans un instant.";
const NOTE_RENVOI_GARE =
  "Renvoi garé dans Emails → À valider : le lien actuel reste valable jusqu'au départ réel ; le nouveau lien naît à l'approbation et remplace alors l'ancien.";

const MSG_FILE_INDISPONIBLE = "File d'envoi indisponible — réessayer.";
const MSG_ENFILAGE_EN_ERREUR =
  "L'enfilage de l'e-mail a échoué : rien n'est parti, le lien de signature précédent a été conservé ou rendu. Réessayer.";
const MSG_ENFILAGE_EN_ERREUR_SANS_LIEN =
  "L'e-mail n'a pas pu être mis en file et le client n'a plus de lien de signature valable : renvoyez le devis.";

/**
 * Rien n'est parti ni garé alors qu'un jeton neuf a révoqué l'ancien lien : rendre l'ancien.
 * S'il ne peut l'être (`false` ou exception), le jeton NEUF est révoqué par son identifiant :
 * jamais deux liens vivants. Ne lève jamais ; ni URL, ni jeton, ni adresse en console.
 * Rend `true` si l'ancien lien a été rendu, `false` sinon (le client n'a alors plus de lien valable).
 */
async function rendreAncienLienDuRenvoi(url: string, tokenId: string | null): Promise<boolean> {
  const revoquerLeNeuf = async (): Promise<void> => {
    if (tokenId === null) return;
    try {
      await revoquerJetonPrecis({ tokenId, motif: "Envoi annulé : rien n'est parti" });
    } catch {
      console.warn("[envoyerDevisEmailAction] jeton neuf non révoqué");
    }
  };
  try {
    const rendu = await rendreLienPrecedent(url, "revoquer");
    if (rendu === false) {
      console.warn("[envoyerDevisEmailAction] ancien lien de signature non rendu");
      await revoquerLeNeuf();
      return false;
    }
    return true;
  } catch {
    console.warn("[envoyerDevisEmailAction] ancien lien de signature non rendu");
    await revoquerLeNeuf();
    return false;
  }
}

const EnvoyerDevisSchema = z.object({
  devisId: z.string().uuid(),
  /** Destinataire explicite ; défaut = email de contact du client CRM. */
  to: z.string().email().optional(),
  messagePersonnalise: z.string().max(4000).optional(),
});

export async function envoyerDevisEmailAction(
  rawInput: unknown,
): Promise<
  | { data: { enqueued: boolean; garePourValidation: boolean; to: string; note?: string } }
  | { error: string }
> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible au build." };
  }
  // `requireAdminWrite` ASSUMÉ : cette action TRANSMET un devis déjà émis (elle
  // exige `statut === "envoye"` et un PDF déjà généré). Conclure le devis est un
  // acte distinct, gardé par `requireHabilitation("conclure_devis")` dans
  // `devis.ts` ; le lien de signature émis ici est celui du CLIENT, pas
  // l'engagement de l'organisme. Envoyer une pièce est la colonne « n'engage
  // rien » du SSOT.
  const session = await requireAdminWrite();
  const parsed = EnvoyerDevisSchema.safeParse(rawInput);
  if (!parsed.success) return { error: "Entrée invalide." };
  const input = parsed.data;

  const devis = await prisma.devis.findUnique({
    where: { id: input.devisId },
    include: {
      client: {
        select: {
          raisonSociale: true,
          contactEmail: true,
          contactNom: true,
          contactCivilite: true,
          contactPrenom: true,
          contactNomFamille: true,
          // Voir devis.ts : la qualité porte l'opposabilité du pouvoir de signer.
          contactFonction: true,
        },
      },
      ...SELECT_SIGNATURES_PIECE,
    },
  });
  if (!devis) return { error: "Devis introuvable." };
  // Un devis accepté (même sur papier) ou signé par le client ne se renvoie pas : l'e-mail le
  // présente comme « à signer » (PDF + bouton de signature). Aucun lien n'est émis hors « envoye »,
  // mais le message serait faux. Deux refus distincts selon la situation.
  if (devis.statut === "accepte" || devis.statut === "transforme_convention") {
    return {
      error:
        "Ce devis est déjà accepté : il ne se renvoie plus. Pour en transmettre une copie, ouvrez l'exemplaire signé (PDF) depuis la fiche.",
    };
  }
  if (signatureClientDuDevis(devis).clientASigne) {
    return {
      error: "Ce devis est déjà signé par le client : le renvoyer lui redemanderait de signer.",
    };
  }
  // Devis à formules : échec FERMÉ si l'interrupteur est éteint. Sinon un renvoi émettrait un
  // nouveau lien (qui révoque l'ancien) et enverrait un e-mail dont le lien serait refusé à la
  // signature. `offre` est un champ scalaire, déjà lu par `include`.
  if (
    devis.offre !== null &&
    devis.offre !== undefined &&
    !(await formulesActives(undefined, { clientId: devis.clientId }))
  ) {
    return {
      error:
        "Ce devis à formules ne peut pas être renvoyé tant que les devis à formules sont désactivés dans la configuration.",
    };
  }
  const aFormules = devis.offre !== null && devis.offre !== undefined;
  // Devis à formules : le bouton « signer » est le seul moyen de choisir une formule. Hors
  // statut « envoye » aucun lien n'est émis : refuser, plutôt qu'un e-mail sans bouton.
  if (aFormules && devis.statut !== "envoye") {
    return {
      error:
        "Ce devis à formules ne peut être renvoyé que s'il est au statut « envoyé » (aucun e-mail sans lien de signature).",
    };
  }
  // Un devis à formules ne part jamais sans lien : sans pièce générée, aucun jeton n'est
  // émissible. Refuser AVANT toute écriture (ni lien créé, ni e-mail en file).
  if (aFormules && devis.documentGenereId === null) {
    return {
      error:
        "Ce devis à formules n'a pas de pièce générée : aucun e-mail sans lien de signature. Générer d'abord le devis.",
    };
  }
  const pieceEnvoyee =
    devis.documentGenereId !== null
      ? await prisma.documentGenere.findUnique({
          where: { id: devis.documentGenereId },
          select: { metadata: true },
        })
      : null;

  const to = input.to ?? devis.client.contactEmail ?? null;
  if (to === null) {
    return { error: "Aucun destinataire : renseigner un email (ou l'email de contact du client)." };
  }
  // Convention Hub : Devis.fichierPdfUrl contient la CLÉ R2 du PDF (posée par
  // sendDevisAction à la génération). Sans PDF, pas d'envoi — le document
  // joint est la raison d'être de cet email.
  if (devis.fichierPdfUrl === null || devis.fichierPdfUrl === "") {
    return { error: "PDF absent : envoyer le devis (génération du PDF) avant l'envoi par email." };
  }

  // ── Lien de signature : RÉÉMIS, jamais rejoué ──
  //
  // 🔴 On ne stocke que le HASH du jeton : le clair n'existe qu'une fois, au
  // moment de l'émission. Un renvoi ne peut donc pas « retrouver » le lien
  // précédent — il en émet un neuf, ce qui révoque l'ancien (index unique
  // partiel sur (pièce, partie)).
  //
  // ⚠️ Conséquence à connaître : renvoyer l'e-mail INVALIDE le lien déjà reçu
  // par le client. C'est le comportement voulu — deux liens vivants sur une même
  // pièce signifieraient qu'en révoquer un donne une fausse impression de
  // sécurité — mais cela veut dire qu'un renvoi « pour information » casse le
  // lien en cours. Le message de retour le dit à l'admin.
  //
  // ⚠️ Fail-soft : un devis doit pouvoir être renvoyé même si le lien échoue.
  // L'e-mail part alors SANS bouton de signature, et on le DIT.
  // 🔴 Verrou consultatif à la MISE EN ATTENTE (même clé et même forme que `premierEnvoi`) : il
  // entoure la garde « déjà garé » ET l'enfilage. Sans lui, deux clics en parallèle (deux onglets)
  // passent tous deux la garde avant que l'un des deux n'ait garé sa ligne : deux lignes à valider.
  // Il tombe à la fin de la transaction, donc APRÈS l'enfilage.
  // Capturée ici : le contrôle `fichierPdfUrl` ci-dessus ne survit pas dans le rappel.
  const clePdf = devis.fichierPdfUrl;
  const issue = await prisma.$transaction(
    async (tx) => {
      const [verrou] = await tx.$queryRaw<{ locked: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(hashtext(${"devis.envoi:" + devis.id})) AS locked
      `;
      if (!verrou?.locked) return { error: MSG_ENVOI_EN_COURS };
      let signatureUrl: string | null = null;
      let tokenId: string | null = null;
      let signatureNote: string | null = null;

      // 🔴 B2, PR 4 — un e-mail de ce devis attend déjà (« à valider », ou « approuvé » depuis peu) :
      // pas de second renvoi. Même règle que l'envoi et la remise en main propre (module partagé).
      if (await emailDevisEnAttente(tx, devis.id)) return { error: MSG_RENVOI_DEJA_GARE };

      const pieceId = devis.documentGenereId;
      const renvoiAvecLien = pieceId !== null && devis.statut === "envoye";
      // Mode d'envoi décidé AVANT tout jeton : créer le jeton révoque l'ancien lien.
      //   - validation : AUCUN jeton ici. La ligne garée porte un marqueur ; le nouveau lien naît à
      //     l'approbation (`lien-a-l-envoi`) et révoque l'ancien alors. D'ici là l'ancien reste vivant.
      //   - auto : chemin d'origine, inchangé.
      const parValidation =
        renvoiAvecLien &&
        (await resoudreMode(GABARIT_DEVIS_ENVOI, devis.clientId)) === "validation";
      if (renvoiAvecLien && !parValidation) {
        try {
          // Calculée AVANT le jeton : si elle lève, aucun jeton n'est créé (créer le jeton révoque
          // l'ancien lien, le client resterait sans lien valable).
          const baseSignature = publicUrl("/fr/portail/signer/").toString();
          const { token, tokenId: idNeuf } = await creerTokenDocument({
            documentGenereId: pieceId,
            partie: "client",
            signataireNom: devis.client.contactNom ?? devis.client.raisonSociale,
            signataireEmail: to,
            signataireQualite: devis.client.contactFonction,
            borneMetier: devis.dateValidite,
          });
          signatureUrl = `${baseSignature}${token}`;
          tokenId = idNeuf;
        } catch (err) {
          if (aFormules) {
            console.warn("[envoyerDevisEmailAction] émission du lien de signature échouée", err);
            return {
              error:
                "Le lien de signature n'a pas pu être créé : un devis à formules ne part jamais sans bouton « signer ». Réessayer.",
            };
          }
          signatureNote =
            err instanceof TokenDocumentError
              ? `Lien de signature non émis (${err.motif}) : l'email part sans bouton « signer ».`
              : "Lien de signature non émis : l'email part sans bouton « signer ».";
          console.warn("[envoyerDevisEmailAction] émission du lien de signature échouée", err);
        }
      }

      const payloadCourriel = payloadDevisEnvoi({
        clientNom: nomPourSalutationDevis(devis.client),
        salutation: salutationPourPayload({
          clientNom: nomPourSalutationDevis(devis.client),
          contactCivilite: devis.client.contactCivilite,
          contactPrenom: devis.client.contactPrenom,
          contactNomFamille: devis.client.contactNomFamille,
        }),
        numero: devis.numero,
        montantTotalHtCents: devis.montantTotalHtCents,
        montantLabel: `${eur(devis.montantTotalHtCents)} HT`,
        dateValiditeLabel: dateFr(devis.dateValidite),
        // Formules figées dans la pièce déjà envoyée : l'e-mail décrit le PDF joint.
        formules: formulesDepuisMetadata(pieceEnvoyee?.metadata),
        // Même si les formules figées sont illisibles : un devis à formules n'annonce jamais de montant.
        devisAFormules: aFormules,
        signatureUrl,
        messagePersonnalise: input.messagePersonnalise,
      });
      if (parValidation) {
        // Marqueur sans identité, sans URL, sans jeton : contrat v1 de `lien-a-l-envoi`.
        payloadCourriel[CLE_MARQUEUR] = {
          v: 1,
          nature: "devis-renvoi",
          documentGenereId: pieceId,
          partie: "client",
          devisId: devis.id,
        };
      }

      let enqueued = false;
      let garePourValidation = false;
      let enfilageEnErreur = false;
      try {
        const r = await enqueueEmail("devis-envoi", to, "fr", payloadCourriel, {
          attachments: [{ filename: `${devis.numero}.pdf`, r2Key: clePdf }],
          entityType: "Devis",
          entityId: devis.id,
          // 🔴 Vérification E2E 2026-07-26. Sans `clientId`, aucune règle
          // d'automatisation PAR CLIENT ne peut jamais s'appliquer : le `where` de
          // `resoudreMode` se réduit aux règles globales. L'écran affichait donc des
          // réglages par client structurellement inertes.
          clientId: devis.clientId,
          sujet: `Devis ${devis.numero} — Axion-IA`,
          ...(parValidation ? { exigerValidation: true } : {}),
        });
        enqueued = r.enqueued;
        garePourValidation = r.garePourValidation ?? false;
      } catch (err) {
        // Cas limite : un délai de réponse Redis peut lever alors que le job a bien été ajouté.
        // L'e-mail partirait alors avec un lien révoqué, mais le client garde son ancien lien
        // rendu (cf. `rendreAncienLienDuRenvoi`) : jamais zéro lien, jamais deux.
        // Journalisé sans adresse ni lien : seul le nom de l'erreur.
        console.warn(
          "[envoyerDevisEmailAction] enfilage de l'e-mail en erreur",
          err instanceof Error ? err.name : "inconnue",
        );
        enfilageEnErreur = true;
      }

      return {
        enqueued,
        garePourValidation,
        enfilageEnErreur,
        signatureUrl,
        tokenId,
        signatureNote,
        parValidation,
      };
    },
    { maxWait: 5_000, timeout: 60_000 },
  );
  if ("error" in issue) return { error: issue.error };
  const {
    enqueued,
    garePourValidation,
    enfilageEnErreur,
    signatureUrl,
    tokenId,
    signatureNote,
    parValidation,
  } = issue;

  // 🔴 `enqueued: false` ne signifie PAS un échec : c'est aussi ce que renvoie
  // un email correctement GARÉ en corbeille de validation. Le traiter comme une
  // erreur affichait « File d'envoi indisponible — réessayer » sur un succès,
  // sautait la journalisation, et invitait l'admin à recliquer — chaque reclic
  // créant une ligne de plus en corbeille, sans déduplication.
  if (!enqueued && !garePourValidation) {
    // Un jeton créé au clic a révoqué l'ancien lien : rien n'est parti ni garé, le nouveau lien est
    // perdu. On rend l'ancien ; s'il ne peut l'être, le jeton neuf est révoqué (jamais deux liens
    // vivants). Jamais d'erreur remontée, ni URL ni adresse dans la console.
    const rendu =
      signatureUrl === null ? true : await rendreAncienLienDuRenvoi(signatureUrl, tokenId);
    if (enfilageEnErreur) {
      return { error: rendu ? MSG_ENFILAGE_EN_ERREUR : MSG_ENFILAGE_EN_ERREUR_SANS_LIEN };
    }
    return { error: MSG_FILE_INDISPONIBLE };
  }

  await logQualiopiActivity({
    action: "facturation.email.devis",
    targetType: "Devis",
    targetId: devis.id,
    // ⚠️ Le LIEN n'est jamais journalisé : il vaut signature. Seul le fait
    // qu'il ait été réémis l'est.
    // ⚠️ Ni l'adresse : le `targetId` suffit à retrouver le devis.
    changes: { numero: devis.numero, lienSignatureReemis: signatureUrl !== null },
    session,
  });
  return {
    data: {
      enqueued,
      garePourValidation,
      to,
      ...(parValidation
        ? { note: NOTE_RENVOI_GARE }
        : signatureNote !== null
          ? { note: signatureNote }
          : {}),
    },
  };
}

const EnvoyerFactureSchema = z.object({
  factureId: z.string().uuid(),
  to: z.string().email().optional(),
  messagePersonnalise: z.string().max(4000).optional(),
});

export async function envoyerFactureEmailAction(
  rawInput: unknown,
): Promise<
  { data: { enqueued: boolean; garePourValidation: boolean; to: string } } | { error: string }
> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible au build." };
  }
  // `requireAdminWrite` ASSUMÉ : la facture est déjà ÉMISE quand on arrive ici —
  // l'action refuse explicitement un brouillon et exige un PDF existant.
  // L'émission, elle, passe par `requireHabilitation("facturer")`.
  const session = await requireAdminWrite();
  const parsed = EnvoyerFactureSchema.safeParse(rawInput);
  if (!parsed.success) return { error: "Entrée invalide." };
  const input = parsed.data;

  // 🔑 Le corps vit dans un service PUR, partagé avec la préparation automatique
  // de l'e-mail au lendemain de la session (cron du worker, hors Next). Le
  // bouton n'exige PAS la validation : les règles d'automatisation par client
  // restent souveraines ici. Cf. l'en-tête de `facture-envoi-email.ts`.
  const resultat = await preparerEnvoiFactureEmail(input);
  if ("error" in resultat) return resultat;
  const { enqueued, garePourValidation, to, numero, estAvoir, pdfHash } = resultat.data;

  await logQualiopiActivity({
    action: "facturation.email.facture",
    targetType: "FactureFormation",
    targetId: input.factureId,
    changes: { to, numero, estAvoir, pdfHash },
    session,
  });
  return { data: { enqueued, garePourValidation, to } };
}
