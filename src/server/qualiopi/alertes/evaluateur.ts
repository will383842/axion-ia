/**
 * Qualiopi — Évaluateur des alertes système (SPEC_PART2 §6.5).
 *
 * Scanne la DB et retourne la liste des alertes à créer/maintenir.
 * Stub-aware : early-exit si DATABASE_URL contient "stub.invalid".
 * Fail-soft par règle : une erreur n'interrompt pas les autres règles.
 * Seuils et dates via getQualiopiConfig (jamais en dur).
 */

import { prisma } from "@/lib/prisma";
import { inscriptionsActives } from "@/server/qualiopi/inscriptions/inscriptions-actives";
// 🔴 2026-08-24 — la MÊME mesure que le cron, jamais une seconde requête jumelle :
// deux prédicats qui se ressemblent finissent par diverger, et ce dépôt le paie
// sans arrêt. Le cron en prend le compte, cette règle en mappe les lignes.
import { sessionsSansRappelJ7 } from "@/server/qualiopi/notifications/rappel-j7-manquant";
import { DELAI_RELANCE_JOURS } from "@/server/qualiopi/trainers/mission-formateur";
import { instantRelance } from "@/server/qualiopi/trainers/delai-reponse-mission";
import { listIndisposEntre } from "@/server/qualiopi/trainers/availability-queries";
import {
  conflitIndisponibilite,
  formulerConflit,
} from "@/server/qualiopi/trainers/conflits-indisponibilite";
import { sessionsAvecJourneesSansCreneaux } from "@/server/qualiopi/presence/journees-sans-creneaux";
import {
  porteUneTraceDePresence,
  sansAucuneTraceDePresence,
} from "@/server/qualiopi/presence/trace-cloture";
import { compterEnAttente } from "@/server/email/outbox-service";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { isQualiopiCertificationObtenue } from "@/server/qualiopi/config/flag";
import { listBaremesEnVigueur } from "@/server/qualiopi/financements/bareme-opco";
import { estBaremePerime, opcoLabel } from "@/server/qualiopi/financements/opco-referentiel";
import { STATUTS_FACTURE_OUVERTE } from "@/server/qualiopi/financements/statuts-facture";
import { libellePalier } from "@/server/qualiopi/financements/relance-paliers";
import {
  CONFORMITE_DEFAUTS,
  addMonths,
  trouverValide,
  vigilancePerimee,
  vigilanceRequise,
} from "@/server/qualiopi/trainers/conformite";
import {
  cumulAnnuelFormateurCents,
  listTrainerDocuments,
} from "@/server/qualiopi/trainers/documents";
import { resolveInterventionSlugForFormation } from "@/server/qualiopi/vente/kit-formation";
// SSOT du prédicat « pièce en attente de signature ». À n'appeler, jamais à
// recopier — la recopie est ce qui a produit la divergence du constat `D3-4-06`.
import { enAttente } from "@/server/qualiopi/documents/signature/pieces-en-attente";
import type { AlerteNiveau } from "../../../../prisma/generated/client";
import {
  ATTENTE_JOURS,
  MARGE_AVANT_SESSION_JOURS,
  titreReclamation,
  verdictSignature,
} from "./seuil-signature";

// ─────────────────────────────────────────────────────────────────────────────
// Type de retour de l'évaluateur
// ─────────────────────────────────────────────────────────────────────────────

export interface AlerteCandidate {
  code: string;
  niveau: AlerteNiveau;
  titre: string;
  message: string;
  cibleType?: string;
  cibleId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internes
// ─────────────────────────────────────────────────────────────────────────────

/** Retourne une date = now() - N jours. */
function daysAgo(n: number, now = new Date()): Date {
  return new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
}

/** Retourne une date = now() + N jours. */
function daysFromNow(n: number, now = new Date()): Date {
  return new Date(now.getTime() + n * 24 * 60 * 60 * 1000);
}

/**
 * Fenêtre de l'alerte « session sans contact sur place ».
 *
 * 🔴 Elle DOIT rester strictement supérieure à
 * {@link FENETRE_CONVOCATION_J7_JOURS} : l'alerte n'a de valeur que si elle se
 * lève AVANT que la convocation du formateur ne parte. Quatorze jours laissent
 * une semaine pleine pour obtenir le contact du client, et un second appel s'il
 * n'a pas répondu au premier. Verrouillé par `alerte-avant-la-convocation.spec.ts`.
 */
export const FENETRE_CONTACT_SUR_PLACE_JOURS = 14;

// ─────────────────────────────────────────────────────────────────────────────
// Règles individuelles — chacune retourne AlerteCandidate[]
// ─────────────────────────────────────────────────────────────────────────────

/**
 * R01 — Référent handicap absent (indicateur 26 ⭐).
 *
 * 🔴 2026-08-23 — cette règle gardait sur `referent_handicap_nom` et **ne
 * pouvait JAMAIS se déclencher**. `getQualiopiConfig` rend la valeur par défaut
 * du registre quand la ligne n'existe pas (`site-settings.ts`, `row == null`),
 * et le registre donne `str("Williams Jullin")` à cette clé : le nom lu n'est
 * donc jamais vide, même sur une base entièrement vierge. Une alerte de niveau
 * CRITIQUE sur un super-indicateur restait muette par construction, et son
 * silence était indiscernable d'une situation saine.
 *
 * Le test ne l'attrapait pas parce qu'il remplaçait `getQualiopiConfig` par un
 * mock rendant `""` — précisément la couche où le défaut vivait.
 *
 * La règle garde désormais sur l'**e-mail**, qui n'a aucune valeur par défaut.
 * Ce n'est pas un choix arbitraire : c'est déjà le signal que retient
 * `evaluerConformite` pour off.26, avec le commentaire « le NOM seul (défaut
 * config) ne prouve pas la désignation ». Les deux lectures disent enfin la
 * même chose — et l'exigence de l'auditeur est bien « nommé ET joignable ».
 *
 * Verrouillé par `alerte-dabsence-ne-peut-pas-etre-morte.spec.ts`, qui garde la
 * FORME et attrapera donc aussi la prochaine règle écrite sur ce motif.
 */
async function regleReferentHandicap(now: Date): Promise<AlerteCandidate[]> {
  void now;
  const email = await getQualiopiConfig("referent_handicap_email");
  if (email && email.trim().length > 0) return [];
  return [
    {
      code: "referent_handicap_absent",
      niveau: "critique",
      titre: "Référent handicap absent",
      message:
        "Aucun e-mail de référent handicap renseigné dans la configuration. " +
        "L'auditeur attend un référent NOMMÉ ET JOIGNABLE : un nom sans moyen " +
        "de contact ne prouve pas la désignation. Obligatoire Qualiopi (ind.26⭐).",
    },
  ];
}

/**
 * R01b — Responsable qualité non désigné (critère 7).
 *
 * 🔴 Même défaut, même date, même correction que R01 ci-dessus :
 * `responsable_qualite_nom` porte aussi le défaut `str("Williams Jullin")`,
 * donc la règle ne pouvait jamais partir. Elle garde désormais sur l'e-mail.
 */
async function regleResponsableQualite(now: Date): Promise<AlerteCandidate[]> {
  void now;
  const email = await getQualiopiConfig("responsable_qualite_email");
  if (email && email.trim().length > 0) return [];
  return [
    {
      code: "responsable_qualite_absent",
      niveau: "important",
      titre: "Responsable qualité non désigné",
      message:
        "Aucun e-mail de responsable/référent qualité renseigné dans la configuration. " +
        "L'auditeur COFRAC attend une personne identifiée ET joignable qui pilote le " +
        "référentiel et prépare les audits (critère 7).",
    },
  ];
}

/**
 * R01c — Catégorie(s) d'actions certifiées non renseignées.
 *
 * 🔴 2026-08-20. La page publique affiche « La certification qualité a été
 * délivrée au titre de la ou des catégories d'actions suivantes : … ». C'est une
 * mention LÉGALE, imposée par les règles d'usage de la marque Qualiopi.
 *
 * Elle était produite par un DÉFAUT CODÉ EN DUR (« Actions de formation »),
 * présent à deux endroits. Autrement dit : le site affirmait au titre du
 * certificat une catégorie que personne n'avait lue sur le certificat. Et le
 * défaut est servi dans trois cas silencieux par `getQualiopiConfig` — ligne
 * absente, parse en échec, **panne de base** — qu'aucun `curl` ne distingue
 * d'une valeur réellement configurée : les deux rendent la même page.
 *
 * Le certificat peut couvrir « Bilans de compétences », « VAE » ou « Actions de
 * formation par apprentissage ». Sur-déclarer est une affirmation fausse ;
 * sous-déclarer est une perte commerciale. Les deux se réparent en lisant le
 * certificat — ce que le code ne peut pas faire à la place de quelqu'un.
 *
 * ⚠️ Cette règle n'existe QUE parce que le défaut du registre a été vidé. Y
 * remettre une valeur la rendrait définitivement muette.
 */
async function regleCategoriesCertifiees(now: Date): Promise<AlerteCandidate[]> {
  void now;
  // Ne se déclenche pas tant que la certification n'est pas affirmée : sans
  // revendication publique, il n'y a aucune mention à accompagner.
  if (!isQualiopiCertificationObtenue()) return [];
  const categories = await getQualiopiConfig("qualiopi_categories_certifiees");
  if (categories.trim().length > 0) return [];
  return [
    {
      code: "categories_certifiees_non_renseignees",
      niveau: "important",
      titre: "Catégorie d'actions certifiées non renseignée",
      message:
        "La page publique affiche la mention obligatoire de la marque Qualiopi avec une " +
        "catégorie de repli, qu'aucun certificat n'a confirmée. Ouvrez le certificat et " +
        "saisissez la ou les catégories exactes dans la configuration Qualiopi " +
        "(« Catégories d'actions certifiées »). Renseignez au passage le certificateur, " +
        "la date d'obtention et la validité : ce sont les pièces que l'auditeur demande.",
    },
  ];
}

/**
 * R01e — Le catalogue se contredit sur « sommes-nous un organisme CERTIFIANT ? »
 *
 * 🔴 2026-08-23, observé À L'ÉCRAN sur `/qualiopi/mode-auditeur`, pas déduit du
 * code. La matrice affichait, dans la même page :
 *
 *   • indicateur 1, **Couvert** — « 1 formation certifiante avec code RS/RNCP renseigné »
 *   • indicateurs 3, 7 ⭐ et 16 ⭐ — « Non applicable · Aucun élément enregistré »
 *
 * Les deux ne peuvent pas être vrais ensemble, et un auditeur le voit sans
 * ouvrir un seul dossier.
 *
 * ## Pourquoi c'est possible : deux colonnes indépendantes, un seul sujet
 *
 * | question | colonne lue | qui l'écrit |
 * |---|---|---|
 * | 3/7/16 sont-ils APPLICABLES ? | `Formation.typesActionQualiopi` | **personne** — aucun écran ne l'expose ; l'import du catalogue y écrit `["classique"]` en dur |
 * | y a-t-il une preuve de certifiant ? | `certificationType` + `codeRncp`/`codeRs` | l'écran de la formation |
 *
 * Une formation peut donc porter un code RNCP parfaitement renseigné tout en
 * étant déclarée « classique », et le système soutient alors les deux thèses à
 * la fois.
 *
 * ## Ce que cette règle NE fait pas, délibérément
 *
 * Elle ne tranche pas. Le périmètre de certification demandé au certificateur
 * est une **décision**, pas une donnée déductible : Will a confirmé le
 * 2026-08-23 que le périmètre ne comporte **aucune action certifiante**, mais
 * cette décision peut changer et elle ne vit pas dans le dépôt. Le code se
 * contente donc de **signaler la contradiction** et de nommer les deux issues.
 *
 * ⚠️ L'enjeu n'est pas cosmétique : si le périmètre devient certifiant, **7 et
 * 16 sont des super-indicateurs** et n'ont aujourd'hui aucune pièce
 * (`audit-dossier.ts` leur associe explicitement `[]`, avec sa justification).
 * Deux NC majeures, donc un refus.
 */
async function regleCatalogueCertifiantIncoherent(now: Date): Promise<AlerteCandidate[]> {
  void now;

  const [nbAvecCodeCertification, formationsTypees] = await Promise.all([
    prisma.formation.count({
      where: {
        certificationType: { not: "aucune" },
        OR: [{ codeRncp: { not: null } }, { codeRs: { not: null } }],
      },
    }),
    // Même lecture que celle qui pilote `indicateursApplicables` : c'est la
    // comparaison de CES deux signaux-là qui a un sens, pas d'un équivalent.
    prisma.formation.findMany({ select: { typesActionQualiopi: true }, take: 200 }),
  ]);

  if (nbAvecCodeCertification === 0) return [];

  const declareCertifiante = formationsTypees.some((f) => {
    const types = f.typesActionQualiopi as unknown as string[] | null;
    return Array.isArray(types) && types.includes("certifiante");
  });

  if (declareCertifiante) return [];

  return [
    {
      code: "catalogue_certifiant_incoherent",
      niveau: "important",
      titre: "Le catalogue se contredit sur les actions certifiantes",
      message:
        `${nbAvecCodeCertification} formation(s) portent un code RNCP/RS, mais aucune n'est ` +
        "déclarée comme action certifiante. La console affiche donc « formation certifiante » " +
        "comme preuve de l'indicateur 1 tout en déclarant les indicateurs 3, 7 et 16 « non " +
        "applicables » — un auditeur voit la contradiction sans ouvrir un dossier. " +
        "Deux issues, et c'est une décision : soit le périmètre certifié inclut ces actions " +
        "(alors 7 et 16 deviennent des NC MAJEURES tant qu'aucune preuve n'existe), soit il " +
        "ne les inclut pas et il faut retirer le code RNCP/RS de ces formations.",
    },
  ];
}

/**
 * R01d — Mentions légales obligatoires absentes des FACTURES.
 *
 * 🔴 `D9-3-02` (2026-08-20). Forme juridique, capital social, RCS et n° de TVA
 * intracommunautaire sont des mentions obligatoires de facture
 * (art. R123-238 C. com. ; art. 242 nonies A ann. II CGI). Elles étaient
 * imprimées **conditionnellement** et gardées par RIEN : absentes de la
 * configuration, elles disparaissaient du PDF sans que personne ne le sache.
 *
 * 🔑 L'omission du n° de TVA sur une facture au-delà de 150 € est
 * **sanctionnée** (art. 1737 CGI). Ce n'est pas un défaut de présentation.
 *
 * ⚠️ Le gabarit affiche désormais « Non renseigné » au lieu d'omettre — mais un
 * avertissement imprimé sur une facture qui part au client n'est pas une
 * solution, c'est un signal. Cette règle est ce qui le transforme en geste.
 *
 * ⚠️ La TVA n'est exigée QUE sous le régime `assujetti` : sous exonération
 * 261-4-4° ou franchise 293 B, l'organisme n'a pas de numéro à porter, et
 * l'exiger produirait une alerte fausse à chaque facture — ce qui apprend à
 * ignorer la catégorie.
 */
async function regleMentionsFacture(now: Date): Promise<AlerteCandidate[]> {
  void now;
  const identite = await getOrganismeIdentite();
  const regime = await getQualiopiConfig("regime_tva");

  const manquantes: string[] = [];
  if (!identite.formeJuridique?.trim()) manquantes.push("forme juridique");
  if (!identite.capitalSocial?.trim()) manquantes.push("capital social");
  if (!identite.rcsVille?.trim()) manquantes.push("RCS et ville d'immatriculation");
  if (regime === "assujetti" && !identite.tvaIntracom?.trim()) {
    manquantes.push("n° de TVA intracommunautaire");
  }
  if (manquantes.length === 0) return [];

  return [
    {
      code: "facture_mentions_legales_absentes",
      niveau: "critique",
      titre: "Mentions obligatoires absentes des factures",
      message:
        `${manquantes.length} mention${manquantes.length > 1 ? "s" : ""} obligatoire${manquantes.length > 1 ? "s" : ""} ` +
        `de facture ${manquantes.length > 1 ? "sont absentes" : "est absente"} de la configuration : ` +
        `${manquantes.join(", ")}. Toute facture émise est irrégulière (art. R123-238 C. com., ` +
        `art. 242 nonies A CGI) et porte « Non renseigné » en clair. ` +
        `L'omission du n° de TVA au-delà de 150 € est en outre sanctionnée (art. 1737 CGI). ` +
        `À compléter dans la configuration de l'identité légale.`,
    },
  ];
}

/** R02 — Réclamations sans réponse depuis > N jours (N = seuil_reclamation_jours, défaut 15). */
async function regleReclamationsSansReponse(now: Date): Promise<AlerteCandidate[]> {
  const joursCfg = await getQualiopiConfig("seuil_reclamation_jours").catch(() => 15);
  const jours = typeof joursCfg === "number" && joursCfg > 0 ? joursCfg : 15;
  const seuil = daysAgo(jours, now);
  const reclamations = await prisma.reclamation.findMany({
    where: {
      statut: { in: ["nouvelle", "en_cours"] },
      dateReception: { lte: seuil },
      dateReponse: null,
    },
    select: { id: true, numero: true, reclamantNom: true, dateReception: true },
  });
  return reclamations.map((r) => ({
    code: "reclamation_sans_reponse_j15",
    niveau: "critique" as AlerteNiveau,
    titre: "Réclamation sans réponse depuis +15 jours",
    message: `La réclamation ${r.numero} de ${r.reclamantNom} (reçue le ${r.dateReception.toLocaleDateString("fr-FR")}) n'a pas encore de réponse.`,
    cibleType: "Reclamation",
    cibleId: r.id,
  }));
}

/**
 * R03 — Émargements manquants : session realisee + enrollment sans trace > 48h.
 *
 * 🔴 `D2-3-C2` (2026-08-20). Cette règle filtrait sur `emargementSigneAt: null`
 * seul. Or ce champ n'est posé QUE par la grille présentielle : l'import d'un
 * relevé de connexion ne l'écrit jamais (`actions/qualiopi/presence.ts`, il
 * appelle `recomputeTauxPresence` et s'arrête là).
 *
 * Toute session 100 % distancielle correctement menée levait donc une alerte
 * CRITIQUE **par stagiaire**, chacune partant par e-mail, alors que le relevé
 * était importé, le taux calculé et le fichier archivé avec son empreinte.
 *
 * Le prédicat vient maintenant de `trace-cloture.ts`, qui portait déjà la bonne
 * définition — et qui l'appliquait, lui, depuis le début.
 */
async function regleEmargementManquant(now: Date): Promise<AlerteCandidate[]> {
  const threshold = daysAgo(2, now); // 48h
  const enrollments = await prisma.enrollment.findMany({
    where: {
      session: { statut: "realisee", dateFin: { lte: threshold } },
      statut: { in: ["planifiee", "presente"] },
      ...sansAucuneTraceDePresence(),
    },
    select: {
      id: true,
      trainee: { select: { nom: true, prenom: true } },
      session: { select: { id: true, numero: true } },
    },
  });
  return enrollments.map((e) => ({
    code: "emargement_manquant",
    niveau: "critique" as AlerteNiveau,
    titre: "Émargement manquant (session réalisée)",
    message: `L'émargement de ${e.trainee.prenom} ${e.trainee.nom} est manquant pour la session ${e.session.numero} (réalisée il y a >48h).`,
    cibleType: "Enrollment",
    cibleId: e.id,
  }));
}

/**
 * R03ter — Session bloquée en `en_cours` faute d'émargement.
 *
 * Comble un angle mort : `regleEmargementManquant` (R03) filtre sur
 * `session.statut = "realisee"`, mais la clôture automatique
 * (`qualiopi-formation-crons-worker.ts`) refuse précisément de passer une session
 * en `realisee` tant qu'aucun inscrit n'a de trace de présence. Une session
 * totalement non émargée ne pouvait donc déclencher NI la clôture, NI R03 : elle
 * restait indéfiniment `en_cours`, absente du BPF, des attestations et des
 * indicateurs, sans le moindre signal.
 *
 * Seuil à 72 h après `dateFin` — au-delà de la fenêtre de 24 h de la clôture
 * automatique, pour ne pas doublonner avec elle sur un simple décalage de cron.
 */
async function regleSessionBloqueeEnCours(now: Date): Promise<AlerteCandidate[]> {
  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: "en_cours",
      // Fenêtre GLISSANTE, pas seulement un plancher : sans borne haute, le
      // premier passage du cron remonterait d'un coup TOUTES les sessions jamais
      // clôturées depuis la mise en service — une salve d'alertes critiques qui
      // noierait les vraies (chaque alerte critique déclenche un e-mail).
      dateFin: { lte: daysAgo(3, now), gte: daysAgo(365, now) },
      // Le motif est VÉRIFIÉ, pas supposé : aucun inscrit ne porte de trace de
      // présence. Sans cette clause, une session restée « en cours » pour une
      // autre raison (clôture refusée sur le financement, dateFin non mise à
      // jour, session de démo) déclencherait une alerte qui MENT sur son
      // diagnostic, et l'administrateur chercherait un émargement qui existe.
      enrollments: {
        none: {
          OR: [{ emargementSigneAt: { not: null } }, { tauxPresencePct: { not: null } }],
        },
      },
      // ⚠️ Une session SANS AUCUN inscrit satisfait aussi `enrollments: { none }`.
      // Elle n'a pourtant rien à émarger — le worker la clôture sans garde.
      // Prisma ne sait pas filtrer sur un `_count` dans le `where` : le tri se
      // fait après lecture (voir le `.filter` ci-dessous), sinon le message
      // afficherait « aucun émargement pour ses 0 inscrit(s) ».
    },
    select: {
      id: true,
      numero: true,
      titreSession: true,
      client: { select: { raisonSociale: true } },
      _count: { select: { enrollments: true } },
    },
    take: 50,
  });

  return sessions
    .filter((s) => s._count.enrollments > 0)
    .map((s) => ({
      code: "session_bloquee_en_cours",
      niveau: "critique" as AlerteNiveau,
      titre: "Session non clôturée faute d'émargement",
      message:
        `La session ${designerSession(s)} est terminée depuis plus de 72 h mais reste « en cours » : ` +
        `aucun de ses ${s._count.enrollments} inscrit${s._count.enrollments > 1 ? "s" : ""} ne porte de trace de présence. ` +
        `Tant qu'elle n'est pas clôturée, elle n'alimente ni le BPF, ni les attestations, ni les indicateurs.`,
      cibleType: "TrainingSession",
      cibleId: s.id,
    }));
}

/**
 * Désignation d'une session dans un message d'alerte : son numéro ET son client.
 *
 * 🔴 Les alertes ne nommaient que le numéro (« la session AXI-SESS-2026-001 »).
 * Il fallait ouvrir la fiche pour savoir de QUI il s'agit — sur trois sessions
 * c'est pénible, sur trente c'est inutilisable, et le lecteur ne peut pas
 * arbitrer l'urgence sans connaître le client. Quand aucun client n'est
 * rattaché, on le DIT : c'est souvent l'anomalie elle-même.
 */
function designerSession(s: {
  numero: string;
  titreSession?: string | null;
  client?: { raisonSociale: string } | null;
}): string {
  const qui = s.client?.raisonSociale ?? "aucun client rattaché";
  return s.titreSession != null && s.titreSession !== ""
    ? `${s.numero} « ${s.titreSession} » (${qui})`
    : `${s.numero} (${qui})`;
}

