"use server";

// « Retrouver mon lien » du formateur indépendant (lot L6, F14), calque de la page des
// apporteurs :
//   · réponse TOUJOURS la même, que l'adresse soit connue ou non (anti-énumération) ;
//   · limite par IP hachée et par adresse ; compteur en panne = REFUS (envoi d'e-mail) ;
//   · interrupteur `dossier_en_ligne` éteint : rien ne part (même réponse neutre) ;
//   · un dossier encore à compléter reçoit son lien, à l'adresse ENREGISTRÉE sur la
//     fiche ; le lien est celui de la version d'accès courante (aucune révocation, aucun
//     lien rouvert) ;
//   · lot B (M25) : une fiche ACTIVE reçoit, au même e-mail F14 (bouton « Ouvrir mon
//     espace »), un lien de connexion à son espace (15 minutes, usage unique) — le même
//     lien que la page de connexion de l'espace, jamais réutilisable.

import { z } from "zod";

import { getClientIp } from "@/lib/client-ip";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { hashIp } from "@/lib/security/ip-hash";
import { createFormateurMagicLink } from "@/server/formateur/magic-link";
import { buildFormateurMagicLinkUrl } from "@/server/formateur/routes";
import { dossierEnLigneOuvert } from "@/server/qualiopi/formateurs-independants/dossier";
import { envoyer } from "@/server/qualiopi/formateurs-independants/envois";
import { urlDossierFormateur } from "@/server/qualiopi/formateurs-independants/jeton-dossier";

import { MESSAGE_RETROUVER, type EtatRetrouver } from "./messages";

const adresse = z.string().trim().toLowerCase().email().max(254);

async function ipBruteOuNull(): Promise<string | null> {
  try {
    return await getClientIp();
  } catch {
    return null;
  }
}

async function envoyerLienSiConnu(email: string, ip: string | null): Promise<void> {
  const fiche = await prisma.trainer.findFirst({
    where: {
      email,
      statut: "sous_traitant",
      finCollaborationAt: null,
      organismeSousTraitantId: null,
      OR: [{ dossierStatut: { in: ["en_cours", "a_completer"] } }, { actif: true }],
    },
    select: { id: true, prenom: true, email: true, accesVersion: true, actif: true },
  });
  if (!fiche) return;
  // Fiche active : son espace (lien de connexion à usage unique), bouton 2.
  if (fiche.actif === true) {
    const jeton = await createFormateurMagicLink(fiche.id, ip);
    await envoyer({
      gabarit: "formateur-lien-espace",
      destinataire: fiche.email,
      payload: { prenom: fiche.prenom, lien: buildFormateurMagicLinkUrl(jeton), bouton: 2 },
      entityType: "Trainer",
      entityId: fiche.id,
    });
    return;
  }
  const lien = urlDossierFormateur(fiche.id, fiche.accesVersion, new Date());
  if (!lien) return;
  await envoyer({
    gabarit: "formateur-lien-espace",
    destinataire: fiche.email,
    payload: { prenom: fiche.prenom, lien, bouton: 1 },
    entityType: "Trainer",
    entityId: fiche.id,
  });
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

  const ipBrute = await ipBruteOuNull();
  const parIp = await checkRateLimit(`formateur-dossier:lien:ip:${hashIp(ipBrute) ?? "sans-ip"}`, {
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

  // Lancé SANS être attendu : une adresse connue ne répond pas plus lentement qu'une
  // inconnue (pas d'oracle de temps). Les erreurs restent muettes.
  // L'IP n'est conservée qu'en empreinte, jamais en clair.
  void envoyerLienSiConnu(lu.data, hashIp(ipBrute)).catch(() => undefined);
  return neutre;
}
