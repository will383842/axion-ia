/**
 * Qualiopi — Server Actions Portail stagiaire + RGPD (AGENT B — T14).
 *
 * Actions PORTAIL (authentification via cookie, PAS requireAdminWrite) :
 *   quitterPortailAction          : supprime le cookie (déconnexion)
 *   soumettreSatisfactionPortailAction : réutilise soumettreReponses T10 via cookie ;
 *                                   un « oui » au besoin d'adaptation chiffre le détail
 *                                   et alerte, SANS cocher situationHandicap (D4)
 *   declarerHandicapAction        : handicap / problème de santé → situationHandicap
 *                                   + handicapDetailsChiffre (encryptPii)
 *   declarerBesoinAmenagementAction : besoin d'aménagement SANS handicap → détail
 *                                   chiffré + `Enrollment.besoinAdaptationDeclareAt`,
 *                                   SANS cocher situationHandicap (dette D2/D4)
 *                                   et SANS toucher au questionnaire
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
import { journaliserDeclarationBesoin } from "@/server/qualiopi/adaptation/journal-declaration";
import { declarerBesoinAmenagementSurInscriptions } from "@/server/qualiopi/adaptation/declaration-amenagement";
import {
  CLE_BESOIN_ADAPTATION_REPONDU,
  MESSAGE_BESOIN_ADAPTATION_SANS_REPONSE,
} from "@/server/qualiopi/positionnement/reponse-explicite";
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
    select: { type: true, enrollment: { select: { traineeId: true } } },
  });
  if (!questionnaire || questionnaire.enrollment.traineeId !== authResult.traineeId) {
    return { error: "Questionnaire introuvable ou non autorisé" };
  }

  // 🔴 D6 (relecture #1095) — le oui/non du besoin d'adaptation se vérifie AUSSI
  // ici : un formulaire resté en cache enverrait `false` pour une question jamais
  // lue. Le marqueur est retiré avant l'écriture (`reponse-explicite.ts`).
  const { [CLE_BESOIN_ADAPTATION_REPONDU]: marqueurReponseExplicite, ...reponsesRecues } =
    v.reponses;
  if (
    questionnaire.type === "positionnement" &&
    (marqueurReponseExplicite !== true || typeof reponsesRecues["besoinAdaptation"] !== "boolean")
  ) {
    return { error: MESSAGE_BESOIN_ADAPTATION_SANS_REPONSE };
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
  const besoinAdaptation = reponsesRecues["besoinAdaptation"] === true;
  const detailBrut = reponsesRecues["detailAdaptation"];
  const detailAdaptation = typeof detailBrut === "string" ? detailBrut.trim() : "";
  // Le booléen RESTE dans les réponses : il dit ce qui a été répondu, et le
  // dépôt stocke déjà `Trainee.situationHandicap` en clair. Seul le DÉTAIL —
  // le texte libre, celui qui décrit la situation — est retiré et chiffré.
  const { detailAdaptation: _retire, ...reponsesSansDetail } = reponsesRecues;

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
 * Même destination et même régime que `declarerHandicapAction` pour le DÉTAIL :
 * chiffré sur la fiche stagiaire, alerte console, message Telegram — deux
 * chemins qui rangeraient le détail à deux endroits produiraient la divergence
 * que ces constats décrivent.
 *
 * 🔴 2026-09-15 (relecture sécurité #1095, dette D4) — ce chemin ne coche PLUS
 * `Trainee.situationHandicap`. La question du positionnement couvre aussi une
 * difficulté d'accès, un aménagement, un problème de santé passager : un « oui »
 * n'est pas un handicap. Cocher la case qualifiait la personne de « handicapée »
 * à tort (exactitude et minimisation, RGPD art. 5), dans la liste des stagiaires
 * et le compte « situation de handicap ». Le besoin, lui, n'est pas perdu : le
 * « oui » reste dans les réponses du positionnement, et `besoinAdaptationDeclare`
 * (`adaptation/reponse-organisme.ts`) le lit là — indicateur 10, alertes, écran
 * de session, dossier d'audit, espace formateur.
 */