/** R03bis — Session sans formateur : démarre sous 7 jours, aucun formateur principal assigné. */
/**
 * R03quater — LA SESSION A COMMENCÉ ET PERSONNE NE PEUT SIGNER.
 *
 * 🔴 Le trou constaté sur le premier dossier réel, AXI-SESS-2026-005 : la
 * stagiaire n'a jamais pu émarger, et **aucune alerte ne pouvait le signaler
 * tant qu'il était encore temps**.
 *
 *   · R03 `emargement_manquant` exige `statut = "realisee"`. Or la clôture
 *     automatique refuse de passer en `realisee` une session dont aucun inscrit
 *     ne porte de trace de présence (`skippedSansEmargement`). Une session non
 *     émargée reste `en_cours` — R03 ne la voit donc JAMAIS. La garde qui
 *     protège la clôture aveugle l'alerte qui devait la surveiller.
 *   · R03ter `session_bloquee_en_cours` attend `dateFin ≤ now − 3 j`, soit un
 *     jour APRÈS l'expiration des jetons (fenêtre de 48 h après la fin).
 *
 * Les deux CONSTATENT après coup. Celle-ci se lève pendant que le rattrapage
 * est encore possible : émettre les liens et les envoyer prend deux minutes le
 * jour même, et rien du tout trois jours plus tard.
 *
 * ⚠️ Le diagnostic est VÉRIFIÉ, pas supposé : on exige qu'il y ait des inscrits
 * ET qu'aucun d'eux n'ait de jeton vivant. Une session sans inscrit n'a rien à
 * faire signer ; une session dont les jetons ont été volontairement révoqués
 * (report, annulation) ne relève pas de cette alerte non plus — elle sera
 * couverte par sa propre trajectoire.
 */
/**
 * Session commencée, liens d'émargement VIVANTS, et pas une seule signature.
 *
 * 🔴 C'est l'angle mort que les trois autres règles laissaient ouvert, et il
 * est ouvert PAR le cron de 06:00 : celui-ci crée les jetons, ce qui éteint
 * `session_sans_dispositif_emargement` (qui exige l'absence de jeton vivant).
 * La session disparaît alors de toute surveillance jusqu'à J+3.
 *
 * ⚠️ On teste l'ÉTAT réel — `emargementSigneAt` sur les inscriptions —, pas
 * l'existence du dispositif. Avoir posé le dispositif n'est pas avoir émargé,
 * et c'est exactement la confusion qui rendait la session invisible.
 *
 * La borne haute est `dateFin + 48 h` : au-delà, les jetons ont expiré, le
 * geste n'est plus possible, et `session_bloquee_en_cours` prend le relais pour
 * CONSTATER. Alerter après ferait crier une alerte qui ne sert plus à rien —
 * et une alerte qui crie sans issue cesse d'être lue.
 */
async function regleEmargementAucuneSignature(now: Date): Promise<AlerteCandidate[]> {
  const finJetons = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: { in: ["planifiee", "en_cours"] },
      dateDebut: { lte: now },
      // Fenêtre encore rattrapable : les jetons vivent 48 h après la fin.
      dateFin: { gte: finJetons },
      AND: [
        // Il y a bien quelqu'un à faire signer.
        { enrollments: { some: { ...inscriptionsActives() } } },
        // Le dispositif EST en place — c'est ce qui distingue cette règle de
        // `session_sans_dispositif_emargement`, sa jumelle en négatif.
        {
          enrollments: {
            some: { emargementTokens: { some: { revokedAt: null, expiresAt: { gt: now } } } },
          },
        },
        // Et personne ne porte la moindre trace de présence.
        //
        // 🔴 `D2-3-C2` — on lisait ici `emargementSigneAt` SEUL. Ce champ n'est
        // posé que par la grille présentielle ; l'import d'un relevé de connexion
        // ne l'écrit pas. Une session distancielle dont le relevé était importé
        // restait donc « sans aucune signature » aux yeux de cette règle, et
        // criait en critique jusqu'à l'expiration des jetons.
        //
        // ⚠️ Fenêtre résiduelle ASSUMÉE : entre la fin d'une session distancielle
        // et l'import de son relevé, aucune trace n'existe encore — l'alerte se
        // lève, et elle a raison de le faire : à cet instant, rien ne prouve que
        // la session a eu lieu. Elle s'éteint d'elle-même dès l'import
        // (`resolutionAuto`).
        { enrollments: { none: porteUneTraceDePresence() } },
      ],
    },
    select: { id: true, numero: true, titreSession: true, dateDebut: true, dateFin: true },
    take: 100,
  });

  return sessions.map((s) => ({
    code: "emargement_aucune_signature" as const,
    niveau: "critique" as const,
    titre: "Lien d'émargement émis, aucune signature",
    // 🔴 Ce message affirmait « les liens sont EN CIRCULATION ». La condition
    // au-dessus ne lit qu'un JETON vivant : elle sait qu'un lien a été
    // FABRIQUÉ, pas qu'il a été envoyé. La première chose à vérifier est donc
    // que l'envoi a eu lieu — pas de relancer quelqu'un qui n'a rien reçu.
    message:
      `Session ${s.numero}${s.titreSession ? ` — ${s.titreSession}` : ""} : un lien de signature ` +
      `existe depuis le ${s.dateDebut.toLocaleDateString("fr-FR")} et PERSONNE n'a signé. ` +
      `⚠️ Vérifiez D'ABORD que le lien a bien été ENVOYÉ : le fabriquer et l'envoyer sont deux ` +
      `gestes distincts, et cette alerte ne sait pas si l'envoi a eu lieu. ` +
      `Les jetons expirent 48 h après le ${s.dateFin.toLocaleDateString("fr-FR")} : après, ` +
      `l'émargement ne sera plus rattrapable et l'écart devra être consigné (ind. 12).`,
    cibleType: "TrainingSession" as const,
    cibleId: s.id,
  }));
}

/**
 * 🔴 2026-08-24, cahier D5 — le rappel J-7 n'a jamais été envoyé.
 *
 * La mesure existait, dans le cron ; elle sortait en `console.error`. Un journal
 * de conteneur n'est lu par personne le lendemain matin, et le rappel J-7 porte
 * les informations logistiques finales — lieu, horaires, accès. Le certificateur
 * vérifie que le stagiaire a bien été informé.
 *
 * ⚠️ `niveau: "important"` et non `critique` : le geste n'est PLUS posable
 * (après le début, rappeler n'informe plus personne). C'est un écart à
 * consigner, pas une urgence à traiter dans l'heure. La doctrine du catalogue
 * est explicite — réserver `critique` aux manquements rend les alertes
 * critiques crédibles.
 */
/**
 * 🔴 2026-08-25, cahier D3-4 — une journée déclarée sans ses créneaux.
 *
 * Le taux de présence a pour dénominateur les créneaux **existants**, pas les
 * journées déclarées. Une journée sans créneaux disparaît donc du calcul, et le
 * taux affiche 100 % sur une session à moitié couverte — sur un chiffre qui
 * part ensuite sur l'attestation et le certificat de réalisation.
 *
 * ⚠️ `niveau: "important"` et non `critique` : le geste EXISTE et il est
 * immédiat (bouton « Générer les créneaux »). Ce n'est pas un manquement, c'est
 * une tâche à poser. Réserver `critique` aux manquements rend les alertes
 * critiques crédibles — doctrine écrite du catalogue.
 */
async function regleJourneeSansCreneaux(now: Date): Promise<AlerteCandidate[]> {
  const sessions = await sessionsAvecJourneesSansCreneaux(now);
  return sessions.map((s) => ({
    code: "journee_sans_creneaux" as const,
    niveau: "important" as const,
    titre: "Journée déclarée sans créneau de présence",
    message:
      `Session ${s.numero}${s.titreSession ? ` — ${s.titreSession}` : ""} : ` +
      `${s.demiJourneesManquantes.length} demi-journée(s) sur ${s.demiJourneesAttendues} ` +
      `n'ont AUCUN créneau de présence (${s.demiJourneesManquantes.slice(0, 4).join(", ")}` +
      `${s.demiJourneesManquantes.length > 4 ? "…" : ""}). ` +
      `Personne ne peut y émarger, et surtout : le taux de présence se calcule sur les ` +
      `créneaux EXISTANTS — ces demi-journées sont donc absentes du dénominateur, et le ` +
      `taux affiché est trop élevé. Il part ensuite sur l'attestation et le certificat de ` +
      `réalisation. Geste : « Générer les créneaux » sur la fiche session.`,
    cibleType: "TrainingSession" as const,
    cibleId: s.id,
  }));
}

async function regleRappelJ7NonEnvoye(now: Date): Promise<AlerteCandidate[]> {
  const sessions = await sessionsSansRappelJ7(now);
  return sessions.map((s) => ({
    code: "rappel_j7_non_envoye" as const,
    niveau: "important" as const,
    titre: "Rappel J-7 jamais envoyé",
    message:
      `Session ${s.numero}${s.titreSession ? ` — ${s.titreSession}` : ""} : commencée le ` +
      `${s.dateDebut.toLocaleDateString("fr-FR")} sans qu'aucun rappel J-7 ne soit parti. ` +
      `Le rappel porte les informations logistiques finales (lieu, horaires, accès) ; ` +
      `après le début, il n'est plus envoyable. L'écart est à consigner : le certificateur ` +
      `vérifie que le stagiaire a été informé.`,
    cibleType: "TrainingSession" as const,
    cibleId: s.id,
  }));
}

async function regleSessionSansDispositifEmargement(now: Date): Promise<AlerteCandidate[]> {
  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: { in: ["planifiee", "en_cours"] },
      // Elle a commencé, et pas il y a un mois : fenêtre glissante de 7 jours,
      // pour la même raison que R03ter — sans borne haute, le premier passage
      // remonterait toutes les sessions jamais émargées de l'historique.
      dateDebut: { lte: now, gte: daysAgo(7, now) },
      AND: [
        // Il y a bien quelqu'un à faire signer.
        { enrollments: { some: { ...inscriptionsActives() } } },
        // Et personne n'a de lien vivant.
        {
          enrollments: {
            none: {
              emargementTokens: { some: { revokedAt: null, expiresAt: { gt: now } } },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      numero: true,
      titreSession: true,
      dateDebut: true,
      client: { select: { raisonSociale: true } },
      _count: { select: { enrollments: true, jours: true } },
    },
    take: 50,
  });

  return sessions.map((s) => {
    // Le message NOMME la cause première : sans journées déclarées, l'émission
    // des liens est refusée à la racine (`creerTokenInscription` lève). Dire
    // « aucun lien émis » sans dire pourquoi enverrait chercher au mauvais
    // endroit.
    const causePremiere =
      s._count.jours === 0
        ? "Aucune journée n'est déclarée : l'émission des liens sera refusée tant que ce n'est pas fait. Déclarez les journées, générez les créneaux, puis envoyez les liens."
        : "Les journées sont déclarées : émettez les liens et envoyez-les aux stagiaires.";
    return {
      code: "session_sans_dispositif_emargement",
      niveau: "critique" as AlerteNiveau,
      titre: "Session en cours sans dispositif de signature",
      message:
        `La session ${designerSession(s)} a commencé et aucun de ses ${s._count.enrollments} ` +
        `inscrit${s._count.enrollments > 1 ? "s" : ""} ne dispose d'un lien de signature valide. ` +
        `Personne ne peut émarger. ${causePremiere} ` +
        `Les liens expirent 48 h après la fin de la session : passé ce délai, la feuille restera vierge.`,
      cibleType: "TrainingSession",
      cibleId: s.id,
    };
  });
}

async function regleSessionSansFormateur(now: Date): Promise<AlerteCandidate[]> {
  const horizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: { in: ["planifiee", "en_cours"] },
      // 🔴 Vérification E2E 2026-07-26 — `lte: horizon` seul n'avait PAS de borne
      // basse : toute session sans formateur, si ancienne soit-elle, ressortait
      // avec le message « démarre le <date passée> ». C'est exactement le piège
      // que `regleSessionBloqueeEnCours` garde déjà (`gte: daysAgo(365)`).
      dateDebut: { lte: horizon, gte: daysAgo(365, now) },
      formateurPrincipalId: null,
    },
    select: {
      id: true,
      numero: true,
      titreSession: true,
      dateDebut: true,
      client: { select: { raisonSociale: true } },
    },
  });
  return sessions.map((s) => {
    // 🔴 Le titre et le verbe étaient figés au FUTUR (« à J-7 », « démarre le »)
    // alors que la borne basse de 365 jours — volontaire, pour qu'une vraie
    // non-conformité ne disparaisse pas en silence — fait remonter des sessions
    // commencées depuis des semaines. Une alerte qui annonce au futur un fait
    // passé se lit comme une erreur du système, et on cesse de la lire.
    const passee = s.dateDebut.getTime() < now.getTime();
    const date = s.dateDebut.toLocaleDateString("fr-FR");
    return {
      code: "session_sans_formateur",
      // 🔴 2026-09-05 (audit du moteur, trou n°10) — le niveau était FIXE à
      // `important`, y compris sur « a démarré sans formateur principal ». Or
      // c'est le seul état vers lequel les quatre alertes critiques du cycle
      // formateur se rabattent une fois la session commencée : elles s'éteignent
      // toutes à `dateDebut`, et celle-ci reprend — en DESSOUS. Une session qui
      // démarre sans personne descendait donc d'un cran au pire moment.
      // `formateur_mission_expiree`, où l'affectation TIENT ENCORE, est
      // catalogué critique : l'écart de niveau disait l'inverse du réel.
      niveau: (passee ? "critique" : "important") as AlerteNiveau,
      titre: passee
        ? "Session démarrée sans formateur principal"
        : "Session à J-7 sans formateur principal",
      message: passee
        ? `La session ${designerSession(s)} a démarré le ${date} sans formateur principal assigné. L'habilitation est requise AVANT animation : l'obligation n'est plus imminente, elle est dépassée.`
        : `La session ${designerSession(s)} démarre le ${date} sans formateur principal assigné (habilitation requise avant animation).`,
      cibleType: "TrainingSession",
      cibleId: s.id,
    };
  });
}

/**
 * R03quinquies — Sorties de démonstration non prêtes pour une session imminente.
 *
 * Le classeur imprimé promet au formateur un filet : « quand l'outil tombe, les
 * sorties sont imprimées dans le kit ». Ces sorties se produisent session par
 * session — et rien ne rappelait de les faire. Un filet qu'on oublie de tendre
 * ne se remarque qu'au moment de la chute, devant la salle.
 *
 * Deux états distincts, deux messages : ne RIEN avoir produit, ou avoir produit
 * sans que personne n'ait relu. Le second est le plus traître, parce qu'il
 * ressemble à du travail fait — or les fiches promettent que « les sorties du
 * kit ont été vérifiées », et une démonstration peut rater sans que le modèle
 * le signale.
 *
 * PAS d'alerte quand la formation n'a pas de classeur publié : il n'y aurait
 * rien à préparer, et une alerte insoluble apprend à ignorer les alertes —
 * c'est la garde que `regleDiaporamaManquant` pose déjà pour les formations
 * sur-mesure.
 */
async function regleSortiesKitNonPretes(now: Date): Promise<AlerteCandidate[]> {
  const horizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: { in: ["planifiee", "en_cours"] },
      // Borne basse comme les règles voisines : sans elle, la première
      // exécution remonterait tout l'historique d'un coup.
      dateDebut: { lte: horizon, gte: daysAgo(365, now) },
    },
    select: {
      id: true,
      numero: true,
      titreSession: true,
      dateDebut: true,
      formationId: true,
      client: { select: { raisonSociale: true } },
      kitSorties: { select: { sorties: true, valideLe: true } },
    },
    take: 50,
  });

  const candidates: AlerteCandidate[] = [];
  for (const s of sessions) {
    const kitPublie =
      (await prisma.supportFormation.count({
        where: {
          formationId: s.formationId,
          type: "kit_formateur_imprime",
          pdfKey: { not: null },
        },
      })) > 0;
    if (!kitPublie) continue;

    const nbSorties = Array.isArray(s.kitSorties?.sorties) ? s.kitSorties.sorties.length : 0;
    const validees = s.kitSorties?.valideLe != null;
    if (nbSorties > 0 && validees) continue;

    const date = s.dateDebut.toLocaleDateString("fr-FR");
    const passee = s.dateDebut.getTime() < now.getTime();
    const quand = passee ? `a démarré le ${date}` : `démarre le ${date}`;

    candidates.push({
      code: "kit_sorties_non_pretes",
      niveau: "important" as AlerteNiveau,
      titre:
        nbSorties === 0
          ? "Sorties de démonstration non produites"
          : "Sorties de démonstration non relues",
      message:
        nbSorties === 0
          ? `La session ${designerSession(s)} ${quand} sans ses sorties de démonstration. Si l'outil tombe en salle, le formateur n'a pas de repli : produisez-les depuis la page de la session.`
          : `La session ${designerSession(s)} ${quand} avec ${nbSorties} sorties produites mais que personne n'a relues. Le classeur promet au formateur qu'elles ont été vérifiées — une démonstration ratée ne se découvre qu'en salle.`,
      cibleType: "TrainingSession",
      cibleId: s.id,
    });
  }
  return candidates;
}

/**
 * R03quater — Diaporama de salle non déposé pour une session imminente.
 *
 * Le slot `diaporama` du kit documentaire est LE .pptx projeté en salle — le
 * fil conducteur de la séance. Une session qui démarre sous 7 jours sans
 * diaporama déposé dans la bibliothèque, c'est un formateur qui réclamera le
 * fichier la veille (ou improvisera).
 *
 * ⚠️ La jointure Formation ↔ kit n'existe QUE par convention
 * (`Formation.slug === interventionSlug`) : elle est résolue STRICTEMENT par
 * `resolveInterventionSlugForFormation`, jamais devinée. Si le slug n'est pas
 * résolvable (formation sur-mesure ou dupliquée `slug-copie`), PAS d'alerte :
 * ces formations n'ont pas de kit dans la bibliothèque, le formateur dépose
 * son support où il veut — alerter exigerait un dépôt à un emplacement qui
 * n'existe pas, et une alerte insoluble apprend à ignorer les alertes.
 *
 * « Déposé » = une version COURANTE publiée (`currentVersionId` non nul) : une
 * ligne de slot sans version est un emplacement vide, pas un dépôt.
 */
async function regleDiaporamaManquant(now: Date): Promise<AlerteCandidate[]> {
  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: { in: ["planifiee", "en_cours"] },
      // Mêmes bornes que R03bis : horizon J-7, borne basse 365 jours (sans
      // elle, le premier passage remonterait tout l'historique d'un coup).
      dateDebut: { lte: daysFromNow(7, now), gte: daysAgo(365, now) },
    },
    select: {
      id: true,
      numero: true,
      titreSession: true,
      statut: true,
      dateDebut: true,
      client: { select: { raisonSociale: true } },
      formation: { select: { slug: true } },
    },
  });

  // Dépôts réels des slugs candidats, en UNE lecture : elle sert deux fois —
  // à reconnaître qu'un kit existe (même si son slug n'est plus au catalogue,
  // cf. `kit-formation.ts`) et à savoir si le diaporama y est.
  const slugsSessions = [
    ...new Set(sessions.map((s) => s.formation?.slug).filter((s): s is string => Boolean(s))),
  ];
  const docs =
    slugsSessions.length > 0
      ? await prisma.interventionDocument.findMany({
          where: { interventionSlug: { in: slugsSessions }, currentVersionId: { not: null } },
          select: { interventionSlug: true, slot: true },
        })
      : [];
  const slugsAvecKit = new Set(docs.map((d) => d.interventionSlug));
  const slugsDeposes = new Set(
    docs.filter((d) => d.slot === "diaporama").map((d) => d.interventionSlug),
  );

  // Garde applicative doublant le `where` (les mocks de test ignorent le SQL),
  // puis résolution du slug kit — fail-visible : pas de kit, pas d'alerte.
  const candidates = sessions.flatMap((s) => {
    if (s.formation == null) return [];
    if (s.statut !== "planifiee" && s.statut !== "en_cours") return [];
    if (s.dateDebut > daysFromNow(7, now) || s.dateDebut < daysAgo(365, now)) return [];
    const slug = resolveInterventionSlugForFormation(s.formation, slugsAvecKit);
    if (slug === null) return [];
    return [{ session: s, slug }];
  });
  if (candidates.length === 0) return [];

  return candidates
    .filter((c) => !slugsDeposes.has(c.slug))
    .map(({ session: s, slug }) => {
      // Même règle de langue que R03bis : une session déjà démarrée se dit au
      // passé — une alerte qui annonce au futur un fait accompli cesse d'être lue.
      const passee = s.dateDebut.getTime() < now.getTime();
      const date = s.dateDebut.toLocaleDateString("fr-FR");
      return {
        code: "diaporama_manquant_session",
        niveau: "important" as AlerteNiveau,
        titre: "Diaporama non déposé pour une session imminente",
        message: passee
          ? `La session ${designerSession(s)} a démarré le ${date} sans diaporama de salle déposé : déposer le .pptx dans Documents interventions → Formations → ${slug} (slot « Diaporama formateur »).`
          : `La session ${designerSession(s)} démarre le ${date} et le diaporama de salle (.pptx) n'est pas déposé : le déposer dans Documents interventions → Formations → ${slug} (slot « Diaporama formateur »).`,
        cibleType: "TrainingSession",
        cibleId: s.id,
      };
    });
}

/**
 * 🔴 LA CONVOCATION VA PARTIR MUETTE.
 *
 * Trouvé en recette le 2026-09-03/04. `convocation-formateur.ts` transporte
 * fidèlement le contact sur place et les consignes d'accès jusqu'au formateur —
 * quand ils sont saisis. Vides, `optionnel()` les omet, et l'e-mail rend une
 * adresse et une salle sans personne à demander ni manière d'entrer. Il a l'air
 * complet ; il est inutilisable à la porte. Aucune alerte ne le disait.
 *
 * ## Pourquoi J-14 et pas J-7
 *
 * 🔴 Le délai est le cœur de cette règle, pas un réglage. La convocation part
 * dans la fenêtre {@link FENETRE_CONVOCATION_J7_JOURS} (7,5 j) : une alerte
 * levée à J-7 arriverait **le jour même où l'e-mail muet s'envole**, et ne
 * servirait à rien. Il faut le temps d'appeler le client, et de le rappeler
 * s'il ne répond pas du premier coup — d'où deux fois la fenêtre de convocation.
 * `alerte-avant-la-convocation.spec.ts` verrouille cette relation : si l'une des
 * deux constantes bouge sans l'autre, il rougit.
 *
 * ## Périmètre (arbitrage Will, 2026-09-04)
 *
 * - `sur_site` : sans contact NI consignes, le formateur reste devant la porte.
 *   Manquer l'un des deux suffit à lever, en `important` ;
 * - `distanciel` : pas de porte à franchir, mais quelqu'un à joindre si le lien
 *   ne s'ouvre pas. Seul le contact compte, et en `info` — c'est gênant, pas
 *   bloquant ;
 * - `nos_locaux` : jamais. L'hôte, c'est l'organisme lui-même ;
 * - `lieuType` non renseigné : jamais non plus. Une session sans lieu du tout
 *   est un autre défaut, et le signaler ici le noierait dans celui-ci.
 *
 * ## Ce qu'elle DIT change une fois l'e-mail parti
 *
 * Tant que `convocationJ7EnvoyeeAt` est vide, il est encore temps : le message
 * demande de renseigner. Une fois la trace posée, le mal est fait et l'action
 * n'est plus la même — il faut rappeler le formateur. Une alerte qui continue à
 * dire « renseignez avant l'envoi » après l'envoi se fait ignorer.
 */
