/**
 * VALIDATION DE LA PAGE « RECEVOIR LE GUIDE » (lot S2, 2026-11-08).
 *
 * La personne a ouvert `/guide-reseau?j=<jeton>` (jeton signé par le Studio, `lien-page-guide.ts`),
 * saisi son prénom et son adresse, et coché l'UNIQUE case. Ici, côté serveur, dans l'ordre :
 *
 *   1. le jeton (signature, forme, expiration, guide connu) — sinon refus NEUTRE « lien » ;
 *   2. la case du guide (texte exact, `content/guides-reseau.ts`) — sinon 422, AUCUNE écriture ;
 *      la case des informations est FACULTATIVE, séparée, jamais déduite de la première ;
 *   3. le prénom (1 à 50 caractères) et l'adresse (validateur de /guide-ia) — sinon 422 ;
 *   4. les formats exigés par le CRM (compte, post_ref) : normalisés ou écartés AVANT toute écriture ;
 *   5. l'adresse est-elle opposée ? Le résultat ne change RIEN au déroulé qui suit (M1) ;
 *   6. le domaine reçoit-il des e-mails (MX) ? « non » → message d'erreur ; « inconnu » passe ;
 *   7. limites par jour (personne, post) — celles du chemin de la conversation, réutilisées ;
 *   8. UNE SEULE TRANSACTION, AVANT toute réponse : verrou de l'adresse, ligne
 *      `contacts_guide_reseau` (écrit `jeton_empreinte`, UNIQUE = usage unique), demande du guide
 *      (`retrouverOuCreerDemande`), ORIGINE (mot, réseau, compte, post, version M1 →
 *      `guide_reseau_origines`, PAS dans `contacts_guide_reseau`) et PREUVE du consentement
 *      (`consent_events`, action `consent`). Tout part ensemble ou rien ne part : si le conteneur
 *      s'arrête juste après la réponse, la fiche relue plus tard par le CRM (au clic) a son
 *      origine ET sa preuve. Un échec (origine, preuve, base…) annule TOUT et remonte : la route
 *      répond sa page d'erreur neutre, le jeton n'est PAS consommé, la personne peut réessayer.
 *      Un jeton déjà utilisé fait échouer l'insertion (P2002 sur `jeton_empreinte`) : rien n'est
 *      créé, succès NEUTRE. TOUT AUTRE conflit d'unicité (ex. `guide_requests` : demande
 *      simultanée du formulaire /guide-ia) rejoue la transaction, ou remonte — jamais un succès
 *      sans guide ;
 *   9. l'e-mail du guide, APRÈS la réponse (`after`) — sauf s'il est déjà parti à cette adresse
 *      depuis moins de 24 h. Un échec de mise en file n'annule rien : la demande est écrite, le
 *      rattrapage la reprend.
 *
 * 🕐 PLANCHER DE DURÉE (`PLANCHER_REPONSE_MS`) : la réponse ne part jamais avant ce délai, quelle que
 * soit l'issue. Une adresse déjà connue (demande existante, mise à jour) et une adresse neuve
 * (création) ne se distinguent ainsi pas au chronomètre. Un échec attend aussi le plancher.
 *
 * 🔴 M1 — ADRESSE OPPOSÉE : indiscernable d'un succès par la réponse (même 303), par l'état du jeton
 * (consommé dans les deux cas : la ligne est une MARQUE sans donnée personnelle — ni clé d'adresse,
 * ni prénom, ni demande) et par le travail fait (MX, limites, verrou, transaction identiques).
 * Résiduel assumé : la mise en file du guide, la preuve et l'origine ne se font pas pour l'adresse
 * opposée ; le plancher de durée absorbe cet écart.
 * 🔴 DÉCISIONS DE WILLIAMS : aucune ligne `newsletter_subscribers` (jamais écrite ici) ; un « stop »
 * l'emporte toujours ; aucune suppression de données de personnes ; origine `message_prive`
 * conservée (aucune migration d'énumération).
 * 🔴 Ni l'adresse, ni le prénom, ni le jeton, ni la référence de conversation ne sont journalisés.
 * La route des confirmations (lot S4) n'est PAS dans ce lot.
 */
