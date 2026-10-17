/**
 * 🔴 CHANTIER QNC, L09 — LE DÉPÔT PUBLIC D'UNE RÉCLAMATION. ROUTE PUBLIQUE.
 *
 * Ouvert à toute partie prenante (stagiaire, entreprise, formateur, financeur),
 * sans compte. C'est donc un point d'entrée HTTP anonyme : chaque protection
 * ci-dessous est délibérée, et la relecture sécurité porte sur ce fichier.
 *
 *   1. INTERRUPTEUR — `qualiopi.reclamations.actif` : éteint (défaut), le dépôt
 *      est refusé AVANT toute lecture du formulaire. En `essai`, seul un
 *      stagiaire connecté à son espace et inscrit au banc d'essai peut déposer.
 *   2. LIMITE DE FRÉQUENCE — 3 dépôts / 10 min / IP (calque de /contact), avant
 *      tout le reste ; puis 3 dépôts / 24 h / ADRESSE (empreinte, jamais
 *      l'adresse en clair dans Redis). L'accusé part vers l'adresse saisie :
 *      sans cette seconde limite, la route servirait à inonder une boîte
 *      tierce depuis plusieurs IP. L'accusé ne recopie d'ailleurs RIEN de ce
 *      qui a été saisi (numéro et dates seulement) : il ne peut pas porter un
 *      message choisi par un tiers.
 *   3. LEURRE — champ `website` rempli = succès SILENCIEUX, rien d'écrit.
 *   4. TURNSTILE — souple, comme /contact (« ne jamais perdre une demande ») :
 *      vérifié et journalisé, jamais bloquant ; les couches dures sont 2 et 3.
 *   5. VALIDATION ZOD — longueurs bornées, adresse valide, caractères de
 *      contrôle retirés, consentement obligatoire.
 *   6. RATTACHEMENT — jamais un identifiant pris du formulaire tel quel : une
 *      inscription n'est retenue que si elle appartient au stagiaire identifié
 *      par le cookie de son espace (jeton haché, vérifié en base).
 *   7. AUCUNE FUITE — une seule erreur générique pour tout refus métier ; la
 *      réponse ne dit jamais si une inscription, une adresse ou une session
 *      existe. Le numéro AXI-REC rendu est celui de la réclamation déposée, rien
 *      d'autre.
 *
 * La date de réception est celle du SERVEUR. L'accusé part automatiquement
 * (cf. `reclamations/cycle-service.ts`).
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { getClientIp } from "@/lib/client-ip";
import { signalerHoneypot } from "@/lib/security/honeypot-observable";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { getPortailToken } from "@/server/qualiopi/portail/cookie";
import { verifierToken } from "@/server/qualiopi/portail/portail-service";
import { AUTEUR_FORMULAIRE_PUBLIC } from "@/server/qualiopi/registres/auteur";
import { deposerReclamation } from "@/server/qualiopi/reclamations/cycle-service";
import { lireInterrupteurReclamations } from "@/server/qualiopi/reclamations/interrupteur";
import {
  MESSAGE_REFUS_DEPOT,
  QUALITES_DEPOT,
  formulaireOuvert,
  nettoyerTexte,
} from "@/server/qualiopi/reclamations/depot-public";

export type EtatDepotReclamation =
  | { etat: "initial" }
  | { etat: "recue"; numero: string | null }
  | { etat: "erreur"; message: string };

const depotSchema = z.object({
  qualite: z.enum(QUALITES_DEPOT),
  nom: z.string().trim().min(2).max(200),
  email: z.string().trim().toLowerCase().email().max(255),
  objet: z.string().trim().min(3).max(300),
  description: z.string().trim().min(10).max(5000),
  formationConcernee: z.string().trim().max(300).optional(),
  enrollmentId: z.string().uuid().optional(),
  consentement: z.literal(true),
});

function texte(fd: FormData, cle: string): string | undefined {
  const v = fd.get(cle);
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

export async function deposerReclamationPubliqueAction(
  _prev: EtatDepotReclamation,
  formData: FormData,
): Promise<EtatDepotReclamation> {
  // 1. Interrupteur — lu avant tout, sans rien lire du formulaire.
  const etat = await lireInterrupteurReclamations();
  if (etat === "eteint") return { etat: "erreur", message: MESSAGE_REFUS_DEPOT };

  // 2. Limite de fréquence.
  const ip = await getClientIp();
  const limite = await checkRateLimit(`reclamation-publique:${ip}`, { limit: 3, windowSec: 600 });
  if (!limite.allowed) {
    return { etat: "erreur", message: "Trop de tentatives. Réessayez dans quelques minutes." };
  }

  // 3. Leurre : succès silencieux, rien n'est enregistré.
  const leurre = formData.get("website");
  if (leurre) {
    await signalerHoneypot("reclamation", leurre);
    return { etat: "recue", numero: null };
  }

  // 4. Turnstile, souple.
  const jeton = formData.get("cf-turnstile-response");
  const turnstileOk = await verifyTurnstile(typeof jeton === "string" ? jeton : null, ip).catch(
    () => false,
  );

  // 5. Validation.
  const parsed = depotSchema.safeParse({
    qualite: formData.get("qualite"),
    nom: nettoyerTexte(texte(formData, "nom")),
    email: texte(formData, "email"),
    objet: nettoyerTexte(texte(formData, "objet")),
    description: nettoyerTexte(texte(formData, "description"), true),
    formationConcernee: nettoyerTexte(texte(formData, "formationConcernee")),
    enrollmentId: texte(formData, "enrollmentId"),
    consentement: formData.get("consentement") === "on" || formData.get("consentement") === "true",
  });
  if (!parsed.success) {
    return {
      etat: "erreur",
      message: "Certains champs sont incomplets ou invalides. Vérifiez le formulaire.",
    };
  }
  const v = parsed.data;

  const empreinte = hashEmailForLookup(v.email);
  if (empreinte !== null) {
    const parAdresse = await checkRateLimit(`reclamation-publique-adresse:${empreinte}`, {
      limit: 3,
      windowSec: 86_400,
    });
    if (!parAdresse.allowed) {
      return { etat: "erreur", message: "Trop de tentatives. Réessayez dans quelques minutes." };
    }
  }

  // 6. Rattachement : seulement depuis l'espace stagiaire, et seulement à une
  //    inscription de CE stagiaire.
  let enrollmentId: string | undefined;
  let depuisEspace = false;
  let inscriptionDeTest = false;
  const cookie = await getPortailToken();
  if (cookie) {
    const acces = await verifierToken(cookie).catch(() => null);
    if (acces) {
      depuisEspace = true;
      if (v.enrollmentId !== undefined) {
        const inscription = await prisma.enrollment
          .findFirst({
            where: { id: v.enrollmentId, traineeId: acces.traineeId },
            select: {
              id: true,
              estTestInterne: true,
              session: { select: { estTestInterne: true } },
            },
          })
          .catch(() => null);
        if (inscription) {
          enrollmentId = inscription.id;
          inscriptionDeTest = inscription.estTestInterne || inscription.session.estTestInterne;
        }
      }
    }
  }

  // 1 bis. En `essai`, seul le banc d'essai dépose — même message que l'éteint.
  if (!formulaireOuvert(etat, { inscriptionDeTest })) {
    return { etat: "erreur", message: MESSAGE_REFUS_DEPOT };
  }

  const description =
    v.formationConcernee !== undefined
      ? `${v.description}\n\nFormation concernée (indiquée par la personne) : ${v.formationConcernee}`
      : v.description;

  try {
    const deposee = await deposerReclamation({
      qualite: v.qualite,
      reclamantNom: v.nom,
      reclamantEmail: v.email,
      objet: v.objet,
      description,
      dateReception: new Date(),
      ...(enrollmentId !== undefined ? { enrollmentId } : {}),
      canal: depuisEspace ? "espace_stagiaire" : "formulaire_public",
      auteur: AUTEUR_FORMULAIRE_PUBLIC,
    });
    if (!turnstileOk) {
      console.warn(`[reclamation-publique] ${deposee.numero} déposée sans Turnstile validé.`);
    }
    return { etat: "recue", numero: deposee.numero };
  } catch (err) {
    console.error(
      "[reclamation-publique] dépôt impossible :",
      err instanceof Error ? err.message : String(err),
    );
    return {
      etat: "erreur",
      message:
        "Votre réclamation n'a pas pu être enregistrée. Réessayez dans un instant ; si le problème persiste, écrivez-nous.",
    };
  }
}