async function regleContactSurPlaceAbsent(now: Date): Promise<AlerteCandidate[]> {
  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: "planifiee",
      // Bornée au FUTUR : une fois la session commencée, le formateur est
      // arrivé — ou pas — et il n'y a plus rien à saisir. Ce qui suit relève de
      // l'émargement et du registre des incidents, pas de cette alerte.
      dateDebut: { gt: now, lte: daysFromNow(FENETRE_CONTACT_SUR_PLACE_JOURS, now) },
      lieuType: { in: ["sur_site", "distanciel"] },
    },
    select: {
      id: true,
      numero: true,
      titreSession: true,
      dateDebut: true,
      lieuType: true,
      contactSurPlaceNom: true,
      contactSurPlaceTelephone: true,
      consignesAcces: true,
      client: { select: { raisonSociale: true } },
      sessionFormateurs: { select: { convocationJ7EnvoyeeAt: true } },
    },
  });

  const rempli = (v: string | null): boolean => (v ?? "").trim().length > 0;

  return sessions.flatMap((s) => {
    // Garde applicative doublant le `where` — les mocks de test ignorent le SQL.
    if (s.lieuType !== "sur_site" && s.lieuType !== "distanciel") return [];

    const contactManquant = !rempli(s.contactSurPlaceNom) && !rempli(s.contactSurPlaceTelephone);
    const consignesManquantes = !rempli(s.consignesAcces);
    const surSite = s.lieuType === "sur_site";
    if (!contactManquant && !(surSite && consignesManquantes)) return [];

    // Nommer CE QUI manque, jamais « informations incomplètes » : le lecteur
    // doit savoir quoi demander au client sans rouvrir la fiche.
    const manques = [
      // 🔴 Le nom du champ (`contactSurPlaceNom`) n'est pas le mot de
      // l'écran. « Sur place » suppose un lieu où se présenter ; en visio il n'y
      // en a pas, et l'agent qui lit ça ne sait pas ce qu'il doit demander au
      // client. Ce qu'on cherche est le même champ, mais ce qu'il SERT n'est
      // pas la même chose : entrer d'un côté, joindre de l'autre.
      contactManquant
        ? surSite
          ? "aucun contact sur place (ni nom ni téléphone)"
          : "aucun contact à joindre (ni nom ni téléphone)"
        : null,
      surSite && consignesManquantes ? "aucune consigne d'accès" : null,
    ].filter((m): m is string => m !== null);

    const dejaConvoque = s.sessionFormateurs.some((sf) => sf.convocationJ7EnvoyeeAt !== null);
    const date = s.dateDebut.toLocaleDateString("fr-FR");
    const quoi = manques.join(" et ");

    // 🔴 Vu à l'écran le 2026-09-04, pas dans les tests : la première version
    // servait UNE seule phrase aux deux modalités, et le distanciel héritait des
    // mots de la porte — « muette sur la manière d'entrer », « personne à
    // demander en arrivant ». Il n'y a pas de porte dans une visio, et l'agent
    // qui lit ça ne sait plus ce qu'il doit demander au client. Ce qui manque
    // n'est pas le même manque : sur site on ne peut pas ENTRER, en distanciel
    // on n'a personne à JOINDRE si le lien ne s'ouvre pas.
    const consequence = surSite
      ? "il aura l'adresse et la salle, personne à demander à l'accueil et aucune manière d'entrer"
      : "il n'aura personne à joindre si le lien ne s'ouvre pas";
    const resteADemander = surSite ? "Demandez-les au client" : "Demandez-le au client";

    // 🔴 Vu à l'écran le 2026-09-04, APRÈS la correction du message : le TITRE,
    // lui, était resté commun aux deux modalités. Une session en visio s'affichait
    // donc en gras « Session sans contact sur place ni consignes d'accès », juste
    // au-dessus d'un message qui ne parle jamais de consignes — puisque la règle
    // ne les regarde pas en distanciel. Le titre CONTREDISAIT son propre
    // paragraphe, et il annonçait un manque là où il n'y en a pas. C'est la ligne
    // qu'on lit en premier : sur /qualiopi/a-traiter, seul le titre est en gras.
    //
    // Sur site non plus il ne peut pas être fixe : la règle lève dès qu'UN des deux
    // manque. Annoncer les deux quand seules les consignes manquent envoie
    // l'agent redemander au client un contact qu'il a déjà donné.
    const titre = surSite
      ? contactManquant && consignesManquantes
        ? "Session sur site sans contact ni consignes d'accès"
        : contactManquant
          ? "Session sur site sans contact sur place"
          : "Session sur site sans consignes d'accès"
      : "Session à distance sans personne à joindre";

    return [
      {
        code: "session_contact_sur_place_absent",
        niveau: (surSite ? "important" : "info") as AlerteNiveau,
        titre,
        message: dejaConvoque
          ? `La convocation du formateur pour ${designerSession(s)} (${date}) est DÉJÀ PARTIE avec ${quoi} : ${consequence}. Appelez-le, et complétez la fiche pour le rappel de la veille.`
          : `${designerSession(s)} démarre le ${date} avec ${quoi}. La convocation du formateur part sept jours avant : sans ces champs, ${consequence}. ${resteADemander}, puis complétez la fiche de session.`,
        cibleType: "TrainingSession",
        cibleId: s.id,
      },
    ];
  });
}

/** R04 — Satisfaction manquante : session realisee > 7 jours + questionnaire non rempli. */
async function regleSatisfactionManquante(now: Date): Promise<AlerteCandidate[]> {
  const threshold = daysAgo(7, now);
  const enrollments = await prisma.enrollment.findMany({
    where: {
      session: { statut: "realisee", dateFin: { lte: threshold } },
      statut: { in: ["planifiee", "presente"] },
      questionnaires: {
        none: {
          type: "satisfaction_chaud",
          reponduAt: { not: null },
        },
      },
    },
    select: {
      id: true,
      trainee: { select: { nom: true, prenom: true } },
      session: { select: { numero: true } },
    },
  });
  return enrollments.map((e) => ({
    code: "satisfaction_manquante",
    niveau: "important" as AlerteNiveau,
    titre: "Questionnaire de satisfaction non rempli",
    message: `Le questionnaire de satisfaction de ${e.trainee.prenom} ${e.trainee.nom} (session ${e.session.numero}) n'est pas rempli 7 jours après la session.`,
    cibleType: "Enrollment",
    cibleId: e.id,
  }));
}

/**
 * R04bis — Positionnement sans réponse à l'approche de la session (indicateur 8).
 *
 * 🔴 Le trou trouvé le 2026-08-17 en construisant la checklist du Lot 1 : sur
 * les quatorze étapes d'un dossier, DOUZE avaient déjà leur code d'alerte. Le
 * positionnement, non — alors qu'il porte un indicateur à lui seul (« analyse
 * du besoin du bénéficiaire avant l'entrée en formation ») et que c'est
 * précisément l'étape ratée sur le premier dossier réel : le questionnaire y a
 * été répondu APRÈS le début de la formation, où il ne positionne plus rien.
 *
 * ⚠️ La règle se déclenche à J-2, pas après. Un positionnement se recueille
 * AVANT la séance : signaler son absence une fois la session commencée
 * n'apporterait plus qu'un constat, et le plan est explicite — une alerte doit
 * GARDER, pas CONSTATER. C'est aussi pourquoi elle ne regarde que les sessions
 * `planifiee` : à `en_cours`, il est trop tard pour que le geste serve.
 *
 * `envoyeAt` et non `reponduAt` en premier critère : ce que l'organisme doit,
 * c'est l'ENVOI. Une non-réponse du stagiaire n'est pas une faute de
 * l'organisme ; l'absence de tentative tracée, si.
 */
async function reglePositionnementSansReponse(now: Date): Promise<AlerteCandidate[]> {
  const dansDeuxJours = daysFromNow(2, now);
  const enrollments = await prisma.enrollment.findMany({
    where: {
      session: {
        statut: "planifiee",
        dateDebut: { lte: dansDeuxJours, gte: now },
      },
      statut: { in: ["planifiee", "presente"] },
      questionnaires: {
        none: { type: "positionnement", reponduAt: { not: null } },
      },
    },
    select: {
      id: true,
      trainee: { select: { nom: true, prenom: true } },
      session: { select: { numero: true, dateDebut: true } },
      questionnaires: {
        where: { type: "positionnement" },
        select: { envoyeAt: true },
      },
    },
  });
  return enrollments.map((e) => {
    const envoye = e.questionnaires.some((q) => q.envoyeAt !== null);
    return {
      code: "positionnement_sans_reponse",
      niveau: "important" as AlerteNiveau,
      titre: "Questionnaire de positionnement sans réponse",
      // Deux situations, deux messages : « jamais envoyé » est un manquement de
      // l'organisme, « envoyé sans réponse » appelle une relance. Les
      // confondre ferait relancer un stagiaire qui n'a jamais rien reçu.
      message: envoye
        ? `Le positionnement de ${e.trainee.prenom} ${e.trainee.nom} (session ${e.session.numero}) a été envoyé mais reste sans réponse, à moins de 2 jours du début. Relancer.`
        : `Le positionnement de ${e.trainee.prenom} ${e.trainee.nom} (session ${e.session.numero}) n'a JAMAIS été envoyé, à moins de 2 jours du début (indicateur 8).`,
      cibleType: "Enrollment",
      cibleId: e.id,
    };
  });
}

/**
 * R04ter — Suivi à froid (J+30) sans réponse (indicateur 30).
 *
 * L'autre code manquant du 2026-08-17. Le recueil à froid est l'obligation la
 * plus facilement oubliée du parcours : elle tombe un mois après la fin, quand
 * le dossier a quitté tous les écrans.
 *
 * ⚠️ Fenêtre à J+37 et non J+30 : l'envoi automatique part à J+30, et le
 * signaler le jour même transformerait un envoi normal en alerte. Sept jours
 * laissent au stagiaire le temps de répondre — la même marge que la première
 * relance.
 *
 * 🔴 Et une borne ARRIÈRE à J+120. Sans elle, chaque session réalisée depuis
 * l'ouverture de l'organisme resterait candidate pour toujours : l'alerte
 * cesserait de dire « fais-le maintenant » pour devenir un inventaire des
 * regrets, et la liste se remplirait de lignes que personne ne peut solder.
 */
async function regleSuiviFroidManquant(now: Date): Promise<AlerteCandidate[]> {
  const borneHaute = daysAgo(37, now);
  const borneBasse = daysAgo(120, now);
  const enrollments = await prisma.enrollment.findMany({
    where: {
      session: {
        statut: "realisee",
        dateFin: { lte: borneHaute, gte: borneBasse },
      },
      statut: { in: ["planifiee", "presente"] },
      questionnaires: {
        none: { type: "satisfaction_froid", reponduAt: { not: null } },
      },
    },
    select: {
      id: true,
      trainee: { select: { nom: true, prenom: true } },
      session: { select: { numero: true } },
    },
  });
  return enrollments.map((e) => ({
    code: "suivi_froid_manquant",
    niveau: "important" as AlerteNiveau,
    titre: "Suivi à froid (J+30) sans réponse",
    message: `Le suivi à 30 jours de ${e.trainee.prenom} ${e.trainee.nom} (session ${e.session.numero}) est sans réponse plus de 37 jours après la fin. Relancer — l'indicateur 30 exige un recueil tracé.`,
    cibleType: "Enrollment",
    cibleId: e.id,
  }));
}

/** R05 — Évaluation des acquis manquante : session realisee > 2 jours sans éval finale. */
async function regleEvaluationAcquisManquante(now: Date): Promise<AlerteCandidate[]> {
  const threshold = daysAgo(2, now);
  const enrollments = await prisma.enrollment.findMany({
    where: {
      session: { statut: "realisee", dateFin: { lte: threshold } },
      statut: { in: ["planifiee", "presente"] },
      evaluations: {
        none: {
          type: "finale",
        },
      },
    },
    select: {
      id: true,
      trainee: { select: { nom: true, prenom: true } },
      session: { select: { numero: true } },
    },
  });
  return enrollments.map((e) => ({
    code: "evaluation_acquis_manquante",
    niveau: "critique" as AlerteNiveau,
    titre: "Évaluation finale des acquis manquante",
    message: `L'évaluation finale des acquis de ${e.trainee.prenom} ${e.trainee.nom} (session ${e.session.numero}) est manquante 2 jours après la session.`,
    cibleType: "Enrollment",
    cibleId: e.id,
  }));
}

/** R06 — Attestation non envoyée : session realisee > 3 jours + attestationGenereeAt null. */
async function regleAttestationNonEnvoyee(now: Date): Promise<AlerteCandidate[]> {
  const threshold = daysAgo(3, now);
  const enrollments = await prisma.enrollment.findMany({
    where: {
      session: { statut: "realisee", dateFin: { lte: threshold } },
      statut: { in: ["planifiee", "presente"] },
      attestationGenereeAt: null,
    },
    select: {
      id: true,
      trainee: { select: { nom: true, prenom: true } },
      session: { select: { numero: true } },
    },
  });
  return enrollments.map((e) => ({
    code: "attestation_non_envoyee",
    niveau: "important" as AlerteNiveau,
    titre: "Attestation non envoyée au stagiaire",
    message: `L'attestation de ${e.trainee.prenom} ${e.trainee.nom} (session ${e.session.numero}) n'a pas été générée/envoyée 3 jours après la session.`,
    cibleType: "Enrollment",
    cibleId: e.id,
  }));
}

/** R07 — Satisfaction sous seuil (seuil_satisfaction_pct, défaut 90%). */
async function regleSatisfactionSousSeuil(_now: Date): Promise<AlerteCandidate[]> {
  const seuilCfg = await getQualiopiConfig("seuil_satisfaction_pct").catch(() => 90);
  const SEUIL_SATISFACTION_PCT = typeof seuilCfg === "number" && seuilCfg > 0 ? seuilCfg : 90;

  // On cherche des sessions réalisées ayant un taux de satisfaction calculable
  const sessions = await prisma.trainingSession.findMany({
    where: { statut: "realisee" },
    select: {
      id: true,
      numero: true,
      enrollments: {
        select: {
          questionnaires: {
            where: { type: "satisfaction_chaud", reponduAt: { not: null } },
            select: { noteGlobale: true },
          },
        },
      },
    },
  });

  const alertes: AlerteCandidate[] = [];
  for (const session of sessions) {
    const notes = session.enrollments
      .flatMap((e) => e.questionnaires)
      .map((q) => q.noteGlobale)
      .filter((n): n is number => n !== null);

    if (notes.length === 0) continue;
    const moyenne = notes.reduce((a, b) => a + b, 0) / notes.length;
    const pct = (moyenne / 5) * 100;
    if (pct < SEUIL_SATISFACTION_PCT) {
      alertes.push({
        code: "satisfaction_sous_seuil",
        niveau: "important",
        titre: "Taux de satisfaction sous le seuil",
        message: `La session ${session.numero} a un taux de satisfaction de ${pct.toFixed(0)}% (seuil : ${SEUIL_SATISFACTION_PCT}%).`,
        cibleType: "TrainingSession",
        cibleId: session.id,
      });
    }
  }
  return alertes;
}

/** R08 — Qualiopi expire dans 90/30 jours ou déjà expirée. */
async function regleQualiopiExpiration(now: Date): Promise<AlerteCandidate[]> {
  const validiteStr = await getQualiopiConfig("qualiopi_validite");
  if (!validiteStr) return [];

  const validite = new Date(validiteStr);
  if (isNaN(validite.getTime())) return [];

  const alertes: AlerteCandidate[] = [];

  if (validite <= now) {
    alertes.push({
      code: "qualiopi_expire",
      niveau: "critique",
      titre: "Certification Qualiopi expirée",
      message: `La certification Qualiopi a expiré le ${validite.toLocaleDateString("fr-FR")}. Renouvellement urgent.`,
    });
  } else if (validite <= daysFromNow(30, now)) {
    alertes.push({
      code: "qualiopi_expire_j30",
      niveau: "critique",
      titre: "Certification Qualiopi expire dans 30 jours",
      message: `La certification Qualiopi expire le ${validite.toLocaleDateString("fr-FR")} (dans ≤30 jours).`,
    });
  } else if (validite <= daysFromNow(90, now)) {
    alertes.push({
      code: "qualiopi_expire_j90",
      niveau: "important",
      titre: "Certification Qualiopi expire dans 90 jours",
      message: `La certification Qualiopi expire le ${validite.toLocaleDateString("fr-FR")} (dans ≤90 jours).`,
    });
  }

  return alertes;
}

/** R09 — BPF : selon la date (>1er avril, >1er mai, >24 mai, >31 mai) et bpf non déposé.
 *  Marqueur réel "BPF déposé" = SiteSetting `bpf_annee_deposee` (mise à jour par l'admin
 *  après dépôt sur maf.fr) >= année du BPF dû. [T17.1 — remplace l'ancienne heuristique
 *  RevueDirection.] Le BPF d'une année N se dépose en N+1 ; on évalue l'obligation de
 *  l'année précédente (déclarable au printemps de l'année courante).
 */
async function regleBpf(now: Date): Promise<AlerteCandidate[]> {
  const annee = now.getFullYear();
  const anneeBpf = annee - 1; // BPF de l'année N-1, à déposer avant le 31 mai de l'année N.

  // 🔴 Audit certification 2026-07-26 (F56). L'obligation de déposer un BPF
  // (art. L6352-11) ne naît qu'avec la DÉCLARATION D'ACTIVITÉ. Sans NDA,
  // l'organisme n'est pas encore un organisme de formation au sens du code du
  // travail : il ne doit aucun bilan.
  //
  // La règle concluait à un manquement à partir de la seule absence de dépôt, et
  // affichait « BPF en retard — régularisation urgente auprès de la DREETS » en
  // CRITIQUE à un organisme qui n'était pas déclaré. Sur un écran qu'un
  // certificateur peut ouvrir, l'alerte l'amène à une conclusion fausse et
  // défavorable. Et deux faux positifs en critique apprennent à ignorer le
  // niveau critique — le jour où une vraie alerte tombe, elle se noie.
  const nda = await getQualiopiConfig("nda_numero");
  if (typeof nda !== "string" || nda.trim() === "") return [];

  const anneeDeposee = await getQualiopiConfig("bpf_annee_deposee");
  const bpfDepose = typeof anneeDeposee === "number" && anneeDeposee >= anneeBpf;
  if (bpfDepose) return [];

  // Seuils BPF (dates légales françaises DREETS — fixées par décret, pas configurables)
  const avrilThreshold = new Date(`${annee}-04-01`);
  const maiThreshold = new Date(`${annee}-05-01`);
  const mai24Threshold = new Date(`${annee}-05-24`);
  const mai31Threshold = new Date(`${annee}-05-31`);

  if (now >= mai31Threshold) {
    return [
      {
        code: "bpf_en_retard",
        niveau: "critique",
        titre: "Bilan Pédagogique et Financier en retard",
        message: `Le BPF ${anneeBpf} aurait dû être déposé avant le 31 mai. Régularisation urgente auprès de la DREETS.`,
      },
    ];
  }
  if (now >= mai24Threshold) {
    return [
      {
        code: "bpf_a_deposer_j7",
        niveau: "critique",
        titre: "Bilan Pédagogique et Financier à déposer (J-7)",
        message: `Le BPF ${anneeBpf} doit être déposé avant le 31 mai (dans ≤7 jours).`,
      },
    ];
  }
  if (now >= maiThreshold) {
    return [
      {
        code: "bpf_a_deposer_j30",
        niveau: "important",
        titre: "Bilan Pédagogique et Financier à déposer (J-30)",
        message: `Le BPF ${anneeBpf} doit être déposé avant le 31 mai (dans ≤30 jours).`,
      },
    ];
  }
  if (now >= avrilThreshold) {
    return [
      {
        code: "bpf_a_deposer_j60",
        niveau: "info",
        titre: "Bilan Pédagogique et Financier à déposer (J-60)",
        message: `Le BPF ${anneeBpf} doit être déposé avant le 31 mai. Préparez vos données.`,
      },
    ];
  }

  return [];
}

/** R10 — Veille inactive depuis > 45 jours. */
async function regleVeilleInactive(now: Date): Promise<AlerteCandidate[]> {
  const threshold = daysAgo(45, now);
  const derniere = await prisma.veille.findFirst({
    orderBy: { dateVeille: "desc" },
    select: { dateVeille: true },
  });
  if (!derniere || derniere.dateVeille <= threshold) {
    const msgDate = derniere
      ? `Dernière entrée : ${derniere.dateVeille.toLocaleDateString("fr-FR")}.`
      : "Aucune entrée de veille enregistrée.";
    return [
      {
        code: "veille_inactive_j45",
        niveau: "important",
        titre: "Aucune entrée de veille depuis 45 jours",
        message: `La veille réglementaire/pédagogique n'a pas été mise à jour depuis plus de 45 jours. ${msgDate} Obligation Qualiopi (ind.23/24/25).`,
      },
    ];
  }
  return [];
}

/** R11 — CV formateur périmé : cvUploadedAt > 12 mois pour formateur actif. */
async function regleCvFormateurPerime(now: Date): Promise<AlerteCandidate[]> {
  const threshold = new Date(now);
  threshold.setFullYear(threshold.getFullYear() - 1);

  const formateurs = await prisma.trainer.findMany({
    where: {
      actif: true,
      OR: [{ cvUploadedAt: { lt: threshold } }, { cvUploadedAt: null }],
    },
    select: { id: true, nom: true, prenom: true, cvUploadedAt: true },
  });
  return formateurs.map((f) => ({
    code: "cv_formateur_perime",
    niveau: "important" as AlerteNiveau,
    titre: "CV formateur non mis à jour depuis 12 mois",
    message: `Le CV de ${f.prenom} ${f.nom} ${
      f.cvUploadedAt
        ? `date du ${f.cvUploadedAt.toLocaleDateString("fr-FR")} (>12 mois)`
        : "n'a jamais été uploadé"
    }. Mise à jour requise.`,
    cibleType: "Trainer",
    cibleId: f.id,
  }));
}

/** R12 — Sous-traitants (SousTraitant OF) : aucun champ qualiopi_validite dans le modèle
 *  → on vérifie la date de vérification data.gouv.fr (verifieDataGouvAt) comme proxy.
 *  Si null ou > 12 mois → alerte. Modèle SousTraitant n'a pas de date d'expiration Qualiopi
 *  explicite dans le schéma T15, on alerte sur les sous-traitants actifs non vérifiés.
 *  Note: les Trainers sous-traitants individuels ont sousTraitantVerifieAt.
 */
async function regleSousTraitantsQualiopi(now: Date): Promise<AlerteCandidate[]> {
  const alertes: AlerteCandidate[] = [];

  // Trainers sous-traitants actifs avec date de vérification périmée (proxy Qualiopi)
  const trainersST = await prisma.trainer.findMany({
    where: { actif: true, statut: "sous_traitant" },
    select: { id: true, nom: true, prenom: true, sousTraitantVerifieAt: true },
  });

  // 🔴 Vérification E2E 2026-07-26 — faux positif à 100 %, niveau CRITIQUE.
  // `sousTraitantVerifieAt` est la date à laquelle la vérification data.gouv.fr
  // a été FAITE (schema.prisma) — donc une date PASSÉE. La règle la comparait à
  // `now + 60 j` puis calculait `verifieAt - now`, toujours ≤ 0 : un
  // sous-traitant vérifié hier était déclaré « expiré ». La preuve de conformité
  // servait à conclure au manquement.
  //
  // Sémantique correcte, conforme au commentaire de tête de la règle : une
  // vérification vaut 12 mois à compter du jour où elle a été faite.
  const VALIDITE_MOIS = 12;
  const perime = daysAgo(365, now); // vérification trop ancienne → expirée
  const bientotPerime = daysAgo(365 - 60, now); // expire sous 60 jours

  for (const t of trainersST) {
    if (!t.sousTraitantVerifieAt) {
      alertes.push({
        code: "sous_traitant_qualiopi_expire",
        niveau: "critique",
        titre: "Qualiopi sous-traitant expiré (sessions futures en cours)",
        message: `Le formateur sous-traitant ${t.prenom} ${t.nom} n'a jamais été vérifié (aucune date de vérification).`,
        cibleType: "Trainer",
        cibleId: t.id,
      });
    } else if (t.sousTraitantVerifieAt <= perime) {
      alertes.push({
        code: "sous_traitant_qualiopi_expire",
        niveau: "critique",
        titre: "Qualiopi sous-traitant expiré (sessions futures en cours)",
        message: `La vérification Qualiopi du formateur sous-traitant ${t.prenom} ${t.nom} date du ${t.sousTraitantVerifieAt.toLocaleDateString("fr-FR")} : elle a plus de ${VALIDITE_MOIS} mois.`,
        cibleType: "Trainer",
        cibleId: t.id,
      });
    } else if (t.sousTraitantVerifieAt <= bientotPerime) {
      const joursRestants = Math.ceil(
        (t.sousTraitantVerifieAt.getTime() - perime.getTime()) / (24 * 60 * 60 * 1000),
      );
      alertes.push({
        code: "sous_traitant_qualiopi_expire_j60",
        niveau: "important",
        titre: "Qualiopi sous-traitant expire dans 60 jours",
        message: `La vérification Qualiopi du formateur sous-traitant ${t.prenom} ${t.nom} (du ${t.sousTraitantVerifieAt.toLocaleDateString("fr-FR")}) atteint ${VALIDITE_MOIS} mois dans ${joursRestants} jours.`,
        cibleType: "Trainer",
        cibleId: t.id,
      });
    }
  }

  return alertes;
}