import { createHash } from "node:crypto";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { encryptPii } from "@/lib/pii-crypto";
import { hashIp, hashUserAgent } from "@/lib/security/ip-hash";
import { demandeGuideSchema } from "@/lib/schemas/forms";
import { estOpposee } from "@/server/email/opposition";
import { jetonOpposition } from "@/server/email/opposition-jeton";
import { domaineRecoitDesEmails } from "@/server/guide-ia/mx";
import { envoisRecentsVers, mettreEnFileGuide } from "@/server/guide-ia/envoi";
import {
  EMPREINTE_CASE_PAGE_GUIDE,
  EMPREINTE_CASE_PAGE_GUIDE_INFOS,
  FORM_REF_PAGE_GUIDE,
  FORM_REF_PAGE_GUIDE_INFOS,
  GUIDES_RESEAU_CONNUS,
  PRENOM_MAX,
  PRENOM_MIN,
  VERSION_CONSENTEMENT_PAGE_GUIDE,
  VERSION_CONSENTEMENT_PAGE_GUIDE_INFOS,
  type ReseauGuide,
} from "@/content/guides-reseau";
import { empreinteJeton, verifierJeton, type DonneesJeton } from "./lien-page-guide";
import { MERCI_STATUT_ECARTE } from "./merci-statut";
import {
  ecrireOrigineDansTransaction,
  hmacConversationRef,
  signalerArchiveSiDepassee,
  type OrigineAEcrire,
} from "./origines";
import { VERSIONS_TEXTE_CONNUES } from "./valeurs-connues";
import { retrouverOuCreerDemande, sousLesLimites } from "./traitement";

export interface EntreeConfirmation {
  readonly jeton: string;
  readonly prenom: string;
  readonly email: string;
  /** Case OBLIGATOIRE : le guide seulement. */
  readonly caseCochee: boolean;
  /** Case FACULTATIVE (décochée par défaut) : les informations d'Axion-IA. Absente = non cochée. */
  readonly infosCochee?: boolean;
  readonly ip: string | null;
  readonly userAgent: string | null;
  /** Secret du lien (déjà contrôlé par `lireSecretLien`). */
  readonly secret: string;
  readonly maintenant?: Date;
  /** Plancher de durée de la réponse (ms). Défaut : `PLANCHER_REPONSE_MS`. Les tests le mettent à 0. */
  readonly plancherMs?: number | undefined;
}

export type ResultatConfirmation =
  | { readonly ok: true }
  | { readonly ok: false; readonly statut: 422; readonly erreur: ErreurSaisie }
  | { readonly ok: false; readonly statut: 400; readonly erreur: "lien" }
  | { readonly ok: false; readonly statut: 429; readonly erreur: "trop_de_requetes" };

export type ErreurSaisie = "case" | "prenom" | "email" | "adresse_refusee";

/** Formats exigés par le CRM Pro pour l'origine (autre dépôt) : au-delà, il refuse la charge. */
const COMPTE_CRM = /^[a-z0-9_]{2,40}$/;
const POST_REF_CRM = /^[A-Za-z0-9_-]{8,80}$/;

/** Compte du lien → format CRM (minuscules, tirets en underscores), ou `null` s'il n'y tient pas. */
export function compteAuFormatCrm(compte: string): string | null {
  const c = compte.toLowerCase().replace(/-/g, "_");
  return COMPTE_CRM.test(c) ? c : null;
}

/**
 * Durée MINIMALE d'une réponse, en millisecondes. Sans elle, créer une demande (adresse neuve) et
 * en retrouver une (adresse connue) ne prennent pas le même temps, et le chronomètre d'une
 * personne malveillante dirait si une adresse est déjà dans la base. 250 ms dépasse largement le
 * temps d'une transaction normale.
 */
export const PLANCHER_REPONSE_MS = 250;

/** Nombre maximal d'essais de la transaction (conflit d'unicité hors jeton : demande simultanée). */
const ESSAIS_TRANSACTION = 3;

/** Valeurs de la MARQUE laissée par un jeton consommé pour une adresse opposée (aucune donnée de personne). */
const MARQUE = {
  emailKey: "-",
  convRef: "-",
  version: "ecartee",
  empreinte: "0".repeat(64),
  statut: MERCI_STATUT_ECARTE,
} as const;

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

