"use server";

// « Retrouver mon lien » du formateur indépendant (lot L6, F14), calque de la page des
// apporteurs :
//   · réponse TOUJOURS la même, que l'adresse soit connue ou non (anti-énumération) ;
//   · limite par IP hachée et par adresse ; compteur en panne = REFUS (envoi d'e-mail) ;
//   · interrupteur `dossier_en_ligne` éteint : rien ne part (même réponse neutre) ;
//   · seul un dossier encore à compléter reçoit son lien, à l'adresse ENREGISTRÉE sur la
//     fiche ; le lien est celui de la version d'accès courante (aucune révocation, aucun
//     lien rouvert). L'accès à l'espace d'un formateur actif viendra avec l'espace.

import { z } from "zod";

import { getClientIp } from "@/lib/client-ip";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { hashIp } from "@/lib/security/ip-hash";
import { dossierEnLigneOuvert } from "@/server/qualiopi/formateurs-independants/dossier";
import { envoyer } from "@/server/qualiopi/formateurs-independants/envois";
import { urlDossierFormateur } from "@/server/qualiopi/formateurs-independants/jeton-dossier";

import { MESSAGE_RETROUVER, type EtatRetrouver } from "./messages";

const adresse = z.string().trim().toLowerCase().email().max(254);

async function ipHachee(): Promise<string> {
  try {
    return hashIp(await getClientIp()) ?? "sans-ip";
  } catch {
    return "sans-ip";
  }
}

export async function demanderLienDossier(
  _prec: EtatRetrouver | undefined,
  formData: FormData,
): Promise<EtatRetrouver> {
  const neutre: EtatRetrouver = { envoye: true, message: MESSAGE_RETROUVER };
  // Champ piège invisible : un robot le remplit, une personne jamais.
  if (String(formData.get("site") ?? "").trim() !== "") return neutre;
  const lu = adresse.safeParse(formData.get("email"));
  if (!lu.success) return { envoye: false, message: "Cette adresse e‑mail ne semble pas valide." };
  const empreinte = hashEmailForLookup(lu.data);
  if (!empreinte) return { envoye: false, message: "Cette adresse e‑mail ne semble pas valide." };

  const parIp = await checkRateLimit(`formateur-dossier:lien:ip:${await ipHachee()}`, {
    limit: 10,
    windowSec: 900,
    surPanne: "refuser",
  });
  const parAdresse = await checkRateLimit(`formateur-dossier:lien:email:${empreinte}`, {
    limit: 5,
    windowSec: 900,
    surPanne: "refuser",
  });
  if (!parIp.allowed || !parAdresse.allowed) return neutre;
  if (!(await dossierEnLigneOuvert())) return neutre;

  try {
    const fiche = await prisma.trainer.findFirst({
      where: {
        email: lu.data,
        statut: "sous_traitant",
        finCollaborationAt: null,
        organismeSousTraitantId: null,
        dossierStatut: { in: ["en_cours", "a_completer"] },
      },
      select: { id: true, prenom: true, email: true, accesVersion: true },
    });
    if (fiche) {
      const lien = urlDossierFormateur(fiche.id, fiche.accesVersion, new Date());
      if (lien) {
        await envoyer({
          gabarit: "formateur-lien-espace",
          destinataire: fiche.email,
          payload: { prenom: fiche.prenom, lien, bouton: 1 },
          entityType: "Trainer",
          entityId: fiche.id,
        });
      }
    }
  } catch {
    // Même réponse : rien ne dit si l'adresse est connue.
  }
  return neutre;
}