/**
 * R12 bis — Vigilance sous-traitance : contrat-cadre, RC pro, vérification annuelle.
 *
 * Couvre les DEUX natures d'intervenant externe — l'organisme (`SousTraitant`)
 * et la personne physique (`Trainer` avec `statut: "sous_traitant"`). La règle
 * R12 ne surveillait que la seconde ; le moteur de conformité ne comptait que la
 * première. Chacune avait donc son angle mort. [2026-08-03]
 *
 * ⚠️ Les seuils suivent la procédure de sous-traitance signée le 03/08 :
 *   - contrat-cadre → CRITIQUE : sans lui l'intervenant n'est pas compté conforme
 *     (off.27), quelles que soient ses autres pièces ;
 *   - RC pro absente → IMPORTANT, jamais critique : elle n'est pas exigée à
 *     l'entrée (§ 4.2), et un critique permanent sur un état accepté
 *     apprendrait à ignorer les critiques ;
 *   - RC pro expirée → CRITIQUE : elle existait, elle est tombée ;
 *   - vérification annuelle → rappel 30 jours avant l'échéance (art. 8).
 */
async function regleVigilanceSousTraitance(now: Date): Promise<AlerteCandidate[]> {
  const alertes: AlerteCandidate[] = [];
  const dans60j = daysFromNow(60, now);
  const dans30j = daysFromNow(30, now);

  const [organismes, formateurs] = await Promise.all([
    prisma.sousTraitant.findMany({
      where: { actif: true },
      select: {
        id: true,
        nom: true,
        contratSigneAt: true,
        rcProEcheanceAt: true,
        rcProAttestationUrl: true,
        prochaineVerifAt: true,
      },
    }),
    prisma.trainer.findMany({
      where: { actif: true, statut: "sous_traitant" },
      select: {
        id: true,
        nom: true,
        prenom: true,
        sousTraitantContratSigneAt: true,
        rcProEcheanceAt: true,
        rcProAttestationUrl: true,
        sousTraitantProchaineVerifAt: true,
      },
    }),
  ]);

  /** Les deux natures traitées par le même code : une divergence de règle entre
   *  elles serait invisible et se paierait en audit. */
  const cibles = [
    ...organismes.map((o) => ({
      cibleType: "SousTraitant" as const,
      cibleId: o.id,
      libelle: o.nom,
      contratSigneAt: o.contratSigneAt,
      rcProEcheanceAt: o.rcProEcheanceAt,
      rcProAttestationUrl: o.rcProAttestationUrl,
      prochaineVerifAt: o.prochaineVerifAt,
    })),
    ...formateurs.map((t) => ({
      cibleType: "Trainer" as const,
      cibleId: t.id,
      libelle: `${t.prenom} ${t.nom}`.trim(),
      contratSigneAt: t.sousTraitantContratSigneAt,
      rcProEcheanceAt: t.rcProEcheanceAt,
      rcProAttestationUrl: t.rcProAttestationUrl,
      prochaineVerifAt: t.sousTraitantProchaineVerifAt,
    })),
  ];

  for (const c of cibles) {
    if (c.contratSigneAt === null) {
      alertes.push({
        code: "sous_traitant_contrat_cadre_manquant",
        niveau: "critique",
        titre: "Sous-traitant sans contrat-cadre signé",
        message: `${c.libelle} est référencé comme sous-traitant sans contrat-cadre signé : il n'est pas compté comme conforme (indicateur 27) et ne devrait pas se voir confier de mission.`,
        cibleType: c.cibleType,
        cibleId: c.cibleId,
      });
    }

    // `?.` volontaire : le fail-soft par règle avale les exceptions, donc une
    // valeur absente ferait taire TOUTE la vigilance sous-traitance sans bruit.
    if (!c.rcProAttestationUrl?.trim()) {
      alertes.push({
        code: "sous_traitant_rc_pro_absente",
        niveau: "important",
        titre: "Sous-traitant sans attestation RC pro",
        message: `${c.libelle} n'a pas fourni d'attestation de responsabilité civile professionnelle. Elle n'est pas exigée à l'entrée, mais AXION IA reste responsable devant le client de la bonne exécution des actions sous-traitées.`,
        cibleType: c.cibleType,
        cibleId: c.cibleId,
      });
    } else if (c.rcProEcheanceAt !== null && c.rcProEcheanceAt <= now) {
      alertes.push({
        code: "sous_traitant_rc_pro_expiree",
        niveau: "critique",
        titre: "Attestation RC pro sous-traitant expirée",
        message: `L'attestation RC pro de ${c.libelle} a expiré le ${c.rcProEcheanceAt.toLocaleDateString("fr-FR")}. Elle avait été fournie et acceptée : demander le renouvellement avant toute nouvelle mission.`,
        cibleType: c.cibleType,
        cibleId: c.cibleId,
      });
    } else if (c.rcProEcheanceAt !== null && c.rcProEcheanceAt <= dans60j) {
      alertes.push({
        code: "sous_traitant_rc_pro_expire_j60",
        niveau: "important",
        titre: "Attestation RC pro sous-traitant expire dans 60 jours",
        message: `L'attestation RC pro de ${c.libelle} expire le ${c.rcProEcheanceAt.toLocaleDateString("fr-FR")}.`,
        cibleType: c.cibleType,
        cibleId: c.cibleId,
      });
    }

    if (c.prochaineVerifAt !== null && c.prochaineVerifAt <= dans30j) {
      alertes.push({
        code: "sous_traitant_verification_annuelle_due",
        niveau: "important",
        titre: "Vérification annuelle d'un sous-traitant à effectuer",
        message: `Les pièces de ${c.libelle} (NDA, assurance, CV) sont à revérifier avant le ${c.prochaineVerifAt.toLocaleDateString("fr-FR")} — article 8 de la procédure de sous-traitance.`,
        cibleType: c.cibleType,
        cibleId: c.cibleId,
      });
    }
  }

  // ── Article 8 : tenir compte des incidents à la reconduction ───────────────
  //
  // Sans ce bloc, le registre d'incidents existerait sans que rien ne le lise —
  // Will ne verrait un formateur défaillant qu'en ouvrant sa fiche, c'est-à-dire
  // au moment où il vient précisément de décider de l'affecter.
  //
  // 🔴 Niveau « important », JAMAIS « critique » : cette alerte INFORME, elle
  // n'interdit pas. Un formateur qui a fait tomber deux sessions peut rester le
  // bon choix pour une mission donnée, et l'arbitrage revient à Will (même
  // logique que la RC pro non bloquante).
  const faitsBloquants = await prisma.incident.groupBy({
    by: ["trainerId", "sousTraitantId"],
    where: {
      dateIncident: { gte: daysFromNow(-730, now) },
      faitIntervenant: { in: ["annulation_tardive", "desistement"] },
      OR: [{ trainerId: { not: null } }, { sousTraitantId: { not: null } }],
    },
    _count: { _all: true },
  });

  const libelleParCible = new Map(cibles.map((c) => [`${c.cibleType}:${c.cibleId}`, c.libelle]));

  for (const groupe of faitsBloquants) {
    if (groupe._count._all < 2) continue;

    const cibleType = groupe.trainerId !== null ? ("Trainer" as const) : ("SousTraitant" as const);
    const cibleId = groupe.trainerId ?? groupe.sousTraitantId;
    if (cibleId === null) continue;

    // Un intervenant devenu inactif n'est plus dans `cibles` : ne pas alerter sur
    // quelqu'un qu'on ne peut plus affecter de toute façon.
    const libelle = libelleParCible.get(`${cibleType}:${cibleId}`);
    if (libelle === undefined) continue;

    alertes.push({
      code: "sous_traitant_incidents_repetes",
      niveau: "important",
      titre: "Intervenant externe : incidents répétés",
      message: `${libelle} a fait tomber ${groupe._count._all} sessions en 24 mois (annulation tardive ou désistement). À prendre en compte lors de la reconduction — article 8 de la procédure de sous-traitance.`,
      cibleType,
      cibleId,
    });
  }

  return alertes;
}

/** R13 — OPCO sans accord J-7 + OPCO formation démarrée sans accord. */
async function regleOpco(now: Date): Promise<AlerteCandidate[]> {
  const j7 = daysFromNow(7, now);
  const alertes: AlerteCandidate[] = [];

  // Sessions planifiées dans 7 jours sans accord OPCO
  const sansAccordJ7 = await prisma.trainingSession.findMany({
    where: {
      statut: "planifiee",
      dateDebut: { lte: j7, gt: now },
      // 🔴 M8 (2026-08-27) — LE TITRE ET LE FILTRE NE DISAIENT PAS LA MÊME CHOSE.
      //
      // L'alerte s'appelle « Session dans 7 jours SANS ACCORD OPCO ». Elle ne
      // regardait que `non_demande` : un dossier PARTI et resté sans réponse
      // (`demande_en_cours`) passait sous le radar — et c'est le cas le plus
      // fréquent, les OPCO répondant rarement en une semaine.
      //
      // Le système REFUSE de démarrer sans accord, mais ne PRÉVENAIT pas qu'il
      // allait refuser : la surprise tombait le matin de la formation. C'est
      // exactement ce que M8 décrit.
      //
      // 🔑 Ce qui aurait dû le faire voir plus tôt : la règle JUMELLE, dix
      // lignes plus bas (« formation démarrée sans accord »), couvre DÉJÀ
      // `["non_demande", "demande_en_cours"]`. Les deux règles parlent du même
      // manque à deux moments — et une seule des deux le reconnaissait.
      // Témoin joué : une session à J-7 basculée en `demande_en_cours` levait
      // 0 alerte avant, 1 après.
      opcoStatut: { in: ["non_demande", "demande_en_cours"] },
      // 🔴 Vérification E2E 2026-07-26 — même défaut que F56, dans la MÊME
      // fonction, sur la requête d'à côté : `non_demande` est la valeur par
      // défaut du schéma, donc toute session à J-7 qu'aucun OPCO ne finance
      // levait « sans accord OPCO ». La garde est identique à celle du bloc
      // ci-dessous.
      OR: [{ opcoSubrogation: true }, { dossiersFinancement: { some: {} } }],
    },
    select: { id: true, numero: true, dateDebut: true },
  });
  for (const s of sansAccordJ7) {
    alertes.push({
      code: "opco_sans_accord",
      niveau: "important",
      titre: "Session dans 7 jours sans accord OPCO",
      message: `La session ${s.numero} démarre le ${s.dateDebut.toLocaleDateString("fr-FR")} sans accord OPCO (statut : non demandé).`,
      cibleType: "TrainingSession",
      cibleId: s.id,
    });
  }

  // Sessions démarrées sans accord OPCO.
  //
  // 🔴 F56 — `opcoStatut` vaut `non_demande` PAR DÉFAUT (schema.prisma). Filtrer
  // dessus seul faisait donc lever une alerte CRITIQUE « formation démarrée sans
  // accord OPCO » sur TOUTE session passée en `en_cours`, y compris celles qu'aucun
  // OPCO ne finance — vérifié en production : 0 dossier de financement,
  // `opcoSubrogation = false`, et l'alerte tombait quand même.
  //
  // Un OPCO n'est concerné que si un dossier de financement existe, ou si la
  // subrogation de paiement a été demandée. Sans l'un des deux, il n'y a pas
  // d'accord à obtenir, donc pas de manquement.
  const demarreeSansAccord = await prisma.trainingSession.findMany({
    where: {
      statut: "en_cours",
      dateDebut: { lte: now },
      opcoStatut: { in: ["non_demande", "demande_en_cours"] },
      OR: [{ opcoSubrogation: true }, { dossiersFinancement: { some: {} } }],
    },
    select: { id: true, numero: true },
  });
  for (const s of demarreeSansAccord) {
    alertes.push({
      code: "opco_formation_demarree_sans_accord",
      niveau: "critique",
      titre: "Formation démarrée sans accord OPCO",
      message: `La session ${s.numero} a démarré sans accord OPCO définitif.`,
      cibleType: "TrainingSession",
      cibleId: s.id,
    });
  }

  return alertes;
}

/**
 * R14 — Convention tripartite manquante : opcoSubrogation = true + non signée + J-3.
 *
 * 🔴 2026-09-05 (audit du moteur, trou n°4) — CETTE ALERTE CRITIQUE
 * S'ÉTEIGNAIT TOUTE SEULE AU MOMENT OÙ LE RISQUE DEVENAIT UN FAIT.
 *
 * Le `where` exigeait `statut: "planifiee"`. Le jour du démarrage, le cron fait
 * passer la session en `en_cours`, la règle cesse de produire la candidate, et
 * `resolutionAuto: true` referme l'alerte au tour suivant. Autrement dit : la
 * subrogation est définitivement perdue — l'OPCO ne paiera pas directement, et
 * c'est le client qui devra avancer — et c'est PRÉCISÉMENT à cet instant que la
 * console redevient silencieuse. L'administrateur voit une alerte disparaître
 * et en déduit qu'elle a été traitée.
 *
 * ⚠️ Le contraste était déjà visible dans ce fichier : `regleConventionFormation`
 * (R17), qui garde la convention de formation, couvre bien
 * `planifiee | en_cours | realisee` — avec le commentaire « une session DÉJÀ
 * DÉMARRÉE sans convention était donc parfaitement silencieuse ». Le même
 * défaut, sur la pièce voisine, avait été corrigé sans que celle-ci le soit.
 *
 * La borne basse de 365 jours suit la doctrine de fenêtre glissante appliquée
 * cinq fois ailleurs : sans elle, le premier passage remonterait tout
 * l'historique d'un coup, et une salve d'alertes critiques noierait les vraies.
 */
async function regleConventionTripartite(now: Date): Promise<AlerteCandidate[]> {
  const j3 = daysFromNow(3, now);
  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: { in: ["planifiee", "en_cours"] },
      opcoSubrogation: true,
      conventionTripartiteSigneeAt: null,
      dateDebut: { lte: j3, gte: daysAgo(365, now) },
    },
    select: { id: true, numero: true, dateDebut: true },
  });
  return sessions.map((s) => {
    // Ce que l'alerte DEMANDE change quand la session a démarré : avant, il
    // s'agit encore de faire signer ; après, la subrogation est perdue et il
    // faut décider qui facture. Une alerte qui continue à dire « faites signer »
    // quand il n'y a plus rien à signer se fait ignorer.
    const demarree = s.dateDebut.getTime() <= now.getTime();
    const date = s.dateDebut.toLocaleDateString("fr-FR");
    return {
      code: "convention_tripartite_manquante",
      niveau: "critique" as AlerteNiveau,
      titre: demarree
        ? "Session démarrée sans convention tripartite (subrogation OPCO perdue)"
        : "Convention tripartite manquante (subrogation OPCO)",
      message: demarree
        ? `La session ${s.numero} a démarré le ${date} en subrogation OPCO sans convention tripartite signée. La subrogation n'est plus opposable à l'OPCO : ou bien la convention est régularisée et acceptée, ou bien la facture part au client, qui devra avancer les fonds.`
        : `La session ${s.numero} (démarrage le ${date}) est en subrogation OPCO mais la convention tripartite n'est pas signée.`,
      cibleType: "TrainingSession",
      cibleId: s.id,
    };
  });
}

/**
 * R15 — Factures impayées : ESCALADE J+60 uniquement.
 *
 * 🔴 Audit certification 2026-07-26 (F59). La règle ne regardait que le statut
 * `emise`. Or une facture partiellement réglée reste due pour son solde — et
 * c'est précisément le cas du RESTE À CHARGE : l'OPCO verse sa part, la facture
 * bascule en `partiellement_payee`, et si l'entreprise ne règle jamais la
 * sienne, aucune alerte ne tombait. Le trou portait exactement sur le scénario
 * de financement mixte, le plus fréquent en formation professionnelle.
 *
 * 🔴 2026-08-02 — la règle était en réalité du CODE MORT, et le correctif F59
 * n'avait rien pu changer à cela. Le filtre omettait `en_retard`, alors que le
 * cron de 06:30 UTC (`handleFacturesRetard`) a déjà basculé dans ce statut TOUTE
 * facture échue avant que le cron d'alertes de 07:00 UTC ne s'exécute. Le `where`
 * ne pouvait donc plus ramener une seule ligne : une facture échue depuis 30 ou
 * 60 jours est, par construction, `en_retard`. Le filtre part désormais du SSOT
 * `STATUTS_FACTURE_OUVERTE`, qui inclut les trois statuts ouverts.
 *
 * ── Division du travail entre relances et alertes (anti-doublon) ─────────────
 *
 *   J1 / J15 / J30 → `RelanceProposee` : une ACTION à faire, dans le hub
 *                    facturation, avec son bouton « Envoyer la relance ».
 *   J60            → alerte critique : une ESCALADE, parce qu'aucun palier de
 *                    relance n'existe au-delà de J30 — plus personne ne
 *                    proposerait rien, et la créance vieillirait en silence.
 *
 * L'émission de `facture_impayee_j30` est donc SUPPRIMÉE : elle doublait la
 * relance J30 déjà proposée pour le même fait. Deux signaux concurrents sur un
 * même impayé, c'est deux cycles de vie à tenir — l'admin envoie la relance, la
 * proposition passe `envoyee`, et l'alerte reste ouverte à côté sans plus rien
 * signifier. Le code `facture_impayee_j30` reste au CATALOGUE (et lui seul
 * permet aux alertes déjà en base de s'auto-résoudre) : voir `catalogue.ts`.
 */
async function regleFacturesImpayees(now: Date): Promise<AlerteCandidate[]> {
  const j60 = daysAgo(60, now);
  const alertes: AlerteCandidate[] = [];

  const factures = await prisma.factureFormation.findMany({
    where: {
      statut: { in: [...STATUTS_FACTURE_OUVERTE] },
      echeanceAt: { not: null, lte: j60 },
      // Un avoir n'est pas une créance : il crédite le client.
      avoirDeId: null,
    },
    select: { id: true, numero: true, echeanceAt: true, statut: true },
  });

  for (const f of factures) {
    if (!f.echeanceAt) continue;
    // Garde applicative doublant le `where` : le filtre SQL est l'autorité, mais
    // la règle ne doit jamais dépendre de lui seul pour rester juste.
    if (f.echeanceAt > j60) continue;
    alertes.push({
      code: "facture_impayee_j60",
      niveau: "critique",
      titre: "Facture impayée depuis +60 jours",
      message: `${f.statut === "partiellement_payee" ? `Le solde de la facture ${f.numero} est impayé` : `La facture ${f.numero} est impayée`} depuis plus de 60 jours (échéance : ${f.echeanceAt.toLocaleDateString("fr-FR")}). Aucun palier de relance automatique n'existe au-delà de 30 jours : cette créance demande une décision (mise en demeure, échéancier, provision).`,
      cibleType: "FactureFormation",
      cibleId: f.id,
    });
  }

  return alertes;
}

/**
 * R15 bis — Facture émise SANS date d'échéance (filet de sécurité).
 *
 * 🔴 Le trou structurel du recouvrement. `handleFacturesRetard` sélectionne les
 * factures sur `echeanceAt < now` ; aucune comparaison SQL n'étant vraie pour
 * NULL, une facture sans échéance n'était jamais candidate — donc jamais
 * `en_retard`, jamais relancée, jamais alertée, et absente du prévisionnel de
 * trésorerie faute de mois de rattachement. La créance vieillissait sans laisser
 * la moindre trace à l'écran.
 *
 * Le cron répare désormais ces lignes de lui-même. Cette règle reste néanmoins
 * nécessaire pour deux raisons :
 *   1. elle couvre la fenêtre entre la création de la facture et le passage
 *      quotidien du cron ;
 *   2. elle DÉNONCE un chemin de création défaillant — si l'alerte revient, un
 *      émetteur a de nouveau omis la colonne, et la réparation automatique
 *      masquerait le défaut sans elle.
 *
 * Une alerte PAR FACTURE (et non un compteur global) : la résolution auto suit
 * la cible, et l'admin doit pouvoir ouvrir la pièce concernée.
 */
async function regleFactureSansEcheance(): Promise<AlerteCandidate[]> {
  const factures = await prisma.factureFormation.findMany({
    where: {
      statut: { in: [...STATUTS_FACTURE_OUVERTE] },
      echeanceAt: null,
      // Un avoir ne porte pas d'échéance de paiement : il crédite, il ne réclame
      // rien. L'y attendre produirait une alerte permanente et insoluble.
      avoirDeId: null,
    },
    select: { id: true, numero: true, emiseAt: true, echeanceAt: true },
  });

  return (
    factures
      // Garde applicative doublant le `where` : le filtre SQL est l'autorité, mais
      // une règle qui n'en dépend QUE de lui n'est vérifiable par aucun test.
      .filter((f) => f.echeanceAt === null)
      .map((f) => ({
        code: "facture_sans_echeance",
        niveau: "important" as AlerteNiveau,
        titre: "Facture émise sans date d'échéance",
        message: `La facture ${f.numero}${f.emiseAt !== null ? ` (émise le ${f.emiseAt.toLocaleDateString("fr-FR")})` : ""} n'a pas de date d'échéance : elle est INVISIBLE du circuit de relance tant que celle-ci manque — jamais marquée en retard, jamais proposée à la relance, absente du prévisionnel de trésorerie. Renseignez l'échéance sur la fiche facture (le passage quotidien du cron la reconstitue sinon à partir de la date d'émission et du délai du client).`,
        cibleType: "FactureFormation",
        cibleId: f.id,
      }))
  );
}

/**
 * R15 ter — Relance ENVOYÉE restée sans effet depuis plus de 15 jours.
 *
 * Demande explicite du propriétaire : « des alertes pour me dire les relances
 * passées ». Envoyer une relance n'est pas un résultat. Sans ce signal, une
 * relance partie devient une case cochée : la proposition disparaît de l'écran
 * « à traiter », et plus rien ne rappelle qu'elle n'a rien produit — jusqu'au
 * palier suivant, qui ne vient que si le cron le propose.
 *
 * Condition retenue : relance `envoyee` il y a plus de 15 jours, facture
 * toujours ouverte, et AUCUN encaissement enregistré depuis l'envoi. Quinze
 * jours = le délai au bout duquel un client de bonne foi a payé ou répondu.
 *
 * ⚠️ « Aucun encaissement depuis l'envoi » et non « facture non soldée » : un
 * versement partiel arrivé après la relance prouve qu'elle a porté, même si le
 * solde reste dû. Alerter alors reviendrait à ignorer la réponse du client.
 *
 * Une seule alerte par FACTURE (cible = la facture, pas la relance) : deux
 * paliers restés sans effet sur la même créance sont un seul problème.
 */
