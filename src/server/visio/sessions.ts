/**
 * Les SESSIONS d'enregistrement : démarrer, accord, refus, battement, fin de
 * tranche, fin (chantier visio, ADR 0054 et 0056 ; PR 5).
 *
 * ## Rien n'est reçu avant l'accord
 *
 * Un enregistrement naît `accord_en_attente`. Tant qu'il y reste, la route des
 * morceaux répond 409 et l'extension garde le son dans son IndexedDB. Sans
 * « Accord obtenu » sous 3 minutes, l'extension détruit ce qu'elle a capté et
 * le serveur clôt (`accord_non_confirme`). « Refus » : destruction immédiate,
 * des deux côtés.
 *
 * ## Les messages en retard ne détruisent rien (plan §3.6, C2)
 *
 * Le site peut être coupé ≈ 28 min pendant un déploiement. L'extension rejoue
 * alors ses déclarations, datées par elle :
 *   · un accord daté dans les 3 minutes du début est accepté même après la
 *     clôture d'office `accord_non_confirme` ;
 *   · un battement qui revient rouvre `interrompu` ;
 *   · une `fin` tardive remplace la clôture d'office ;
 *   · JAMAIS après un refus : la destruction est définitive.
 *
 * ## Refus motivés (409) au démarrage
 *
 * Hors liste blanche, échange apporteur, entretien de candidat à ±30 min,
 * mode `pilote` et rencontre qui n'est pas de test, reprise d'historique,
 * opposition à l'IA d'une personne de la fiche (art. 21), client ACTIF dont le
 * préavis court encore (décision de Will du 29/09, `preavis-clients-actifs.ts`)
 * — pour la visio comme pour la dictée. Le préavis est revérifié à l'accord :
 * une rencontre rattachée à un client actif entre-temps est refusée aussi.
 * Un refus ou un retrait déjà déclaré sur CETTE rencontre est définitif :
 * un nouveau « Démarrer » répond 409 `refus_anterieur_definitif`.
 */

import type { EnregistrementStatut, PrismaClient } from "../../../prisma/generated/client";
import {
  DELAIS_SERVEUR,
  VERSION_CONTRAT_ENREGISTREUR,
  type MotifRefusSession,
  type TCreerSession,
  type TDeclarerAccord,
  type TFinSession,
  type TFinTranche,
} from "@/lib/schemas/enregistreur";
import { CONSENT_FORM_REFS } from "@/lib/consents";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import type { ModeEnregistrement } from "./drapeau";
// Liste blanche UNIQUE, celle du dossier client (PR 4, anti-doublon D1) :
// type « Discutons… » ET jamais un rendez-vous lié à une candidature.
import { estRendezVousDuDossier } from "./liste-blanche-types";
import { estAppelApporteur } from "@/server/calendly/appel-apporteur";
import { ETATS_ENREGISTREMENT_ACTIFS } from "./etats";
import { CONSERVATION_AUDIO_MAX_JOURS } from "./cloture";
import { ajouterAuJournal } from "./journal-enregistrement";
import { blocagePreavis } from "./preavis-clients-actifs";
import {
  CODE_REFUS_PREAVIS,
  DICTEE_ANNONCEE,
  PREAVIS_SOUS_TRAITANTS,
  type Preavis,
} from "./visio-annonce";
import { echec, ok, type Resultat } from "./resultat";
import type { StockageAudio } from "./stockage-audio";

/** Fenêtre autour du rendez-vous où un entretien de candidat bloque l'enregistrement. */
export const MARGE_ENTRETIEN_MS = 30 * 60_000;

/** États où le traitement a commencé : un refus ne s'y déclare plus ici (retrait, PR 6). */
const ETATS_TRAITES: ReadonlyArray<EnregistrementStatut> = [
  "en_traitement",
  "transcrit",
  "compte_rendu_pret",
  "valide",
  "echec",
];

type Db = PrismaClient;

export interface Appareil {
  readonly id: string;
  readonly adminUserId: string;
}

/** Les motifs à texte fixe. Le préavis a le sien, daté, dans `visio-annonce.ts`. */
type MotifATexteFixe = Exclude<MotifRefusSession, typeof CODE_REFUS_PREAVIS>;

