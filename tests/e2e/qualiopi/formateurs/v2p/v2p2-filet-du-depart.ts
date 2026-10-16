// V2P2 — Le FILET DU DÉPART, séquence par séquence : une relance déjà en file (ou
// garée, puis approuvée tard) est-elle retenue quand son interrupteur est coupé, ou
// quand le formateur a répondu ?
//
// Requête directe, sans écran : pour chaque campagne du registre RÉEL
// (`REGISTRE_CAMPAGNES`), on appelle le lecteur que le worker d'e-mails appelle au
// départ (`RELECTURES_AU_DEPART.get(gabarit)`), sur un job de la forme exacte que le
// passage enfile (gabarit, destinataire, fiche, étape), contre la base réelle du banc.
// Les interrupteurs sont coupés PAR LA CONSOLE (cascade comprise), puis remis à
// l'identique. Le lecteur rend le motif de la retenue, ou `null` : l'e-mail part.

import { RELECTURES_AU_DEPART } from "@/server/email/relecture-au-depart";
import { REGISTRE_CAMPAGNES } from "@/server/relances/registre-campagnes";

import {
  basculer,
  creerAdmin,
  creerCandidatureFreelance,
  creerIndependant,
  adresse,
  menage,
  prisma,
  remettreInterrupteurs,
  type Admin,
} from "./outils";

/**
 * Les interrupteurs dont chaque séquence dépend, d'après `docs/formateurs/ordre-d-allumage.md`
 * et le registre : la clé déclarée par la campagne, et sa clé mère (dont la coupure coupe
 * la fille en cascade). Les clés qu'il faut d'abord allumer (éteintes sur le banc) suivent.
 */
const COUPURES: Readonly<Record<string, readonly string[]>> = {
  "dossier-relance": ["relances_auto", "dossier_en_ligne"],
  "invit-relance": ["invitation_auto", "echange_ouvert"],
  "contrat-relance": ["relances_auto", "dossier_en_ligne"],
  "contrat-version-relance": ["relances_auto", "nouvelle_version_contrat"],
  "lettre-1re": ["lettre_auto", "contrat_auto"],
  "lettre-j3": ["lettre_auto", "contrat_auto"],
  "nda-a-transmettre": ["relances_auto", "dossier_en_ligne"],
  "bilan-fin-formation": ["bilan_fin_formation"],
};

/** À allumer avant de pouvoir les couper (éteintes par défaut sur le banc). */
const A_ALLUMER = ["lettre_auto", "bilan_fin_formation", "nouvelle_version_contrat"];

export interface CasFilet {
  readonly campagne: string;
  readonly gabarit: string;
  /** `temoin` : tout allumé ; `coupe:<clé>` ; `reponse` : le formateur a répondu. */
  readonly evenement: string;
  readonly motif: string | null;
}

export interface ObservationsV2p2 {
  readonly adresses: string[];
  readonly allumage: Record<string, boolean>;
  readonly cas: CasFilet[];
}

export default async function v2p2(): Promise<ObservationsV2p2> {
  try {
    const direction: Admin = await creerAdmin("super_admin");
    const allumage: Record<string, boolean> = {};
    for (const cle of A_ALLUMER) allumage[cle] = (await basculer(direction, cle, true)).ok;

    const t = await creerIndependant({
      actif: true,
      dossierStatut: "a_completer",
      sousTraitantNda: "en cours",
    } as never);
    const emailCandidat = adresse("candidat");
    const candidature = await creerCandidatureFreelance(emailCandidat);

    const cas: CasFilet[] = [];
    const lire = async (c: (typeof REGISTRE_CAMPAGNES)[number], etape: string) => {
      const index = c.regle.etapes.findIndex((e) => e.id === etape);
      const variante = c.variante?.(etape) ?? index + 1;
      const surFiche = c.entityType === "Trainer";
      const lecteur = RELECTURES_AU_DEPART.get(c.gabarit);
      if (lecteur === undefined) return "(aucun lecteur au départ)";
      return lecteur({
        template: c.gabarit,
        to: surFiche ? t.email : emailCandidat,
        entityType: c.entityType,
        entityId: surFiche ? t.id : candidature,
        payload: { prenom: t.prenom, etape: variante },
      });
    };

    // Les relances de pièces (F40, F41) relisent au départ leur pièce d'origine
    // (`origineRelance`) : sans pièce réelle à renouveler, leur lecteur retient toujours,
    // et la matrice ne distinguerait rien. Elles sont hors de ce scénario (rapport : écart).
    const AVEC_PIECE = new Set(["vigilance", "piece", "seuil-urssaf"]);
    for (const c of REGISTRE_CAMPAGNES.filter((x) => !AVEC_PIECE.has(x.id))) {
      const etape = c.regle.etapes[0]?.id ?? "";
      cas.push({
        campagne: c.id,
        gabarit: c.gabarit,
        evenement: "temoin",
        motif: await lire(c, etape),
      });
      for (const cle of COUPURES[c.id] ?? []) {
        const r = await basculer(direction, cle, false);
        if (!r.ok) throw new Error(`banc : la console refuse de couper « ${cle} » : ${r.error}`);
        cas.push({
          campagne: c.id,
          gabarit: c.gabarit,
          evenement: `coupe:${cle}`,
          motif: await lire(c, etape),
        });
        // Remise à l'identique (cascade comprise) avant la clé suivante.
        await remettreInterrupteurs();
        for (const k of A_ALLUMER) await basculer(direction, k, true);
      }
      {
        const reponse = await prisma.reponseEntranteFormateur.create({
          data: {
            ...(c.entityType === "Trainer" ? { trainerId: t.id } : { candidatureId: candidature }),
            source: "hors_circuit",
            recuLe: new Date(),
            auto: false,
            auteurId: direction.id,
          },
          select: { id: true },
        });
        cas.push({
          campagne: c.id,
          gabarit: c.gabarit,
          evenement: "reponse",
          motif: await lire(c, etape),
        });
        await prisma.reponseEntranteFormateur.delete({ where: { id: reponse.id } });
      }
    }
    return { adresses: [t.email, emailCandidat], allumage, cas };
  } finally {
    await remettreInterrupteurs();
    await menage();
  }
}