async function regleRelanceSansEffet(now: Date): Promise<AlerteCandidate[]> {
  const j15 = daysAgo(15, now);

  const relances = await prisma.relanceProposee.findMany({
    where: {
      statut: "envoyee",
      traiteeAt: { not: null, lte: j15 },
      factureFormationId: { not: null },
      factureFormation: { statut: { in: [...STATUTS_FACTURE_OUVERTE] }, avoirDeId: null },
    },
    orderBy: { traiteeAt: "desc" },
    select: {
      palier: true,
      traiteeAt: true,
      factureFormationId: true,
      factureFormation: {
        select: {
          id: true,
          numero: true,
          payments: { where: { status: "succeeded" }, select: { paidAt: true } },
        },
      },
    },
  });

  const vues = new Set<string>();
  const alertes: AlerteCandidate[] = [];
  for (const r of relances) {
    const f = r.factureFormation;
    if (f === null || r.traiteeAt === null) continue;
    // Garde applicative doublant le `where` (les mocks de test ignorent le SQL).
    if (r.traiteeAt > j15) continue;
    // Une seule alerte par facture — `orderBy traiteeAt desc` garantit qu'on
    // retient la relance la PLUS RÉCENTE, celle dont l'absence d'effet compte.
    if (vues.has(f.id)) continue;

    const encaissementDepuis = f.payments.some(
      (p) => p.paidAt !== null && p.paidAt >= (r.traiteeAt as Date),
    );
    if (encaissementDepuis) continue;

    vues.add(f.id);
    alertes.push({
      code: "relance_sans_effet",
      niveau: "important",
      titre: "Relance envoyée sans effet depuis +15 jours",
      message: `La relance « ${libellePalier(r.palier)} » de la facture ${f.numero}, envoyée le ${r.traiteeAt.toLocaleDateString("fr-FR")}, n'a donné lieu à aucun encaissement depuis. Passez au palier suivant depuis le hub facturation, ou tranchez (échéancier, mise en demeure, recouvrement).`,
      cibleType: "FactureFormation",
      cibleId: f.id,
    });
  }

  return alertes;
}

/**
 * Suivi des dossiers de financement (OPCO / France Travail).
 *
 * 🔴 2026-07-31 — `DossierFinancement.echeanceFinanceurAt` existait au schéma,
 * avec son commentaire (« les OPCO paient à 30-60 j »), et RIEN ne le lisait.
 * Même famille de défaut que les refs des circuits de signature : la donnée
 * est saisie, aucun consommateur. Conséquence : un financeur en retard de
 * paiement ou un dossier envoyé jamais instruit ne déclenchaient AUCUN signal —
 * le suivi reposait sur la mémoire de l'admin.
 *
 * Deux règles :
 *  1. `dossier_financement_sans_reponse` — statut `envoye` depuis +30 j sans
 *     accord ni refus. 30 j = le délai d'instruction usuel d'un OPCO ; au-delà,
 *     relancer est légitime et attendre en silence fait perdre le financement.
 *  2. `financeur_paiement_en_retard` — accord obtenu (voire facturé), échéance
 *     de paiement saisie et DÉPASSÉE, paiement non reçu. Critique : c'est de la
 *     trésorerie due, et les OPCO ne relancent jamais d'eux-mêmes.
 *
 * ⚠️ Distinct de `facture_impayee_j30/j60` : celles-ci partent de la FACTURE et
 * de son échéance propre. Un dossier subrogé peut être en retard AVANT toute
 * facture (accord reçu, échéance passée) — c'est précisément le cas que la
 * facturation ne voit pas.
 */
/**
 * Devis envoyé sans réponse — refonte console phase 1 (2026-08-01).
 *
 * 🔴 Trou trouvé en vérifiant le plan « À traiter » avec Will : un devis
 * `envoye` pouvait dormir ÉTERNELLEMENT — aucune règle ne le surveillait,
 * contrairement aux dossiers OPCO (+30 j) et aux factures. Le client qui ne
 * répond pas est pourtant la relance commerciale la plus banale qui soit.
 *
 * 7 jours : le délai de relance commerciale usuel, plus court que les 30 j
 * d'un dossier OPCO (une administration répond en semaines, un client en jours).
 */
async function regleDevisSansReponse(now: Date): Promise<AlerteCandidate[]> {
  const devisDormants = await prisma.devis.findMany({
    where: { statut: "envoye", sentAt: { not: null, lte: daysAgo(7, now) } },
    select: {
      id: true,
      numero: true,
      sentAt: true,
      client: { select: { raisonSociale: true } },
    },
  });
  const alertes: AlerteCandidate[] = [];
  for (const d of devisDormants) {
    if (!d.sentAt) continue;
    alertes.push({
      code: "devis_sans_reponse",
      niveau: "important",
      titre: "Devis envoyé sans réponse depuis +7 jours",
      message: `Le devis ${d.numero} (${d.client.raisonSociale}) est parti le ${d.sentAt.toLocaleDateString("fr-FR")} sans acceptation ni refus : relancer le client.`,
      cibleType: "Devis",
      cibleId: d.id,
    });
  }
  return alertes;
}

/**
 * R-DEV-EXP-J7 — Devis qui expire dans les 7 jours (SPEC_PART5 §D.10).
 *
 * Complémentaire de `devis_sans_reponse` (dormant depuis J+7 après ENVOI) :
 * ici l'horloge est l'ÉCHÉANCE (`dateValidite`, J+30 par défaut). Un devis
 * envoyé il y a 25 jours n'est plus « dormant », il est en train de mourir —
 * c'est la dernière fenêtre utile pour relancer.
 */
async function regleDevisExpireJ7(now: Date): Promise<AlerteCandidate[]> {
  const devisEnFin = await prisma.devis.findMany({
    where: {
      statut: "envoye",
      dateValidite: { gte: now, lte: daysFromNow(7, now) },
    },
    select: {
      id: true,
      numero: true,
      dateValidite: true,
      client: { select: { raisonSociale: true } },
    },
  });
  return devisEnFin.map((d) => ({
    code: "devis_expire_j7",
    niveau: "important" as AlerteNiveau,
    titre: "Devis expire dans moins de 7 jours",
    message: `Le devis ${d.numero} (${d.client.raisonSociale}) expire le ${d.dateValidite.toLocaleDateString("fr-FR")} : dernière fenêtre pour relancer le client avant l'échéance.`,
    cibleType: "Devis",
    cibleId: d.id,
  }));
}

/**
 * R-DEV-EXP — Devis expiré sans suite (SPEC_PART5 §D.10).
 *
 * Le statut `expire` est posé par le cron `formation-crons.devis-expiration`
 * (06:45, avant ce moteur à 07:00). Un devis expiré qui a déjà une révision
 * (`revisions`) a une suite — pas d'alerte. Borne basse 90 jours : au-delà,
 * c'est de l'histoire, pas une action à mener (même logique que la borne de
 * `session_sans_formateur`).
 */
async function regleDevisExpire(now: Date): Promise<AlerteCandidate[]> {
  const devisExpires = await prisma.devis.findMany({
    where: {
      statut: "expire",
      dateValidite: { gte: daysAgo(90, now), lt: now },
      revisions: { none: {} },
    },
    select: {
      id: true,
      numero: true,
      dateValidite: true,
      client: { select: { raisonSociale: true } },
    },
  });
  return devisExpires.map((d) => ({
    code: "devis_expire",
    niveau: "info" as AlerteNiveau,
    titre: "Devis expiré sans suite",
    message: `Le devis ${d.numero} (${d.client.raisonSociale}) a expiré le ${d.dateValidite.toLocaleDateString("fr-FR")} sans acceptation ni révision : créer un nouveau devis ou clôturer la piste.`,
    cibleType: "Devis",
    cibleId: d.id,
  }));
}

/**
 * Déblocage — devis signé, convention générable (plan « Nouvelle vente » §1a).
 *
 * Un devis passe `accepte` à la signature ; tant que rien n'est construit
 * dessus, la vente attend UNE action admin (créer la session, générer la
 * convention) et rien ne le signalait — il fallait rouvrir l'écran Devis pour
 * l'apprendre. Le cron notifie ce code par email interne (cf. CODES_DEBLOCAGE
 * du crons-worker).
 *
 * ⚠️ « Rien construit dessus » = ni session, ni parcours 1-to-1 : un devis de
 * coaching reste légitimement `accepte` sans jamais devenir convention
 * (`createCoachingParcoursAction` s'y adosse tel quel). Sans ces `none`,
 * l'alerte harcèlerait chaque vente 1-to-1 déjà planifiée.
 */
async function regleDevisSigneConvention(_now: Date): Promise<AlerteCandidate[]> {
  const signes = await prisma.devis.findMany({
    where: {
      statut: "accepte",
      sessions: { none: {} },
      coachingSessions: { none: {} },
    },
    select: {
      id: true,
      numero: true,
      acceptedAt: true,
      client: { select: { raisonSociale: true } },
    },
  });
  return signes.map((d) => ({
    code: "devis_signe_convention",
    niveau: "important" as AlerteNiveau,
    titre: "Devis signé — session et convention à créer",
    message: `Le devis ${d.numero} (${d.client.raisonSociale}) est signé${d.acceptedAt != null ? ` depuis le ${d.acceptedAt.toLocaleDateString("fr-FR")}` : ""} : créer la session puis générer la convention ; pour un devis 1-to-1 (conseil), créer le parcours — contrat de prestation, pas de convention de formation.`,
    cibleType: "Devis",
    cibleId: d.id,
  }));
}

/**
 * Déblocage — cycle moteur terminé, publication en attente (plan « Nouvelle
 * vente » §1a-2, chemin B adaptation).
 *
 * `assemble` est le dernier statut que le moteur pose tout seul : la suite
 * (relecture, publication) est HUMAINE. Une adaptation créée par le wizard
 * restait invisible une fois générée — l'admin qui attendait pour vendre
 * n'apprenait la fin du cycle qu'en rouvrant la fiche. La règle couvre toute
 * formation assemblée, adaptation ou pas : l'attente est la même.
 */
async function regleMoteurAssembleAPublier(_now: Date): Promise<AlerteCandidate[]> {
  const assemblees = await prisma.formation.findMany({
    where: { statutGeneration: "assemble", statut: { not: "archive" } },
    select: { id: true, numero: true, titre: true },
  });
  return assemblees.map((f) => ({
    code: "moteur_assemble_a_publier",
    niveau: "important" as AlerteNiveau,
    titre: "Génération terminée — formation à relire et publier",
    message: `Le moteur a terminé « ${f.titre} » (${f.numero}) : relire le contenu assemblé puis publier — la formation n'est pas planifiable avant.`,
    cibleType: "Formation",
    cibleId: f.id,
  }));
}

/**
 * Signature qui traîne sur une pièce émise — refonte console phase 1
 * (2026-08-01), le second trou trouvé avec le devis dormant.
 *
 * Un lien de signature émis mais jamais signé (`en_attente`), ou une pièce
 * signée d'un seul côté (`partielle`), n'alertait personne : il fallait ouvrir
 * la bonne fiche pour s'en apercevoir. Or une convention non signée à J-2 de
 * la formation est exactement ce qu'un contrôle relève.
 *
 * ⚠️ `updatedAt` comme horloge : la colonne bouge à chaque événement de
 * signature (statut dérivé recalculé). 7 jours SANS mouvement = ça traîne.
 */
async function regleSignatureEnAttente(now: Date): Promise<AlerteCandidate[]> {
  // 🔴 Le seuil était ABSOLU et aveugle à la session.
  //
  // On attendait sept jours quelle que soit la date de début. Une convention
  // signée d'un seul côté pour une session qui commence dans trois jours
  // n'alertait pas — elle aurait alerté quatre jours APRÈS le démarrage. Or la
  // convention se conclut AVANT l'entrée en formation (L.6353-1) : passé le
  // premier jour, l'alerte ne prévient plus, elle constate.
  //
  // On élargit donc la requête aux deux causes, puis on tranche par le module
  // pur. ⚠️ Le critère « avant la session » ne peut pas REMPLACER l'attente :
  // devis, sous-traitance et lettres de mission n'ont aucune session, et ne
  // seraient plus surveillés du tout — un défaut silencieux, donc pire.
  const pieces = await prisma.documentGenere.findMany({
    where: {
      // 🔴 SSOT, pas une recopie (constat `D3-4-06`, 2026-08-19). Ce prédicat
      // portait `statutSignature` SANS `annuleeAt: null`, alors que
      // `pieces-en-attente.ts` le portait déjà — le correctif de 2026 avait été
      // appliqué à la liste « À traiter » de la console et jamais ici. Chaque
      // nuit, une pièce annulée ressortait en CRITIQUE et déclenchait un e-mail,
      // sur un document déclaré sans valeur. Le risque n'est pas l'e-mail :
      // c'est que l'administrateur apprenne à ignorer les alertes critiques de
      // signature, c'est-à-dire l'unique fonction du dispositif.
      ...enAttente(),
      OR: [
        { updatedAt: { lte: daysAgo(ATTENTE_JOURS, now) } },
        {
          session: {
            dateDebut: { lte: new Date(now.getTime() + MARGE_AVANT_SESSION_JOURS * 86400000) },
          },
        },
      ],
    },
    select: {
      id: true,
      type: true,
      numero: true,
      statutSignature: true,
      updatedAt: true,
      session: { select: { numero: true, dateDebut: true } },
    },
  });

  const candidates: AlerteCandidate[] = [];
  for (const p of pieces) {
    const partielle = p.statutSignature === "partielle";
    const verdict = verdictSignature({
      modifieeLe: p.updatedAt,
      dateDebut: p.session?.dateDebut ?? null,
      maintenant: now,
    });
    if (!verdict.reclamer || verdict.motif === null) continue;

    const depuis = p.updatedAt.toLocaleDateString("fr-FR");
    const situation =
      verdict.motif === "attente"
        ? ""
        : ` La session ${p.session?.numero ?? ""} commence le ${p.session?.dateDebut.toLocaleDateString("fr-FR") ?? ""}.`;

    candidates.push({
      code: partielle ? "signature_contreseing_du" : "signature_en_attente",
      // Une session déjà commencée sans pièce conclue n'est plus « important » :
      // l'écart est constitué, il ne se rattrape plus par une relance.
      niveau:
        verdict.motif === "session_commencee" ? ("critique" as const) : ("important" as const),
      titre: titreReclamation({ motif: verdict.motif, partielle }),
      message: partielle
        ? `La pièce ${p.numero} (${p.type}) porte une signature depuis le ${depuis} mais il manque la contrepartie : contresigner ou relancer l'autre partie.${situation}`
        : `La pièce ${p.numero} (${p.type}) attend sa première signature depuis le ${depuis} : relancer le signataire ou réémettre le lien.${situation}`,
      cibleType: "DocumentGenere",
      cibleId: p.id,
    });
  }
  return candidates;
}

/**
 * Pièce INTÉGRALEMENT SIGNÉE dont l'exemplaire n'est jamais parti.
 *
 * 🔴 Le défaut vécu le 2026-09-04, et le seul du domaine que rien ne pouvait
 * voir. La convention `AXI-DOC-2026-039` a été signée par la cliente à 20:47
 * UTC, contresignée par l'organisme à 21:33 — et la cliente n'a jamais reçu son
 * exemplaire. Un contrat de formation n'existe qu'une fois remis aux deux
 * parties (L.6353-1 s.) ; l'organisme détenait seul la preuve d'un engagement
 * réciproque, et l'écran de retour du portail promettait pourtant l'envoi.
 *
 * ⚠️ Pourquoi cette règle ne pouvait PAS être écrite avant.
 *
 * Les quatre surfaces de rattrapage du domaine — `pieces-en-attente`, la
 * pastille de navigation, l'écran « À traiter », `regleSignatureEnAttente`
 * ci-dessus — filtrent toutes sur `enAttente()`, c'est-à-dire
 * `statutSignature IN (en_attente, partielle)`. Une pièce COMPLÈTE en sort par
 * construction. Et `partieARelancer()` rend `null` dès qu'elle est `signee`,
 * avec ce commentaire : « `signee` n'a personne à relancer ». Le succès de la
 * signature éteignait donc le seul signal capable de dire qu'il restait
 * quelque chose à faire — et il ne restait aucune colonne où l'écrire. C'est
 * `exemplaireSigneEnvoyeAt` qui rend le manque OBSERVABLE ; cette règle ne fait
 * que le lire.
 *
 * ⚠️ Pas de borne basse (pas de « depuis N jours ») : la remise est
 * automatique et immédiate à la contresignature. Un exemplaire non transmis
 * n'est pas un retard, c'est une panne — d'e-mail, de R2, ou de code. Attendre
 * sept jours pour la dire ne la rendrait pas plus vraie.
 *
 * ⚠️ Une borne HAUTE, en revanche : `DELAI_GRACE_TRANSMISSION_MINUTES`. La
 * remise est enfilée dans la même requête que la signature, mais le worker
 * BullMQ peut avoir une minute de retard, et l'évaluateur ne doit pas crier sur
 * une pièce signée pendant qu'il tournait.
 */
const DELAI_GRACE_TRANSMISSION_MINUTES = 30;

async function regleExemplaireSigneNonTransmis(now: Date): Promise<AlerteCandidate[]> {
  const limite = new Date(now.getTime() - DELAI_GRACE_TRANSMISSION_MINUTES * 60_000);
  const pieces = await prisma.documentGenere.findMany({
    where: {
      statutSignature: "signee",
      exemplaireSigneEnvoyeAt: null,
      // Une pièce annulée au registre ne fait plus foi : il n'y a rien à
      // remettre, et la réclamer enverrait rouvrir un dossier clos.
      annuleeAt: null,
      updatedAt: { lte: limite },
    },
    select: {
      id: true,
      type: true,
      numero: true,
      updatedAt: true,
      // Relus pour la garde applicative ci-dessous, pas pour l'affichage.
      exemplaireSigneEnvoyeAt: true,
      annuleeAt: true,
      signatures: {
        where: { revokedAt: null },
        select: { partie: true, signataireEmail: true },
      },
    },
  });

  const candidates: AlerteCandidate[] = [];
  for (const p of pieces) {
    // Garde applicative doublant le `where` — les mocks de test ignorent le SQL,
    // et c'est précisément une alerte critique posée sur une pièce annulée qui
    // a appris à l'administrateur à ignorer les critiques (constat `D3-4-06`).
    if (p.exemplaireSigneEnvoyeAt !== null) continue;
    if (p.annuleeAt !== null) continue;

    // Une pièce dont AUCUNE partie n'a laissé d'adresse ne peut pas être
    // remise par e-mail. La signaler chaque nuit sans qu'aucun geste ne la
    // ferme serait du bruit permanent — et le bruit apprend à ignorer les
    // critiques, c'est-à-dire l'unique fonction du dispositif.
    const joignables = p.signatures.filter(
      (s) => s.partie !== "axionia" && (s.signataireEmail ?? "").trim().length > 0,
    );
    if (joignables.length === 0) continue;

    const depuis = p.updatedAt.toLocaleDateString("fr-FR");
    candidates.push({
      code: "exemplaire_signe_non_transmis",
      niveau: "critique" as const,
      titre: `Exemplaire signé jamais remis — ${p.numero}`,
      // Nommer le DESTINATAIRE et pas seulement la pièce : celui qui lit doit
      // savoir QUI attend, sans rouvrir le dossier.
      message:
        `La pièce ${p.numero} (${p.type}) est intégralement signée depuis le ${depuis}, ` +
        `mais son exemplaire signé n'est jamais parti à ${joignables
          .map((s) => s.signataireEmail)
          .join(", ")}. Le contrat n'est donc remis qu'à une seule des parties, ` +
        `alors que l'écran de signature promet l'envoi. Rouvrez la pièce et ` +
        `relancez la remise.`,
      cibleType: "DocumentGenere",
      cibleId: p.id,
    });
  }
  return candidates;
}

/**
 * Sélection Prisma partagée pour résoudre un libellé humain de dossier de
 * financement (voir `libelleDossier` ci-dessous) — factorisée pour ne pas
 * dupliquer les 4 relations entre les deux requêtes de `regleDossiersFinancement`.
 */
const SELECT_DOSSIER_LIBELLE = {
  client: { select: { raisonSociale: true } },
  trainingSession: {
    select: { numero: true, titreSession: true, client: { select: { raisonSociale: true } } },
  },
  coachingContract: {
    select: { numero: true, client: { select: { raisonSociale: true } } },
  },
  auditMission: {
    select: { numero: true, titre: true, client: { select: { raisonSociale: true } } },
  },
  devis: {
    select: { numero: true, client: { select: { raisonSociale: true } } },
  },
} as const;

interface DossierPourLibelle {
  numeroDossierExterne: string | null;
  client: { raisonSociale: string } | null;
  trainingSession: {
    numero: string;
    titreSession: string;
    client: { raisonSociale: string } | null;
  } | null;
  coachingContract: { numero: string; client: { raisonSociale: string } | null } | null;
  auditMission: {
    numero: string;
    titre: string;
    client: { raisonSociale: string } | null;
  } | null;
  devis: { numero: string; client: { raisonSociale: string } | null } | null;
}

/**
 * Libellé humain d'un dossier de financement pour les messages d'alerte.
 *
 * 🔴 Audit du 2026-08-01 (défaut P1) — sans `numeroDossierExterne`, le message
 * retombait sur `d.id.slice(0, 8)`, un fragment d'UUID illisible pour Will.
 * `DossierFinancement` n'a pas de client obligatoire : le rattachement se fait
 * soit directement (`client`), soit via l'entité financée (session, contrat de
 * coaching, mission d'audit, devis) qui porte elle-même un client optionnel.
 * On descend cette chaîne de relations et on ne retombe sur un intitulé
 * générique que si AUCUNE d'elles n'est renseignée (cas jamais rencontré en
 * pratique, mais un dossier de financement orphelin de toute relation est
 * concevable en théorie — d'où ce filet documenté plutôt qu'un UUID inventé).
 */
function libelleDossier(d: DossierPourLibelle): string {
  if (d.numeroDossierExterne) return d.numeroDossierExterne;
  if (d.client) return d.client.raisonSociale;
  if (d.trainingSession) {
    return (
      d.trainingSession.client?.raisonSociale ??
      `session ${d.trainingSession.numero} (${d.trainingSession.titreSession})`
    );
  }
  if (d.coachingContract) {
    return (
      d.coachingContract.client?.raisonSociale ?? `contrat de coaching ${d.coachingContract.numero}`
    );
  }
  if (d.auditMission) {
    return d.auditMission.client?.raisonSociale ?? `mission d'audit « ${d.auditMission.titre} »`;
  }
  if (d.devis) {
    return d.devis.client?.raisonSociale ?? `devis ${d.devis.numero}`;
  }
  return "dossier sans référence identifiable";
}

async function regleDossiersFinancement(now: Date): Promise<AlerteCandidate[]> {
  const alertes: AlerteCandidate[] = [];

  // 1. Envoyé sans réponse depuis +30 jours.
  const sansReponse = await prisma.dossierFinancement.findMany({
    where: { statut: "envoye", envoyeAt: { not: null, lte: daysAgo(30, now) } },
    select: {
      id: true,
      financeurNom: true,
      numeroDossierExterne: true,
      envoyeAt: true,
      ...SELECT_DOSSIER_LIBELLE,
    },
  });
  for (const d of sansReponse) {
    if (!d.envoyeAt) continue;
    alertes.push({
      code: "dossier_financement_sans_reponse",
      niveau: "important",
      titre: "Dossier de financement envoyé sans réponse depuis +30 jours",
      message: `Le dossier ${libelleDossier(d)} (${d.financeurNom ?? "financeur non nommé"}) est parti le ${d.envoyeAt.toLocaleDateString("fr-FR")} sans accord ni refus : relancer le financeur.`,
      cibleType: "DossierFinancement",
      cibleId: d.id,
    });
  }

  // 2. Échéance de paiement du financeur dépassée, paiement non reçu.
  const enRetard = await prisma.dossierFinancement.findMany({
    where: {
      statut: { in: ["accord_recu", "facture"] },
      echeanceFinanceurAt: { not: null, lte: now },
      paiementRecuAt: null,
    },
    select: {
      id: true,
      financeurNom: true,
      numeroDossierExterne: true,
      echeanceFinanceurAt: true,
      // 🔴 16/08 — sans subrogation, le financeur ne verse RIEN à l'organisme :
      // il rembourse son adhérent. L'alerte disait pourtant « relancer le
      // financeur » dans les deux cas, ce qui envoie réclamer à quelqu'un qui
      // ne doit rien et laisse le vrai débiteur tranquille. Le message suit
      // désormais le circuit réel.
      subrogation: true,
      ...SELECT_DOSSIER_LIBELLE,
    },
  });
  for (const d of enRetard) {
    if (!d.echeanceFinanceurAt) continue;
    const echeance = d.echeanceFinanceurAt.toLocaleDateString("fr-FR");
    const financeur = d.financeurNom ?? "financeur non nommé";
    alertes.push({
      code: "financeur_paiement_en_retard",
      niveau: "critique",
      titre: d.subrogation
        ? "Paiement du financeur en retard (échéance dépassée)"
        : "Encaissement en retard — hors subrogation, c'est le client qui doit",
      message: d.subrogation
        ? `Le paiement du dossier ${libelleDossier(d)} (${financeur}) était attendu le ${echeance} et n'est pas reçu : relancer le financeur.`
        : `Le règlement du dossier ${libelleDossier(d)} était attendu le ${echeance} et n'est pas reçu. ⚠️ Ce dossier est SANS subrogation : ${financeur} rembourse le client, il ne verse rien à l'organisme. C'est le CLIENT qu'il faut relancer.`,
      cibleType: "DossierFinancement",
      cibleId: d.id,
    });
  }

  return alertes;
}

