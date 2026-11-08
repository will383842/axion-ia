/**
 * VALIDATION DE LA PAGE « RECEVOIR LE GUIDE » (lot S2, 2026-11-08).
 *
 * La personne a ouvert `/guide-reseau?j=<jeton>` (jeton signé par le Studio, `lien-page-guide.ts`),
 * saisi son prénom et son adresse, et coché l'UNIQUE case. Ici, côté serveur, dans l'ordre :
 *
 *   1. le jeton (signature, forme, expiration) — sinon refus NEUTRE « lien », jamais la cause ;
 *   2. la case (texte exact, `content/guides-reseau.ts`) — sinon 422, AUCUNE écriture ;
 *   3. le prénom (1 à 50 caractères) et la forme de l'adresse — sinon 422, aucune écriture ;
 *   4. 🔴 adresse OPPOSÉE : réponse IDENTIQUE à un succès, rien n'est envoyé ni écrit (le jeton
 *      n'est pas consommé : la personne ne peut pas apprendre qu'elle est opposée) ;
 *   5. le domaine reçoit-il des e-mails (MX) ? « non » → message d'erreur ; « inconnu » passe ;
 *   6. limites par jour (personne, post) — celles du chemin de la conversation, réutilisées ;
 *   7. UNE TRANSACTION : verrou de l'adresse, ligne `contacts_guide_reseau` (écrit
 *      `jeton_empreinte`, UNIQUE = usage unique), demande du guide (`retrouverOuCreerDemande`).
 *      Un jeton déjà utilisé fait échouer l'insertion (P2002) : rien n'est créé, succès NEUTRE ;
 *   8. la preuve du consentement (`consent_events`, action `consent`) ;
 *   9. l'e-mail du guide — sauf s'il est déjà parti à cette adresse depuis moins de 24 h.
 *
 * 🔴 DÉCISIONS DE WILLIAMS : aucune ligne `newsletter_subscribers` (jamais écrite ici) ; un « stop »
 * l'emporte toujours ; aucune suppression de données de personnes ; origine `message_prive`
 * conservée (aucune migration d'énumération).
 * 🔴 Ni l'adresse, ni le prénom, ni le jeton, ni la référence de conversation ne sont journalisés.
 * L'événement CRM (lot S3) et la route des confirmations (lot S4) ne sont PAS dans ce lot.
 */
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { encryptPii } from "@/lib/pii-crypto";
import { recordConsentEvent } from "@/lib/consents";
import { estOpposee } from "@/server/email/opposition";
import { jetonOpposition } from "@/server/email/opposition-jeton";
import { domaineRecoitDesEmails } from "@/server/guide-ia/mx";
import { envoisRecentsVers, mettreEnFileGuide } from "@/server/guide-ia/envoi";
import {
  EMPREINTE_CASE_PAGE_GUIDE,
  FORM_REF_PAGE_GUIDE,
  GUIDES_RESEAU_CONNUS,
  PRENOM_MAX,
  PRENOM_MIN,
  VERSION_CONSENTEMENT_PAGE_GUIDE,
  type ReseauGuide,
} from "@/content/guides-reseau";
import { empreinteJeton, verifierJeton, type DonneesJeton } from "./lien-page-guide";
import { hmacConversationRef } from "./origines";
import { retrouverOuCreerDemande, sousLesLimites } from "./traitement";

export interface EntreeConfirmation {
  readonly jeton: string;
  readonly prenom: string;
  readonly email: string;
  readonly caseCochee: boolean;
  readonly ip: string | null;
  readonly userAgent: string | null;
  /** Secret du lien (déjà contrôlé par `lireSecretLien`). */
  readonly secret: string;
  readonly maintenant?: Date;
}

export type ResultatConfirmation =
  | { readonly ok: true }
  | { readonly ok: false; readonly statut: 422; readonly erreur: ErreurSaisie }
  | { readonly ok: false; readonly statut: 400; readonly erreur: "lien" }
  | { readonly ok: false; readonly statut: 429; readonly erreur: "trop_de_requetes" };

export type ErreurSaisie = "case" | "prenom" | "email" | "adresse_refusee";

const ADRESSE_FORME = /^[^\s@]{1,64}@[^\s@]{1,255}$/;

/** Réseau du lien (alphabet du jeton) → réseau du registre des demandes. */
const RESEAU_DU_LIEN: Readonly<Record<DonneesJeton["reseau"], ReseauGuide>> = {
  instagram: "instagram",
  facebook: "facebook",
  linkedin: "linkedin_page",
  autre: "page_guide",
};

