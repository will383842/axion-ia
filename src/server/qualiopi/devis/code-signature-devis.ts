/**
 * Envoi du CODE à usage unique qui permet de signer un devis à formules (lot 4 bis).
 *
 * Déclenché par UN SEUL geste : le clic du signataire sur « Recevoir mon code » (action publique
 * gardée par le jeton). Jamais à l'envoi du devis, jamais par un cron ni une relance.
 *
 * ## Règles, et pourquoi chacune
 *
 *  · **Adresse figée.** Le code part à l'adresse portée par le LIEN (figée à l'émission, depuis la
 *    fiche client) — jamais à une adresse reçue de la requête. Un lien transféré ne permet pas de
 *    rediriger le code.
 *  · **6 chiffres, 10 minutes, usage unique, 5 essais** (mécanisme de `code-signature.ts`), stocké
 *    HACHÉ ; comparaison à temps constant. Au cinquième échec la pièce est **bloquée 15 minutes** :
 *    ni code émis, ni code accepté.
 *  · **Plafonds d'envoi** : pas deux envois à moins d'une minute d'écart, au plus cinq par heure et
 *    par lien (huit par pièce) — comptés sur les codes réellement ÉMIS.
 *  · **Le code ne traverse la file que SCELLÉ** (AES-256-GCM) ; rien en clair dans Redis, Sentry ni
 *    les journaux. Clé de scellement absente : aucun code n'est émis (il invaliderait le précédent
 *    sans jamais partir).
 *  · **Un seul code vivant** : deux demandes simultanées émettent chacune un code, la seconde
 *    invalide la première ; seule la demande dont le code est resté vivant envoie l'e-mail.
 */

import { prisma } from "@/lib/prisma";
import { CLE_CODE_SIGNATURE, scellerCodePourFile } from "@/server/email/code-en-file";
import { emettreCodeSignature } from "@/server/qualiopi/documents/signature/code-signature";
import { blocageCumule } from "@/server/qualiopi/documents/signature/echecs-cumules";
import { enqueueEmail } from "@/server/queue/queues";
import {
  CODE_DEVIS_VALIDITE_MS,
  decisionEnvoiCode,
  libelleValiditeCode,
} from "./signature-renforcee";

export type RaisonRefusEnvoiCodeDevis =
  "bloque" | "trop_tot" | "trop_de_codes" | "envoi_impossible";

export type ResultatEnvoiCodeDevis =
  | { readonly ok: true }
  | { readonly ok: false; readonly raison: RaisonRefusEnvoiCodeDevis; readonly message: string };

const MESSAGES: Readonly<Record<RaisonRefusEnvoiCodeDevis, string>> = {
  bloque:
    "Trop d'essais. Par sécurité, la signature est bloquée pendant quelques minutes : réessayez plus tard.",
  trop_tot: "Un code vient de vous être envoyé. Patientez une minute avant d'en demander un autre.",
  trop_de_codes:
    "Plusieurs codes ont déjà été demandés en une heure. Utilisez le plus récent reçu, ou réessayez plus tard.",
  envoi_impossible: "Le code n'a pas pu vous être envoyé. Réessayez dans un instant.",
};

const refus = (raison: RaisonRefusEnvoiCodeDevis): ResultatEnvoiCodeDevis => ({
  ok: false,
  raison,
  message: MESSAGES[raison],
});

function plusTardif(a: Date | null, b: Date | null): Date | null {
  if (a === null) return b;
  if (b === null) return a;
  return a.getTime() >= b.getTime() ? a : b;
}

const HEURE_MS = 60 * 60 * 1000;

export async function envoyerCodeDevis(input: {
  readonly documentGenereId: string;
  /** Lien de signature qui demande le code (`DocumentSignatureToken.id`). */
  readonly jetonId: string;
  /** Adresse FIGÉE sur le lien. */
  readonly destinataire: string;
  readonly numeroDevis: string;
  readonly maintenant?: Date;
}): Promise<ResultatEnvoiCodeDevis> {
  const maintenant = input.maintenant ?? new Date();
  const partie = "client" as const;
  const depuisUneHeure = new Date(maintenant.getTime() - HEURE_MS);

  // ── Plafonds et blocage, relus en base ──
  const [bloque, bloqueCumule, duLien, deLaPiece] = await Promise.all([
    prisma.documentSignatureCode.findFirst({
      where: { documentGenereId: input.documentGenereId, partie, bloqueJusquA: { gt: maintenant } },
      select: { bloqueJusquA: true },
    }),
    // Compteur cumulé de la pièce : un code redemandé ne contourne pas le blocage.
    blocageCumule(input.documentGenereId, partie, maintenant),
    prisma.documentSignatureCode.findMany({
      where: { jetonId: input.jetonId, createdAt: { gt: depuisUneHeure } },
      select: { createdAt: true },
    }),
    prisma.documentSignatureCode.count({
      where: {
        documentGenereId: input.documentGenereId,
        partie,
        createdAt: { gt: depuisUneHeure },
      },
    }),
  ]);
  const decision = decisionEnvoiCode({
    maintenant,
    envoisDuLien: duLien.map((l) => l.createdAt),
    envoisDeLaPiece: deLaPiece,
    bloqueJusquA: plusTardif(bloque?.bloqueJusquA ?? null, bloqueCumule),
  });
  if (!decision.ok) return refus(decision.raison);

  // La clé de scellement est éprouvée AVANT d'émettre : sans elle, aucun code n'est émis.
  try {
    scellerCodePourFile("000000");
  } catch {
    return refus("envoi_impossible");
  }

  // Le code n'existe en clair que dans cette portée : scellé aussitôt émis, jamais retourné,
  // jamais journalisé, jamais porté par une erreur (le `catch` ne garde rien).
  let emis: { codeScelle: string; expiresAt: Date; id: string };
  try {
    const brut = await emettreCodeSignature({
      documentGenereId: input.documentGenereId,
      partie,
      maintenant,
      validiteMs: CODE_DEVIS_VALIDITE_MS,
      jetonId: input.jetonId,
    });
    emis = { codeScelle: scellerCodePourFile(brut.code), expiresAt: brut.expiresAt, id: brut.id };
  } catch {
    return refus("envoi_impossible");
  }

  // Deux demandes simultanées passent toutes deux les contrôles : chaque émission invalide la
  // précédente, donc seule la demande dont le code est resté VIVANT envoie l'e-mail.
  const vivant = await prisma.documentSignatureCode.findFirst({
    where: { documentGenereId: input.documentGenereId, partie, utiliseAt: null, invalideAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (vivant === null || vivant.id !== emis.id) return refus("trop_tot");

  try {
    const r = await enqueueEmail(
      "devis-code-signature",
      input.destinataire,
      "fr",
      {
        numero: input.numeroDevis,
        valeurs: { code: emis.codeScelle, durée: libelleValiditeCode() },
        // La ligne du code, relue au départ (expiré ou remplacé : l'e-mail ne part pas). Jamais le code.
        [CLE_CODE_SIGNATURE]: emis.id,
      },
      { entityType: "DocumentGenere", entityId: input.documentGenereId },
    );
    return r.enqueued ? { ok: true } : refus("envoi_impossible");
  } catch {
    return refus("envoi_impossible");
  }
}
