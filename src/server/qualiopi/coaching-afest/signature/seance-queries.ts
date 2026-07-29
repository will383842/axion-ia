/**
 * AFEST 1-to-1 — Lecture de l'état de signature des séances d'un parcours.
 *
 * LECTURE SEULE, aucune écriture. Alimente l'écran du formateur
 * (`EmargementAfest`) et rien d'autre pour l'instant ; si un second écran
 * apparaît (console admin), il DOIT passer par ici. Deux lectures parallèles
 * divergeraient sur ce qui est affiché comme signé, et l'une finirait par
 * contredire l'autre sur la même séance.
 *
 * ## Ce que cette lecture doit garantir
 *
 * 🔴 **Le texte présenté au signataire vient de `mentionCompleteAfest`.** Le
 * tuple haché scelle `MENTION_VERSION_AFEST` ; prouver « ce qu'il a signé »
 * suppose que l'écran et l'empreinte concordent. Une mention réécrite dans le
 * composant ferait pointer des empreintes scellées vers un texte qui n'a jamais
 * été affiché — le tuteur, tiers non contractant, est précisément celui qui
 * pourrait l'opposer.
 *
 * 🔴 **Aucune case « signé » sans de quoi l'étayer.** Chaque rôle signé sort
 * d'ici avec son nom FIGÉ (celui de la ligne, pas celui du parcours au moment du
 * rendu), son horodatage en heure de Paris et son empreinte `selfHash`. C'est le
 * défaut exact que ce chantier vient de retirer côté AFEST : quatre booléens
 * posés au clic, rendus « signé » sur le PDF, sans signataire ni empreinte.
 *
 * 🔴 **La signabilité vient de `etatSeance`, jamais d'une règle réécrite ici.**
 * La garde temporelle par séance est la même que celle du service : si l'écran
 * appliquait sa propre version, il proposerait des boutons que le service
 * refuserait, et un refus après clic se lit comme une panne.
 *
 * ⚠️ **Aucune adresse électronique ne sort d'ici.** `signataireEmail` reste
 * scellé en base : il sert au recalcul de l'empreinte et au binding du canal par
 * lien, pas à l'affichage. L'adresse du tuteur n'est lue que pour savoir si elle
 * EXISTE — une absence bloque sa signature côté service.
 *
 * Node runtime (Prisma). Stub-aware par ricochet : `findFirst` rend `null` au
 * build SSG, ce que l'appelant traite comme « pas de parcours », cas normal.
 */

import { prisma } from "@/lib/prisma";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { readCoachingForDocs } from "../coaching-snapshot";
import {
  etatSeance,
  horairesSeance,
  type MotifNonSignable,
  type StatutSeance,
} from "./seances-signables";
import { mentionCompleteAfest, MENTION_RECUEIL_ATTESTE_PAR_OF } from "./mentions-afest";
import type { MethodeSignatureAfest, RoleSignataireAfest } from "./seance-signature-hash";

/** Les trois rôles, dans l'ordre d'affichage. Ordre stable : l'écran s'y fie. */
const ROLES: readonly RoleSignataireAfest[] = ["beneficiaire", "formateur", "tuteur"] as const;

/**
 * Libellés des rôles.
 *
 * ⚠️ La distinction n'est PAS cosmétique et elle est portée par le schéma :
 * bénéficiaire et formateur apposent une SIGNATURE-PRÉSENCE ; le tuteur
 * entreprise apporte une CO-ATTESTATION DE RÉALITÉ. Il est un tiers, il n'était
 * pas nécessairement en salle, et lui faire signer « j'atteste avoir suivi »
 * serait faux — c'est déjà ce que dit `mentionAttestationAfest`.
 */
const LIBELLES_ROLE: Readonly<Record<RoleSignataireAfest, string>> = {
  beneficiaire: "Bénéficiaire — signature de présence",
  formateur: "Formateur AFEST — signature de présence",
  tuteur: "Tuteur en entreprise — co-attestation de réalité",
};

/**
 * Modalités, en clair.
 *
 * La modalité est HACHÉE dans le tuple : la dire à l'écran n'est pas un détail
 * d'ergonomie, c'est une partie de ce que la ligne prouve. Une confirmation
 * accessible et un tracé manuscrit ne se valent pas en apparence — ils se valent
 * en valeur probante, et c'est le rendu qui doit le porter, pas le silence.
 */
const LIBELLES_METHODE: Readonly<Record<MethodeSignatureAfest, string>> = {
  trace: "signature tracée",
  papier_scanne: "feuille papier signée puis photographiée",
  confirmation_accessible: "confirmation nominative (modalité accessible)",
};