/**
 * Vigilance URSSAF des sous-traitants (art. L.8222-1) — demandé par Will le
 * 2026-08-01.
 *
 * L'attestation vaut 6 mois et devient obligatoire dès 5 000 € de cumul
 * annuel ; sans elle, l'OF est SOLIDAIREMENT responsable des cotisations
 * impayées du prestataire. La fiche formateur la signalait déjà en rouge —
 * mais il fallait OUVRIR la fiche pour le voir. Ici, elle remonte chaque matin.
 *
 * 🔴 Zéro logique dupliquée : seuil (`vigilanceRequise`), sélection de la
 * pièce (`trouverValide`) et péremption (`vigilancePerimee`) sont LES MÊMES
 * fonctions que la carte conformité de la fiche. La règle NDA voisine a montré
 * ce que coûte une réimplémentation locale : un faux positif à 100 % resté
 * critique pendant des semaines (cf. regleSousTraitantsQualiopi, 2026-07-26).
 */
async function regleVigilanceUrssaf(now: Date): Promise<AlerteCandidate[]> {
  const alertes: AlerteCandidate[] = [];

  const trainersST = await prisma.trainer.findMany({
    where: { actif: true, statut: "sous_traitant" },
    select: { id: true, nom: true, prenom: true },
  });
  if (trainersST.length === 0) return alertes;

  const annee = now.getFullYear();
  for (const t of trainersST) {
    const [documents, montantRetenuCents] = await Promise.all([
      listTrainerDocuments(t.id),
      cumulAnnuelFormateurCents(t.id, annee),
    ]);

    // Sous le seuil : aucune obligation, aucune alerte — un formateur à 800 €
    // de cumul n'a pas à fournir d'attestation.
    if (!vigilanceRequise("sous_traitant", montantRetenuCents, CONFORMITE_DEFAUTS)) continue;

    const nomComplet = `${t.prenom} ${t.nom}`.trim();
    const doc = trouverValide(documents, "attestation_vigilance_urssaf", now);

    if (vigilancePerimee(doc, now, CONFORMITE_DEFAUTS)) {
      alertes.push({
        code: doc === null ? "vigilance_urssaf_absente" : "vigilance_urssaf_perimee",
        niveau: "critique",
        titre:
          doc === null
            ? "Attestation de vigilance URSSAF absente (responsabilité solidaire)"
            : "Attestation de vigilance URSSAF périmée (responsabilité solidaire)",
        message:
          doc === null
            ? `Le sous-traitant ${nomComplet} a dépassé le seuil de ${CONFORMITE_DEFAUTS.seuilVigilanceCents / 100} € de cumul annuel sans attestation de vigilance URSSAF valide (art. L.8222-1) : la demander et la verser à sa fiche.`
            : `L'attestation de vigilance URSSAF de ${nomComplet} a plus de ${CONFORMITE_DEFAUTS.vigilanceValiditeMois} mois : en demander une nouvelle (art. L.8222-1, renouvellement semestriel).`,
        cibleType: "Trainer",
        cibleId: t.id,
      });
      continue;
    }

    // Préavis : l'attestation est valide mais atteint ses 6 mois sous 30 jours.
    if (doc !== null && doc.dateEmission !== null) {
      const expireLe = addMonths(doc.dateEmission, CONFORMITE_DEFAUTS.vigilanceValiditeMois);
      if (expireLe <= daysFromNow(30, now)) {
        const joursRestants = Math.max(
          0,
          Math.ceil((expireLe.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
        );
        alertes.push({
          code: "vigilance_urssaf_expire_j30",
          niveau: "important",
          titre: "Attestation de vigilance URSSAF à renouveler sous 30 jours",
          message: `L'attestation de vigilance URSSAF de ${nomComplet} atteint ses ${CONFORMITE_DEFAUTS.vigilanceValiditeMois} mois le ${expireLe.toLocaleDateString("fr-FR")} (dans ${joursRestants} jours) : demander le renouvellement dès maintenant.`,
          cibleType: "Trainer",
          cibleId: t.id,
        });
      }
    }
  }

  return alertes;
}

/**
 * R16 — Demandes RGPD non traitées > 30 jours.
 *
 * 🔴 2026-09-05 (audit du moteur, trou n°10) — le niveau était `info`, ici comme
 * au catalogue. L'article 12.3 du RGPD donne UN MOIS pour répondre à une demande
 * d'effacement : quand cette règle lève, le délai n'est pas « proche », il est
 * DÉPASSÉ, et le manquement est opposable devant la CNIL. `info` rangeait ce
 * fait dans la colonne qu'on parcourt en diagonale, à côté d'un devis expiré.
 */
async function regleRgpdSuppression(now: Date): Promise<AlerteCandidate[]> {
  const threshold = daysAgo(30, now);
  const demandes = await prisma.rgpdDemande.findMany({
    where: {
      type: "suppression",
      statut: "demandee",
      demandeAt: { lte: threshold },
    },
    select: { id: true, traineeId: true, demandeAt: true },
  });
  return demandes.map((d) => ({
    code: "suppression_rgpd_j30",
    niveau: "important" as AlerteNiveau,
    titre: "Demande de suppression RGPD non traitée depuis 30 jours",
    message: `Une demande de suppression RGPD (trainee ${d.traineeId}) est en attente depuis le ${d.demandeAt.toLocaleDateString("fr-FR")} (>30 jours).`,
    cibleType: "RgpdDemande",
    cibleId: d.id,
  }));
}

/** R17 — Convention de formation (L.6353-1) manquante avant démarrage (off.9⭐).
 *  Session planifiee dont dateDebut ∈ [now, now+5j] sans DocumentGenere convention. */
async function regleConventionFormation(now: Date): Promise<AlerteCandidate[]> {
  const limite = daysFromNow(5, now);
  const sessions = await prisma.trainingSession.findMany({
    where: {
      // 🔴 Constat F7, 2026-07-26 — la règle ne regardait QUE les sessions
      // `planifiee` démarrant dans les 5 jours. Une session DÉJÀ DÉMARRÉE sans
      // convention était donc parfaitement silencieuse, alors que c'est le cas
      // le plus grave : l'obligation est dépassée, plus seulement imminente.
      // Vérifié en production : `AXI-SESS-2026-001` est `en_cours` depuis le
      // 08/07, sans convention, et un certificat de réalisation a même été émis
      // — sans qu'aucune alerte ne se lève.
      //
      // Borne basse d'un an : sans elle, le premier passage du cron déverserait
      // une salve sur tout l'historique (piège déjà rencontré sur R03bis).
      statut: { in: ["planifiee", "en_cours", "realisee"] },
      dateDebut: { lte: limite, gte: daysAgo(365, now) },
      // 🔴 Vérification E2E 2026-07-26 — la règle n'acceptait que la convention.
      // Vendue à un particulier, la pièce exigée par le code du travail est un
      // CONTRAT de formation (L6353-3), type `contrat` : une session
      // parfaitement en règle levait quand même une alerte CRITIQUE
      // « Convention manquante ». La règle ne vérifiait pas quelle obligation
      // s'applique.
      documents: {
        none: { type: { in: ["convention", "convention_tripartite", "contrat"] } },
      },
    },
    select: { id: true, numero: true, dateDebut: true, statut: true },
  });
  return sessions.map((s) => {
    // Le message doit dire au lecteur où il en est : « à produire avant le
    // démarrage » et « la session a démarré sans » n'appellent pas la même
    // urgence, même si le niveau reste critique dans les deux cas.
    const dejaDemarree = s.statut !== "planifiee";
    const dateFr = s.dateDebut.toLocaleDateString("fr-FR");
    return {
      code: "convention_formation_manquante",
      niveau: "critique" as AlerteNiveau,
      titre: dejaDemarree
        ? "Session démarrée SANS convention de formation"
        : "Convention de formation manquante avant démarrage",
      message: dejaDemarree
        ? `La session ${s.numero} a démarré le ${dateFr} sans convention (L.6353-1) ni contrat de formation (L.6353-3). L'obligation n'est plus imminente, elle est dépassée : régulariser et documenter le retard (ind.9⭐).`
        : `Aucune convention (L.6353-1) ni contrat de formation (L.6353-3) n'est généré pour la session ${s.numero} (début le ${dateFr}). Obligatoire avant démarrage (ind.9⭐).`,
      cibleType: "TrainingSession",
      cibleId: s.id,
    };
  });
}

/** R18 (LOT 4) — Revue trimestrielle à réaliser (info, non bloquante — décision B4).
 *
 *  Gatée par la clé de config `revue_trimestrielle_activee` (défaut true).
 *  Le modèle RevueDirection n'a NI champ période NI titre/notes (une seule
 *  revue par année, `annee @unique`) → convention SANS migration : la cadence
 *  trimestrielle est considérée couverte si une revue de direction a été TENUE
 *  OU MISE À JOUR (dateRevue) depuis le début du trimestre précédent. En
 *  pratique : l'admin rouvre la revue de l'année chaque trimestre, met à jour
 *  `dateRevue` + décisions/plan d'actions, et l'alerte se résout (resolutionAuto).
 */
async function regleRevueTrimestrielle(now: Date): Promise<AlerteCandidate[]> {
  const activee = await getQualiopiConfig("revue_trimestrielle_activee").catch(() => false);
  if (activee !== true) return [];

  // Début du trimestre PRÉCÉDENT (heure locale serveur — granularité au jour,
  // suffisante pour une cadence trimestrielle).
  const trimestreCourant = Math.floor(now.getMonth() / 3); // 0..3
  let anneePrec = now.getFullYear();
  let trimestrePrec = trimestreCourant - 1;
  if (trimestrePrec < 0) {
    trimestrePrec = 3;
    anneePrec -= 1;
  }
  const debutTrimestrePrec = new Date(anneePrec, trimestrePrec * 3, 1);

  const revueRecente = await prisma.revueDirection.findFirst({
    where: { dateRevue: { gte: debutTrimestrePrec } },
    select: { id: true },
  });
  if (revueRecente !== null) return [];

  const labelTrimestrePrec = `T${trimestrePrec + 1} ${anneePrec}`;
  return [
    {
      code: "revue_trimestrielle_a_faire",
      niveau: "info",
      titre: "Revue trimestrielle à réaliser",
      message: `Aucune revue de direction tenue ou mise à jour depuis le trimestre ${labelTrimestrePrec}. Cadence trimestrielle non bloquante : mettez à jour la revue de l'année (date, décisions, plan d'actions) pour couvrir le trimestre.`,
    },
  ];
}

/** R21 — Barème OPCO en vigueur dont le relevé portail est périmé (> N mois). */
async function regleBaremeOpcoPerime(now: Date): Promise<AlerteCandidate[]> {
  const configVal = await getQualiopiConfig("bareme_opco_validite_mois").catch(() => 12);
  const mois = typeof configVal === "number" && configVal > 0 ? configVal : 12;

  const baremes = await listBaremesEnVigueur(now);
  return baremes
    .filter((b) => estBaremePerime(b.releveLe, mois, now))
    .map((b) => ({
      code: "bareme_opco_perime",
      niveau: "important" as AlerteNiveau,
      titre: "Barème OPCO à rafraîchir (relevé trop ancien)",
      message: `Le barème ${opcoLabel(b.opco)} ${
        b.releveLe
          ? `a été relevé le ${b.releveLe.toLocaleDateString("fr-FR")} (> ${mois} mois)`
          : "n'a pas de date de relevé"
      }. Vérifiez le portail OPCO et créez une nouvelle version si les plafonds ont changé.`,
      cibleType: "BaremeOpco",
      cibleId: b.id,
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalogue des règles
// ─────────────────────────────────────────────────────────────────────────────

type RegleFn = (now: Date) => Promise<AlerteCandidate[]>;

/** R-outbox — Des emails commerciaux attendent une validation manuelle.
 *
 *  Une corbeille de validation ne vaut que si quelqu'un l'ouvre. Sans ce
 *  signal, un devis « marqué envoyé » pouvait rester indéfiniment non expédié.
 *  Le seuil est à 1 : l'attente n'est pas un état normal, c'est une action due.
 */
async function regleEmailsEnAttente(): Promise<AlerteCandidate[]> {
  const n = await compterEnAttente();
  if (n === 0) return [];
  return [
    {
      code: "emails_en_attente_validation",
      niveau: "important",
      titre: "Des emails attendent votre validation",
      message: `${n} email${n > 1 ? "s" : ""} en attente dans la corbeille de validation. Tant qu'ils ne sont pas approuvés, rien ne part chez le client.`,
      cibleType: "EmailOutbox",
    },
  ];
}

/**
 * R-OFF — Offres actives non vérifiées depuis plus de 30 jours (SPEC_PART5 §A.2).
 *
 * `OffreSite.derniereVerifCoherenceAt` est horodaté par le bouton « Vérifier la
 * cohérence » de /qualiopi/offres — mais rien ne surveillait son ancienneté :
 * la colonne existait, l'alerte prévue par la spec n'avait jamais été écrite.
 * Une offre jamais vérifiée (colonne null) compte comme périmée : c'est le cas
 * le plus dangereux, pas un cas à part.
 */
async function regleOffresNonVerifiees(now: Date): Promise<AlerteCandidate[]> {
  const seuil = daysAgo(30, now);
  const offres = await prisma.offreSite.findMany({
    where: {
      actif: true,
      OR: [{ derniereVerifCoherenceAt: null }, { derniereVerifCoherenceAt: { lt: seuil } }],
    },
    select: { id: true, code: true, titreFr: true, derniereVerifCoherenceAt: true },
  });
  return offres.map((o) => {
    const detail =
      o.derniereVerifCoherenceAt === null
        ? "jamais vérifiée depuis sa création"
        : `vérifiée pour la dernière fois le ${o.derniereVerifCoherenceAt.toLocaleDateString("fr-FR")}`;
    return {
      code: "offres_site_non_verifiees",
      niveau: "info" as AlerteNiveau,
      titre: "Offre non vérifiée depuis plus de 30 jours",
      message: `L'offre ${o.code} — « ${o.titreFr} » est ${detail}. Vérifier que titre, durée, promesse et tarif correspondent toujours à la page du site (bouton « Vérifier la cohérence » sur /qualiopi/offres).`,
      cibleType: "OffreSite",
      cibleId: o.id,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Cycle de vie du FORMATEUR sur une session (2026-09-03)
//
// Quatre règles pour un même trou : une session vendue pouvait rester sans
// formateur CONFIRMÉ — refus non lu, proposition sans réponse, formateur en
// congés sur les dates, formateur non habilité posé par la création de
// session — sans qu'aucune alerte ne le dise. `joursEnConflit` existait et
// n'était appelé nulle part.
// ─────────────────────────────────────────────────────────────────────────────

/** Le formateur a REFUSÉ et la session n'a toujours pas de principal : à réaffecter. */
async function regleMissionFormateurRefusee(now: Date): Promise<AlerteCandidate[]> {
  const missions = await prisma.missionFormateur.findMany({
    where: {
      statut: "refusee",
      role: "principal",
      session: { statut: "planifiee", dateDebut: { gt: now }, formateurPrincipalId: null },
    },
    orderBy: { reponduAt: "desc" },
    select: {
      reponduAt: true,
      motifRefus: true,
      trainer: { select: { prenom: true, nom: true } },
      session: {
        select: {
          id: true,
          numero: true,
          titreSession: true,
          dateDebut: true,
          client: { select: { raisonSociale: true } },
        },
      },
    },
  });
  // Une alerte par SESSION : c'est elle qu'il faut pourvoir, pas chaque refus.
  const vues = new Set<string>();
  const out: AlerteCandidate[] = [];
  for (const m of missions) {
    if (vues.has(m.session.id)) continue;
    vues.add(m.session.id);
    const dans = Math.ceil((m.session.dateDebut.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    out.push({
      code: "formateur_mission_refusee",
      niveau: "critique",
      titre: "Mission refusée — session sans formateur",
      message:
        `${m.trainer.prenom} ${m.trainer.nom} a refusé d'animer ${designerSession(m.session)}` +
        ` (démarrage dans ${dans} jour${dans > 1 ? "s" : ""}).` +
        ` Motif : « ${m.motifRefus ?? "non renseigné"} ». Affectez un autre formateur.`,
      cibleType: "TrainingSession",
      cibleId: m.session.id,
    });
  }
  return out;
}

/** Proposition sans réponse depuis `DELAI_RELANCE_JOURS` jours : relancé, mais toujours muet. */
async function regleMissionFormateurSansReponse(now: Date): Promise<AlerteCandidate[]> {
  // 🔴 C'était `solliciteAt <= daysAgo(3)`. Un seuil FIXE de trois jours, alors
  // que la question est « reste-t-il du temps ? ». Sur une session à moins de
  // trois jours — le cas courant — la condition n'était jamais vraie : l'alerte
  // ne se levait donc JAMAIS quand le silence coûtait le plus cher.
  //
  // On alerte désormais dès que la MOITIÉ du délai accordé est écoulée, c'est-
  // à-dire au moment où la relance part. Repli sur l'ancien seuil pour les
  // propositions antérieures à `echeanceReponseAt`, qui n'en ont pas.
  const missions = await prisma.missionFormateur.findMany({
    where: {
      statut: "en_attente",
      OR: [
        { echeanceReponseAt: null, solliciteAt: { lte: daysAgo(DELAI_RELANCE_JOURS, now) } },
        { echeanceReponseAt: { not: null } },
      ],
      session: { statut: "planifiee", dateDebut: { gt: now } },
    },
    select: {
      solliciteAt: true,
      relanceAt: true,
      echeanceReponseAt: true,
      trainer: { select: { prenom: true, nom: true } },
      session: {
        select: {
          id: true,
          numero: true,
          titreSession: true,
          dateDebut: true,
          client: { select: { raisonSociale: true } },
        },
      },
    },
  });
  return missions.flatMap((m) => {
    // Garde applicative doublant le `where` : la moitié du délai doit être
    // écoulée. Le SQL ne sait pas exprimer « mi-chemin entre deux colonnes ».
    if (
      m.echeanceReponseAt !== null &&
      instantRelance(m.solliciteAt, m.echeanceReponseAt).getTime() > now.getTime()
    ) {
      return [];
    }
    const depuis = Math.floor((now.getTime() - m.solliciteAt.getTime()) / (24 * 60 * 60 * 1000));
    const dans = Math.ceil((m.session.dateDebut.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    // Le niveau suit l'URGENCE : à moins de sept jours du démarrage, un
    // formateur qui n'a pas confirmé est un risque sur une prestation vendue.
    const niveau: AlerteNiveau = dans <= 7 ? "critique" : "important";
    return [
      {
        code: "formateur_mission_sans_reponse",
        niveau,
        titre: "Formateur sans réponse à la proposition de mission",
        message:
          `${m.trainer.prenom} ${m.trainer.nom} n'a pas répondu à la proposition pour ` +
          `${designerSession(m.session)} depuis ${depuis} jour${depuis > 1 ? "s" : ""}` +
          `${m.relanceAt !== null ? " (relancé)" : ""} ; démarrage dans ${dans} jour${dans > 1 ? "s" : ""}.` +
          " Appelez-le, ou affectez quelqu'un d'autre.",
        cibleType: "TrainingSession",
        cibleId: m.session.id,
      },
    ];
  });
}

/**
 * ÉCHÉANCE DÉPASSÉE, session pas encore démarrée : la session est LIBRE.
 *
 * Distincte de `regleMissionFormateurSansReponse`, qui dit « on attend encore ».
 * Ici on n'attend plus — le cron a retiré l'affectation — et le geste attendu
 * n'est plus d'appeler mais de réaffecter. Les fondre en une seule alerte
 * ferait lire « relancez-le » à quelqu'un qui doit chercher quelqu'un d'autre.
 *
 * ⚠️ On ne lève pas si un AUTRE formateur a accepté la même session : une
 * co-animation proposée à deux dont un seul répond est un non-événement.
 */
async function regleMissionFormateurSansReponseDelai(now: Date): Promise<AlerteCandidate[]> {
  const missions = await prisma.missionFormateur.findMany({
    where: {
      statut: "sans_reponse",
      session: { statut: "planifiee", dateDebut: { gt: now } },
    },
    select: {
      echeanceReponseAt: true,
      trainer: { select: { prenom: true, nom: true } },
      session: {
        select: {
          id: true,
          numero: true,
          titreSession: true,
          dateDebut: true,
          client: { select: { raisonSociale: true } },
          missionsFormateur: { where: { statut: "acceptee" }, select: { id: true } },
        },
      },
    },
  });

  const vues = new Set<string>();
  const out: AlerteCandidate[] = [];
  for (const m of missions) {
    if (m.session.missionsFormateur.length > 0) continue;
    if (vues.has(m.session.id)) continue;
    vues.add(m.session.id);
    const dans = Math.ceil((m.session.dateDebut.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    out.push({
      code: "formateur_mission_sans_reponse_delai",
      niveau: "critique",
      titre: "Délai dépassé — session libérée, formateur à réaffecter",
      message:
        `${m.trainer.prenom} ${m.trainer.nom} n'a pas répondu dans le délai pour ` +
        `${designerSession(m.session)} : l'affectation a été retirée et la session n'a plus de ` +
        `formateur (démarrage dans ${dans} jour${dans > 1 ? "s" : ""}). Affectez quelqu'un d'autre. ` +
        `Ce n'est pas un refus — il n'a rien refusé, il n'a rien dit.`,
      cibleType: "TrainingSession",
      cibleId: m.session.id,
    });
  }
  return out;
}

/**
 * 🔴 LA SESSION A DÉMARRÉ ET LE FORMATEUR N'A JAMAIS RÉPONDU.
 *
 * Trou constaté en recette le 2026-09-03, sur AXI-SESS-2026-010 : zéro alerte
 * sur le formateur, alors que la session avait démarré le matin même avec une
 * proposition restée muette. Les deux règles qui auraient dû l'attraper
 * s'excluent l'une l'autre :
 *
 *   · `regleMissionFormateurSansReponse` exige `statut = "en_attente"` ET
 *     `dateDebut > now`. Or `relancerEtExpirerMissions` passe la proposition en
 *     `expiree` DÈS que la session démarre. L'alerte s'éteint donc à l'instant
 *     précis où le risque devient un fait ;
 *   · `regleSessionSansFormateur` exige `formateurPrincipalId: null`. Or
 *     l'expiration ne retire PAS l'affectation — elle constate un silence, elle
 *     ne décide pas à la place de l'organisme (doctrine de `mission-formateur.ts`).
 *
 * Ce que l'alerte demande n'est donc pas « affectez quelqu'un » — il est trop
 * tard — mais : la session a-t-elle été animée ? Si oui, l'accord n'a jamais
 * été tracé ; si non, il y a un incident à consigner et un client à prévenir.
 *
 * ⚠️ Une proposition expirée alors qu'un AUTRE formateur a accepté la même
 * session est un non-événement (co-animation proposée à deux, un seul répond) :
 * on ne lève que si aucune mission acceptée ne couvre la session.
 */
async function regleMissionFormateurExpiree(now: Date): Promise<AlerteCandidate[]> {
  const missions = await prisma.missionFormateur.findMany({
    where: {
      statut: "expiree",
      // Bornée à un an en arrière, comme `regleSessionSansFormateur` : sans
      // borne basse, tout l'historique remonterait à chaque balayage.
      session: {
        statut: { in: ["planifiee", "en_cours"] },
        dateDebut: { lte: now, gte: daysAgo(365, now) },
      },
    },
    select: {
      role: true,
      solliciteAt: true,
      trainer: { select: { prenom: true, nom: true } },
      session: {
        select: {
          id: true,
          numero: true,
          titreSession: true,
          dateDebut: true,
          client: { select: { raisonSociale: true } },
          missionsFormateur: { where: { statut: "acceptee" }, select: { id: true } },
        },
      },
    },
  });
  // Une alerte par SESSION : c'est la session qu'il faut instruire, pas chaque
  // proposition restée muette.
  const vues = new Set<string>();
  const out: AlerteCandidate[] = [];
  for (const m of missions) {
    if (m.session.missionsFormateur.length > 0) continue;
    if (vues.has(m.session.id)) continue;
    vues.add(m.session.id);
    const date = m.session.dateDebut.toLocaleDateString("fr-FR");
    out.push({
      code: "formateur_mission_expiree",
      niveau: "critique",
      titre: "Session démarrée sans réponse du formateur",
      message:
        `${m.trainer.prenom} ${m.trainer.nom} n'a jamais répondu à la proposition pour ` +
        `${designerSession(m.session)}, qui a démarré le ${date}. ` +
        "L'affectation tient toujours, mais aucun accord n'a été tracé : vérifiez que la " +
        "session a bien été animée, et consignez un incident si elle ne l'a pas été.",
      cibleType: "TrainingSession",
      cibleId: m.session.id,
    });
  }
  return out;
}

/**
 * Formateur affecté sur des jours où il s'est déclaré indisponible (congés, maladie…).
 *
 * 🔴 2026-09-05 (audit du moteur, trou n°4) — la borne était `dateDebut > now`
 * + `statut: "planifiee"` : l'alerte se fermait **le jour où la session
 * commence**, c'est-à-dire au moment exact où le formateur est censé animer
 * alors qu'il s'est déclaré absent. Le risque devenait un fait, et la console
 * se taisait.
 *
 * ⚠️ La borne est désormais posée sur `dateFin` et non sur `dateDebut` : la
 * session reste candidate tant qu'elle n'est pas terminée depuis plus d'une
 * semaine. Ce n'est pas un détail de commodité — c'est ce qui garde la fenêtre
 * de lecture `listIndisposEntre` étroite. Une borne basse de 365 jours sur
 * `dateDebut`, comme ailleurs dans ce fichier, ferait lire deux ans
 * d'indisponibilités à chaque balayage pour ne rien trouver.
 *
 * Les sept jours de grâce après la fin ne servent pas à rattraper (il n'y a
 * plus rien à déplacer) : ils laissent le temps de LIRE, et de consigner
 * l'incident si le formateur n'est effectivement pas venu.
 */
async function regleFormateurIndisponibleSurSession(now: Date): Promise<AlerteCandidate[]> {
  const horizon = daysFromNow(365, now);
  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: { in: ["planifiee", "en_cours"] },
      dateDebut: { lte: horizon },
      dateFin: { gte: daysAgo(7, now) },
      sessionFormateurs: { some: {} },
    },
    select: {
      id: true,
      numero: true,
      titreSession: true,
      dateDebut: true,
      dateFin: true,
      client: { select: { raisonSociale: true } },
      jours: { select: { date: true } },
      sessionFormateurs: {
        select: { trainerId: true, trainer: { select: { prenom: true, nom: true } } },
      },
    },
  });
  if (sessions.length === 0) return [];
  const debut = sessions.reduce(
    (min, s) => (s.dateDebut < min ? s.dateDebut : min),
    sessions[0]!.dateDebut,
  );
  const fin = sessions.reduce(
    (max, s) => (s.dateFin > max ? s.dateFin : max),
    sessions[0]!.dateFin,
  );
  const indispos = await listIndisposEntre(debut, fin);
  if (indispos.length === 0) return [];

  const out: AlerteCandidate[] = [];
  for (const s of sessions) {
    const conflits: string[] = [];
    for (const sf of s.sessionFormateurs) {
      const c = conflitIndisponibilite(
        s,
        indispos.filter((i) => i.trainerId === sf.trainerId),
      );
      if (c !== null)
        conflits.push(`${sf.trainer.prenom} ${sf.trainer.nom} — ${formulerConflit(c)}`);
    }
    if (conflits.length === 0) continue;
    // Deux situations, deux gestes. Avant le démarrage, on déplace ou on
    // remplace. Après, il n'y a plus rien à déplacer : la question devient
    // « qui a animé, et l'a-t-on tracé ? ». Une alerte qui réclame un geste
    // devenu impossible apprend à être ignorée — et il en reste quatre sur ce
    // même écran.
    const demarree = s.dateDebut.getTime() <= now.getTime();
    out.push({
      code: "formateur_indisponible_sur_session",
      niveau: "critique",
      titre: demarree
        ? "Session tenue sur des jours d'indisponibilité déclarée du formateur"
        : "Formateur indisponible sur les dates de la session",
      message: demarree
        ? `${designerSession(s)} a démarré sur des jours où son formateur s'était déclaré indisponible : ` +
          `${conflits.join(" ; ")}. Vérifiez QUI a réellement animé : si ce n'est pas lui, l'émargement ` +
          `et le certificat de réalisation nomment la mauvaise personne ; si personne n'est venu, ` +
          `il y a un incident à consigner et un client à rappeler.`
        : `${designerSession(s)} est vendue sur des jours où son formateur s'est déclaré indisponible : ` +
          `${conflits.join(" ; ")}. Déplacez la session, ou changez de formateur.`,
      cibleType: "TrainingSession",
      cibleId: s.id,
    });
  }
  return out;
}

/**
 * Formateur principal sans habilitation ACTIVE sur la formation de la session (ind.21/22).
 *
 * 🔴 2026-09-05 (audit du moteur, trou n°4) — la borne était `dateDebut > now`
 * + `statut: "planifiee"` : **l'alerte se fermait le jour où le formateur non
 * habilité anime.** Les indicateurs 21 et 22 portent sur la qualification de
 * celui qui a effectivement dispensé l'action ; une session animée sans
 * habilitation est une non-conformité constituée, et c'était exactement l'état
 * dans lequel la console cessait d'en parler.
 *
 * La borne suit `dateFin` plutôt que `dateDebut`, comme la règle
 * d'indisponibilité juste au-dessus : la session reste candidate tant qu'elle
 * n'est pas finie depuis plus d'une semaine.
 *
 * ⚠️ Escalade en `critique` une fois la session commencée, alors que le
 * catalogue porte `important`. Ce n'est pas un oubli : avant animation, le
 * geste est simple et l'écart réparable (habiliter, ou changer de formateur) ;
 * après, l'écart est au dossier et se lit lors d'un audit. La divergence est
 * DÉCLARÉE dans l'entrée du catalogue, parce que l'audit du 2026-09-04 a montré
 * qu'une divergence tacite ne se distingue plus d'une erreur.
 */
async function regleFormateurNonHabiliteAssigne(now: Date): Promise<AlerteCandidate[]> {
  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: { in: ["planifiee", "en_cours"] },
      dateFin: { gte: daysAgo(7, now) },
      formateurPrincipalId: { not: null },
    },
    select: {
      id: true,
      numero: true,
      titreSession: true,
      formationId: true,
      formateurPrincipalId: true,
      dateDebut: true,
      client: { select: { raisonSociale: true } },
      formateurPrincipal: {
        select: {
          prenom: true,
          nom: true,
          habilitations: { where: { retireAt: null }, select: { formationId: true } },
        },
      },
    },
  });
  const out: AlerteCandidate[] = [];
  for (const s of sessions) {
    const f = s.formateurPrincipal;
    if (f === null) continue;
    // Même règle que l'affectation (`isTrainerHabilite`) : la ligne
    // d'habilitation ACTIVE, sans exception de statut — pas même le dirigeant.
    const habilite = f.habilitations.some((h) => h.formationId === s.formationId);
    if (habilite) continue;
    const demarree = s.dateDebut.getTime() <= now.getTime();
    out.push({
      code: "formateur_non_habilite_assigne",
      niveau: demarree ? "critique" : "important",
      titre: demarree
        ? "Session animée par un formateur non habilité"
        : "Formateur principal non habilité sur cette formation",
      message: demarree
        ? `${f.prenom} ${f.nom} anime ${designerSession(s)}, démarrée le ${s.dateDebut.toLocaleDateString("fr-FR")}, ` +
          "sans habilitation active sur cette formation. L'écart n'est plus prévisible, il est au dossier : " +
          "les indicateurs 21 et 22 portent sur la qualification de celui qui a réellement dispensé l'action. " +
          "Habilitez-le en versant la preuve de compétence à sa fiche, ou consignez l'écart."
        : `${f.prenom} ${f.nom} est formateur principal de ${designerSession(s)} sans habilitation active ` +
          "sur cette formation. Habilitez-le (fiche formateur → Habilitations), ou changez de formateur (ind.21/22).",
      cibleType: "TrainingSession",
      cibleId: s.id,
    });
  }
  return out;
}

/**
 * 🔴 LE FORMATEUR A DIT OUI, PUIS S'EST DÉSISTÉ — ET RIEN NE LE DISAIT.
 *
 * Audit du moteur d'alertes, 2026-09-04, trou n°1 : **le seul risque du cycle
 * formateur qui était 100 % muet**. Les sept codes existants partent tous d'une
 * `MissionFormateur` restée sans réponse — refusée, expirée, sans réponse dans
 * le délai, non habilitée. Ici, la réponse a été DONNÉE, puis reprise : aucun
 * de ces états ne s'applique, et la session tombe en silence.
 *
 * Le fait n'a qu'une seule trace dans ce dépôt : le registre des incidents
 * (`faitIntervenant: desistement | annulation_tardive`). Il n'était lu que par
 * `sous_traitant_incidents_repetes`, qui exige **DEUX faits sur 24 mois** et
 * regarde vers la reconduction — c'est-à-dire vers le passé, et pour un autre
 * usage. La session qui tombe demain n'y apparaît jamais.
 *
 * ⚠️ CETTE RÈGLE NE LIT PAS `MissionFormateurStatut.retiree`, contrairement à
 * ce que l'audit proposait, et c'est une correction vérifiée dans le code :
 * `retiree` n'est jamais posé que sur une mission `en_attente`, par
 * l'ORGANISME (`proposerMission` et `retirerMissionsEnAttente`, les deux seules
 * écritures du dépôt). C'est la ménagerie normale d'une co-animation proposée à
 * deux formateurs. En faire une alerte critique produirait du bruit à chaque
 * affectation réussie — et le bruit apprend à ignorer les critiques.
 *
 * ⚠️ On ne lève PAS si le trou est déjà bouché : une mission acceptée par
 * quelqu'un d'autre, ou un formateur principal qui n'est pas le désistant,
 * suffisent. Sans cette garde, l'alerte crierait sur une session qu'on vient de
 * sauver, et son extinction (`resolutionAuto`) n'aurait plus rien à dire.
 *
 * Fenêtre : la session ne doit pas être finie depuis plus de deux jours. Un
 * désistement sur une session déjà passée relève du registre des incidents et
 * de la reconduction, pas de l'urgence.
 */
async function regleFormateurDesisteSession(now: Date): Promise<AlerteCandidate[]> {
  const incidents = await prisma.incident.findMany({
    where: {
      faitIntervenant: { in: ["desistement", "annulation_tardive"] },
      sessionId: { not: null },
      dateIncident: { gte: daysAgo(365, now) },
      session: {
        statut: { in: ["planifiee", "en_cours"] },
        dateFin: { gte: daysAgo(2, now) },
      },
    },
    select: {
      id: true,
      dateIncident: true,
      faitIntervenant: true,
      trainerId: true,
      trainer: { select: { prenom: true, nom: true } },
      sousTraitant: { select: { nom: true } },
      session: {
        select: {
          id: true,
          numero: true,
          titreSession: true,
          statut: true,
          dateDebut: true,
          dateFin: true,
          formateurPrincipalId: true,
          client: { select: { raisonSociale: true } },
          missionsFormateur: { where: { statut: "acceptee" }, select: { trainerId: true } },
        },
      },
    },
    take: 100,
  });

  // Une alerte par SESSION : c'est la session qu'il faut sauver, pas chaque
  // ligne du registre. Même choix que `regleMissionFormateurExpiree`.
  const vues = new Set<string>();
  const out: AlerteCandidate[] = [];
  for (const i of incidents) {
    const s = i.session;
    if (s === null) continue;
    // Gardes applicatives doublant le `where` — les mocks de test ignorent le
    // SQL, et une règle critique qui lèverait sur une session terminée depuis
    // six mois est exactement le bruit que ce catalogue combat.
    if (s.statut !== "planifiee" && s.statut !== "en_cours") continue;
    if (s.dateFin.getTime() < daysAgo(2, now).getTime()) continue;

    // Le trou est-il déjà bouché ? Quelqu'un d'AUTRE que le désistant a
    // accepté, ou tient la place de formateur principal.
    const desistantId = i.trainerId;
    const remplace =
      s.missionsFormateur.some((m) => m.trainerId !== desistantId) ||
      (s.formateurPrincipalId !== null && s.formateurPrincipalId !== desistantId);
    if (remplace) continue;

    if (vues.has(s.id)) continue;
    vues.add(s.id);

    const qui =
      i.trainer !== null
        ? `${i.trainer.prenom} ${i.trainer.nom}`.trim()
        : (i.sousTraitant?.nom ?? "L'intervenant");
    const fait = i.faitIntervenant === "desistement" ? "s'est désisté" : "a annulé tardivement";
    const quand = i.dateIncident.toLocaleDateString("fr-FR");
    const debut = s.dateDebut.toLocaleDateString("fr-FR");
    const demarree = s.dateDebut.getTime() <= now.getTime();

    out.push({
      code: "formateur_desiste_session",
      niveau: "critique",
      titre: demarree
        ? "Session en cours sans intervenant confirmé après un désistement"
        : "Formateur désisté — session sans intervenant confirmé",
      message:
        `${qui} ${fait} le ${quand} pour ${designerSession(s)}, qui ${demarree ? "a démarré" : "démarre"} le ${debut}. ` +
        `Aucun autre formateur n'a accepté cette session et aucun principal n'y est affecté. ` +
        `Trouvez un remplaçant, ou reportez la session et prévenez le client — le registre des ` +
        `incidents garde la trace, il ne trouve personne.`,
      cibleType: "TrainingSession",
      cibleId: s.id,
    });
  }
  return out;
}

/**
 * 🔴 LE STAGIAIRE N'A PAS ÉTÉ CONVOQUÉ, ET PERSONNE NE SURVEILLAIT LA COLONNE
 * QUI LE DIT.
 *
 * Audit du moteur, trou n°5. `Enrollment.convocationEnvoyeeAt` porte au schéma
 * le récit d'un défaut déjà payé : « vérifié en production le 15/08/2026,
 * AUCUNE convocation n'était jamais partie, sur tout l'historique ». La colonne
 * a été créée pour rendre le cron RATTRAPANT — et elle n'est lue que par ce
 * cron, comme garde de son propre envoi (`crons-worker.ts`).
 *
 * 🔑 Autrement dit : la colonne mesure exactement le défaut d'août, et
 * personne ne lit la mesure. Si le cron ne tourne pas — déploiement, coupure
 * Redis, file BullMQ bloquée — la colonne reste nulle et le silence est
 * parfait. Il a fallu aller CHERCHER en production pour découvrir le premier ;
 * cette règle est ce qui évite de recommencer.
 *
 * ⚠️ J-2 et non J-1 : la convocation part au plus tard à J-2 dans ce dépôt, et
 * une alerte qui tombe le jour même de l'envoi accuserait un envoi normal. Deux
 * jours laissent le temps d'envoyer à la main.
 *
 * ⚠️ Bornée aux sessions `planifiee` NON commencées : après le début, convoquer
 * n'informe plus personne. Ce qui reste — le stagiaire n'est pas venu — relève
 * de l'émargement et du registre des incidents. C'est la même borne que
 * `positionnement_sans_reponse`, et pour la même raison : une alerte doit
 * GARDER, pas CONSTATER.
 */
async function regleConvocationStagiaireManquante(now: Date): Promise<AlerteCandidate[]> {
  const dansDeuxJours = daysFromNow(2, now);
  const enrollments = await prisma.enrollment.findMany({
    where: {
      session: { statut: "planifiee", dateDebut: { lte: dansDeuxJours, gte: now } },
      ...inscriptionsActives(),
      convocationEnvoyeeAt: null,
    },
    select: {
      id: true,
      convocationEnvoyeeAt: true,
      trainee: { select: { nom: true, prenom: true } },
      session: { select: { numero: true, dateDebut: true } },
    },
    take: 200,
  });
  return (
    enrollments
      // Garde applicative doublant le `where` : les mocks ignorent le SQL, et
      // accuser d'un manque une convocation DÉJÀ partie serait le pire des
      // messages — celui qu'on ne peut pas fermer.
      .filter((e) => e.convocationEnvoyeeAt === null)
      .map((e) => ({
        code: "convocation_stagiaire_manquante",
        niveau: "critique" as AlerteNiveau,
        titre: "Stagiaire non convoqué à moins de 2 jours du début",
        message:
          `${e.trainee.prenom} ${e.trainee.nom} n'a reçu aucune convocation pour la session ` +
          `${e.session.numero}, qui démarre le ${e.session.dateDebut.toLocaleDateString("fr-FR")}. ` +
          `L'information du bénéficiaire avant l'entrée en formation est due (indicateur 9), et ` +
          `sans convocation il ne saura ni où ni quand se présenter. Envoyez-la depuis la fiche ` +
          `de session.`,
        cibleType: "Enrollment",
        cibleId: e.id,
      }))
  );
}

/**
 * 🔴 UNE SESSION À DISTANCE SANS LIEN DE CONNEXION.
 *
 * Audit du moteur, trou n°3 : `TrainingSession.lieuVisioUrl` n'apparaissait
 * NULLE PART dans ce fichier. La seule règle qui regarde le distanciel,
 * `regleContactSurPlaceAbsent`, ne lit que le contact à joindre — et sort en
 * `info`, « c'est gênant, pas bloquant ». Sans lien, ce n'est plus gênant : la
 * formation n'a pas lieu, et le lieu de déroulement est une mention de la
 * convention (L.6353-1, off.9).
 *
 * ⚠️ Le lien ne se rattrape pas le matin même : il figure dans la convocation
 * du stagiaire ET dans celle du formateur, toutes deux parties avant J-2. Le
 * poser tard oblige à réécrire à tout le monde.
 *
 * ⚠️ La fenêtre COUVRE `en_cours`, et c'est le point du trou n°4 appliqué
 * d'avance : quatre alertes critiques de ce fichier s'éteignaient au démarrage,
 * c'est-à-dire quand le risque devient un fait. Une session à distance qui a
 * commencé sans lien n'a personne dans la salle — c'est l'instant où il faut
 * crier le plus fort, pas se taire.
 */
async function regleSessionDistancielSansLien(now: Date): Promise<AlerteCandidate[]> {
  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: { in: ["planifiee", "en_cours"] },
      lieuType: "distanciel",
      dateDebut: { lte: daysFromNow(2, now) },
      // Tant que la session n'est pas finie depuis deux jours : après, le lien
      // ne sert plus à rien et l'écart se consigne.
      dateFin: { gte: daysAgo(2, now) },
    },
    select: {
      id: true,
      numero: true,
      titreSession: true,
      dateDebut: true,
      lieuType: true,
      lieuVisioUrl: true,
      client: { select: { raisonSociale: true } },
    },
    take: 100,
  });

  return (
    sessions
      // Gardes applicatives doublant le `where` — les mocks ignorent le SQL, et
      // annoncer « session à distance » sur une session en salle enverrait
      // chercher un lien qui n'a pas lieu d'être.
      .filter((s) => s.lieuType === "distanciel" && (s.lieuVisioUrl ?? "").trim().length === 0)
      .map((s) => {
        const demarree = s.dateDebut.getTime() <= now.getTime();
        const date = s.dateDebut.toLocaleDateString("fr-FR");
        return {
          code: "session_distanciel_sans_lien",
          niveau: "critique" as AlerteNiveau,
          titre: demarree
            ? "Session à distance démarrée sans lien de connexion"
            : "Session à distance sans lien de connexion",
          message: demarree
            ? `${designerSession(s)} est à distance, a démarré le ${date}, et aucun lien de connexion n'est enregistré. Personne ne peut se connecter : posez le lien et renvoyez-le immédiatement aux inscrits et au formateur.`
            : `${designerSession(s)} est à distance et démarre le ${date} sans lien de connexion enregistré. Le lien part avec les convocations : sans lui, ni les stagiaires ni le formateur ne sauront où se rendre, et le lieu de déroulement manque à la convention.`,
          cibleType: "TrainingSession",
          cibleId: s.id,
        };
      })
  );
}

/**
 * 🔴 LES QUATRE RÈGLES D'ÉMARGEMENT NE SAVENT COMPTER QUE JUSQU'À ZÉRO.
 *
 * Audit du moteur, trou n°9. `regleEmargementManquant` porte
 * `sansAucuneTraceDePresence()` ; `regleSessionBloqueeEnCours` et
 * `regleEmargementAucuneSignature` portent `enrollments: { none: … }`. Toutes
 * posent la même question — « pas UNE seule trace ? » — et une session où onze
 * inscrits sur douze ont signé y répond « non ». Le douzième est invisible.
 *
 * Ce n'est pas totalement muet : `cloture_trace_presence_incomplete`
 * (`signal-cloture.ts`) dit le cas partiel — mais À LA CLÔTURE, quand les
 * jetons ont expiré et que le seul geste restant est de sortir du dispositif
 * ceux qui ont renoncé. Celle-ci se lève PENDANT, tant qu'une signature est
 * encore recevable. Les deux ne parlent pas au même moment, et c'est pour cela
 * qu'elles coexistent plutôt que de se remplacer.
 *
 * ⚠️ La fenêtre est celle de `regleEmargementAucuneSignature`, sa jumelle en
 * négatif : session commencée, jetons encore vivants (48 h après la fin). Au
 * même instant, l'une dit « personne n'a signé », l'autre « tout le monde n'a
 * pas signé » — et elles s'excluent, puisque la seconde exige qu'au moins un
 * inscrit porte une trace.
 *
 * ⚠️ `important` et non `critique`. La session a des preuves, elle n'en a pas
 * assez. Trois critiques d'émargement existent déjà pour le dossier vide ; en
 * ajouter un quatrième sur le cas partiel apprendrait à les ignorer tous.
 */
async function regleEmargementPartiel(now: Date): Promise<AlerteCandidate[]> {
  const finJetons = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: { in: ["planifiee", "en_cours"] },
      dateDebut: { lte: now },
      dateFin: { gte: finJetons },
      AND: [
        // Au moins un inscrit actif PORTE une trace — c'est ce qui distingue le
        // partiel du zéro, et ce qui garantit qu'on ne double aucune des trois
        // règles du dossier vide.
        { enrollments: { some: { ...inscriptionsActives(), ...porteUneTraceDePresence() } } },
        // …et au moins un n'en porte aucune.
        { enrollments: { some: { ...inscriptionsActives(), ...sansAucuneTraceDePresence() } } },
      ],
    },
    select: {
      id: true,
      numero: true,
      titreSession: true,
      dateFin: true,
      client: { select: { raisonSociale: true } },
      enrollments: {
        where: inscriptionsActives(),
        select: {
          emargementSigneAt: true,
          tauxPresencePct: true,
          trainee: { select: { nom: true, prenom: true } },
        },
      },
    },
    take: 50,
  });

  const out: AlerteCandidate[] = [];
  for (const s of sessions) {
    // Le comptage est refait en mémoire, et pas seulement parce que les mocks
    // ignorent le SQL : c'est lui qui produit les NOMS. Une alerte qui dirait
    // « 3 inscrits sans trace » sans les nommer obligerait à rouvrir la fiche
    // pour savoir qui relancer — et sur une session de douze, personne ne le
    // fait.
    const sansTrace = s.enrollments.filter(
      (e) => e.emargementSigneAt === null && e.tauxPresencePct === null,
    );
    const total = s.enrollments.length;
    if (sansTrace.length === 0 || sansTrace.length === total) continue;

    const noms = sansTrace
      .slice(0, 5)
      .map((e) => `${e.trainee.prenom} ${e.trainee.nom}`.trim())
      .join(", ");
    const reste = sansTrace.length > 5 ? ` et ${sansTrace.length - 5} autre(s)` : "";
    out.push({
      code: "emargement_partiel",
      niveau: "important",
      titre: "Émargement incomplet : une partie des inscrits n'a aucune trace",
      message:
        `${designerSession(s)} : ${sansTrace.length} inscrit(s) sur ${total} ne portent aucune ` +
        `trace de présence — ${noms}${reste}. Les liens d'émargement expirent 48 h après le ` +
        `${s.dateFin.toLocaleDateString("fr-FR")} : après, une attestation délivrée à ces ` +
        `personnes ne serait adossée à aucune preuve, et l'écart devra être consigné.`,
      cibleType: "TrainingSession",
      cibleId: s.id,
    });
  }
  return out;
}

/**
 * 🔴 PLUS D'INSCRITS QUE DE PLACES VENDUES.
 *
 * Audit du moteur, trou n°12 : `nbParticipantsPrevus` n'était lu que par les
 * écrans et les devis. Aucune règle ne comparait l'effectif réel à l'effectif
 * conventionné, si bien que le dépassement se découvre dans la salle — ou sur
 * la facture, quand l'OPCO refuse la part au-delà du barème.
 *
 * Ce n'est pas qu'une affaire de chaises : l'effectif conditionne le montant
 * conventionné, la prise en charge « par stagiaire », et l'engagement
 * pédagogique pris au catalogue (indicateur 17). Un groupe plus nombreux que
 * prévu est un avenant à la convention, pas un détail d'intendance.
 *
 * ⚠️ On compte les inscriptions ACTIVES (`inscriptionsActives`) : un abandon
 * n'occupe pas une place, et compter les sortis ferait crier sur une session
 * qui s'est justement vidée. C'est le même dénominateur que le taux de présence
 * et que le BPF — trois chiffres qui doivent coïncider.
 */
async function regleEffectifDepasse(now: Date): Promise<AlerteCandidate[]> {
  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: { in: ["planifiee", "en_cours"] },
      // Fenêtre glissante : sans borne, le premier passage remonterait tout
      // l'historique des sessions jamais rectifiées.
      dateFin: { gte: daysAgo(30, now) },
      dateDebut: { lte: daysFromNow(365, now) },
    },
    select: {
      id: true,
      numero: true,
      titreSession: true,
      dateDebut: true,
      nbParticipantsPrevus: true,
      client: { select: { raisonSociale: true } },
      enrollments: { where: inscriptionsActives(), select: { id: true } },
    },
    take: 100,
  });

  return sessions
    .filter((s) => s.nbParticipantsPrevus > 0 && s.enrollments.length > s.nbParticipantsPrevus)
    .map((s) => ({
      code: "effectif_depasse",
      niveau: "important" as AlerteNiveau,
      titre: "Plus d'inscrits que l'effectif prévu",
      message:
        `${designerSession(s)} compte ${s.enrollments.length} inscrits actifs pour ` +
        `${s.nbParticipantsPrevus} prévus (démarrage le ${s.dateDebut.toLocaleDateString("fr-FR")}). ` +
        `L'effectif conditionne le montant conventionné, la prise en charge au barème « par ` +
        `stagiaire » et l'engagement pédagogique du catalogue : régularisez la convention, ou ` +
        `reportez les inscrits en trop sur une autre date.`,
      cibleType: "TrainingSession",
      cibleId: s.id,
    }));
}

/**
 * 🔴 LA PRESTATION EST LIVRÉE, ET AUCUNE FACTURE N'EXISTE.
 *
 * Audit du moteur, trou n°10. Les quatre règles de recouvrement de ce fichier —
 * `facture_impayee_j60`, `facture_sans_echeance`, `relance_sans_effet`,
 * `financeur_paiement_en_retard` — partent toutes d'une `FactureFormation` qui
 * EXISTE. La session réalisée jamais facturée est hors de leur champ à toutes,
 * et c'est le seul cas où l'argent ne revient pas sans que rien ne vieillisse :
 * il n'y a pas de ligne dans la balance âgée, donc rien à voir.
 *
 * ⚠️ J+15 après la fin, pas le lendemain : la clôture, l'émargement et
 * l'attestation passent d'abord. Facturer avant d'avoir clos revient à
 * facturer un effectif qu'on n'a pas encore arrêté.
 *
 * ⚠️ `montantHtCents > 0` : une action interne ou offerte n'a rien à émettre,
 * et l'alerte serait insoluble. Une facture `annulee` ne compte pas — elle est
 * précisément le cas où il faut en réémettre une.
 *
 * ⚠️ Un BROUILLON est distingué d'une absence totale, et le message le dit. Ce
 * n'est pas de la cosmétique : le geste diffère (émettre une pièce déjà
 * préparée, ou tout créer), et une alerte qui réclame ce qui est déjà à moitié
 * fait se fait ignorer.
 */
async function regleSessionRealiseeNonFacturee(now: Date): Promise<AlerteCandidate[]> {
  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: "realisee",
      dateFin: { lte: daysAgo(15, now), gte: daysAgo(365, now) },
      montantHtCents: { gt: 0 },
    },
    select: {
      id: true,
      numero: true,
      titreSession: true,
      dateFin: true,
      montantHtCents: true,
      client: { select: { raisonSociale: true } },
      facturesFormation: { select: { statut: true } },
    },
    take: 100,
  });

  const out: AlerteCandidate[] = [];
  for (const s of sessions) {
    // 🔴 Garde applicative doublant `montantHtCents: { gt: 0 }` — et elle n'est
    // pas décorative : le témoin « se tait sur une session à 0 € » a ROUGI sans
    // elle (`expected { …(6) } to be undefined`), parce que les mocks de test
    // ignorent le SQL. Réclamer une facture pour une action offerte produirait
    // une alerte qu'aucun geste ne ferme.
    if (s.montantHtCents <= 0) continue;
    const emises = s.facturesFormation.filter(
      (f) => f.statut !== "annulee" && f.statut !== "brouillon",
    );
    if (emises.length > 0) continue;
    const brouillons = s.facturesFormation.filter((f) => f.statut === "brouillon").length;
    const fin = s.dateFin.toLocaleDateString("fr-FR");
    const montant = (s.montantHtCents / 100).toLocaleString("fr-FR", {
      style: "currency",
      currency: "EUR",
    });
    out.push({
      code: "session_realisee_non_facturee",
      niveau: "important",
      titre: "Session réalisée jamais facturée",
      message:
        brouillons > 0
          ? `${designerSession(s)} est réalisée depuis le ${fin} et sa facture est restée en BROUILLON : ${montant} HT ne sont ni émis, ni exigibles, ni suivis par les relances. Émettez-la.`
          : `${designerSession(s)} est réalisée depuis le ${fin} et aucune facture n'a été émise : ${montant} HT n'apparaissent nulle part — ni dans les encaissements attendus, ni dans la balance âgée, ni dans les relances. Créez la facture depuis la fiche de session.`,
      cibleType: "TrainingSession",
      cibleId: s.id,
    });
  }
  return out;
}

