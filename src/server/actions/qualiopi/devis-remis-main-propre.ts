/**
 * Qualiopi — Server Action « Remis en main propre » d'un devis CLASSIQUE.
 *
 * Pourquoi : `sendDevisAction` ne passe un devis « envoye » que si un courriel est réellement
 * enfilé ou garé (B1). Un devis classique d'un client sans adresse e-mail (ou à l'adresse
 * bloquée) ne pouvait donc plus être accepté (`acceptDevisAction` exige « envoye » ou « expire »).
 * Cette action est la voie explicite : la pièce numérotée est créée, le devis passe « envoye »,
 * SANS jeton de signature et SANS e-mail. Le devis papier est signé hors ligne, puis l'admin
 * clique « Marquer accepté ».
 *
 * Un devis à formules ne passe JAMAIS par ici : il se signe uniquement en ligne.
 */

"use server";

import React from "react";
import { z } from "zod";
import { computeTotauxFacture, TAUX_TVA_STANDARD } from "@/server/qualiopi/legal/tva";
import {
  raisonEcheancierRefuse,
  TITRE_ECHEANCIER,
} from "@/server/qualiopi/devis/assistant/conditions-prix-unique";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { emettreDevisEmis } from "@/server/partners-sync/producteurs/devis";
import { DevisPdf, type DevisData } from "@/server/qualiopi/documents/templates/devis";
import {
  donneesPdfDevis,
  lireContextePdfDevis,
  OffreDevisInvalideError,
} from "@/server/qualiopi/documents/donnees-pdf-devis";
import { prendreVerrouEnvoiDevis } from "@/server/qualiopi/devis/marquer-devis-envoye";
import { emailDevisEnAttente } from "@/server/qualiopi/devis/email-devis-en-attente";
import {
  cloreVersionRemplacee,
  MSG_VERSION_REMPLACEE_ACCEPTEE,
  MSG_VERSION_REMPLACEE_SIGNEE_ENTRE_TEMPS,
  versionRemplaceeBloqueEmission,
  VersionRemplaceeSigneeEntreTempsError,
} from "@/server/qualiopi/devis/version-remplacee";

type ActionResult<T> = { data: T } | { error: string };

const entreeSchema = z.object({
  id: z.string().uuid(),
  motif: z.enum(["sans_email", "adresse_bloquee", "remis_en_rendez_vous"]),
});

/** Refus : le message est celui affiché à l'admin ; `motif` (code court) va au journal. */
class RemiseRefusee extends Error {
  constructor(
    message: string,
    readonly motif: string,
  ) {
    super(message);
  }
}

const MSG_VERROU =
  "Une opération est déjà en cours sur ce devis. Patientez quelques secondes, puis rechargez la page.";
const MSG_PDF_RATE =
  "Le PDF du devis n'a pas pu être créé. Rien n'a été modifié ; le devis reste en brouillon. Réessayez dans un instant.";

