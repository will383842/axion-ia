/**
 * Qualiopi — Server Actions Portail stagiaire + RGPD (AGENT B — T14).
 *
 * Actions PORTAIL (authentification via cookie, PAS requireAdminWrite) :
 *   quitterPortailAction          : supprime le cookie (déconnexion)
 *   soumettreSatisfactionPortailAction : réutilise soumettreReponses T10 via cookie
 *   declarerHandicapAction        : set situationHandicap + handicapDetailsChiffre (encryptPii)
 *   demanderExportRgpdAction      : crée demande RGPD type=export via cookie
 *   demanderSuppressionRgpdAction : crée demande RGPD type=suppression via cookie
 *
 * Actions ADMIN (requireAdminWrite + audit) :
 *   genererPortailAccesAction     : crée un accès portail pour un stagiaire
 *   revoquerPortailAccesAction    : révoque un accès portail existant
 *
 * Règles non négociables :
 * - Cookie via helpers cookie.ts (HttpOnly, Secure, SameSite=Lax).
 * - PII handicap chiffré via encryptPii (jamais en clair en DB).
 * - Authentification portail = getPortailToken() + verifierToken() — PAS requireAdminWrite.
 * - exactOptionalPropertyTypes.
 */

"use server";

import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";
import {
  requireAdminWrite,
  requireSuperAdmin,
  logQualiopiActivity,
} from "@/server/actions/qualiopi/_guards";
import {
  creerAcces,
  verifierToken,
  revoquerAcces,
  demanderAccesParEmail,
} from "@/server/qualiopi/portail/portail-service";
import { checkRateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { getPortailToken, clearPortailCookie } from "@/server/qualiopi/portail/cookie";
import { creerDemandeRgpd } from "@/server/qualiopi/portail/rgpd-service";
import { soumettreReponses } from "@/server/qualiopi/satisfaction/satisfaction-service";
import { encryptPii, decryptPii } from "@/lib/pii-crypto";
import { sendTelegram } from "@/lib/telegram";
import { creerOuDedup } from "@/server/qualiopi/alertes/alertes-service";
import { construireAlerteBesoinAdaptation } from "@/server/qualiopi/alertes/besoin-adaptation";
import { SITE_URL } from "@/lib/site-url";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const demanderAccesSchema = z.object({
  email: z.string().trim().email().max(254),
});

const genererPortailAccesSchema = z.object({
  traineeId: z.string().uuid(),
  joursValidite: z.number().int().min(1).max(365).optional(),
});

const revoquerPortailAccesSchema = z.object({
  id: z.string().uuid(),
});

const soumettreSatisfactionPortailSchema = z.object({
  // 🔴 `D4-5-S1` — c'était le jeton du questionnaire. Le portail authentifie
  // pourtant le stagiaire par cookie ET vérifie l'appartenance juste en
  // dessous : le jeton n'était qu'un identifiant redondant, expédié au
  // navigateur et conservé dans la page. L'identifiant n'ouvre rien.
  questionnaireId: z.string().uuid(),
  reponses: z.record(z.unknown()),
  noteGlobale: z.number().int().min(1).max(5).optional(),
});

const declarerHandicapSchema = z.object({
  besoin: z.string().min(1).max(2000),
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Résout le traineeId depuis le cookie portail.
 * Retourne { traineeId } ou { error }.
 */
async function resolveTraineeIdFromCookie(): Promise<{ traineeId: string } | { error: string }> {
  const cookieToken = await getPortailToken();
  if (!cookieToken) return { error: "Session portail absente — veuillez vous reconnecter" };

  const result = await verifierToken(cookieToken);
  if (!result) return { error: "Session portail expirée ou révoquée — veuillez vous reconnecter" };

  return { traineeId: result.traineeId };
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 2026-08-25 — `accederPortailAction` A ÉTÉ RETIRÉE. Ne pas la réintroduire.
//
// Elle échangeait un token d'accès portail contre le cookie de session, comme
// la route `app/[locale]/portail/acces/[token]/route.ts` — mais SANS son
// rate-limit anti-brute-force (10 tentatives / 60 s par IP).
//
// Ce fichier porte `"use server"` : chacune de ses fonctions exportées est un
// ENDPOINT HTTP. C'était donc un second chemin d'entrée au portail, dépourvu de
// la seule protection qui garde le premier — et **sans aucun appelant de
// production** : trouvée par le balayage des exports sans appelant.
//
// ⚠️ Le correctif n'a PAS été d'y recopier le rate-limit : un prédicat recopié
// diverge toujours, et ce dépôt l'a payé quatre fois. Il n'y a plus qu'un seul
// chemin vers le cookie de session, et il est protégé.
//
// Verrouillé par `__tests__/un-seul-chemin-vers-le-cookie-portail.spec.ts`.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// PORTAIL — demanderAccesPortailAction (self-service, public, sans cookie)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Re-demande self-service d'un lien d'accès à l'espace stagiaire par email.
 *
 * - PUBLIC (aucun cookie/admin requis).
 * - Anti-énumération : retourne TOUJOURS le même résultat, que l'email existe
 *   ou non (l'envoi éventuel se fait côté service, silencieusement).
 * - Rate-limité par IP (5 demandes / 15 min) pour éviter l'email-bombing.
 */
export async function demanderAccesPortailAction(input: {
  email: string;
}): Promise<ActionResult<{ ok: true }>> {
  const generic: ActionResult<{ ok: true }> = { data: { ok: true } };
  const parsed = demanderAccesSchema.safeParse(input);
  if (!parsed.success) return generic;

  try {
    const hdrs = await headers();
    const ip =
      hdrs.get("cf-connecting-ip") ??
      hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const rl = await checkRateLimit(`portail:reacces:${ip}`, { limit: 5, windowSec: 900 });
    if (!rl.allowed) return generic; // silencieux
  } catch {
    // fail-open : un rate-limit indisponible ne doit pas bloquer la demande
  }

  try {
    await demanderAccesParEmail(parsed.data.email);
  } catch {
    // fail-soft : ne jamais révéler d'erreur interne au public
  }
  return generic;
}

// ─────────────────────────────────────────────────────────────────────────────
// PORTAIL — quitterPortailAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Déconnecte le stagiaire en supprimant le cookie de session portail.
 */
export async function quitterPortailAction(): Promise<ActionResult<{ ok: boolean }>> {
  await clearPortailCookie();
  return { data: { ok: true } };
}

// ─────────────────────────────────────────────────────────────────────────────
// PORTAIL — soumettreSatisfactionPortailAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Soumet les réponses à un questionnaire de satisfaction depuis le portail stagiaire.
 * Réutilise `soumettreReponses` de T10 (satisfaction-service).
 * S'authentifie via le cookie portail (PAS requireAdminWrite).
 */
export async function soumettreSatisfactionPortailAction(input: {
  questionnaireId: string;
  reponses: Record<string, unknown>;
  noteGlobale?: number;
}): Promise<ActionResult<{ id: string }>> {
  // Vérifier l'authentification portail
  const authResult = await resolveTraineeIdFromCookie();
  if ("error" in authResult) return { error: authResult.error };

  const parsed = soumettreSatisfactionPortailSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  // A-01 (IDOR) : vérifier que le questionnaire appartient bien au stagiaire authentifié.
  const questionnaire = await prisma.questionnaire.findUnique({
    where: { id: v.questionnaireId },
    select: { enrollment: { select: { traineeId: true } } },
  });
  if (!questionnaire || questionnaire.enrollment.traineeId !== authResult.traineeId) {
    return { error: "Questionnaire introuvable ou non autorisé" };
  }

  // ── 🔴 Besoin d'adaptation : le SORTIR du JSON avant de l'écrire ──────────
  //
  // Constats `D46-01` et `D46-02`. Le questionnaire de positionnement porte une
  // case « J'ai un besoin d'adaptation » et un champ libre dont le texte
  // d'invite promet : « transmis au référent handicap ».
  //
  // Or, avant ce correctif :
  //   · PERSONNE ne le lisait. `besoinAdaptation` et `detailAdaptation`
  //     n'apparaissaient QUE dans le composant de saisie — 8 occurrences dans
  //     un seul fichier, aucun lecteur serveur, aucun écran, aucun export. La
  //     promesse faite au bénéficiaire n'était tenue par aucune ligne de code.
  //   · Le détail atterrissait EN CLAIR dans `Questionnaire.reponses`, colonne
  //     `Json @default("{}")`, sans chiffrement, sans habilitation, sans
  //     journal d'accès.
  //
  // Le second point n'est pas un oubli de précaution : c'est une contradiction
  // avec une décision déjà prise et écrite. `declarerHandicapAction`, quinze
  // lignes plus bas, chiffre la MÊME donnée (`encryptPii`), en réserve la
  // lecture au super-administrateur et journalise chaque révélation. Le dépôt
  // avait donc jugé que cette information l'exigeait — et le second chemin
  // l'ignorait. Donnée de santé, RGPD art. 9.
  //
  // 🔑 Et c'est le chemin AMONT : le positionnement arrive avant la formation,
  // donc c'est le seul moment où l'adaptation peut encore être organisée. Le
  // même défaut avait été fermé le 2026-08-04 sur l'autre chemin, et laissé
  // ouvert sur celui-ci.
  //
  // L'extraction se fait AVANT `soumettreReponses` : une fois la valeur écrite
  // dans la colonne JSON, elle y est en clair, et l'en retirer après coup
  // laisserait une trace dans les sauvegardes.
  const besoinAdaptation = v.reponses["besoinAdaptation"] === true;
  const detailBrut = v.reponses["detailAdaptation"];
  const detailAdaptation = typeof detailBrut === "string" ? detailBrut.trim() : "";
  // Le booléen RESTE dans les réponses : il dit ce qui a été répondu, et le
  // dépôt stocke déjà `Trainee.situationHandicap` en clair. Seul le DÉTAIL —
  // le texte libre, celui qui décrit la situation — est retiré et chiffré.
  const { detailAdaptation: _retire, ...reponsesSansDetail } = v.reponses;

  const result = await soumettreReponses({
    questionnaireId: v.questionnaireId,
    reponses: reponsesSansDetail,
    ...(v.noteGlobale !== undefined ? { noteGlobale: v.noteGlobale } : {}),
  });

  if (!result) return { error: "Questionnaire introuvable ou déjà soumis" };

  if (besoinAdaptation) {
    // Après la soumission seulement : une déclaration qui n'a pas été
    // enregistrée ne doit pas lever d'alerte.
    //
    // ⚠️ ATTENDU, contrairement à `declarerHandicapAction` qui détache tout.
    // Écrire le détail chiffré n'est pas une notification, c'est la
    // PERSISTANCE de la déclaration : c'est précisément ce que ce correctif
    // rétablit, et le perdre en silence reproduirait le défaut. Ce sont deux
    // écritures locales, pas un appel tiers — l'appel tiers (Telegram) reste
    // détaché à l'intérieur.
    //
    // Fail-soft quand même : les réponses SONT déjà enregistrées. Rendre une
    // erreur ferait croire au bénéficiaire qu'il doit tout refaire, alors que
    // seul le signalement a échoué. Mais on ne se tait pas : Sentry le voit.
    try {
      await signalerBesoinAdaptation(authResult.traineeId, detailAdaptation);
    } catch (err) {
      Sentry.captureException(err, {
        tags: { service: "soumettreSatisfactionPortailAction", etape: "besoin_adaptation" },
        extra: { traineeId: authResult.traineeId, questionnaireId: result.id },
      });
    }
  }

  return { data: { id: result.id } };
}

/**
 * Enregistre un besoin d'adaptation déclaré au POSITIONNEMENT et prévient.
 *
 * Même destination et même régime que `declarerHandicapAction` : détail chiffré
 * sur la fiche stagiaire, alerte console, message Telegram. C'est délibérément
 * la même écriture — deux chemins de déclaration qui rangeraient la donnée à
 * deux endroits différents produiraient exactement la divergence que ces
 * constats décrivent.
 */
async function signalerBesoinAdaptation(traineeId: string, detail: string): Promise<void> {
  const trainee = await prisma.trainee.update({
    where: { id: traineeId },
    data: {
      situationHandicap: true,
      // ⚠️ Un détail VIDE n'écrase pas un détail existant. Le bénéficiaire peut
      // cocher la case sans rien préciser au positionnement alors qu'il a déjà
      // décrit sa situation ailleurs : recopier `null` par symétrie détruirait
      // cette déclaration-là, sans que rien ne le signale.
      ...(detail.length > 0 ? { handicapDetailsChiffre: encryptPii(detail) } : {}),
    },
    select: { id: true, prenom: true, nom: true },
  });

  // ⚠️ Aucun de ces deux messages ne porte le besoin : le texte d'une alerte est
  // FIGÉ en base à sa création et se recopie en pastille et en notification.
  // `construireAlerteBesoinAdaptation` ne reçoit d'ailleurs PAS le détail en
  // paramètre — la fuite est hors de portée, pas seulement évitée.
  const alerte = construireAlerteBesoinAdaptation(trainee);
  await creerOuDedup({
    code: "besoin_adaptation_declare",
    niveau: "important",
    titre: alerte.titre,
    message: alerte.message,
    cibleType: "Trainee",
    cibleId: trainee.id,
  });

  // Seul appel TIERS du lot : détaché, pour ne pas tenir la réponse du
  // bénéficiaire sur la latence de Telegram. Il ne remplace pas l'alerte —
  // Will peut ne pas le lire, et rien ne l'y ramène.
  void sendTelegram({
    tag: "ADAPTATION_DECLAREE",
    body:
      `♿ ${trainee.prenom} ${trainee.nom} a déclaré un besoin d'adaptation ` +
      `dans son questionnaire de positionnement.\n` +
      `Le détail est chiffré : le lire depuis sa fiche stagiaire dans la console.`,
  }).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// PORTAIL — declarerHandicapAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Déclare la situation de handicap depuis le portail stagiaire.
 * Chiffre le détail via encryptPii (jamais en clair en DB).
 * S'authentifie via le cookie portail.
 */
export async function declarerHandicapAction(input: {
  besoin: string;
}): Promise<ActionResult<{ ok: boolean }>> {
  const authResult = await resolveTraineeIdFromCookie();
  if ("error" in authResult) return { error: authResult.error };

  const parsed = declarerHandicapSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };

  const handicapDetailsChiffre = encryptPii(parsed.data.besoin);

  const trainee = await prisma.trainee.update({
    where: { id: authResult.traineeId },
    data: {
      situationHandicap: true,
      handicapDetailsChiffre,
    },
    select: { id: true, prenom: true, nom: true },
  });

  // 🔴 PERSONNE N'ÉTAIT PRÉVENU (corrigé le 2026-08-04).
  //
  // Cette action écrivait en base et s'arrêtait là : aucune alerte, aucun
  // courriel, aucune pastille « à traiter ». L'écran promet pourtant « nous en
  // tiendrons compte avant la formation ». Un besoin déclaré la veille d'une
  // session pouvait donc n'être découvert par personne — et l'indicateur 26
  // Qualiopi porte précisément sur l'accueil des publics en situation de
  // handicap.
  //
  // ⚠️ Aucun de ces deux messages ne contient le besoin : c'est une donnée de
  // santé. Ils nomment la personne et renvoient à sa fiche, où la lecture est
  // réservée au super-administrateur et journalisée.

  // 1. L'ALERTE CONSOLE — le canal qui compte.
  //
  // 🔴 Vérification en production du 2026-08-04 : la première correction ne
  // posait QUE le message Telegram ci-dessous. `alertes_systeme` restait vide,
  // donc /qualiopi/a-traiter — la première page ouverte le matin — n'en savait
  // rien. Une alerte qui vit dans un seul canal, hors de l'outil de travail,
  // n'est pas une alerte : c'est un pari sur l'attention de quelqu'un.
  //
  // `creerOuDedup` dédoublonne sur (code, cibleId) tant que l'alerte est
  // ouverte : re-déclarer ne fabrique donc pas une seconde ligne. Et comme le
  // message ne porte que l'identité — jamais le besoin —, il ne peut pas se
  // périmer entre-temps (le texte d'une alerte est figé à sa création).
  //
  // Fire-and-forget comme le reste : la déclaration du bénéficiaire est le
  // geste important, une panne d'alerte ne doit pas la faire échouer.
  const alerte = construireAlerteBesoinAdaptation(trainee);
  void creerOuDedup({
    code: "besoin_adaptation_declare",
    niveau: "important",
    titre: alerte.titre,
    message: alerte.message,
    cibleType: "Trainee",
    cibleId: trainee.id,
  }).catch(() => {});

  // 2. Le message Telegram — utile pour être prévenu hors console, mais il ne
  // remplace pas l'alerte : Will peut ne pas le lire, et rien ne l'y ramène.
  void sendTelegram({
    tag: "ADAPTATION_DECLAREE",
    body:
      `♿ ${trainee.prenom} ${trainee.nom} a déclaré un besoin d'adaptation.\n` +
      `Le détail est chiffré : le lire depuis sa fiche stagiaire dans la console.`,
  }).catch(() => {});

  return { data: { ok: true } };
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — lireBesoinAdaptationAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Révèle le besoin d'adaptation déclaré par un bénéficiaire.
 *
 * ## 🔴 Pourquoi cette action a dû être créée
 *
 * Le besoin était chiffré en base et **lisible NULLE PART dans la console**. La
 * fiche stagiaire n'exposait que deux booléens — « situation déclarée » et « un
 * détail existe » — et le formulaire affichait « lecture réservée au référent
 * handicap » alors qu'aucun écran ne la permettait. Le déchiffrement n'existait
 * que pour le bénéficiaire lui-même et pour l'export RGPD.
 *
 * Autrement dit : quelqu'un pouvait écrire « j'ai besoin d'une salle accessible
 * en fauteuil » et personne, côté organisme, ne pouvait le lire — alors que
 * l'écran promet « nous en tiendrons compte avant la formation ».
 *
 * ## Pourquoi super-admin et pas admin
 *
 * C'est une donnée de SANTÉ (RGPD art. 9). Le principe est le moindre accès :
 * on ne l'ouvre pas à tout compte administrateur. `requireSuperAdmin` est le
 * garde le plus restrictif dont dispose ce dépôt.
 *
 * ## Pourquoi une action « à la demande » et non un affichage direct
 *
 * Rendre le besoin dans la page l'exposerait à toute personne qui passe devant
 * l'écran, et le ferait entrer dans le HTML de chaque consultation de fiche.
 * Ici, il faut un geste délibéré — et **ce geste est journalisé**, ce qui rend
 * l'accès auditable. Une donnée de santé lue sans trace n'est pas conforme.
 */
export async function lireBesoinAdaptationAction(input: {
  traineeId: string;
}): Promise<ActionResult<{ besoin: string | null }>> {
  const parsed = z.object({ traineeId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };

  let session;
  try {
    session = await requireSuperAdmin();
  } catch {
    return { error: "Réservé au super-administrateur" };
  }

  const trainee = await prisma.trainee.findUnique({
    where: { id: parsed.data.traineeId },
    select: { handicapDetailsChiffre: true },
  });
  if (!trainee) return { error: "Stagiaire introuvable" };

  // Journalisation AVANT de rendre la valeur : si l'écriture du journal échoue,
  // on ne veut pas avoir déjà divulgué la donnée sans trace.
  await logQualiopiActivity({
    action: "qualiopi.trainee.besoin_adaptation.lu",
    targetType: "Trainee",
    targetId: parsed.data.traineeId,
    // Jamais le contenu dans le journal — on trace l'ACCÈS, pas la donnée.
    changes: { lu: true },
    session,
  });

  return { data: { besoin: decryptPii(trainee.handicapDetailsChiffre) } };
}

// ─────────────────────────────────────────────────────────────────────────────
// PORTAIL — demanderExportRgpdAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée une demande de droit d'accès RGPD (export) pour le stagiaire connecté.
 */
export async function demanderExportRgpdAction(): Promise<ActionResult<{ id: string }>> {
  const authResult = await resolveTraineeIdFromCookie();
  if ("error" in authResult) return { error: authResult.error };

  const demande = await creerDemandeRgpd(authResult.traineeId, "export");
  return { data: { id: demande.id } };
}

// ─────────────────────────────────────────────────────────────────────────────
// PORTAIL — demanderSuppressionRgpdAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée une demande de droit à l'effacement RGPD (suppression) pour le stagiaire connecté.
 */
export async function demanderSuppressionRgpdAction(): Promise<ActionResult<{ id: string }>> {
  const authResult = await resolveTraineeIdFromCookie();
  if ("error" in authResult) return { error: authResult.error };

  const demande = await creerDemandeRgpd(authResult.traineeId, "suppression");
  return { data: { id: demande.id } };
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — genererPortailAccesAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère un accès portail pour un stagiaire (ADMIN) **et le lui envoie**.
 *
 * 🔴 L'envoi manquait, et l'écran affirmait le contraire. `creerAcces` créait le
 * jeton, journalisait, rendait l'URL — et rien ne partait. La fiche session
 * affichait alors « Accès actif — expire le … » : vrai en base, faux pour la
 * personne concernée, qui n'avait jamais rien reçu. Le seul émetteur du gabarit
 * `qualiopi-portail-acces` était `demanderAccesParEmail`, c'est-à-dire le
 * self-service « j'ai perdu mon lien » — un chemin que le stagiaire ne peut
 * emprunter que s'il connaît déjà l'existence de son espace.
 *
 * ⚠️ L'e-mail porte `ouvertParOrganisme: true`. Sans ce drapeau, le gabarit
 * dirait « vous avez demandé un nouveau lien […] vous pouvez ignorer cet
 * email » à quelqu'un qui n'a rien demandé — exactement le défaut corrigé le
 * 15/08 sur le positionnement.
 *
 * L'envoi est FAIL-SOFT : l'accès est créé et rendu même si l'e-mail échoue,
 * avec `envoyeAuStagiaire: false`. Perdre l'accès parce que la file d'e-mails
 * est indisponible serait pire que devoir transmettre le lien à la main — mais
 * l'appelant doit savoir lequel des deux cas il a sous les yeux, sinon on
 * recrée le mensonge qu'on vient de retirer.
 */
export async function genererPortailAccesAction(input: {
  traineeId: string;
  joursValidite?: number;
}): Promise<
  ActionResult<{
    id: string;
    token: string;
    url: string;
    expiresAt: Date;
    envoyeAuStagiaire: boolean;
  }>
> {
  const session = await requireAdminWrite();

  const parsed = genererPortailAccesSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  const acces = await creerAcces(
    v.traineeId,
    v.joursValidite !== undefined ? v.joursValidite : undefined,
  );

  // URL à transmettre au stagiaire (remplace localhost par le domaine en prod)
  // 🔴 2026-08-23 — ORIGINE CANONIQUE, ET NON UNE VARIABLE FANTÔME.
  //
  // Cette ligne lisait `process.env["NEXT_PUBLIC_APP_URL"] ?? "https://axion-ia.com"`.
  // Or `NEXT_PUBLIC_APP_URL` n'était déclarée NULLE PART dans le dépôt — ni dans
  // les trois `.env*.example`, ni dans `ci.yml`, ni dans le schéma `env.ts` — et
  // trois modules la lisaient avec le MÊME repli codé en dur. Partout où elle
  // n'était pas posée à la main, l'URL produite pointait donc la PRODUCTION.
  //
  // Conséquence mesurée : le lien d'accès envoyé au stagiaire pointait
  // `https://axion-ia.com` quel que soit l'environnement. Correct en production,
  // faux partout ailleurs — et le parcours E2E du portail mesurait la production
  // au lieu du serveur sous test. En local il ne passait que parce qu'un
  // `.env.local` non versionné posait la variable ; en CI, non.
  //
  // 🔑 On ne DÉCLARE pas la variable manquante, on supprime le doublon :
  // `SITE_URL` (`@/lib/site-url`) est déjà l'origine canonique, validée par le
  // schéma (`env.ts:404`, défaut `http://localhost:3000`), déclarée dans les
  // trois `.env*.example` ET dans `ci.yml`, et munie de son propre filet de
  // sécurité en production. Un prédicat recopié diverge toujours : il n'y en a
  // plus qu'un.
  const baseUrl = SITE_URL;
  const url = `${baseUrl}/fr/portail/acces/${acces.token}`;

  let envoyeAuStagiaire = false;
  try {
    const stagiaire = await prisma.trainee.findUnique({
      where: { id: v.traineeId },
      select: { email: true, nom: true, prenom: true },
    });
    if (stagiaire !== null && stagiaire.email !== "") {
      const envoi = await enqueueEmail(
        "qualiopi-portail-acces",
        stagiaire.email,
        "fr",
        {
          stagiairePrenomNom: `${stagiaire.prenom} ${stagiaire.nom}`.trim(),
          lienPortail: url,
          ouvertParOrganisme: true,
        },
        {
          jobId: `qualiopi-portail-acces-admin-${acces.id}-${Date.now()}`,
          entityType: "PortailAcces",
          entityId: acces.id,
        },
      );
      // 🔴 2026-08-19 (constat `D5-3-01`, même famille que la convocation et les
      // liens d'émargement) — ce drapeau était posé inconditionnellement.
      // `enqueueEmail` ne lève pas : elle rend `{ enqueued: false }`. L'écran
      // annonçait donc « accès envoyé au stagiaire » alors que rien n'était
      // parti, et personne n'avait de raison de renvoyer.
      envoyeAuStagiaire = envoi.enqueued;
      if (!envoi.enqueued) {
        console.error(
          `[portail] accès créé mais e-mail NON mis en file (accès ${acces.id})` +
            (envoi.garePourValidation === true ? " — garé en corbeille de validation" : ""),
        );
      }
    }
  } catch (err) {
    console.error(
      "[portail] accès créé mais e-mail non envoyé",
      err instanceof Error ? err.message : String(err),
    );
  }

  await logQualiopiActivity({
    action: "qualiopi.portail.generer_acces",
    targetType: "PortailAcces",
    targetId: acces.id,
    changes: { traineeId: v.traineeId, expiresAt: acces.expiresAt, envoyeAuStagiaire },
    session,
  });

  return {
    data: { id: acces.id, token: acces.token, url, expiresAt: acces.expiresAt, envoyeAuStagiaire },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — revoquerPortailAccesAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Révoque un accès portail (ADMIN).
 */
export async function revoquerPortailAccesAction(input: {
  id: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();

  const parsed = revoquerPortailAccesSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id } = parsed.data;

  await revoquerAcces(id);

  await logQualiopiActivity({
    action: "qualiopi.portail.revoquer_acces",
    targetType: "PortailAcces",
    targetId: id,
    changes: { revoked: true },
    session,
  });

  return { data: { id } };
}
