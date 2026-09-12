/**
 * Qualiopi — D'où vient le mandat de facturation d'un sous-traitant.
 *
 * Le mandat n'est pas une pièce séparée : c'est **l'article 4 bis du contrat de
 * sous-traitance**, ajouté le 2026-09-09. Un sous-traitant qui signe son contrat
 * donne donc le mandat par le même geste — et le lui redemander sur un
 * formulaire serait lui faire signer deux fois la même chose.
 *
 * Ce module répond à une seule question : **à quelle date ce sous-traitant a-t-il
 * donné mandat, et par quel acte ?**
 *
 * ── ⛔ CE QUI REND CETTE DÉRIVATION PIÉGEUSE, ET POURQUOI ELLE A ATTENDU ──────
 *
 * 🔴 Une première version de cette idée voulait dériver la date du mandat de
 * `Trainer.sousTraitantContratSigneAt`. **C'était faux, et dangereux.**
 *
 * Jusqu'au 2026-09-10, `GABARIT_VERSIONS.contrat_sous_traitance` valait `1` — et
 * il valait déjà `1` AVANT l'ajout de la clause 4 bis, parce que l'incrément
 * avait été oublié. Un contrat signé en août et un contrat signé en septembre
 * enregistraient donc la MÊME version : rien ne les distinguait. Dériver sur une
 * date aurait affirmé qu'un mandat existe sur la foi d'un indice qui ne le
 * prouve pas — **fabriquer la preuve**, ce que le mécanisme de versions existe
 * précisément pour empêcher.
 *
 * La dérivation ne devient sûre qu'appuyée sur la VERSION DU GABARIT SIGNÉ, qui
 * est la seule chose établissant que le texte signé contenait la clause. C'est
 * ce que fait ce module.
 *
 * ⚠️ Tant que `contrat_sous_traitance` n'est pas passé à 2, aucune pièce ne
 * porte la version requise et ce module ne dérive RIEN. C'est le comportement
 * voulu : inerte plutôt que faux.
 */

import { prisma } from "@/lib/prisma";

/**
 * Version du contrat de sous-traitance à partir de laquelle le texte signé
 * contient l'article 4 bis (mandat de facturation).
 *
 * ⚠️ Comparaison `>=` et non `===` : une v3 future contiendrait toujours la
 * clause. **Si une version future la RETIRAIT, ce seuil deviendrait faux** —
 * c'est la seule évolution qui casserait ce module en silence, et elle est
 * signalée ici plutôt que découverte plus tard. La garde d'empreinte
 * (`gabarit-empreinte.spec.ts`) force à trancher à chaque retouche du texte :
 * c'est là qu'on s'en apercevrait.
 */
export const VERSION_CONTRAT_AVEC_MANDAT = 2;

/** Statuts d'un contrat dont la signature est ACQUISE. */
const SIGNATURE_ACQUISE = "signee" as const;

export type SourceMandat =
  /** Saisi à la main sur la fiche — un mandat papier, ou signé hors de l'outil. */
  | { readonly source: "saisie"; readonly signeAt: Date }
  /** Dérivé du contrat de sous-traitance signé, article 4 bis. */
  | { readonly source: "contrat"; readonly signeAt: Date; readonly numeroContrat: string }
  /** Aucun mandat : le sous-traitant émet lui-même ses factures. */
  | { readonly source: "aucune" };

export interface MandatResolu {
  readonly origine: SourceMandat;
  /** Date de signature retenue, ou `null` s'il n'y a pas de mandat. */
  readonly signeAt: Date | null;
  /**
   * Date de révocation. TOUJOURS celle saisie à la main, jamais dérivée.
   *
   * 🔑 Révoquer un mandat est un acte écrit distinct : rien dans le contrat
   * signé ne peut l'exprimer. Dériver une révocation serait inventer un acte
   * que personne n'a posé — l'inverse exact du risque qu'on évite en amont.
   */
  readonly revoqueAt: Date | null;
}

