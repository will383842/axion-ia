/**
 * Pilotage des SALARIÉS — la vue employeur, tous postes confondus.
 *
 * ## 🔴 Ce que cette lecture existe pour corriger
 *
 * Les contrats de travail vivaient sur la fiche de chaque personne, et nulle
 * part ailleurs. Pour savoir qui était sous contrat, qui avait signé, qui
 * attendait son exemplaire, il fallait **ouvrir les fiches une par une**. Sur
 * trois personnes c'est tenable ; sur douze, personne ne le fait — et le jour où
 * un CDD n'a pas été remis dans les délais, on l'apprend trop tard.
 *
 * ⚠️ Une alerte existe pour ce cas précis (`contrat_cdd_non_remis`), et elle ne
 * remplace pas cette vue : une alerte VA CHERCHER quelqu'un quand ça va mal, un
 * tableau permet de VOIR où on en est quand tout va bien. Les deux servent, et
 * la seconde évite que la première soit le premier signal.
 *
 * ## ⚠️ TOUS LES SALARIÉS, PAS SEULEMENT LES FORMATEURS
 *
 * Une secrétaire, un responsable marketing, un développeur ont un contrat de
 * travail exactement comme un formateur — le même délai de remise, la même
 * signature, la même conséquence en cas de manquement. Les séparer en deux
 * listes obligerait à savoir dans laquelle chercher avant de chercher.
 *
 * 🔑 Le `dirigeant` est INCLUS dans la lecture mais il n'a pas de contrat de
 * travail : il relève de son mandat social. Sa ligne le DIT, plutôt que de
 * l'afficher éternellement « sans contrat » — une case vide se lirait comme un
 * oubli, alors que c'est un état normal et définitif.
 *
 * LECTURE SEULE, stub-aware : rend une liste vide si la base est indisponible.
 */

import { prisma } from "@/lib/prisma";

import { joursDepuisEmbauche, remiseCddEnSouffrance } from "./remise-contrat";

/** Où en est le contrat d'une personne. Un seul mot, celui qui commande le geste. */
export type EtatContrat =
  /** Mandat social : pas de contrat de travail, et c'est définitif. */
  | "sans_objet"
  /** Rien n'a encore été saisi ni produit. */
  | "a_etablir"
  /** La pièce existe, personne n'a signé. */
  | "a_signer"
  /** Une des deux parties a signé. */
  | "partiel"
  /** Les deux parties ont signé. */
  | "signe";

export interface LigneSalarie {
  readonly trainerId: string;
  readonly nomComplet: string;
  readonly email: string;
  readonly statut: "salarie" | "dirigeant";
  readonly actif: boolean;
  /** Intitulé du poste. Champ libre — « Secrétaire », « Développeur web »… */
  readonly poste: string | null;
  readonly contratType: "cdi" | "cdd" | null;
  readonly dateEmbauche: Date | null;
  readonly etat: EtatContrat;
  /** Numéro de la pièce au registre, quand elle existe. */
  readonly numeroPiece: string | null;
  /** La pièce porte-t-elle le filigrane SPÉCIMEN ? */
  readonly estSpecimen: boolean;
  /** Parties ayant signé, sur les deux attendues. */
  readonly signatures: number;
  /** Le salarié a-t-il été prévenu que sa pièce l'attend ? */
  readonly prevenu: boolean;
  /** Date de remise consignée, ou `null`. */
  readonly remisAt: Date | null;
  /**
   * 🔴 Le seul signal URGENT de cette vue : un CDD établi, embauche commencée,
   * remise non consignée. Passé deux jours ouvrables, il est requalifiable en
   * CDI (art. L.1242-13 et L.1245-1).
   */
  readonly remiseUrgente: boolean;
  /** Ancienneté de l'embauche en jours calendaires. `null` si à venir. */
  readonly joursDepuisEmbauche: number | null;
}

/**
 * Tous les salariés et le dirigeant, avec l'état de leur contrat.
 *
 * ⚠️ Les INACTIFS sont rendus eux aussi, et c'est volontaire : un contrat non
 * remis ne cesse pas de l'être parce qu'on a désactivé le compte. C'est l'écran
 * qui décide de les replier, pas la lecture — filtrer ici priverait l'appelant
 * d'une information qu'il ne pourrait plus retrouver.
 */
