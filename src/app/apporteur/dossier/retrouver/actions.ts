"use server";

// « Retrouver mon espace » (décision de Will, 2026-10-09) : l'apporteur tape son adresse e-mail
// et, SI une fiche du réseau la porte, il reçoit le lien de son espace (« apporteur-lien-espace »).
//
// Modèle : la demande de lien de l'espace formateur (`server/actions/formateur/auth.actions.ts`).
//   · Réponse TOUJOURS la même, que l'adresse soit connue ou non : la page ne dit jamais qui fait
//     partie du réseau (anti-énumération) ;
//   · limite par IP et par adresse, et on REFUSE si la limite est indisponible (envoi d'e-mail) ;
//   · rien pour un dossier refusé ou résilié (le lien mènerait à une page neutre) ;
//   · une fiche RETIRÉE reçoit son lien : son espace reste ouvert au dépôt des attestations.

import { z } from "zod";

import { envoyer } from "@/features/apporteurs-reseau/envois";
import { urlDossier } from "@/features/apporteurs-reseau/jeton";
import { etatDeLaPage } from "@/features/apporteurs-reseau/signature-regles";
import { getClientIp } from "@/lib/client-ip";
import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashEmailForLookup } from "@/lib/security/email-hash";

import { MESSAGE_RETROUVER, type EtatRetrouver } from "./messages";

const adresse = z.string().trim().toLowerCase().email().max(254);

// Adresse enregistrée, déchiffrée — ou null si elle est illisible. Jamais d'exception : une
// fiche au chiffré corrompu ne doit pas répondre autrement qu'une adresse inconnue
// (anti-énumération), et le placeholder « clé absente » n'est pas une adresse.
function adresseEnregistree(chiffre: string): string | null {
  try {
    const lu = adresse.safeParse(decryptPii(chiffre));
    return lu.success ? lu.data : null;
  } catch {
    return null;
  }
}

export async function demanderLienEspace(
  _prec: EtatRetrouver | undefined,
  formData: FormData,
): Promise<EtatRetrouver> {
  // Champ piège invisible : un robot le remplit, une personne jamais.
  if (String(formData.get("site") ?? "").trim() !== "") {
    return { envoye: true, message: MESSAGE_RETROUVER };
  }
  const lu = adresse.safeParse(formData.get("email"));
  if (!lu.success) return { envoye: false, message: "Cette adresse e-mail ne semble pas valide." };
  const email = lu.data;
  const empreinte = hashEmailForLookup(email);
  if (!empreinte) return { envoye: false, message: "Cette adresse e-mail ne semble pas valide." };

  const ip = await getClientIp();
  const parIp = await checkRateLimit(`apporteur:lien-espace:ip:${ip}`, {
    limit: 10,
    windowSec: 900,
    surPanne: "refuser",
  });
  const parAdresse = await checkRateLimit(`apporteur:lien-espace:email:${empreinte}`, {
    limit: 5,
    windowSec: 900,
    surPanne: "refuser",
  });
  if (!parIp.allowed || !parAdresse.allowed) return { envoye: true, message: MESSAGE_RETROUVER };

  const fiche = await prisma.apporteurReseau.findUnique({
    where: { emailHash: empreinte },
    select: { id: true, prenom: true, statut: true, versionLien: true, email: true },
  });
  if (fiche && etatDeLaPage(fiche.statut) !== "neutre") {
    const lien = urlDossier(fiche.id, fiche.versionLien);
    // Relecture sécurité (a1) : l'envoi part à l'adresse ENREGISTRÉE sur la fiche, jamais à
    // celle tapée dans le formulaire (même empreinte ne vaut pas même adresse).
    const enregistree = adresseEnregistree(fiche.email);
    if (lien && enregistree) {
      await envoyer({
        gabarit: "apporteur-lien-espace",
        destinataire: enregistree,
        payload: { prenom: fiche.prenom, lien },
        entityType: "ApporteurReseau",
        entityId: fiche.id,
      });
    }
  }
  return { envoye: true, message: MESSAGE_RETROUVER };
}
