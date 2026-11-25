/**
 * DEMANDE D'AIDE depuis l'espace de l'apporteur (`/apporteur/dossier/<id>/<jeton>/aide`).
 *
 * Même garde que les actions sœurs de l'espace : limite de débit par IP HACHÉE, puis dossier
 * relu PAR SON LIEN (`lireDossierParLien` : jeton HMAC, version du lien, temps constant). Un
 * jeton faux ou révoqué, un dossier refusé ou résilié rendent le même refus.
 *
 * L'équipe est prévenue par le gabarit d'alerte interne EXISTANT (`qualiopi-alerte-interne`,
 * modèle : `alerte-vigilance.ts`), avec le lien vers la fiche console. AUCUN e-mail ne part à
 * l'apporteur, aucune table n'est écrite : la trace est celle du journal des e-mails
 * (`entityType` / `entityId`).
 *
 * 🔴 Le texte libre est une donnée NON FIABLE : il n'est jamais interprété (le gabarit le rend
 * comme du texte, échappé), jamais écrit dans un journal ni dans Sentry, jamais placé dans le
 * titre de l'alerte (donc jamais dans l'objet de l'e-mail). Ce qui ressemble à un IBAN en est
 * retiré avant l'envoi.
 *
 * ⚠️ Module `"use server"` : il n'exporte QUE des fonctions asynchrones (textes et types dans
 * `demande-aide-textes.ts`).
 */

"use server";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { getClientIp } from "@/lib/client-ip";
import { destinataireAlertesInternes } from "@/lib/destinataires-internes";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/security/ip-hash";
import { enqueueEmail } from "@/server/queue/queues";

import {
  MESSAGE_AIDE_MAX,
  MESSAGE_AIDE_MIN,
  SUJETS_AIDE,
  TEXTES_AIDE,
  type EtatDemandeAide,
  type SujetAide,
} from "./demande-aide-textes";
import { lireDossierParLien } from "./donnees";
import { etatDeLaPage } from "./signature-regles";

const CLES_SUJET = SUJETS_AIDE.map((s) => s.cle) as [SujetAide, ...SujetAide[]];

const saisieValide = z.object({
  sujet: z.enum(CLES_SUJET),
  message: z.string().min(MESSAGE_AIDE_MIN).max(MESSAGE_AIDE_MAX),
});

/** Ce qui ressemble à un IBAN (2 lettres, 2 chiffres, puis 10 à 30 caractères, groupés ou non). */
const FORME_IBAN = /\b[A-Za-z]{2}\d{2}(?:[ .-]?[A-Za-z0-9]){10,30}\b/g;

/** Une seule ligne, sans caractère de contrôle, sans rien qui ressemble à un IBAN. */
function assainir(texte: string): string {
  return texte
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(FORME_IBAN, "[coordonnées bancaires retirées]")
    .replace(/\s+/g, " ")
    .trim();
}

const lien = (v: string) => (typeof v === "string" ? v.slice(0, 100) : "");
const champ = (fd: FormData, nom: string, max: number) => {
  const v = fd.get(nom);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
};

async function ipHachee(): Promise<string> {
  try {
    return hashIp(await getClientIp()) ?? "sans-ip";
  } catch {
    return "sans-ip"; // sel absent : jamais d'IP en clair
  }
}

export async function envoyerDemandeAide(
  id: string,
  jeton: string,
  _prec: EtatDemandeAide | undefined,
  fd: FormData,
): Promise<EtatDemandeAide> {
  // +1 : un message trop long reste trop long après la coupe, et le refus le dit.
  const saisie = {
    sujet: champ(fd, "sujet", 40),
    message: champ(fd, "message", MESSAGE_AIDE_MAX + 1),
  };

  // 1. Débit par connexion, AVANT toute lecture du dossier (essais de liens).
  const parIp = await checkRateLimit(`apporteur:aide:ip:${await ipHachee()}`, {
    limit: 20,
    windowSec: 900,
    surPanne: "refuser",
  });
  if (!parIp.allowed) return { ok: false, message: TEXTES_AIDE.tropDEnvois, saisie };

  // 2. Le lien, revérifié côté serveur. Refusé ou résilié : même refus qu'un lien faux.
  const dossier = await lireDossierParLien(lien(id), lien(jeton));
  if (!dossier || etatDeLaPage(dossier.statut) === "neutre") {
    return { ok: false, message: TEXTES_AIDE.lienInvalide, saisie };
  }

  // 3. La saisie.
  const lu = saisieValide.safeParse(saisie);
  if (!lu.success) {
    const surSujet = lu.error.issues.some((i) => i.path[0] === "sujet");
    if (surSujet) return { ok: false, champ: "sujet", message: TEXTES_AIDE.sujetManquant, saisie };
    const trop = saisie.message.length > MESSAGE_AIDE_MAX;
    return {
      ok: false,
      champ: "message",
      message: trop ? TEXTES_AIDE.messageLong : TEXTES_AIDE.messageCourt,
      saisie,
    };
  }

  // 4. Limite par dossier : l'envoi part en e-mail, on refuse si le compteur est aveugle.
  const parDossier = await checkRateLimit(`apporteur:aide:dossier:${dossier.id}`, {
    limit: 5,
    windowSec: 3600,
    surPanne: "refuser",
  });
  if (!parDossier.allowed) return { ok: false, message: TEXTES_AIDE.tropDEnvois, saisie };

  // 5. L'alerte interne. Seuls le nom, le sujet et le message partent : aucune autre donnée
  //    du dossier (ni IBAN, ni adresse, ni pièce).
  const nom = [dossier.prenom, dossier.nom].filter(Boolean).join(" ").trim();
  const sujet = SUJETS_AIDE.find((s) => s.cle === lu.data.sujet)!.libelle;
  try {
    const r = await enqueueEmail(
      "qualiopi-alerte-interne",
      destinataireAlertesInternes(),
      "fr",
      {
        niveau: "important",
        code: "apporteur_demande_aide",
        titre: `Demande d'aide : ${nom || "un apporteur"}`,
        message: `${nom || "Un apporteur"} demande de l'aide depuis son espace. Sujet : ${sujet}. Répondez-lui par e-mail, à l'adresse de sa fiche. Son message : « ${assainir(lu.data.message)} »`,
        cibleType: "ApporteurReseau",
        cibleId: dossier.id,
        createdAt: new Date().toLocaleDateString("fr-FR"),
        rubrique: "apporteurs",
        chemin: `apporteurs/${dossier.id}`,
      },
      { entityType: "ApporteurReseau", entityId: dossier.id },
    );
    // « Garée pour validation » : le message est enregistré et sera lu, il n'est pas perdu.
    if (r.enqueued !== true && r.garePourValidation !== true)
      return { ok: false, message: TEXTES_AIDE.echec, saisie };
  } catch (e) {
    // Contexte MINIMAL : le nom de l'erreur seul, jamais son message ni une valeur saisie.
    const nomErreur = e instanceof Error ? e.name : "inconnue";
    Sentry.captureException(new Error(`apporteur-aide : échec de l'alerte (${nomErreur})`), {
      tags: { service: "apporteur-aide", etape: "alerte-interne" },
    });
    return { ok: false, message: TEXTES_AIDE.echec, saisie };
  }
  return { ok: true };
}