/**
 * Motifs de non-signabilité, en clair, DITS AVANT LE CLIC.
 *
 * 🔴 Ces phrases doublent celles de `MESSAGES` dans le service — qui ne les
 * exporte pas — mais elles ne servent PAS au même moment : le service refuse
 * APRÈS coup, l'écran empêche AVANT. Si les deux divergeaient un jour, la
 * conséquence serait cosmétique (deux formulations du même refus) et jamais
 * probante : c'est toujours le service qui tranche, jamais cette table.
 */
const MOTIFS_LISIBLES: Readonly<Record<MotifNonSignable, string>> = {
  seance_neutralisee: "Séance annulée ou justifiée comme non tenue : elle ne s'émarge pas.",
  horaires_indeterminables:
    "Durée de la séance non renseignée : ses horaires réels sont indéterminables et la feuille serait insuffisamment probante. Renseignez la durée dans le compte-rendu avant de faire signer.",
  seance_non_commencee: "Séance à venir : elle se signera le moment venu, pas avant.",
  seance_trop_ancienne:
    "Délai de signature dépassé (48 h après la fin de la séance). Une séance ne se signe pas des mois après sa tenue : contactez l'organisme.",
  deja_signe: "Déjà signée à ce titre.",
};

const jourLisibleFmt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

/**
 * Horodatage affiché, EN HEURE DE PARIS.
 *
 * ⚠️ `timeZone` explicite : sans elle, le rendu suivrait le fuseau du serveur.
 * Une signature apposée à 00 h 30 heure de Paris s'afficherait « la veille » sur
 * un conteneur en UTC, sur la pièce même qui doit dire QUAND elle a été apposée.
 */
const horodatageParis = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

/** Où en est UN rôle sur UNE séance. */
export interface EtatRoleSeance {
  role: RoleSignataireAfest;
  libelle: string;
  /** Signé et non révoqué ? */
  signee: boolean;
  /** Nom FIGÉ dans la ligne de signature. Jamais recalculé depuis le parcours. */
  signataireNom: string | null;
  /** Horodatage lisible, heure de Paris. */
  signeAtLisible: string | null;
  /** Empreinte vérifiable. C'est elle qui rend la signature opposable. */
  empreinte: string | null;
  /** Modalité employée, en clair. */
  methodeLisible: string | null;
  /** Vrai si la ligne porte un `recueilliParTrainerId` — plafond probant à dire. */
  recueilliSurPosteFormateur: boolean;
  /** Le formateur peut-il faire signer ce rôle MAINTENANT, sur son poste ? */
  peutSigner: boolean;
  /** Pourquoi pas, dit AVANT le clic. `null` quand `peutSigner` ou déjà signé. */
  blocage: string | null;
  /** Nom attendu du signataire — nécessaire à la modalité accessible. */
  signataireAttenduNom: string | null;
  /** Texte EXACT présenté au signataire. Vide quand la signature est impossible. */
  mentions: string[];
}

/** Une séance et ses trois rôles. */
export interface EtatSeanceSignature {
  compteRenduSeanceId: string;
  /** Jour civil lisible, heure de Paris. */
  jourLisible: string;
  /** Horaires RÉELS `HH:MM–HH:MM`, ou `null` s'ils sont indéterminables. */
  horaires: string | null;
  /** Blocage au grain SÉANCE (indépendant du rôle), ou `null`. */
  blocageSeance: string | null;
  roles: EtatRoleSeance[];
}

export interface EtatSignaturesAfest {
  coachingSessionId: string;
  seances: EtatSeanceSignature[];
  /**
   * 🔴 Le plafond probant, affiché et non seulement documenté.
   *
   * Repris TEL QUEL de `MENTION_RECUEIL_ATTESTE_PAR_OF`, qui est aussi la phrase
   * scellée dans les mentions du canal « poste du formateur ». Le réécrire ici
   * ferait diverger l'affichage de ce qui a été signé.
   */
  plafondProbant: string;
}

/** Identité d'un rôle telle que la résout le serveur — jamais le client. */
interface IdentiteRole {
  nom: string | null;
  /** Message de blocage si l'identité manque, `null` si elle est complète. */
  blocage: string | null;
}

/**
 * Résout le nom d'un rôle, et dit ce qui manque.
 *
 * 🔴 MIROIR de `resoudreIdentite` du service, qui n'est pas exporté. La
 * duplication est assumée et bornée : ici on ne fait que DÉCIDER D'AFFICHER un
 * bouton ; là-bas on REFUSE une écriture. Si les deux divergeaient, le pire cas
 * serait un bouton proposé puis refusé — désagréable, jamais probant. L'inverse
 * (un service laxiste rattrapé par l'écran) serait, lui, inacceptable : c'est
 * pourquoi la garde reste dans le service.
 *
 * ⚠️ Le repli littéral « Bénéficiaire » qui existe côté génération de documents
 * n'a rien à faire ici : sceller un nom générique produirait une signature
 * juridiquement anonyme. On bloque plutôt que de fabriquer.
 */