export async function marquerRemisEnMainPropreAction(input: {
  id: string;
  motif: "sans_email" | "adresse_bloquee" | "remis_en_rendez_vous";
}): Promise<ActionResult<{ id: string }>> {
  // Stub-aware (build GH Actions) : aucune mutation au SSG.
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible pendant le build" };
  }
  // Même habilitation que l'envoi.
  const session = await requireAdminWrite();
  const parsed = entreeSchema.safeParse(input);
  if (!parsed.success) return { error: "Demande invalide" };
  const { id: devisId, motif } = parsed.data;

  let documentGenereId: string | null = null;

  try {
    await prisma.$transaction(
      async (tx) => {
        // (a) Verrou consultatif non bloquant, MÊME clé que l'envoi.
        if (!(await prendreVerrouEnvoiDevis(tx, devisId)))
          throw new RemiseRefusee(MSG_VERROU, "verrou_pris");

        // (b) Relecture DANS la transaction, puis gardes.
        const devis = await tx.devis.findUnique({
          where: { id: devisId },
          select: {
            id: true,
            numero: true,
            clientId: true,
            statut: true,
            // Version lue : l'écriture finale exige qu'elle n'ait pas bougé pendant le PDF.
            updatedAt: true,
            lignes: true,
            activite: true,
            refClient: true,
            replacesDevisId: true,
            offre: true,
            offreSha256: true,
            conditionsParticulieres: true,
            replacesDevis: { select: { statut: true, documentGenereId: true } },
            financementSuggere: true,
            montantTotalHtCents: true,
            montantOpcoEstimeCents: true,
            resteAChargeCents: true,
            dateValidite: true,
            client: {
              select: {
                type: true,
                raisonSociale: true,
                siret: true,
                adresse: true,
                adresseRue: true,
                adresseCodePostal: true,
                adresseVille: true,
                contactNom: true,
                contactEmail: true,
                contactFonction: true,
              },
            },
          },
        });
        if (!devis) throw new RemiseRefusee("Devis introuvable", "introuvable");

        if (devis.statut !== "brouillon") {
          throw new RemiseRefusee(
            `Seul un devis en brouillon peut être remis en main propre (statut actuel : ${devis.statut}).`,
            "statut_non_brouillon",
          );
        }
        // Révision : version remplacée signée, acceptée ou transformée = refus, avant le PDF.
        if (
          await versionRemplaceeBloqueEmission(tx, {
            replacesDevisId: devis.replacesDevisId,
            statutRemplace: devis.replacesDevis?.statut,
          })
        ) {
          throw new RemiseRefusee(MSG_VERSION_REMPLACEE_ACCEPTEE, "version_remplacee_signee");
        }
        if (devis.offre !== null || devis.offreSha256 !== null) {
          throw new RemiseRefusee(
            "Un devis à formules se signe uniquement en ligne.",
            "devis_a_formules",
          );
        }
        if (devis.montantTotalHtCents <= 0) {
          throw new RemiseRefusee(
            "Devis à 0,00 € HT : chiffrez les lignes avant de le remettre.",
            "total_nul",
          );
        }
        // Un courriel de ce devis attend déjà dans la corbeille : le remettre en main propre
        // le laisserait partir ensuite. Validez-le ou refusez-le d'abord.
        // « À valider » ET « approuvé » (en cours d'envoi) : dans les deux cas l'e-mail peut partir.
        const dejaGare = await emailDevisEnAttente(tx, devisId);
        if (dejaGare) {
          throw new RemiseRefusee(
            "Un e-mail de ce devis attend déjà dans Emails → À valider : validez-le ou refusez-le avant de remettre le devis en main propre.",
            "deja_gare",
          );
        }

        // (c) Pièce PDF numérotée : un échec refuse tout (le devis reste en brouillon).
        let data: DevisData;
        try {
          const contexte = await lireContextePdfDevis();
          data = donneesPdfDevis(devis, contexte, new Date());
        } catch (err) {
          if (err instanceof OffreDevisInvalideError) {
            throw new RemiseRefusee(err.message, "offre_invalide");
          }
          console.warn("[marquerRemisEnMainPropreAction] données du PDF non construites", err);
          throw new RemiseRefusee(MSG_PDF_RATE, "pdf_rate");
        }
        // Échéancier de l'assistant : même contrôle que sendDevisAction, AVANT toute pièce.
        const raisonEcheancier = data.conditionsParticulieres?.startsWith(TITRE_ECHEANCIER)
          ? raisonEcheancierRefuse(
              data.conditionsParticulieres,
              computeTotauxFacture(
                data.lignes,
                data.regimeTva,
                data.tauxTvaStandardPercent ?? TAUX_TVA_STANDARD,
              ).totalTtcCents,
              data.regimeTva,
            )
          : null;
        if (raisonEcheancier !== null) {
          throw new RemiseRefusee(raisonEcheancier, "echeancier_incoherent");
        }
        let pdfCle: string;
        let pieceId: string;
        try {
          const doc = await generateDocument({
            type: "devis",
            element: React.createElement(DevisPdf, { data }),
            identite: data.identite,
            refs: { clientId: devis.clientId },
          });
          if (!doc.id) throw new Error("pièce sans identifiant");
          // Clé R2 stable (l'URL signée expire en 900 s : on stocke la clé).
          pdfCle = `documents/${new Date().getFullYear()}/devis/${doc.numero}.pdf`;
          pieceId = doc.id;
          documentGenereId = pieceId;
        } catch (err) {
          console.warn("[marquerRemisEnMainPropreAction] génération PDF échouée", err);
          throw new RemiseRefusee(MSG_PDF_RATE, "pdf_rate");
        }

        // (d) AUCUN jeton de signature, AUCUN e-mail.

        // (e) Écriture gardée : brouillon + version lue (un enregistrement survenu pendant le
        // PDF fait tomber l'écriture à `count: 0`).
        const marque = await tx.devis.updateMany({
          where: { id: devisId, statut: "brouillon", updatedAt: devis.updatedAt },
          data: {
            statut: "envoye",
            sentAt: new Date(),
            fichierPdfUrl: pdfCle,
            documentGenereId: pieceId,
          },
        });
        if (marque.count !== 1) {
          throw new Error(`devis non passé à « envoye » (${marque.count} ligne modifiée)`);
        }
        // (f) Seul un PROSPECT (ou « perdu ») devient « devis envoyé » ; jamais de rétrogradation.
        await tx.client.updateMany({
          where: { id: devis.clientId, statut: { in: ["prospect", "perdu"] } },
          data: { statut: "devis_envoye" },
        });
        // (g) Révision : version remplacée « expire », ses jetons sont révoqués.
        await cloreVersionRemplacee(tx, {
          replacesDevisId: devis.replacesDevisId,
          documentGenereIdRemplace: devis.replacesDevis?.documentGenereId,
          numero: devis.numero,
          statutRemplace: devis.replacesDevis?.statut,
        });
        // (h) Événement « devis émis » dans la MÊME transaction (règle devis.emis du cliquet).
        await emettreDevisEmis(tx, devisId);
      },
      { maxWait: 5_000, timeout: 60_000 },
    );
  } catch (err) {
    if (err instanceof RemiseRefusee) {
      if (err.motif !== "introuvable") {
        try {
          await logQualiopiActivity({
            action: "qualiopi.devis.remis_main_propre_refuse",
            targetType: "Devis",
            targetId: devisId,
            // Le MOTIF seulement.
            changes: { motif: err.motif },
            session,
          });
        } catch (e) {
          console.warn("[marquerRemisEnMainPropreAction] journal du refus échoué", e);
        }
      }
      return { error: err.message };
    }
    if (err instanceof VersionRemplaceeSigneeEntreTempsError) {
      // Transaction annulée : le brouillon reste brouillon, l'ancienne version reste « envoye ».
      try {
        await logQualiopiActivity({
          action: "qualiopi.devis.remis_main_propre_refuse",
          targetType: "Devis",
          targetId: devisId,
          changes: { motif: "version_remplacee_signee_entre_temps" },
          session,
        });
      } catch (e) {
        console.warn("[marquerRemisEnMainPropreAction] journal du refus échoué", e);
      }
      return { error: MSG_VERSION_REMPLACEE_SIGNEE_ENTRE_TEMPS };
    }
    throw err;
  }

  // Transaction validée. Ni adresse ni lien dans le journal.
  await logQualiopiActivity({
    action: "qualiopi.devis.remis_main_propre",
    targetType: "Devis",
    targetId: devisId,
    changes: {
      statut: "envoye",
      canal: "main_propre",
      motif,
      documentGenereId,
      emailEnvoye: false,
      lienSignatureEmis: false,
    },
    session,
  });

  return { data: { id: devisId } };
}