const MESSAGES_REFUS: Readonly<Record<MotifATexteFixe, string>> = {
  rencontre_inconnue:
    "Ce rendez-vous n'existe pas (ou plus) dans la console : actualisez la liste.",
  hors_liste_blanche:
    "Ce type de rendez-vous ne s'enregistre pas (seuls « Discutons de votre projet IA » et les visios créées dans la console).",
  apporteur: "Les échanges avec les candidats apporteurs ne s'enregistrent jamais.",
  entretien_candidat: "Un entretien de candidat est prévu à cette heure-là : rien ne s'enregistre.",
  pilote_rencontre_non_test:
    "Mode pilote : seul le rendez-vous de test (client fictif) peut être enregistré.",
  reprise_historique: "Ce rendez-vous est antérieur à la mise en service : il ne s'enregistre pas.",
  opposition_ia:
    "Une personne de ce client s'est opposée au traitement par IA : ni enregistrement, ni dictée.",
  refus_anterieur_definitif:
    "Ce rendez-vous a déjà fait l'objet d'un refus : rien ne s'enregistre.",
};

/** Un refus motivé : le code du contrat et le texte montré à Will. */
export interface RefusMotive {
  readonly motif: MotifRefusSession;
  readonly message: string;
}

function motive(motif: MotifATexteFixe): RefusMotive {
  return { motif, message: MESSAGES_REFUS[motif] };
}

function refusSession(motif: MotifATexteFixe): Resultat {
  return echec(409, motif, MESSAGES_REFUS[motif]);
}

/** Le refus « client actif sous préavis » : code et texte de `refusPourPreavis`. */
function refusPreavis(message: string): Resultat {
  return echec(409, CODE_REFUS_PREAVIS, message);
}

