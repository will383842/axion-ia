"use server";

/**
 * Aperçu de l'e-mail du devis avant envoi (étape 4 de l'assistant). LECTURE SEULE : aucune
 * écriture, aucun jeton, aucun envoi. Le contenu vient du MÊME module pur que l'envoi
 * (`contenuEmailDevis`) : ce que le fondateur voit est ce qui partira.
 *
 * Le lien de signature n'existe pas encore (il est créé à l'envoi) : le rendu reçoit un lien
 * fictif, puis `masquerSecretsEmail` et `rendreLiensOuvrables` ôtent tout lien personnel (le lien fictif de signature reste inerte).
 */
import { z } from "zod";

import { isUuid } from "@/lib/is-uuid";
import { enveloppeExpedition } from "@/lib/email/enveloppe";
import { rendreLiensOuvrables } from "@/lib/email/apercu-lecteur";
import { salutation } from "@/lib/email/salutation";
import { masquerSecretsEmail } from "@/lib/email/masquer-secrets";
import { renderEmailTemplate, sujetDuGabarit } from "@/lib/email/templates";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/server/actions/qualiopi/_guards";
import {
  contenuEmailDevis,
  messageEntreeSchema,
  objetEntreeSchema,
} from "@/server/qualiopi/devis/contenu-email-devis";
import { GABARIT_DEVIS_ENVOI } from "@/server/qualiopi/devis/email-devis-en-attente";
import {
  donneesPdfDevis,
  lireContextePdfDevis,
  SELECT_DEVIS_POUR_PDF,
} from "@/server/qualiopi/documents/donnees-pdf-devis";
import { estActifPour, lireInterrupteurQualiopi } from "@/server/qualiopi/socle/interrupteurs";
import { LOT_DEVIS_ASSISTANT } from "@/server/qualiopi/devis/interrupteur-assistant";

type ActionResult<T> = { data: T } | { error: string };

export interface ApercuEmailDevis {
  /** Adresse lue sur la fiche du client ; vide si la fiche n'en a pas. */
  a: string;
  de: string;
  objet: string;
  objetOrigine: string;
  html: string;
  piecesJointes: string[];
  lienSignature: "créé à l'envoi";
  salutation: string;
  adresseManquante: boolean;
}

// Lien FICTIF : il n'ouvre rien et n'est jamais un jeton. Il est rendu inerte avant d'être renvoyé.
const LIEN_FICTIF = "https://axion-ia.com/fr/portail/signer/apercu";

const entreeSchema = z.object({
  devisId: z.string({ message: "Devis invalide." }),
  sujet: objetEntreeSchema,
  message: messageEntreeSchema,
});

export async function apercuEmailDevisAction(input: {
  devisId: string;
  sujet?: string | undefined;
  message?: string | undefined;
}): Promise<ActionResult<ApercuEmailDevis>> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible pendant le build" };
  }
  await requireAdminWrite();
  const lu = entreeSchema.safeParse(input);
  if (!lu.success) return { error: lu.error.issues[0]?.message ?? "Demande invalide." };
  input = lu.data;
  if (!isUuid(input.devisId)) return { error: "Devis invalide." };

  // Interrupteur relu à l'appel ; l'état « essai » ne vaut que pour une fiche d'essai.
  const etat = await lireInterrupteurQualiopi(LOT_DEVIS_ASSISTANT);
  if (etat === "eteint") return { error: "L'assistant de devis est désactivé." };

  const devis = await prisma.devis.findUnique({
    where: { id: input.devisId },
    select: {
      ...SELECT_DEVIS_POUR_PDF,
      id: true,
      clientId: true,
      montantTotalHtCents: true,
      client: {
        select: {
          ...SELECT_DEVIS_POUR_PDF.client.select,
          contactNom: true,
          contactCivilite: true,
          contactPrenom: true,
          contactNomFamille: true,
          testInterne: { select: { clientId: true } },
        },
      },
    },
  });
  if (!devis) return { error: "Devis introuvable." };
  if (
    etat === "essai" &&
    !estActifPour(etat, { estTestInterne: devis.client.testInterne !== null })
  ) {
    return { error: "L'assistant de devis est en essai : il n'agit que sur une fiche d'essai." };
  }
  if (devis.statut !== "brouillon") {
    return { error: "L'aperçu de l'e-mail n'est disponible que pour un devis en brouillon." };
  }

  let formules;
  try {
    formules = donneesPdfDevis(
      devis,
      await lireContextePdfDevis({ clientId: devis.clientId }),
      new Date(),
    ).formules;
  } catch {
    return { error: "Le devis n'a pas pu être relu : aperçu indisponible." };
  }

  const entree = { devis, client: devis.client, formules } as const;
  const modifie = contenuEmailDevis({
    ...entree,
    signatureUrl: LIEN_FICTIF,
    ...(input.sujet !== undefined ? { sujet: input.sujet } : {}),
    ...(input.message !== undefined ? { message: input.message } : {}),
  });
  if (!modifie.ok) return { error: modifie.error };
  const origine = contenuEmailDevis({ ...entree, signatureUrl: LIEN_FICTIF });
  if (!origine.ok) return { error: origine.error };

  const adresse = devis.client.contactEmail?.trim() ?? "";
  try {
    const rendu = await renderEmailTemplate(GABARIT_DEVIS_ENVOI, "fr", modifie.payload, {
      destinataire: adresse === "" ? null : adresse,
    });
    const objetOrigine = sujetDuGabarit(GABARIT_DEVIS_ENVOI, "fr", origine.payload);
    const masque = masquerSecretsEmail({
      subject: rendu.subject,
      html: rendu.html,
      text: rendu.text,
    });
    return {
      data: {
        a: adresse,
        de: enveloppeExpedition().from,
        objet: modifie.sujet ?? masque.subject,
        objetOrigine,
        html: rendreLiensOuvrables(masque.html, { exclure: [LIEN_FICTIF] }),
        piecesJointes: [`${devis.numero}.pdf`],
        lienSignature: "créé à l'envoi",
        // Même fonction que le gabarit : « Bonjour Monsieur Dupont, », « Bonjour Léa, » ou « Bonjour, ».
        salutation: salutation(
          {
            civilite: devis.client.contactCivilite,
            prenom: devis.client.contactPrenom,
            nomFamille: devis.client.contactNomFamille,
          },
          "fr",
        ),
        adresseManquante: adresse === "",
      },
    };
  } catch {
    return { error: "L'aperçu de l'e-mail n'a pas pu être rendu." };
  }
}