/**
 * Le conflit d'unicité vient-il du JETON ? `meta.target` porte les colonnes (`["jeton_empreinte"]`)
 * ou le nom de la contrainte. Tout autre conflit n'est PAS un jeton rejoué.
 */
function estConflitDuJeton(e: unknown): boolean {
  if (!estConflitUnique(e)) return false;
  const cible = (e as { meta?: { target?: unknown } }).meta?.target;
  const noms = Array.isArray(cible) ? cible.map(String) : typeof cible === "string" ? [cible] : [];
  return noms.some((n) => n.includes("jeton_empreinte"));
}

/** Version de la preuve de la case des informations (même forme que `versionPreuveCase`). */
export function versionPreuveInfos(): string {
  return `${VERSION_CONSENTEMENT_PAGE_GUIDE_INFOS}.${EMPREINTE_CASE_PAGE_GUIDE_INFOS.slice(0, 32)}`;
}

/** Version écrite dans le registre de preuve : version du texte + début de son empreinte (≤ 64). */
export function versionPreuveCase(): string {
  return `${VERSION_CONSENTEMENT_PAGE_GUIDE}.${EMPREINTE_CASE_PAGE_GUIDE.slice(0, 32)}`;
}

/** SHA-256 hex d'un texte (utilisé par les tests pour vérifier l'empreinte du texte de la case). */
export function empreinteTexte(texte: string): string {
  return createHash("sha256").update(texte, "utf8").digest("hex");
}

/** Hachage de contexte de la preuve : sans sel, on renonce à l'élément, pas à la preuve. */
function sansLever(f: () => string | null): string | null {
  try {
    return f();
  } catch {
    return null;
  }
}

/** Valide la saisie, écrit tout dans UNE transaction, puis ne répond jamais avant le plancher. */
export async function confirmerPageGuide(e: EntreeConfirmation): Promise<ResultatConfirmation> {
  const debut = Date.now();
  try {
    return await traiterConfirmation(e);
  } finally {
    // Réussite, refus ou erreur : la durée de la réponse est la même.
    const reste = (e.plancherMs ?? PLANCHER_REPONSE_MS) - (Date.now() - debut);
    if (reste > 0) await new Promise<void>((fin) => setTimeout(fin, reste));
  }
}