function resoudreIdentiteRole(
  role: RoleSignataireAfest,
  cs: {
    beneficiaireNom: string | null;
    tuteurEntrepriseNom: string | null;
    tuteurEntrepriseEmail: string | null;
    trainer: { nom: string; prenom: string };
    trainee: { nom: string; prenom: string } | null;
  },
): IdentiteRole {
  if (role === "beneficiaire") {
    const nom = cs.trainee
      ? `${cs.trainee.prenom} ${cs.trainee.nom}`.trim()
      : (cs.beneficiaireNom ?? "").trim();
    return nom === ""
      ? {
          nom: null,
          blocage:
            "Le nom du bénéficiaire n'est pas renseigné sur ce parcours. Une signature sans signataire identifié ne prouve rien : l'organisme doit le renseigner avant.",
        }
      : { nom, blocage: null };
  }
  if (role === "formateur") {
    const nom = `${cs.trainer.prenom} ${cs.trainer.nom}`.trim();
    return nom === ""
      ? { nom: null, blocage: "Votre nom n'est pas renseigné sur votre fiche formateur." }
      : { nom, blocage: null };
  }
  const nom = (cs.tuteurEntrepriseNom ?? "").trim();
  // ⚠️ L'adresse du tuteur est lue pour savoir si elle EXISTE, et n'est jamais
  // retournée : le service refuse sans elle, l'écran doit donc le dire avant.
  const email = (cs.tuteurEntrepriseEmail ?? "").trim();
  return nom === "" || email === ""
    ? {
        nom: null,
        blocage:
          "Le tuteur en entreprise (nom ET adresse électronique) n'est pas renseigné sur ce parcours.",
      }
    : { nom, blocage: null };
}

/**
 * État de signature de toutes les séances d'un parcours AFEST, pour SON formateur.
 *
 * Retourne `null` quand le parcours n'existe pas, n'appartient pas à ce
 * formateur, ou n'est pas cadré en AFEST. Les trois cas se traitent pareil côté
 * écran : le bloc d'émargement par séance ne s'affiche pas. Afficher un bloc vide
 * sur un parcours non-AFEST laisserait croire à une pièce manquante.
 *
 * ⚠️ `maintenant` est un PARAMÈTRE, résolu UNE fois pour tout le rendu. Deux
 * appels séparés pourraient tomber de part et d'autre de la fenêtre de
 * rattrapage et afficher une séance signable dont la signature serait refusée.
 */