/**
 * 🔴 UNE RC PRO QUI TOMBE HORS SOUS-TRAITANCE NE DISAIT RIEN.
 *
 * Audit du moteur, trou n°11 — implémenté PARTIELLEMENT, et le partiel est le
 * cœur de la décision.
 *
 * `rcProAttestationUrl` et `rcProEcheanceAt` sont des colonnes de `Trainer` :
 * TOUS les formateurs peuvent en porter une. Mais `regleVigilanceSousTraitance`
 * filtre sur `statut: "sous_traitant"`, si bien qu'une attestation versée à la
 * fiche d'un formateur salarié ou dirigeant expirait sans que rien ne le dise.
 *
 * ⚠️ CETTE RÈGLE NE SIGNALE QUE L'EXPIRATION, JAMAIS L'ABSENCE.
 * `requisPourStatut` (`trainers/conformite.ts`) est la source de vérité des
 * pièces exigées : elle n'exige la RC pro d'aucun statut, et la RC pro de
 * l'organisme couvre ses propres salariés. Réclamer chaque nuit une pièce que
 * personne ne doit fournir produirait une alerte qu'AUCUN GESTE ne ferme — le
 * motif écrit trois fois dans le catalogue pour lequel on n'alerte jamais sur
 * un devoir qui n'existe pas. Le distinguo est celui que la règle
 * sous-traitance pose déjà : absente → non exigée à l'entrée ; expirée → elle
 * existait, elle est tombée. Seul le second cas a un sens ici, et il l'a quel
 * que soit le statut.
 *
 * ⛔ LA VIGILANCE URSSAF N'EST PAS ÉTENDUE, contrairement à la lettre de
 * l'audit. `vigilanceRequise` la réserve à l'indépendant, et c'est le droit qui
 * le veut : l'article L.8222-1 vise le donneur d'ordre d'un PRESTATAIRE, pas
 * l'employeur de son propre salarié. L'étendre exigerait de modifier le SSOT de
 * conformité et produirait une alerte critique permanente et insoluble sur
 * chaque salarié. C'est un arbitrage, il est signalé, il n'est pas pris ici.
 */