/** Les champs de mandat portés par la fiche du formateur. */
export interface MandatSaisi {
  readonly mandatAutofacturationSigneAt: Date | null;
  readonly mandatAutofacturationRevoqueAt: Date | null;
}

/**
 * Résout le mandat d'un sous-traitant : saisie manuelle d'abord, contrat signé
 * ensuite.
 *
 * 🔑 **LA SAISIE MANUELLE GAGNE TOUJOURS, et ce n'est pas une préférence.** Un
 * mandat papier signé avant l'entrée du formateur dans l'outil est valable, et
 * il est ANTÉRIEUR au contrat électronique. Laisser la dérivation l'écraser
 * repousserait la date du mandat, et rendrait irrégulières — a posteriori — des
 * factures parfaitement régulières le jour de leur émission. On ne remplace
 * jamais une donnée qu'un humain a établie par une donnée qu'on déduit.
 *
 * ⚠️ La date retenue sur le contrat est celle de la DERNIÈRE signature apposée,
 * pas de la première. C'est le choix conservateur : le mandat n'engage qu'une
 * fois la pièce complète, et une date plus tardive couvre MOINS de factures. En
 * cas de doute sur une date de mandat, se tromper vers le tard est sans
 * conséquence ; vers le tôt rend une pièce irrégulière.
 *
 * Stub-aware (try/catch) : appelable au build SSG.
 */
export async function resoudreMandat(trainerId: string, saisi: MandatSaisi): Promise<MandatResolu> {
  const revoqueAt = saisi.mandatAutofacturationRevoqueAt;

  if (saisi.mandatAutofacturationSigneAt !== null) {
    return {
      origine: { source: "saisie", signeAt: saisi.mandatAutofacturationSigneAt },
      signeAt: saisi.mandatAutofacturationSigneAt,
      revoqueAt,
    };
  }

  try {
    const contrats = await prisma.documentGenere.findMany({
      where: {
        trainerId,
        type: "contrat_sous_traitance",
        statutSignature: SIGNATURE_ACQUISE,
        // Une pièce annulée n'engage plus personne : le mandat qu'elle portait
        // ne survit pas à son annulation.
        annuleeAt: null,
      },
      select: {
        numero: true,
        metadata: true,
        signatures: { where: { revokedAt: null }, select: { signeAt: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    for (const c of contrats) {
      if (versionGabarit(c.metadata) < VERSION_CONTRAT_AVEC_MANDAT) continue;
      // Dernière signature apposée : la pièce n'engage qu'une fois complète.
      // `signeAt` est NON NULL au schéma : une ligne de signature sans date
      // n'existe pas. On ne filtre donc pas — un filtre inutile laisserait
      // croire au lecteur suivant que le cas se produit.
      const dates = c.signatures.map((s) => s.signeAt);
      if (dates.length === 0) continue;
      const signeAt = dates.reduce((a, b) => (a.getTime() >= b.getTime() ? a : b));
      return {
        origine: { source: "contrat", signeAt, numeroContrat: c.numero },
        signeAt,
        revoqueAt,
      };
    }
  } catch {
    // Stub de build, ou lecture indisponible : on ne dérive pas. Le refus
    // d'émettre qui s'ensuit est le comportement prudent — jamais l'inverse.
    return { origine: { source: "aucune" }, signeAt: null, revoqueAt };
  }

  return { origine: { source: "aucune" }, signeAt: null, revoqueAt };
}

/**
 * Version du gabarit portée par l'instantané d'une pièce.
 *
 * ⚠️ Absente → **1**, comme partout ailleurs dans ce dépôt : les pièces
 * générées avant l'introduction du mécanisme n'en portent pas, et les lire
 * comme « version courante » ferait passer un contrat d'août pour un contrat
 * contenant la clause. En cas de doute, on refuse.
 */
function versionGabarit(metadata: unknown): number {
  if (typeof metadata !== "object" || metadata === null) return 1;
  const rd = (metadata as Record<string, unknown>)["renderData"];
  if (typeof rd !== "object" || rd === null) return 1;
  const v = (rd as Record<string, unknown>)["gabaritVersion"];
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 1;
}