function estConflitUnique(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

/** Version écrite dans le registre de preuve : version du texte + début de son empreinte (≤ 64). */
export function versionPreuveCase(): string {
  return `${VERSION_CONSENTEMENT_PAGE_GUIDE}.${EMPREINTE_CASE_PAGE_GUIDE.slice(0, 32)}`;
}

/** SHA-256 hex d'un texte (utilisé par les tests pour vérifier l'empreinte du texte de la case). */
export function empreinteTexte(texte: string): string {
  return createHash("sha256").update(texte, "utf8").digest("hex");
}

export async function confirmerPageGuide(e: EntreeConfirmation): Promise<ResultatConfirmation> {
  const maintenant = e.maintenant ?? new Date();

  // 1. Le jeton. Toute cause d'échec donne la MÊME réponse.
  let donnees: DonneesJeton;
  try {
    const v = verifierJeton(e.jeton, e.secret, maintenant.getTime());
    if (!v.ok || !GUIDES_RESEAU_CONNUS.includes(v.donnees.guide)) {
      return { ok: false, statut: 400, erreur: "lien" };
    }
    donnees = v.donnees;
  } catch {
    return { ok: false, statut: 400, erreur: "lien" };
  }

  // 2-3. Saisie. Rien n'est écrit tant qu'elle n'est pas complète.
  if (e.caseCochee !== true) return { ok: false, statut: 422, erreur: "case" };
  const prenom = e.prenom.trim();
  if ([...prenom].length < PRENOM_MIN || [...prenom].length > PRENOM_MAX) {
    return { ok: false, statut: 422, erreur: "prenom" };
  }
  const email = e.email.trim().toLowerCase();
  if (email.length > 254 || !ADRESSE_FORME.test(email)) {
    return { ok: false, statut: 422, erreur: "email" };
  }

  // 4. Adresse opposée : succès apparent, rien d'envoyé ni d'écrit, jeton non consommé.
  if (await estOpposee(email)) {
    console.warn(JSON.stringify({ event: "guides_reseau_page", resultat: "opposee" }));
    return { ok: true };
  }

  // 5. Le domaine reçoit-il des e-mails ? « inconnu » (panne DNS) laisse passer.
  if ((await domaineRecoitDesEmails(email)) === "non") {
    return { ok: false, statut: 422, erreur: "adresse_refusee" };
  }

  const emailKey = hashEmailForLookup(email);
  if (!emailKey) throw new Error("[guides-reseau] empreinte d'adresse indisponible");

  // 6. Limites du guide (par personne, puis par post).
  const post = donnees.post_ref ? { ref: donnees.post_ref, canal: null } : null;
  if (!(await sousLesLimites(emailKey, maintenant, post))) {
    return { ok: false, statut: 429, erreur: "trop_de_requetes" };
  }

  // 7. Une transaction : contact (usage unique du jeton) + demande du guide.
  const demandeEntree = {
    email,
    mot: donnees.mot,
    reseau: RESEAU_DU_LIEN[donnees.reseau],
    guide: donnees.guide,
    locale: "fr" as const,
    versionTexteM1: donnees.version_m1,
  };
  let demande: { id: string; downloadToken: string };
  try {
    demande = await prisma.$transaction(async (tx) => {
      // Deux envois simultanés de la même adresse se suivent au lieu de se croiser.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"guide-reseau-page:" + emailKey}))`;
      // 1) Le contact d'abord : `jeton_empreinte` (UNIQUE) est l'usage unique. Un jeton déjà
      //    utilisé échoue ICI (P2002), avant que la moindre demande soit créée.
      const contact = await tx.contactGuideReseau.create({
        data: {
          emailKey,
          prenom: encryptPii(prenom),
          mot: donnees.mot,
          reseau: donnees.reseau,
          compteRef: donnees.compte,
          postRef: donnees.post_ref ?? null,
          versionM1: donnees.version_m1,
          versionConsentement: VERSION_CONSENTEMENT_PAGE_GUIDE,
          consentEmpreinte: EMPREINTE_CASE_PAGE_GUIDE,
          consentiLe: maintenant,
          jetonEmpreinte: empreinteJeton(e.jeton),
          convRef: hmacConversationRef(donnees.conv),
          merciStatut: "a_envoyer",
        },
        select: { id: true },
      });
      // 2) La demande du guide (cœur partagé avec le chemin de la conversation), puis le lien.
      const d = await retrouverOuCreerDemande(demandeEntree, emailKey, maintenant, tx);
      await tx.contactGuideReseau.update({
        where: { id: contact.id },
        data: { guideRequestId: d.id },
        select: { id: true },
      });
      return { id: d.id, downloadToken: d.downloadToken };
    });
  } catch (err) {
    if (estConflitUnique(err)) {
      // Jeton déjà utilisé : rien n'a été créé (transaction annulée), réponse de succès neutre.
      console.warn(JSON.stringify({ event: "guides_reseau_page", resultat: "jeton_deja_utilise" }));
      return { ok: true };
    }
    throw err;
  }

  // 8. La preuve du consentement (ne lève jamais).
  await recordConsentEvent({
    email,
    formRef: FORM_REF_PAGE_GUIDE,
    consentVersion: versionPreuveCase(),
    action: "consent",
    occurredAt: maintenant,
    ip: e.ip,
    userAgent: e.userAgent,
  });

  // 9. L'e-mail du guide, sauf s'il est déjà parti à cette adresse depuis moins de 24 h.
  let guide: string;
  if ((await envoisRecentsVers(email, maintenant)) > 0) {
    guide = "deja-servi";
  } else {
    guide = await mettreEnFileGuide(
      { id: demande.id, email, locale: "fr", downloadToken: demande.downloadToken },
      { reseau: true, pageGuide: { oppositionToken: jetonOpposition(email) }, maintenant },
    );
  }
  console.warn(
    JSON.stringify({
      event: "guides_reseau_page",
      resultat: "enregistree",
      reseau: donnees.reseau,
      guide,
    }),
  );
  return { ok: true };
}