export async function listSalaries(now = new Date()): Promise<LigneSalarie[]> {
  try {
    const rows = await prisma.trainer.findMany({
      where: { statut: { in: ["salarie", "dirigeant"] } },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        statut: true,
        actif: true,
        contratPoste: true,
        contratType: true,
        dateEmbauche: true,
        contratRemisAt: true,
        documentsGeneres: {
          where: { type: "contrat_travail", annuleeAt: null },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
          select: {
            numero: true,
            metadata: true,
            statutSignature: true,
            signatures: { where: { revokedAt: null }, select: { partie: true } },
          },
        },
      },
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
      take: 300,
    });

    return rows.map((t) => {
      const piece = t.documentsGeneres[0];
      // ⚠️ `metadata` est une colonne Json : on teste la forme, on ne caste pas.
      const estSpecimen =
        piece !== undefined &&
        typeof piece.metadata === "object" &&
        piece.metadata !== null &&
        !Array.isArray(piece.metadata) &&
        (piece.metadata as Record<string, unknown>)["specimen"] === true;

      // 🔑 On compte les parties DISTINCTES : deux lignes de la même partie
      // (une révocation suivie d'une nouvelle signature mal filtrée, par
      // exemple) afficheraient « 2/2 » sur un contrat signé d'un seul côté.
      const signatures =
        piece === undefined ? 0 : new Set(piece.signatures.map((s) => s.partie)).size;

      const etat: EtatContrat =
        t.statut === "dirigeant"
          ? "sans_objet"
          : piece === undefined
            ? "a_etablir"
            : signatures === 0
              ? "a_signer"
              : signatures >= 2
                ? "signe"
                : "partiel";

      return {
        trainerId: t.id,
        nomComplet: `${t.prenom} ${t.nom}`.trim(),
        email: t.email,
        statut: t.statut as "salarie" | "dirigeant",
        actif: t.actif,
        poste: t.contratPoste,
        contratType: t.contratType,
        dateEmbauche: t.dateEmbauche,
        etat,
        numeroPiece: piece?.numero ?? null,
        estSpecimen,
        signatures,
        // 🔴 « Prévenu » se déduit ici de l'EXISTENCE de la pièce et de rien
        // d'autre : le journal des e-mails est lu par la fiche, pas par cette
        // liste — une requête par ligne sur trois cents lignes coûterait plus
        // que ce qu'elle apprend. La liste dit « où on en est », la fiche dit
        // « quand exactement ».
        prevenu: piece !== undefined,
        remisAt: t.contratRemisAt,
        remiseUrgente: remiseCddEnSouffrance(
          {
            statut: t.statut as "salarie" | "dirigeant",
            contratType: t.contratType,
            dateEmbauche: t.dateEmbauche,
            contratRemisAt: t.contratRemisAt,
            contratEtabli: piece !== undefined,
          },
          now,
        ),
        joursDepuisEmbauche: joursDepuisEmbauche(t.dateEmbauche, now),
      };
    });
  } catch {
    /*
      🔴 ON N'AVALE L'EXCEPTION QUE POUR LE STUB DE BUILD (recette du 13/09).

      Le `catch` rendait `[]` quelle que soit la panne. Conséquence à l'écran :
      quatre compteurs à zéro peints en VERT, « Aucun salarié enregistré », et
      pas un mot disant que rien n'a été lu. Une base injoignable produisait donc
      l'image exacte d'une entreprise parfaitement à jour — et c'est le seul
      écran où l'on va vérifier qu'aucun CDD n'est en retard.

      ⚠️ Le repli `[]` reste INDISPENSABLE au build : le SSG tourne sur une base
      stub (`stub.invalid`), et y lever ferait échouer la construction de la page.
      Mais il ne couvre plus que ce cas-là ; toute autre panne remonte et la
      frontière d'erreur du segment s'affiche, ce qui est la vérité.
    */
    if (process.env["DATABASE_URL"]?.includes("stub.invalid") === true) return [];
    throw new Error("La liste des salariés n'a pas pu être lue.");
  }
}

/** Ce que l'en-tête de l'écran résume, calculé une fois. */
export interface SyntheseSalaries {
  readonly total: number;
  readonly actifs: number;
  readonly sansContrat: number;
  readonly enAttenteDeSignature: number;
  readonly remisesUrgentes: number;
}

/**
 * 🔑 Les compteurs portent sur les ACTIFS seulement.
 *
 * Un ancien salarié dont le contrat n'a jamais été établi est un fait
 * historique, pas une tâche : le compter parmi les « sans contrat » ferait un
 * chiffre qui ne redescend jamais, et un chiffre qui ne redescend jamais finit
 * par être ignoré — avec les vrais retards qu'il contient.
 */
export function synthetiserSalaries(lignes: readonly LigneSalarie[]): SyntheseSalaries {
  const actifs = lignes.filter((l) => l.actif);
  return {
    total: lignes.length,
    actifs: actifs.length,
    // `sans_objet` exclu : le dirigeant n'a pas de contrat à établir.
    sansContrat: actifs.filter((l) => l.etat === "a_etablir").length,
    enAttenteDeSignature: actifs.filter((l) => l.etat === "a_signer" || l.etat === "partiel")
      .length,
    remisesUrgentes: actifs.filter((l) => l.remiseUrgente).length,
  };
}