export async function lireEtatSignaturesAfest(
  coachingSessionId: string,
  trainerId: string,
  maintenant: Date = new Date(),
): Promise<EtatSignaturesAfest | null> {
  // 🔴 La garde de propriété est DANS le `where`, pas après la lecture : sans
  // elle, n'importe quel formateur authentifié ferait exécuter la requête
  // complète — nom du bénéficiaire, du tuteur, toutes les séances — sur
  // n'importe quel identifiant de parcours.
  const cs = await prisma.coachingSession.findFirst({
    where: { id: coachingSessionId, trainerId },
    select: {
      id: true,
      estAfest: true,
      // Contenu pédagogique figé (snapshot WS9) ou repli LIVE : c'est l'intitulé
      // que le service SCELLERA. La mention doit citer le même, sinon l'écran et
      // l'empreinte ne parlent pas de la même formation.
      coachingSnapshot: true,
      interventionSlug: true,
      objectifsPedagogiques: true,
      heuresPrevuesConvention: true,
      certificationType: true,
      codeRncp: true,
      codeRs: true,
      numeroEnregistrementFc: true,
      beneficiaireNom: true,
      tuteurEntrepriseNom: true,
      tuteurEntrepriseEmail: true,
      trainer: { select: { nom: true, prenom: true } },
      trainee: { select: { nom: true, prenom: true } },
      comptesRendus: {
        orderBy: [{ dateSeance: "desc" }, { id: "desc" }],
        select: {
          id: true,
          dateSeance: true,
          dureeMinutes: true,
          statut: true,
          signatures: {
            // Une signature révoquée n'est plus une preuve : elle ne doit pas
            // s'afficher comme telle, et elle ne doit pas non plus bloquer une
            // re-signature légitime.
            where: { revokedAt: null },
            select: {
              role: true,
              signataireNom: true,
              signeAt: true,
              selfHash: true,
              methode: true,
              recueilliParTrainerId: true,
              // ⚠️ `signataireEmail` VOLONTAIREMENT absent : il ne doit jamais
              // atteindre le navigateur.
            },
          },
        },
      },
    },
  });
  if (cs === null || !cs.estAfest) return null;

  const identite = await getOrganismeIdentite();
  const resolu = readCoachingForDocs(cs.coachingSnapshot, cs);

  // Résolues UNE fois pour toutes les séances : elles ne dépendent que du
  // parcours, et les recalculer par séance ouvrirait la porte à une divergence
  // entre deux lignes de la même liste.
  const identites = new Map<RoleSignataireAfest, IdentiteRole>(
    ROLES.map((role) => [role, resoudreIdentiteRole(role, cs)]),
  );
  const beneficiaireNom = identites.get("beneficiaire")?.nom ?? null;

  const seances: EtatSeanceSignature[] = cs.comptesRendus.map((cr) => {
    const statut = cr.statut as StatutSeance;
    const h = horairesSeance(cr.dateSeance, cr.dureeMinutes);
    const posees = new Map(cr.signatures.map((s) => [s.role as RoleSignataireAfest, s]));

    // État au grain SÉANCE, rôle mis de côté (`dejaSigne: false`) : c'est ce qui
    // vaut pour l'en-tête. Le motif par rôle est calculé juste après, et lui
    // tient compte des signatures déjà posées.
    const etatBrut = etatSeance(
      { id: cr.id, debut: cr.dateSeance, dureeMinutes: cr.dureeMinutes, statut, dejaSigne: false },
      maintenant,
    );

    const jourLisible = jourLisibleFmt.format(cr.dateSeance);

    const roles: EtatRoleSeance[] = ROLES.map((role) => {
      const posee = posees.get(role);
      const id = identites.get(role) ?? { nom: null, blocage: "Identité indisponible." };

      // 🔴 La garde temporelle vient de `etatSeance`, appelée AVEC l'état réel
      // de ce rôle. C'est la même fonction que celle du service : une règle
      // réécrite ici finirait par proposer ce que le service refuse.
      const etat = etatSeance(
        {
          id: cr.id,
          debut: cr.dateSeance,
          dureeMinutes: cr.dureeMinutes,
          statut,
          dejaSigne: posee !== undefined,
        },
        maintenant,
      );

      // ⚠️ La mention du TUTEUR cite nommément le bénéficiaire (il atteste SUR
      // lui). Sans ce nom, la phrase serait tronquée et l'empreinte scellerait
      // un texte incomplet. Le service, lui, ne vérifie que l'identité du
      // signataire : ce blocage-ci n'existe QUE dans l'écran, et il est
      // volontaire — mieux vaut ne pas proposer que sceller une mention creuse.
      const blocageMentionTuteur =
        role === "tuteur" && beneficiaireNom === null
          ? "Le nom du bénéficiaire manque : la co-attestation du tuteur le cite nommément et serait incomplète."
          : null;

      const blocage = posee
        ? null
        : !etat.signable
          ? MOTIFS_LISIBLES[etat.motif]
          : (id.blocage ?? blocageMentionTuteur);

      const peutSigner = posee === undefined && etat.signable && blocage === null;

      return {
        role,
        libelle: LIBELLES_ROLE[role],
        signee: posee !== undefined,
        signataireNom: posee?.signataireNom ?? null,
        signeAtLisible: posee === undefined ? null : horodatageParis.format(posee.signeAt),
        empreinte: posee?.selfHash ?? null,
        methodeLisible:
          posee === undefined ? null : LIBELLES_METHODE[posee.methode as MethodeSignatureAfest],
        recueilliSurPosteFormateur: posee?.recueilliParTrainerId != null,
        peutSigner,
        blocage,
        signataireAttenduNom: id.nom,
        // 🔴 Construites ICI, par `mentionCompleteAfest`, et JAMAIS réécrites
        // dans le composant : `MENTION_VERSION_AFEST` est scellée dans le tuple,
        // et prouver « ce qu'il a signé » suppose que les deux concordent.
        //
        // `recueilliParOf: true` — ce canal est celui du poste du formateur, et
        // la mention doit donc porter le plafond probant. En canal par lien elle
        // serait fausse.
        mentions:
          peutSigner && h !== null
            ? mentionCompleteAfest(
                role,
                {
                  formationIntitule: resolu.intitule,
                  jourLisible,
                  horaires: `${h.heureDebut}–${h.heureFin}`,
                  organisme: identite.raisonSociale,
                  beneficiaireNom: beneficiaireNom ?? "",
                },
                true,
              )
            : [],
      };
    });

    return {
      compteRenduSeanceId: cr.id,
      jourLisible,
      horaires: h === null ? null : `${h.heureDebut}–${h.heureFin}`,
      blocageSeance: etatBrut.signable ? null : MOTIFS_LISIBLES[etatBrut.motif],
      roles,
    };
  });

  return {
    coachingSessionId: cs.id,
    seances,
    plafondProbant: MENTION_RECUEIL_ATTESTE_PAR_OF,
  };
}