function estConflitUnique(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

function accordDansLeDelai(debut: Date, accordLe: Date): boolean {
  const ecart = accordLe.getTime() - debut.getTime();
  // Une seconde de tolérance en arrière : les deux dates viennent de la même
  // horloge (l'extension), mais l'arrondi à la milliseconde peut les croiser.
  return ecart >= -1000 && ecart <= DELAIS_SERVEUR.accordMaxMs;
}

type RencontrePourEligibilite = {
  readonly id: string;
  readonly source: string;
  readonly type: string;
  readonly estTestInterne: boolean;
  readonly repriseHistorique: boolean;
  readonly clientId: string | null;
  readonly debutPrevu: Date | null;
  readonly calendlyEvent: {
    readonly eventTypeName: string;
    readonly linkedJobApplicationId: string | null;
  } | null;
};

/**
 * Peut-on enregistrer cette rencontre, maintenant, dans ce mode ? Rend le refus
 * motivé, ou `null`. L'opposition à l'IA, le refus déjà déclaré et le préavis
 * passent AVANT la nature : ils bloquent la dictée comme la visio.
 */
export async function motifDeRefus(
  db: Pick<
    Db,
    | "clientContact"
    | "clientContactAdresse"
    | "rencontre"
    | "rencontreParticipant"
    | "calendlyEvent"
    | "client"
    | "enregistrement"
    | "enregistrementConsentement"
  >,
  rencontre: RencontrePourEligibilite,
  entree: {
    readonly nature: "visio" | "dictee";
    readonly mode: Exclude<ModeEnregistrement, "ferme">;
    readonly maintenant: Date;
    /** Injecté par les tests ; la déclaration unique sinon. */
    readonly preavis?: Preavis | null;
  },
): Promise<RefusMotive | null> {
  // 1. Opposition à l'IA d'une personne de la fiche ou d'un participant (art. 21).
  const opposantsFiche = rencontre.clientId
    ? await db.clientContact.count({
        where: { clientId: rencontre.clientId, oppositionIaLe: { not: null } },
      })
    : 0;
  if (opposantsFiche > 0) return motive("opposition_ia");
  const participantsOpposes = await db.rencontreParticipant.findMany({
    where: { rencontreId: rencontre.id, contactId: { not: null } },
    select: { contactId: true },
  });
  const idsContacts = participantsOpposes
    .map((p) => p.contactId)
    .filter((x): x is string => x !== null);
  if (idsContacts.length > 0) {
    const opposes = await db.clientContact.count({
      where: { id: { in: idsContacts }, oppositionIaLe: { not: null } },
    });
    if (opposes > 0) return motive("opposition_ia");
  }

  // 1 bis. Un refus (ou un retrait) déjà déclaré sur CETTE rencontre est
  //    définitif : pas de nouvel enregistrement dans le même rendez-vous.
  //    Les AUTRES rencontres du client allument le bandeau (V5-C6).
  const refusIci = await db.enregistrement.count({
    where: { rencontreId: rencontre.id, statut: "refuse" },
  });
  const retraitIci = await db.enregistrementConsentement.count({
    where: { rencontreId: rencontre.id, type: "retrait" },
  });
  if (refusIci + retraitIci > 0) return motive("refus_anterieur_definitif");

  // 2. Client ACTIF dont le préavis court (décision de Will du 29/09) : ni
  //    visio ni dictée. Client validé, proposé, ou reconnu par une adresse
  //    (`preavis-clients-actifs.ts`) : un vrai prospect n'est pas concerné.
  const preavis = entree.preavis === undefined ? PREAVIS_SOUS_TRAITANTS : entree.preavis;
  const blocage = await blocagePreavis(db, rencontre.id, entree.maintenant, preavis);
  if (blocage) return { motif: CODE_REFUS_PREAVIS, message: blocage.message };

  // 3. Nature : la dictée n'est enregistrée que si la notice l'annonce
  //    (`DICTEE_ANNONCEE`, source unique `visio-annonce.ts`, dérivée de
  //    l'annonce publique : faux tant que la PR 8 n'a rien annoncé).
  if (entree.nature === "dictee" && !DICTEE_ANNONCEE) return motive("hors_liste_blanche");

  // 4. Type de rencontre.
  if (rencontre.source === "calendly") {
    const nom = rencontre.calendlyEvent?.eventTypeName ?? null;
    if (estAppelApporteur(nom)) return motive("apporteur");
    if (!rencontre.calendlyEvent || !estRendezVousDuDossier(rencontre.calendlyEvent)) {
      return motive("hors_liste_blanche");
    }
  } else if (rencontre.source === "saisie_manuelle") {
    if (entree.nature === "visio" && rencontre.type !== "visio") {
      return motive("hors_liste_blanche");
    }
  } else {
    return motive("hors_liste_blanche");
  }

  // 5. Reprise d'historique : jamais d'enregistrement.
  if (rencontre.repriseHistorique) return motive("reprise_historique");

  // 6. Mode pilote : le client fictif seulement.
  if (entree.mode === "pilote" && !rencontre.estTestInterne) {
    return motive("pilote_rencontre_non_test");
  }

  // 7. Un entretien de candidat à ±30 min de l'heure du rendez-vous (ou de maintenant).
  const centre = (rencontre.debutPrevu ?? entree.maintenant).getTime();
  const autour = await db.calendlyEvent.findMany({
    where: {
      startTime: {
        gte: new Date(centre - MARGE_ENTRETIEN_MS),
        lte: new Date(centre + MARGE_ENTRETIEN_MS),
      },
      status: { not: "canceled" },
    },
    select: { linkedJobApplicationId: true },
  });
  // Un entretien se reconnaît à son LIEN de candidature (liste blanche du
  // dossier, D1), jamais au nom de son type.
  if (autour.some((e) => e.linkedJobApplicationId !== null)) {
    return motive("entretien_candidat");
  }
  return null;
}

/**
 * Écrit la preuve d'un accord (ajout seul) et l'information au registre des
 * consentements (`action = "information"`, JAMAIS `optin` : ce qui se prouve,
 * c'est que la personne a été informée et n'a pas refusé).
 */
async function consignerAccord(
  db: Pick<
    Db,
    "enregistrementConsentement" | "rencontre" | "rencontreParticipant" | "consentEvent"
  >,
  entree: {
    readonly enregistrementId: string;
    readonly rencontreId: string;
    readonly accordLe: Date;
    readonly nbParticipants: number | null;
    readonly versionTexte: string;
    readonly nouvellePersonne: boolean;
    readonly declareParId: string;
  },
): Promise<void> {
  await db.enregistrementConsentement.create({
    data: {
      enregistrementId: entree.enregistrementId,
      rencontreId: entree.rencontreId,
      type: entree.nouvellePersonne ? "nouveau_participant_signale" : "declaration_axion",
      versionTexte: entree.versionTexte.slice(0, 64),
      nbParticipants: entree.nbParticipants,
      declareParId: entree.declareParId,
      survenuLe: entree.accordLe,
    },
  });

  // Registre des consentements : best-effort, comme `recordConsentEvent` — la
  // preuve de l'accord est déjà écrite ci-dessus, dans la table du circuit.
  try {
    const rencontre = await db.rencontre.findUnique({
      where: { id: entree.rencontreId },
      select: { calendlyEvent: { select: { inviteeEmail: true } } },
    });
    const participants = await db.rencontreParticipant.findMany({
      where: { rencontreId: entree.rencontreId, role: "client", emailHash: { not: null } },
      select: { emailHash: true },
    });
    const cles = new Set<string>();
    const invite = hashEmailForLookup(rencontre?.calendlyEvent?.inviteeEmail ?? null);
    if (invite) cles.add(invite);
    for (const p of participants) if (p.emailHash) cles.add(p.emailHash);
    if (cles.size > 0) {
      await db.consentEvent.createMany({
        data: [...cles].map((personKey) => ({
          personKey,
          formRef: CONSENT_FORM_REFS.enregistrementVisioAnnonce,
          consentVersion: entree.versionTexte.slice(0, 64),
          action: "information",
          occurredAt: entree.accordLe,
        })),
      });
    }
  } catch (err) {
    console.error("[enregistreur] registre des consentements non écrit :", err);
  }
}

/** Démarre un enregistrement, ou reprend celui de la même clé. */
export async function creerOuReprendreSession(
  db: Db,
  entree: {
    readonly appareil: Appareil;
    readonly corps: TCreerSession;
    readonly mode: Exclude<ModeEnregistrement, "ferme">;
    readonly maintenant: Date;
    /** Injecté par les tests ; la déclaration unique sinon. */
    readonly preavis?: Preavis | null;
  },
): Promise<Resultat> {
  const { corps, appareil } = entree;
  const preavis = entree.preavis === undefined ? PREAVIS_SOUS_TRAITANTS : entree.preavis;
  const debut = new Date(corps.debutLe);
  const accordLocalLe = corps.accordLocalLe ? new Date(corps.accordLocalLe) : null;

  // 0. Rejeu de la même création (réseau coupé après l'écriture).
  const parCle = await db.enregistrement.findUnique({
    where: { cleClient: corps.cleClient },
    select: { id: true, rencontreId: true, statut: true, appareilId: true },
  });
  if (parCle) {
    if (parCle.appareilId !== appareil.id || parCle.rencontreId !== corps.rencontreId) {
      return echec(
        409,
        "cle_client_deja_prise",
        "Cette clé de capture appartient à un autre enregistrement.",
      );
    }
    let statut = parCle.statut;
    if (accordLocalLe) {
      const r = await declarerAccord(db, {
        appareil,
        enregistrementId: parCle.id,
        corps: {
          accordLe: accordLocalLe.toISOString(),
          nbParticipants: corps.nbParticipants ?? 1,
          versionTexte: "annonce-v1",
          nouvellePersonne: false,
        },
        maintenant: entree.maintenant,
        preavis,
      });
      // Le préavis refuse l'accord rejoué : le refus remonte tel quel, et
      // l'extension détruit son son au lieu de le garder pour rien.
      if (r.statut === 409 && r.corps["erreur"] === CODE_REFUS_PREAVIS) return r;
      if (r.statut === 200 && typeof r.corps["statut"] === "string") {
        statut = r.corps["statut"] as EnregistrementStatut;
      }
    }
    return ok({
      enregistrementId: parCle.id,
      rencontreId: parCle.rencontreId,
      statut,
      repris: true,
    });
  }

  // 1. La rencontre.
  const rencontre = await db.rencontre.findUnique({
    where: { id: corps.rencontreId },
    select: {
      id: true,
      source: true,
      type: true,
      estTestInterne: true,
      repriseHistorique: true,
      clientId: true,
      debutPrevu: true,
      fusionneeDansId: true,
      calendlyEvent: { select: { eventTypeName: true, linkedJobApplicationId: true } },
    },
  });
  if (!rencontre || rencontre.fusionneeDansId !== null) return refusSession("rencontre_inconnue");

  // 2. Peut-on l'enregistrer ?
  const refus = await motifDeRefus(db, rencontre, {
    nature: corps.nature,
    mode: entree.mode,
    maintenant: entree.maintenant,
    preavis,
  });
  if (refus) return echec(409, refus.motif, refus.message);

  // 3. Un seul enregistrement actif par rencontre : on renvoie celui qui vit,
  //    l'extension s'y rattache (reprise après un plantage).
  const actif = await db.enregistrement.findFirst({
    where: { rencontreId: rencontre.id, statut: { in: [...ETATS_ENREGISTREMENT_ACTIFS] } },
    select: { id: true, statut: true },
  });
  if (actif) {
    return echec(
      409,
      "enregistrement_actif",
      "Un enregistrement est déjà en cours pour ce rendez-vous : reprise.",
      {
        enregistrementId: actif.id,
        statut: actif.statut,
      },
    );
  }

  // 4. Création. Un accord rejoué dans le délai démarre directement `en_cours`.
  const accordValide = accordLocalLe !== null && accordDansLeDelai(debut, accordLocalLe);
  let cree: { id: string; statut: EnregistrementStatut };
  try {
    cree = await db.enregistrement.create({
      data: {
        rencontreId: rencontre.id,
        nature: corps.nature,
        cleClient: corps.cleClient,
        appareilId: appareil.id,
        statut: accordValide ? "en_cours" : "accord_en_attente",
        debut,
        accordConfirmeLe: accordValide ? accordLocalLe : null,
        evenements: ajouterAuJournal(null, { le: entree.maintenant, type: "session_creee" }),
        versionExtension: corps.versionExtension.slice(0, 20),
        versionContrat: VERSION_CONTRAT_ENREGISTREUR,
      },
      select: { id: true, statut: true },
    });
  } catch (err) {
    if (!estConflitUnique(err)) throw err;
    // Course : un autre appel a créé l'actif entre-temps (index partiel unique).
    const gagnant = await db.enregistrement.findFirst({
      where: { rencontreId: rencontre.id, statut: { in: [...ETATS_ENREGISTREMENT_ACTIFS] } },
      select: { id: true, statut: true },
    });
    if (!gagnant) throw err;
    return echec(
      409,
      "enregistrement_actif",
      "Un enregistrement est déjà en cours pour ce rendez-vous : reprise.",
      {
        enregistrementId: gagnant.id,
        statut: gagnant.statut,
      },
    );
  }

  if (accordValide && accordLocalLe) {
    await consignerAccord(db, {
      enregistrementId: cree.id,
      rencontreId: rencontre.id,
      accordLe: accordLocalLe,
      nbParticipants: corps.nbParticipants,
      versionTexte: "annonce-v1",
      nouvellePersonne: false,
      declareParId: appareil.adminUserId,
    });
  }
  return ok({
    enregistrementId: cree.id,
    rencontreId: rencontre.id,
    statut: cree.statut,
    repris: false,
  });
}

/** Charge un enregistrement de CET appareil ; un autre appareil reçoit 404 (rien n'est révélé). */
async function chargerDeLAppareil(db: Pick<Db, "enregistrement">, id: string, appareilId: string) {
  const enr = await db.enregistrement.findUnique({
    where: { id },
    select: {
      id: true,
      rencontreId: true,
      appareilId: true,
      statut: true,
      debut: true,
      fin: true,
      motifArret: true,
      evenements: true,
      accordConfirmeLe: true,
      updatedAt: true,
    },
  });
  if (!enr || enr.appareilId !== appareilId) return null;
  return enr;
}

const INTROUVABLE = echec(404, "enregistrement_inconnu", "Enregistrement introuvable.");

/** « Accord obtenu » (ou une nouvelle personne qui accepte en cours d'appel). */
export async function declarerAccord(
  db: Db,
  entree: {
    readonly appareil: Appareil;
    readonly enregistrementId: string;
    readonly corps: TDeclarerAccord;
    readonly maintenant?: Date;
    /** Injecté par les tests ; la déclaration unique sinon. */
    readonly preavis?: Preavis | null;
  },
): Promise<Resultat> {
  const enr = await chargerDeLAppareil(db, entree.enregistrementId, entree.appareil.id);
  if (!enr) return INTROUVABLE;
  const accordLe = new Date(entree.corps.accordLe);
  const preavis = entree.preavis === undefined ? PREAVIS_SOUS_TRAITANTS : entree.preavis;

  if (enr.statut === "refuse" || enr.statut === "abandonne") {
    return echec(
      409,
      "enregistrement_clos",
      "Un refus a été déclaré : l'accord ne peut plus être enregistré.",
    );
  }

  // Le préavis, revérifié ici : la rencontre a pu être rattachée à un client
  // actif depuis le démarrage. Aucun accord n'est consigné, aucun son ne sera
  // reçu (la route des morceaux reste à 409 `accord_en_attente`), et la
  // clôture d'office passera l'enregistrement `accord_non_confirme`.
  const blocage = await blocagePreavis(
    db,
    enr.rencontreId,
    entree.maintenant ?? new Date(),
    preavis,
  );
  if (blocage) return refusPreavis(blocage.message);

  // Une personne arrivée en cours d'appel : preuve de plus, rien d'autre ne change.
  if (entree.corps.nouvellePersonne) {
    if (enr.statut === "accord_en_attente" || enr.statut === "accord_non_confirme") {
      return echec(409, "accord_initial_absent", "L'accord de départ n'a pas encore été déclaré.");
    }
    await consignerAccord(db, {
      enregistrementId: enr.id,
      rencontreId: enr.rencontreId,
      accordLe,
      nbParticipants: entree.corps.nbParticipants,
      versionTexte: entree.corps.versionTexte,
      nouvellePersonne: true,
      declareParId: entree.appareil.adminUserId,
    });
    return ok({ statut: enr.statut });
  }

  // Déjà confirmé : idempotent.
  if (enr.accordConfirmeLe !== null) return ok({ statut: enr.statut, deja: true });

  if (enr.statut !== "accord_en_attente" && enr.statut !== "accord_non_confirme") {
    return echec(409, "etat_inattendu", "Cet enregistrement n'attend plus d'accord.");
  }
  if (!accordDansLeDelai(enr.debut, accordLe)) {
    return echec(
      409,
      "accord_hors_delai",
      "L'accord doit être obtenu dans les 3 minutes qui suivent le démarrage : le son a été détruit.",
    );
  }

  // Message en retard : une clôture d'office `accord_non_confirme` est levée,
  // parce que l'accord a bien été donné à temps (daté par l'extension).
  // L'extension rejoue ses messages dans l'ordre : l'accord précède toujours
  // sa `fin`, qui suivra et déposera l'enregistrement.
  const corrige = enr.statut === "accord_non_confirme";
  const statut: EnregistrementStatut = "en_cours";
  await db.enregistrement.update({
    where: { id: enr.id },
    data: {
      statut,
      accordConfirmeLe: accordLe,
      updatedAt: new Date(),
      ...(corrige ? { motifArret: null, fin: null } : {}),
      evenements: ajouterAuJournal(enr.evenements, {
        le: new Date(),
        type: corrige ? "accord_en_retard_accepte" : "accord_obtenu",
      }),
    },
  });
  await consignerAccord(db, {
    enregistrementId: enr.id,
    rencontreId: enr.rencontreId,
    accordLe,
    nbParticipants: entree.corps.nbParticipants,
    versionTexte: entree.corps.versionTexte,
    nouvellePersonne: false,
    declareParId: entree.appareil.adminUserId,
  });
  return ok({ statut });
}

/**
 * « Refus » : tout est détruit, immédiatement et définitivement — le son déjà
 * reçu est supprimé de R2. Idempotent : un refus rejoué reprend la suppression
 * de ce qui aurait résisté la première fois.
 */
export async function declarerRefus(
  db: Db,
  stockage: StockageAudio,
  entree: {
    readonly appareil: Appareil;
    readonly enregistrementId: string;
    readonly refusLe: Date;
    readonly maintenant: Date;
  },
): Promise<Resultat> {
  const enr = await chargerDeLAppareil(db, entree.enregistrementId, entree.appareil.id);
  if (!enr) return INTROUVABLE;
  if (ETATS_TRAITES.includes(enr.statut)) {
    return echec(
      409,
      "retrait_apres_traitement",
      "Le traitement a commencé : utilisez « Retirer l'accord » sur la page du rendez-vous.",
    );
  }

  // 1. D'abord l'état : plus aucun morceau n'est accepté à partir d'ici.
  if (enr.statut !== "refuse") {
    await db.enregistrement.update({
      where: { id: enr.id },
      data: {
        statut: "refuse",
        motifArret: "refus_participant",
        fin: enr.fin ?? entree.refusLe,
        // Échéance immédiate : toute purge (celle-ci, sa reprise, celle de la
        // PR 6) voit ce son comme dû MAINTENANT, jamais comme « sans date ».
        audioAPurgerAvant: entree.maintenant,
        evenements: ajouterAuJournal(enr.evenements, { le: entree.maintenant, type: "refus" }),
      },
    });
    await db.enregistrementConsentement.create({
      data: {
        enregistrementId: enr.id,
        rencontreId: enr.rencontreId,
        type: "retrait",
        versionTexte: "refus-pendant-l-appel-v1",
        declareParId: entree.appareil.adminUserId,
        survenuLe: entree.refusLe,
      },
    });
  }

  // 2. Puis le son : chaque morceau supprimé de R2, puis sa ligne. Ce qui
  //    résiste (R2 en panne) est repris par `reprendrePurgesDesRefus`, à la
  //    requête suivante de l'extension et à chaque balayage : le 503 ci-dessous
  //    n'est pas une promesse en l'air.
  const resistants = await purgerLeSonDUnRefus(db, stockage, enr.id, entree.maintenant);
  if (resistants > 0) {
    return echec(
      503,
      "stockage_indisponible",
      "La suppression du son n'a pas abouti : nouvel essai automatique.",
    );
  }
  return ok({ statut: "refuse", detruire: true });
}

/** Battement d'une session : signe de vie ; rouvre un `interrompu`. */
export async function battementSession(
  db: Db,
  entree: {
    readonly appareil: Appareil;
    readonly enregistrementId: string;
    readonly maintenant: Date;
  },
): Promise<Resultat> {
  const enr = await chargerDeLAppareil(db, entree.enregistrementId, entree.appareil.id);
  if (!enr) return INTROUVABLE;
  if (enr.statut === "interrompu") {
    await db.enregistrement.update({
      where: { id: enr.id },
      data: {
        statut: "en_cours",
        updatedAt: entree.maintenant,
        evenements: ajouterAuJournal(enr.evenements, {
          le: entree.maintenant,
          type: "reprise_battement",
        }),
      },
    });
    return ok({ statut: "en_cours", rouvert: true });
  }
  if (enr.statut === "en_cours" || enr.statut === "accord_en_attente") {
    await db.enregistrement.update({
      where: { id: enr.id },
      data: { updatedAt: entree.maintenant },
    });
    return ok({ statut: enr.statut });
  }
  if (
    enr.statut === "refuse" ||
    enr.statut === "accord_non_confirme" ||
    enr.statut === "abandonne"
  ) {
    return echec(
      409,
      "enregistrement_clos",
      "Cet enregistrement est clos : la capture doit s'arrêter.",
      {
        statut: enr.statut,
      },
    );
  }
  return ok({ statut: enr.statut });
}

/** Fin d'une tranche de 180 s : ce que l'extension annonce, pour contrôle. */
export async function terminerTranche(
  db: Db,
  entree: {
    readonly appareil: Appareil;
    readonly enregistrementId: string;
    readonly corps: TFinTranche;
    readonly maintenant: Date;
  },
): Promise<Resultat> {
  const enr = await chargerDeLAppareil(db, entree.enregistrementId, entree.appareil.id);
  if (!enr) return INTROUVABLE;
  if (enr.statut === "accord_en_attente") {
    return echec(409, "accord_en_attente", "Rien n'est reçu avant l'accord.");
  }
  if (!["en_cours", "interrompu", "depose"].includes(enr.statut)) {
    return echec(409, "enregistrement_clos", "Cet enregistrement n'accepte plus de son.", {
      statut: enr.statut,
    });
  }
  const c = entree.corps;
  const tranche = await db.enregistrementTranche.upsert({
    where: {
      enregistrementId_piste_numero: { enregistrementId: enr.id, piste: c.piste, numero: c.numero },
    },
    create: {
      enregistrementId: enr.id,
      piste: c.piste,
      numero: c.numero,
      debutCaptureEpochMs: BigInt(c.debutCaptureEpochMs),
      motifDebut: c.motifDebut,
      statut: "en_reception",
    },
    update: {},
    select: { id: true },
  });
  const recus = await db.enregistrementMorceau.count({ where: { trancheId: tranche.id } });
  await db.enregistrementTranche.update({
    where: { id: tranche.id },
    data: {
      motifDebut: c.motifDebut,
      debutCaptureEpochMs: BigInt(c.debutCaptureEpochMs),
      nbMorceauxAnnonces: c.nbMorceaux,
      empreinteAnnoncee: c.empreinte,
      dureeMs: c.dureeMs,
      niveauFinMuet: c.finMuette,
      statut: recus >= c.nbMorceaux ? "complete" : "en_reception",
    },
  });
  await db.enregistrement.update({ where: { id: enr.id }, data: { updatedAt: entree.maintenant } });
  return ok({ recus, annonces: c.nbMorceaux });
}

/**
 * Fin de l'enregistrement. Une `fin` tardive remplace la clôture d'office
 * (motif, périodes perdues, `incomplet` recalculé) ; jamais après un refus.
 */
export async function terminerSession(
  db: Db,
  entree: {
    readonly appareil: Appareil;
    readonly enregistrementId: string;
    readonly corps: TFinSession;
    readonly maintenant: Date;
  },
): Promise<Resultat> {
  const enr = await chargerDeLAppareil(db, entree.enregistrementId, entree.appareil.id);
  if (!enr) return INTROUVABLE;
  const c = entree.corps;
  const finLe = new Date(c.finLe);

  if (enr.statut === "refuse" || enr.statut === "abandonne") {
    return echec(409, "enregistrement_clos", "Un refus a été déclaré : rien n'est conservé.", {
      statut: enr.statut,
    });
  }
  if (enr.statut === "accord_en_attente" || enr.statut === "accord_non_confirme") {
    // Arrêté avant l'accord : rien n'a été reçu, rien n'est gardé.
    await db.enregistrement.update({
      where: { id: enr.id },
      data: {
        statut: "accord_non_confirme",
        motifArret: "accord_non_confirme",
        fin: finLe,
        evenements: ajouterAuJournal(enr.evenements, {
          le: entree.maintenant,
          type: "fin_sans_accord",
        }),
      },
    });
    return ok({ statut: "accord_non_confirme", detruire: true });
  }
  if (ETATS_TRAITES.includes(enr.statut)) {
    return ok({ statut: enr.statut, deja: true });
  }
  const clotureDOffice = enr.statut === "depose" && enr.motifArret === "cloture_serveur";
  if (enr.statut === "depose" && !clotureDOffice) return ok({ statut: "depose", deja: true });

  // Tranches encore en réception : ce qui manque est constaté ici.
  const tranches = await db.enregistrementTranche.findMany({
    where: { enregistrementId: enr.id },
    select: {
      id: true,
      nbMorceauxAnnonces: true,
      statut: true,
      _count: { select: { morceaux: true } },
    },
  });
  let tranchesIncompletes = 0;
  for (const t of tranches) {
    if (t.statut !== "en_reception" && t.statut !== "incomplete") continue;
    const complete = t.nbMorceauxAnnonces !== null && t._count.morceaux >= t.nbMorceauxAnnonces;
    if (!complete) tranchesIncompletes += 1;
    await db.enregistrementTranche.update({
      where: { id: t.id },
      data: { statut: complete ? "complete" : "incomplete" },
    });
  }

  const incomplet = c.perdus.length > 0 || tranchesIncompletes > 0;
  await db.enregistrement.update({
    where: { id: enr.id },
    data: {
      statut: "depose",
      fin: finLe,
      motifArret: c.motif,
      incomplet,
      perdus: JSON.stringify(c.perdus),
      fenetresHorsAccord: JSON.stringify(c.fenetresHorsAccord),
      audioAPurgerAvant: new Date(finLe.getTime() + CONSERVATION_AUDIO_MAX_JOURS * 86_400_000),
      evenements: ajouterAuJournal(enr.evenements, ...c.evenements, {
        le: entree.maintenant,
        type: clotureDOffice ? "cloture_serveur_corrigee" : "fin",
      }),
    },
  });
  return ok({ statut: "depose", incomplet, corrige: clotureDOffice });
}

type DbPurge = Pick<Db, "enregistrement" | "enregistrementTranche" | "enregistrementMorceau">;

/**
 * Supprime de R2 puis de la base chaque morceau d'un enregistrement refusé.
 * Rend le nombre de morceaux qui ont RÉSISTÉ ; à zéro, les tranches passent
 * `purgee` et `audioSupprimeLe` est posé.
 */
export async function purgerLeSonDUnRefus(
  db: DbPurge,
  stockage: StockageAudio,
  enregistrementId: string,
  maintenant: Date,
): Promise<number> {
  const morceaux = await db.enregistrementMorceau.findMany({
    where: { tranche: { enregistrementId } },
    select: { trancheId: true, seq: true, cleR2: true },
  });
  let resistants = 0;
  for (const m of morceaux) {
    try {
      await stockage.supprimer(m.cleR2);
      await db.enregistrementMorceau.delete({
        where: { trancheId_seq: { trancheId: m.trancheId, seq: m.seq } },
      });
    } catch {
      resistants += 1;
    }
  }
  if (resistants > 0) return resistants;
  await db.enregistrementTranche.updateMany({
    where: { enregistrementId },
    data: { statut: "purgee", audioSupprimeLe: maintenant, tailleOctets: 0 },
  });
  await db.enregistrement.update({
    where: { id: enregistrementId },
    data: { audioSupprimeLe: maintenant },
  });
  return 0;
}

export interface BilanReprisePurges {
  /** Enregistrements refusés dont le son est maintenant entièrement supprimé. */
  readonly purges: number;
  /** Enregistrements refusés dont un morceau résiste encore (R2 en panne). */
  readonly enAttente: number;
}

/**
 * La REPRISE des purges de refus : tout enregistrement `refuse` qui a encore
 * un morceau en base, ou dont `audioSupprimeLe` est nul, est repurgé. Couvre les deux trous : la suppression R2 en panne au
 * moment du refus (le 503 promettait un nouvel essai), et un morceau déposé
 * juste après le refus par une requête déjà en vol.
 *
 * Appelée à chaque requête de l'extension (`garde-route.ts`) et par le balayage
 * (`balayage-enregistreur.ts`). Idempotente ; bornée à 20 enregistrements.
 */
export async function reprendrePurgesDesRefus(
  db: DbPurge,
  stockage: StockageAudio,
  maintenant: Date,
): Promise<BilanReprisePurges> {
  const aReprendre = await db.enregistrement.findMany({
    where: {
      statut: "refuse",
      OR: [{ audioSupprimeLe: null }, { tranches: { some: { morceaux: { some: {} } } } }],
    },
    select: { id: true },
    take: 20,
  });
  let purges = 0;
  let enAttente = 0;
  for (const e of aReprendre) {
    const resistants = await purgerLeSonDUnRefus(db, stockage, e.id, maintenant);
    if (resistants > 0) enAttente += 1;
    else purges += 1;
  }
  return { purges, enAttente };
}