async function regleRcProFormateurHorsSousTraitance(now: Date): Promise<AlerteCandidate[]> {
  const dans60j = daysFromNow(60, now);
  const formateurs = await prisma.trainer.findMany({
    where: {
      actif: true,
      // Les sous-traitants sont déjà couverts par `regleVigilanceSousTraitance`,
      // avec leurs propres codes. Deux alertes pour le même fait, ce sont deux
      // cycles de vie à tenir et un lecteur qui ne sait plus laquelle fermer.
      statut: { not: "sous_traitant" },
      rcProEcheanceAt: { not: null },
    },
    select: {
      id: true,
      nom: true,
      prenom: true,
      statut: true,
      rcProEcheanceAt: true,
    },
  });

  const alertes: AlerteCandidate[] = [];
  for (const t of formateurs) {
    // Gardes applicatives doublant le `where` : les mocks ignorent le SQL, et
    // doubler l'alerte d'un sous-traitant est précisément ce que le filtre évite.
    if (t.statut === "sous_traitant") continue;
    if (t.rcProEcheanceAt === null) continue;

    const nom = `${t.prenom} ${t.nom}`.trim();
    const echeance = t.rcProEcheanceAt.toLocaleDateString("fr-FR");
    if (t.rcProEcheanceAt <= now) {
      alertes.push({
        code: "formateur_rc_pro_expiree",
        niveau: "critique",
        titre: "Attestation RC pro d'un formateur expirée",
        message:
          `L'attestation de responsabilité civile professionnelle de ${nom} a expiré le ${echeance}. ` +
          `Elle avait été fournie et versée à sa fiche : demandez le renouvellement. ` +
          `AXION IA reste responsable devant le client de la bonne exécution de l'action.`,
        cibleType: "Trainer",
        cibleId: t.id,
      });
    } else if (t.rcProEcheanceAt <= dans60j) {
      alertes.push({
        code: "formateur_rc_pro_expire_j60",
        niveau: "important",
        titre: "Attestation RC pro d'un formateur expire dans 60 jours",
        message: `L'attestation RC pro de ${nom} expire le ${echeance} : demandez le renouvellement dès maintenant.`,
        cibleType: "Trainer",
        cibleId: t.id,
      });
    }
  }
  return alertes;
}

const REGLES: Array<{ nom: string; fn: RegleFn }> = [
  { nom: "referent_handicap", fn: regleReferentHandicap },
  { nom: "responsable_qualite", fn: regleResponsableQualite },
  { nom: "mentions_facture", fn: regleMentionsFacture },
  { nom: "categories_certifiees", fn: regleCategoriesCertifiees },
  { nom: "catalogue_certifiant_incoherent", fn: regleCatalogueCertifiantIncoherent },
  { nom: "offres_site_non_verifiees", fn: regleOffresNonVerifiees },
  { nom: "reclamations_sans_reponse", fn: regleReclamationsSansReponse },
  { nom: "emargement_manquant", fn: regleEmargementManquant },
  { nom: "session_sans_formateur", fn: regleSessionSansFormateur },
  { nom: "kit_sorties_non_pretes", fn: regleSortiesKitNonPretes },
  { nom: "session_bloquee_en_cours", fn: regleSessionBloqueeEnCours },
  { nom: "session_sans_dispositif_emargement", fn: regleSessionSansDispositifEmargement },
  { nom: "emargement_aucune_signature", fn: regleEmargementAucuneSignature },
  { nom: "rappel_j7_non_envoye", fn: regleRappelJ7NonEnvoye },
  { nom: "journee_sans_creneaux", fn: regleJourneeSansCreneaux },
  { nom: "diaporama_manquant_session", fn: regleDiaporamaManquant },
  { nom: "satisfaction_manquante", fn: regleSatisfactionManquante },
  { nom: "evaluation_acquis_manquante", fn: regleEvaluationAcquisManquante },
  { nom: "attestation_non_envoyee", fn: regleAttestationNonEnvoyee },
  { nom: "satisfaction_sous_seuil", fn: regleSatisfactionSousSeuil },
  { nom: "qualiopi_expiration", fn: regleQualiopiExpiration },
  { nom: "bpf", fn: regleBpf },
  { nom: "veille_inactive", fn: regleVeilleInactive },
  { nom: "emails_en_attente_validation", fn: regleEmailsEnAttente },
  { nom: "cv_formateur_perime", fn: regleCvFormateurPerime },
  { nom: "sous_traitants_qualiopi", fn: regleSousTraitantsQualiopi },
  { nom: "vigilance_sous_traitance", fn: regleVigilanceSousTraitance },
  { nom: "vigilance_urssaf", fn: regleVigilanceUrssaf },
  { nom: "opco", fn: regleOpco },
  { nom: "convention_tripartite", fn: regleConventionTripartite },
  { nom: "convention_formation", fn: regleConventionFormation },
  { nom: "factures_impayees", fn: regleFacturesImpayees },
  { nom: "facture_sans_echeance", fn: regleFactureSansEcheance },
  { nom: "relance_sans_effet", fn: regleRelanceSansEffet },
  { nom: "dossiers_financement", fn: regleDossiersFinancement },
  { nom: "devis_sans_reponse", fn: regleDevisSansReponse },
  { nom: "devis_expire_j7", fn: regleDevisExpireJ7 },
  { nom: "devis_expire", fn: regleDevisExpire },
  { nom: "devis_signe_convention", fn: regleDevisSigneConvention },
  { nom: "moteur_assemble_a_publier", fn: regleMoteurAssembleAPublier },
  { nom: "signatures_en_attente", fn: regleSignatureEnAttente },
  { nom: "exemplaire_signe_non_transmis", fn: regleExemplaireSigneNonTransmis },
  { nom: "rgpd_suppression", fn: regleRgpdSuppression },
  { nom: "revue_trimestrielle", fn: regleRevueTrimestrielle },
  { nom: "bareme_opco_perime", fn: regleBaremeOpcoPerime },
  // Lot 1 §1.4 — les deux seules étapes du parcours d'un dossier qui n'avaient
  // AUCUN code d'alerte. Les douze autres en avaient déjà un ; ajouter une
  // alerte « échéance dépassée » globale les aurait signalées deux fois.
  { nom: "positionnement_sans_reponse", fn: reglePositionnementSansReponse },
  { nom: "suivi_froid_manquant", fn: regleSuiviFroidManquant },
  // Cycle de vie du formateur sur une session (2026-09-03).
  { nom: "formateur_mission_refusee", fn: regleMissionFormateurRefusee },
  { nom: "formateur_mission_sans_reponse", fn: regleMissionFormateurSansReponse },
  { nom: "formateur_mission_sans_reponse_delai", fn: regleMissionFormateurSansReponseDelai },
  { nom: "formateur_mission_expiree", fn: regleMissionFormateurExpiree },
  { nom: "session_contact_sur_place_absent", fn: regleContactSurPlaceAbsent },
  { nom: "formateur_indisponible_sur_session", fn: regleFormateurIndisponibleSurSession },
  { nom: "formateur_non_habilite_assigne", fn: regleFormateurNonHabiliteAssigne },
  // Audit du moteur d'alertes du 2026-09-04 — les trous restants, comblés le
  // 2026-09-05. Chacun était muet, pas approximatif : aucune règle ne lisait
  // `Incident.faitIntervenant` sur une session vivante, ni
  // `Enrollment.convocationEnvoyeeAt`, ni `TrainingSession.lieuVisioUrl`, ni
  // `nbParticipantsPrevus`, ni l'absence de facture, ni la RC pro d'un
  // formateur hors sous-traitance — et les quatre règles d'émargement ne
  // savaient compter que jusqu'à zéro.
  { nom: "formateur_desiste_session", fn: regleFormateurDesisteSession },
  { nom: "convocation_stagiaire_manquante", fn: regleConvocationStagiaireManquante },
  { nom: "session_distanciel_sans_lien", fn: regleSessionDistancielSansLien },
  { nom: "emargement_partiel", fn: regleEmargementPartiel },
  { nom: "effectif_depasse", fn: regleEffectifDepasse },
  { nom: "session_realisee_non_facturee", fn: regleSessionRealiseeNonFacturee },
  { nom: "formateur_rc_pro_hors_sous_traitance", fn: regleRcProFormateurHorsSousTraitance },
];

// ─────────────────────────────────────────────────────────────────────────────
// Point d'entrée public
// ─────────────────────────────────────────────────────────────────────────────

export interface EvaluationAlertes {
  candidates: AlerteCandidate[];
  /**
   * Noms des règles ayant LEVÉ (fail-soft). 🔴 Tant que cette liste n'est pas
   * vide, la résolution automatique doit être SUSPENDUE : une règle en échec
   * ne produit aucune candidate, et `synchroniserAlertes` résoudrait alors en
   * masse toutes les alertes ouvertes de ses codes — un simple timeout DB un
   * matin effacerait à tort toutes les alertes devis.
   */
  reglesEnEchec: string[];
  /**
   * T3a — noms des règles dont la moisson a été TRONQUÉE au plafond, avec le
   * nombre réel de candidates trouvées.
   *
   * 🔴 Une troncature muette est le pire des trois états possibles. Un moteur
   * qui remonte tout est lent ; un moteur qui remonte les N premières et le
   * DIT est utilisable ; un moteur qui remonte les N premières en silence
   * fabrique la certitude qu'il n'y a rien d'autre. C'est le même principe que
   * les plafonds d'écran (T1) : un plafond annoncé est une information, un
   * plafond tu est un mensonge par omission.
   */
  reglesTronquees: { nom: string; trouvees: number; retenues: number }[];
}

/**
 * Plafond de candidates par règle et par passage.
 *
 * Il ne protège pas la base — les requêtes des règles restent non bornées, et
 * ce point est traité à part (cf. le commentaire de `evaluerAlertesDetaille`).
 * Il protège l'ÉTAPE D'ÉCRITURE : sans lui, une règle qui dégénère (une
 * condition trop large sur 8 000 inscriptions) inonderait la table d'alertes,
 * et la console deviendrait illisible au moment précis où elle sert le plus.
 *
 * 200 : bien au-dessus de tout volume légitime observé (la règle la plus
 * bavarde en produit quelques dizaines), assez bas pour qu'une dégénérescence
 * se voie immédiatement dans `reglesTronquees`.
 */
export const PLAFOND_CANDIDATES_PAR_REGLE = 200;

/**
 * Évalue toutes les règles — variante détaillée qui expose les échecs.
 *
 * Stub-aware : vide si DATABASE_URL contient "stub.invalid".
 * Fail-soft par règle : une erreur de règle est loggée, comptée, et n'empêche
 * pas les autres règles.
 *
 * ⚠️ CE QUE T3a NE FAIT DÉLIBÉRÉMENT PAS, et pourquoi c'est écrit ici.
 *
 * Les 31 `findMany` des règles restent SANS `take`. Le plan (T3a, 3ᵉ puce)
 * demandait de les borner ; ce n'est pas un oubli, c'est un refus motivé :
 *
 * - plusieurs règles **agrègent** (compter des présences, comparer un seuil de
 *   satisfaction, recouper deux listes). Poser un `take` dessus ne les rendrait
 *   pas plus rapides : ça les rendrait **fausses**, en silence, dans un système
 *   de conformité où une alerte manquante est un risque d'audit ;
 * - distinguer, sur 31 requêtes, celles qui énumèrent de celles qui agrègent
 *   demande de lire chaque règle et son usage — c'est un chantier à part entière,
 *   pas une passe mécanique ;
 * - le plafond posé ci-dessus protège déjà ce qui coûtait vraiment : l'étape
 *   d'écriture et la lisibilité de la console.
 *
 * 🔴 Le coût réel de ces 31 requêtes n'est aujourd'hui **pas mesuré**. Il le
 * deviendra : la fixture volumétrique (T0) et le gate de mesure existent
 * désormais, et une sonde sur le passage du cron dira lesquelles pèsent
 * réellement. Borner à l'aveugle avant cette mesure reviendrait à optimiser au
 * hasard un système qui, aujourd'hui, tient 400 alertes.
 */
export async function evaluerAlertesDetaille(): Promise<EvaluationAlertes> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { candidates: [], reglesEnEchec: [], reglesTronquees: [] };
  }

  const now = new Date();
  const toutes: AlerteCandidate[] = [];
  const reglesEnEchec: string[] = [];
  const reglesTronquees: { nom: string; trouvees: number; retenues: number }[] = [];

  for (const { nom, fn } of REGLES) {
    try {
      const candidates = await fn(now);
      if (candidates.length > PLAFOND_CANDIDATES_PAR_REGLE) {
        reglesTronquees.push({
          nom,
          trouvees: candidates.length,
          retenues: PLAFOND_CANDIDATES_PAR_REGLE,
        });
        console.warn(
          `[evaluateur-alertes] règle ${nom} TRONQUÉE : ${candidates.length} candidates ` +
            `trouvées, ${PLAFOND_CANDIDATES_PAR_REGLE} retenues. Une règle aussi bavarde est ` +
            `presque toujours une condition trop large, pas un vrai afflux.`,
        );
      }
      toutes.push(...candidates.slice(0, PLAFOND_CANDIDATES_PAR_REGLE));
    } catch (err) {
      reglesEnEchec.push(nom);
      console.error(
        `[evaluateur-alertes] erreur règle ${nom}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return { candidates: toutes, reglesEnEchec, reglesTronquees };
}

/** Compat : la liste des candidates seule (appelants historiques). */
export async function evaluerAlertes(): Promise<AlerteCandidate[]> {
  return (await evaluerAlertesDetaille()).candidates;
}