async function signalerBesoinAdaptation(traineeId: string, detail: string): Promise<void> {
  // Un SEUL instant pour le journal et pour le message de l'alerte : ils doivent
  // désigner la même déclaration.
  const declareLe = new Date();
  const identite = { id: true, prenom: true, nom: true } as const;
  // ⚠️ Un détail VIDE n'écrase pas un détail existant. Le bénéficiaire peut
  // répondre « oui » sans rien préciser au positionnement alors qu'il a déjà
  // décrit sa situation ailleurs : recopier `null` par symétrie détruirait
  // cette déclaration-là, sans que rien ne le signale. Sans détail, la fiche
  // n'est donc pas écrite du tout — on ne la lit que pour nommer la personne.
  const trainee =
    detail.length > 0
      ? await prisma.trainee.update({
          where: { id: traineeId },
          data: { handicapDetailsChiffre: encryptPii(detail) },
          select: identite,
        })
      : await prisma.trainee.findUnique({ where: { id: traineeId }, select: identite });
  if (trainee === null) {
    // Le cookie désignait une fiche qui n'existe plus : l'appelant le remonte à Sentry.
    throw new Error("signalerBesoinAdaptation : stagiaire introuvable");
  }

  // ⚠️ Aucun de ces deux messages ne porte le besoin : le texte d'une alerte est
  // FIGÉ en base à sa création et se recopie en pastille et en notification.
  // `construireAlerteBesoinAdaptation` ne reçoit d'ailleurs PAS le détail en
  // paramètre — la fuite est hors de portée, pas seulement évitée.
  //
  // 🔴 La DATE de la déclaration est journalisée AVANT l'alerte : c'est elle qui
  // rouvre le circuit (ind. 10) si une réponse avait déjà été consignée.
  await journaliserDeclarationBesoin({
    traineeId: trainee.id,
    origine: "portail_positionnement",
    declareLe,
  });
  const alerte = construireAlerteBesoinAdaptation({ ...trainee, declareLe });
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
// PORTAIL — les DEUX déclarations de « mon compte »
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Déclare une SITUATION DE HANDICAP ou un PROBLÈME DE SANTÉ nécessitant une
 * adaptation, depuis « mon compte ». Pose `Trainee.situationHandicap`.
 *
 * Le détail est chiffré (`encryptPii`, jamais en clair en base). Authentification
 * par le cookie portail.
 */
export async function declarerHandicapAction(input: {
  besoin: string;
}): Promise<ActionResult<{ ok: boolean }>> {
  return declarerDepuisMonCompte(input, "handicap");
}

/**
 * Déclare un BESOIN D'AMÉNAGEMENT SANS handicap — matériel, rythme, accès,
 * organisation — depuis « mon compte ». Ne pose PAS
 * `Trainee.situationHandicap`.
 *
 * 🔴 Dette D2/D4 (relectures #1095, #1099, #1101). L'écran ne proposait qu'un
 * seul bouton, dont le texte couvrait « handicap, trouble d'apprentissage,
 * etc. », et son unique action cochait la case. Une pause plus longue ou un
 * support agrandi faisaient donc qualifier la personne « en situation de
 * handicap » — inexactitude et minimisation (RGPD art. 5) — et alimentaient le
 * décompte handicap (ind. 20 et 26). #1101 avait fermé le même défaut sur le
 * positionnement ; c'était le dernier chemin.
 *
 * 🔑 DEUX ENDPOINTS, une seule implémentation. Un unique endpoint qui recevrait
 * la nature en paramètre rendrait possible qu'un formulaire en cache ou une
 * valeur absente coche la case par défaut. Ici la case n'est pas atteignable
 * depuis ce chemin : elle n'y est pas écrite. L'implémentation, elle, est
 * partagée — un prédicat recopié diverge toujours.
 */
export async function declarerBesoinAmenagementAction(input: {
  besoin: string;
}): Promise<ActionResult<{ ok: boolean }>> {
  return declarerDepuisMonCompte(input, "amenagement");
}

/** Ce que le bénéficiaire a voulu dire, et c'est lui qui le dit. */
type NatureDeclaration = "handicap" | "amenagement";

/** Sépare deux déclarations successives dans la colonne chiffrée. Jamais traduit. */
const SEPARATEUR_DECLARATIONS = "\n\n— Déclaration du ";

const instantParis = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

/**
 * Le texte chiffré à écrire : la NOUVELLE déclaration, précédée des précédentes.
 *
 * 🔴 Dette D3 (relecture #1103). `handicapDetailsChiffre` était ÉCRASÉ à chaque
 * déclaration. Quelqu'un qui précisait « et j'aurai besoin d'une place près de la
 * porte » effaçait « je suis malentendant » : le référent ne voyait plus que la
 * seconde phrase, et rien ne disait qu'il y en avait eu une première. Une
 * déclaration de besoin n'est pas un champ de profil qu'on met à jour, c'est un
 * message reçu.
 *
 * Les déclarations sont donc CUMULÉES, chacune datée, dans la même colonne
 * `@db.Text` — une seule destination, comme le reste du dispositif. Volume :
 * 2 000 caractères par déclaration, et une déclaration est un geste rare.
 *
 * ⚠️ Si l'ancien texte ne se déchiffre pas (format hérité, clé tournée), on ne
 * le perd pas en silence : la nouvelle déclaration part avec une mention qui dit
 * qu'une précédente existait et n'a pas pu être relue. Le contraire — garder
 * l'ancien illisible et jeter le nouveau — perdrait la seule des deux qui soit
 * encore utile.
 *
 * 🔴 Le clair ne sort JAMAIS d'ici : ni journal, ni Sentry, ni valeur de retour.
 */
async function detailCumule(traineeId: string, nouveau: string): Promise<string> {
  const entete = `${SEPARATEUR_DECLARATIONS}${instantParis.format(new Date())} —\n`;
  let precedent: string | null = null;
  try {
    const fiche = await prisma.trainee.findUnique({
      where: { id: traineeId },
      select: { handicapDetailsChiffre: true },
    });
    const chiffre = fiche?.handicapDetailsChiffre ?? null;
    if (chiffre !== null && chiffre !== "") {
      precedent = decryptPii(chiffre);
      if (precedent === null || precedent === "") {
        precedent = "[déclaration précédente enregistrée, non relisible]";
      }
    }
  } catch (err) {
    // On ne sait plus s'il y avait quelque chose : le dire, et ne rien écraser
    // à l'aveugle serait pire — la nouvelle déclaration doit partir.
    Sentry.captureException(err, {
      tags: { service: "declarationMonCompte", etape: "detail_precedent" },
      extra: { traineeId },
    });
    precedent = "[déclaration précédente enregistrée, non relisible]";
  }
  return encryptPii(precedent === null ? nouveau : `${precedent}${entete}${nouveau}`);
}

async function declarerDepuisMonCompte(
  input: { besoin: string },
  nature: NatureDeclaration,
): Promise<ActionResult<{ ok: boolean }>> {
  const authResult = await resolveTraineeIdFromCookie();
  if ("error" in authResult) return { error: authResult.error };

  const parsed = declarerHandicapSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };

  const declareLe = new Date();

  const trainee = await prisma.trainee.update({
    where: { id: authResult.traineeId },
    data: {
      // La case n'est posée QUE par la déclaration de handicap ou de problème
      // de santé. Un besoin d'aménagement ne la voit jamais.
      ...(nature === "handicap" ? { situationHandicap: true } : {}),
      handicapDetailsChiffre: await detailCumule(authResult.traineeId, parsed.data.besoin),
    },
    select: { id: true, prenom: true, nom: true },
  });

  // Sans la case, le besoin est porté par SA PROPRE colonne
  // (`Enrollment.besoinAdaptationDeclareAt`), troisième source du besoin déclaré
  // de l'indicateur 10. ATTENDU — c'est la PERSISTANCE de la déclaration, pas
  // une notification.
  //
  // 🔴 Ce qu'on NE fait PAS : réécrire `Questionnaire.reponses`. Un premier
  // correctif y posait `besoinAdaptation: true` « là où les lecteurs cherchent
  // déjà » et transformait un « Non » explicite du bénéficiaire en « Oui » sur
  // la pièce d'audit, bandeau « 4, 8 et 10 » compris. Une réponse de
  // bénéficiaire ne se réécrit pas.
  if (nature === "amenagement") {
    try {
      const resultat = await declarerBesoinAmenagementSurInscriptions({
        traineeId: trainee.id,
        declareLe,
      });
      if (resultat.etat === "colonne_absente") {
        // L'heure qui suit une fusion : le worker tourne avant que l'entrypoint
        // de l'app n'ait migré. Rare, borné, et jamais silencieux.
        Sentry.captureMessage("déclaration d'aménagement : colonne pas encore migrée", {
          level: "warning",
          tags: { service: "declarerBesoinAmenagementAction" },
          extra: { traineeId: trainee.id },
        });
      } else if (resultat.inscriptions === 0) {
        // Aucune inscription en cours : la personne n'a plus de session à venir.
        // L'alerte et le journal partent quand même ; il n'y a simplement aucune
        // formation où organiser l'aménagement.
        Sentry.captureMessage("déclaration d'aménagement sans inscription en cours", {
          level: "info",
          tags: { service: "declarerBesoinAmenagementAction" },
          extra: { traineeId: trainee.id },
        });
      }
    } catch (err) {
      Sentry.captureException(err, {
        tags: { service: "declarerBesoinAmenagementAction", etape: "inscriptions" },
        extra: { traineeId: trainee.id },
      });
    }
  }

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
  // ouverte : re-déclarer ne fabrique donc pas une seconde ligne. Le message
  // porte l'identité et l'INSTANT de la déclaration — jamais le besoin.
  //
  // 🔴 2026-09-15 (relecture #1095) — sans l'instant, une alerte RÉSOLUE au même
  // message écartait toute nouvelle déclaration de la personne : un vrai besoin
  // déclaré ici après une réponse « aucune adaptation nécessaire » ne levait
  // rien. La date est aussi JOURNALISÉE : c'est elle qui rouvre l'indicateur 10
  // (`journal-declaration.ts`). Attendue, contrairement à l'alerte : elle est la
  // trace de la déclaration, pas une notification — et elle est fail-soft.
  await journaliserDeclarationBesoin({
    traineeId: trainee.id,
    origine: nature === "handicap" ? "portail_mon_compte" : "portail_mon_compte_amenagement",
    declareLe,
  });

  // Fire-and-forget comme le reste : la déclaration du bénéficiaire est le
  // geste important, une panne d'alerte ne doit pas la faire échouer.
  const alerte = construireAlerteBesoinAdaptation({ ...trainee, declareLe });
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
  //
  // ⚠️ La NATURE se dit, et elle n'est pas le détail : « situation de handicap
  // ou problème de santé » vs « aménagement, sans handicap déclaré ». Sans elle,
  // le même message annoncerait deux choses différentes, et la personne qui lit
  // supposerait la première — ce que tout ce correctif cesse de faire.
  void sendTelegram({
    tag: "ADAPTATION_DECLAREE",
    body:
      `♿ ${trainee.prenom} ${trainee.nom} a déclaré ` +
      (nature === "handicap"
        ? `une situation de handicap ou un problème de santé nécessitant une adaptation.\n`
        : `un besoin d'aménagement, SANS déclarer de situation de handicap.\n`) +
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

  // 🔴 2026-08-25 — révoque TOUS les accès vivants du stagiaire, pas seulement
  // celui affiché : `creerAcces` n'invalide pas les précédents, et l'écran n'en
  // montre qu'un. Le geste ne coupait donc pas ce qu'il annonçait.
  const nbRevoques = await revoquerAcces(id);

  await logQualiopiActivity({
    action: "qualiopi.portail.revoquer_acces",
    targetType: "PortailAcces",
    targetId: id,
    // Le COMPTE, pas un booléen : un journal qui écrit « revoked: true » sans
    // dire combien laisse croire qu'un seul accès existait.
    changes: { revoked: true, nbAccesRevoques: nbRevoques },
    session,
  });

  return { data: { id } };
}