async function traiterConfirmation(e: EntreeConfirmation): Promise<ResultatConfirmation> {
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
  // Même validateur que le formulaire /guide-ia (`demandeGuideSchema`) : une seule définition.
  const adresse = e.email.trim();
  const analyse = demandeGuideSchema.safeParse({ email: adresse });
  if (adresse.length > 254 || !analyse.success) {
    return { ok: false, statut: 422, erreur: "email" };
  }
  const email = analyse.data.email;

  // 4. Formats du CRM, AVANT toute écriture. Compte hors format → l'origine ne part pas au CRM
  //    (le guide part quand même) ; post_ref hors format → retiré de l'origine.
  const compte = compteAuFormatCrm(donnees.compte);
  const postRef =
    donnees.post_ref !== undefined && POST_REF_CRM.test(donnees.post_ref) ? donnees.post_ref : null;

  // 5. Adresse opposée : on le SAIT, mais le déroulé qui suit est le même (M1).
  const opposee = await estOpposee(email);

  // 6. Le domaine reçoit-il des e-mails ? « inconnu » (panne DNS) laisse passer.
  if ((await domaineRecoitDesEmails(email)) === "non") {
    return { ok: false, statut: 422, erreur: "adresse_refusee" };
  }

  const emailKey = hashEmailForLookup(email);
  if (!emailKey) throw new Error("[guides-reseau] empreinte d'adresse indisponible");

  // 7. Limites du guide (par personne, puis par post).
  const post = postRef ? { ref: postRef, canal: null } : null;
  if (!(await sousLesLimites(emailKey, maintenant, post))) {
    return { ok: false, statut: 429, erreur: "trop_de_requetes" };
  }

  // 8. Une transaction : contact (usage unique du jeton) + demande du guide.
  const demandeEntree = {
    email,
    mot: donnees.mot,
    reseau: RESEAU_DU_LIEN[donnees.reseau],
    guide: donnees.guide,
    locale: "fr" as const,
    versionTexteM1: donnees.version_m1,
  };
  const infos = e.infosCochee === true;
  const prenomChiffre = encryptPii(prenom);
  const empreinte = empreinteJeton(e.jeton);
  // Origine et preuve sont construites AVANT la transaction (une clé HMAC absente lève ici, sans
  // rien avoir écrit), puis écrites DANS la transaction. Rien pour une adresse opposée.
  const origine = opposee
    ? null
    : construireOrigineDePage(donnees, compte, postRef, empreinte, maintenant);
  const ipHash = e.ip ? sansLever(() => hashIp(e.ip as string)) : null;
  const agentHash = e.userAgent ? sansLever(() => hashUserAgent(e.userAgent as string)) : null;
  let demande: { id: string; downloadToken: string } | null = null;
  let totalArchive = 0;
  for (let essai = 1; ; essai++) {
    try {
      demande = await prisma.$transaction(async (tx) => {
        // Deux envois simultanés de la même adresse se suivent au lieu de se croiser.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"guide-reseau-page:" + emailKey}))`;
        if (opposee) {
          // M1 : la MÊME lecture que le chemin normal (`retrouverOuCreerDemande`), résultat écarté.
          await tx.guideRequest.findUnique({
            where: { emailKey_aimant: { emailKey, aimant: demandeEntree.guide } },
            select: { id: true, downloadToken: true, origine: true },
          });
          // Marque : le jeton est consommé comme pour un succès, SANS donnée de la personne.
          await tx.contactGuideReseau.create({
            data: {
              emailKey: MARQUE.emailKey,
              prenom: "",
              versionConsentement: MARQUE.version,
              consentEmpreinte: MARQUE.empreinte,
              consentiLe: maintenant,
              jetonEmpreinte: empreinte,
              convRef: MARQUE.convRef,
              merciStatut: MARQUE.statut,
            },
            select: { id: true },
          });
          return null;
        }
        // 1) Le contact d'abord : `jeton_empreinte` (UNIQUE) est l'usage unique. Un jeton déjà
        //    utilisé échoue ICI (P2002), avant que la moindre demande soit créée. L'ORIGINE n'est
        //    pas écrite ici : elle vit dans `guide_reseau_origines` (étape 9).
        const contact = await tx.contactGuideReseau.create({
          data: {
            emailKey,
            prenom: prenomChiffre,
            versionConsentement: VERSION_CONSENTEMENT_PAGE_GUIDE,
            consentEmpreinte: EMPREINTE_CASE_PAGE_GUIDE,
            consentiLe: maintenant,
            // Case facultative : enregistrée « non transmise » (le CRM ne la reçoit qu'au clic, et
            // seulement si l'interrupteur newsletter_optin est allumé).
            ...(infos
              ? {
                  infosStatut: "non_transmise",
                  infosVersion: VERSION_CONSENTEMENT_PAGE_GUIDE_INFOS,
                  infosEmpreinte: EMPREINTE_CASE_PAGE_GUIDE_INFOS,
                  infosConsentiLe: maintenant,
                }
              : {}),
            jetonEmpreinte: empreinte,
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
        // 3) L'ORIGINE (historique v3) et 4) la PREUVE du consentement : dans la MÊME transaction.
        //    Aucune des deux n'avale son erreur ici : elle annule le contact et la demande aussi.
        const ecrite = await ecrireOrigineDansTransaction(tx, emailKey, origine!);
        totalArchive = ecrite.total;
        await tx.consentEvent.create({
          data: {
            personKey: emailKey,
            formRef: FORM_REF_PAGE_GUIDE,
            consentVersion: versionPreuveCase(),
            action: "consent",
            occurredAt: maintenant,
            ipHash,
            userAgent: agentHash,
          },
          select: { id: true },
        });
        if (infos) {
          await tx.consentEvent.create({
            data: {
              personKey: emailKey,
              formRef: FORM_REF_PAGE_GUIDE_INFOS,
              consentVersion: versionPreuveInfos(),
              action: "consent",
              occurredAt: maintenant,
              ipHash,
              userAgent: agentHash,
            },
            select: { id: true },
          });
        }
        return { id: d.id, downloadToken: d.downloadToken };
      });
      break;
    } catch (err) {
      if (estConflitDuJeton(err)) {
        // Jeton déjà utilisé : rien n'a été créé (transaction annulée), réponse de succès neutre.
        console.warn(
          JSON.stringify({ event: "guides_reseau_page", resultat: "jeton_deja_utilise" }),
        );
        return { ok: true };
      }
      // Autre conflit d'unicité (demande simultanée sur `guide_requests`) : la transaction a été
      // annulée en entier, le jeton n'est PAS consommé. On la rejoue (la demande existe alors).
      if (estConflitUnique(err) && essai < ESSAIS_TRANSACTION) continue;
      throw err;
    }
  }

  if (opposee || demande === null) {
    // M1 : même forme que le chemin normal — un `after()` est inscrit dans les deux cas, la réponse
    // part sans attendre ; ici la suite se borne à une ligne de journal.
    after(() => {
      console.warn(JSON.stringify({ event: "guides_reseau_page", resultat: "opposee" }));
    });
    return { ok: true };
  }
  const demandeFaite = demande;
  signalerArchiveSiDepassee(totalArchive);

  // 9 : APRÈS la réponse, la seule suite : l'e-mail du guide. Sa perte ne perd rien (la demande,
  // l'origine et la preuve sont déjà validées ; le rattrapage reprend la demande).
  after(async () => {
    try {
      await suiteApresReponse(donnees, demandeFaite, { email, maintenant });
    } catch (err) {
      console.error(
        JSON.stringify({
          event: "guides_reseau_page_suite_echec",
          erreur: err instanceof Error ? err.name : "erreur",
        }),
      );
    }
  });
  return { ok: true };
}

/** L'origine de la page (mot, réseau, compte au format CRM, post, version M1). */
function construireOrigineDePage(
  donnees: DonneesJeton,
  compte: string | null,
  postRef: string | null,
  empreinte: string,
  maintenant: Date,
): OrigineAEcrire {
  return {
    mot: donnees.mot,
    reseau: RESEAU_DU_LIEN[donnees.reseau],
    guide: donnees.guide,
    postRef,
    postUrl: null,
    canal: null,
    famille: "guide_reseau",
    detail: donnees.guide === "guide-ia" ? "guide_ia" : "autre_non_classe",
    compte,
    versionTexte: (VERSIONS_TEXTE_CONNUES as readonly string[]).includes(donnees.version_m1)
      ? donnees.version_m1
      : null,
    utmCampagne: null,
    commentaireRefHmac: null,
    occurredAt: new Date(Math.floor(maintenant.getTime() / 1000) * 1000),
    // Dérivée du jeton (usage unique). Lot S3 : JAMAIS de CRM au POST de la page — l'adresse n'est
    // qu'une saisie ; l'événement part au CLIC du lien du guide (`transmettreClicGuide`), qui
    // relit cette origine.
    cleIdempotence: `page-${empreinte.slice(0, 40)}`,
  };
}

interface ContexteSuite {
  readonly email: string;
  readonly maintenant: Date;
}

async function suiteApresReponse(
  donnees: DonneesJeton,
  demande: { id: string; downloadToken: string },
  { email, maintenant }: ContexteSuite,
): Promise<void> {
  // L'e-mail du guide, sauf s'il est déjà parti à cette adresse depuis moins de 24 h.
  //     Un échec de mise en file n'annule rien : la demande est écrite (et le consentement prouvé),
  //     `queued_at` reste vide et le rattrapage la reprend. La personne n'est pas renvoyée en erreur.
  let guide: string;
  try {
    if ((await envoisRecentsVers(email, maintenant)) > 0) {
      guide = "deja-servi";
    } else {
      guide = await mettreEnFileGuide(
        { id: demande.id, email, locale: "fr", downloadToken: demande.downloadToken },
        { reseau: true, pageGuide: { oppositionToken: jetonOpposition(email) }, maintenant },
      );
    }
  } catch (err) {
    guide = "non-parti";
    console.error(
      JSON.stringify({
        event: "guides_reseau_page_mise_en_file_echec",
        erreur: err instanceof Error ? err.name : "erreur",
      }),
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
}
