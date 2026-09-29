/**
 * Une base du DOSSIER CLIENT en mémoire, pour les tests de la PR 4 du
 * chantier visio : la base générique (`_prisma-en-memoire.ts`) avec les
 * unicités, les valeurs par défaut et les CONTRÔLES de la migration qui
 * comptent ici — rejoués au COMMIT de chaque transaction, comme les CHECK et
 * les triggers différés de Postgres :
 *
 *   · `faits_valide_range`            — un fait validé est rangé et a un client ;
 *   · `faits_portee_projet`           — portée « projet » ⇔ projet renseigné ;
 *   · `faits_client_de_la_rencontre`  — un fait appartient au client de sa rencontre ;
 *   · `rencontres_statut_fige_calendly`, `rencontres_saisie_sur_fiche_validee`,
 *     `rencontres_test_interne_saisie` ;
 *   · `rencontre_suivis_suite_datee` ;
 *   · `comptes_rendus_un_valide` ;
 *   · `client_fusions_une_vivante_par_absorbee`.
 *
 * Angle mort : les clés étrangères composées et les triggers d'ajout seul ne
 * sont pas rejoués (Gate D les prouve sur une vraie base).
 */

import { prismaEnMemoire, type BaseEnMemoire, type Ligne, type Tables } from "./_prisma-en-memoire";

export class ErreurControle extends Error {}

function controler(t: Tables): void {
  const rencontres = t["rencontre"] ?? [];
  for (const f of t["fait"] ?? []) {
    if (f["statut"] === "valide" && (f["portee"] === "a_ranger" || !f["clientId"])) {
      throw new ErreurControle("faits_valide_range");
    }
    if ((f["portee"] === "projet") !== (f["projetId"] !== null && f["projetId"] !== undefined)) {
      throw new ErreurControle("faits_portee_projet");
    }
    if (f["rencontreId"]) {
      const r = rencontres.find((x) => x["id"] === f["rencontreId"]);
      if (r && (r["clientId"] ?? null) !== (f["clientId"] ?? null)) {
        throw new ErreurControle("faits_client_de_la_rencontre");
      }
    }
  }
  for (const r of rencontres) {
    if (r["source"] === "calendly" && r["calendlyEventId"] && r["statut"]) {
      throw new ErreurControle("rencontres_statut_fige_calendly");
    }
    if (
      r["source"] === "saisie_manuelle" &&
      (!r["clientId"] || r["rattachementStatut"] !== "valide")
    ) {
      throw new ErreurControle("rencontres_saisie_sur_fiche_validee");
    }
    if (r["estTestInterne"] && r["source"] !== "saisie_manuelle") {
      throw new ErreurControle("rencontres_test_interne_saisie");
    }
  }
  for (const s of t["rencontreSuivi"] ?? []) {
    if (s["suite"] && s["suite"] !== "aucune" && !s["suiteLe"]) {
      throw new ErreurControle("rencontre_suivis_suite_datee");
    }
  }
  const valides = (t["compteRendu"] ?? []).filter((c) => c["statut"] === "valide");
  if (new Set(valides.map((c) => c["rencontreId"])).size !== valides.length) {
    throw new ErreurControle("comptes_rendus_un_valide");
  }
  const vivantes = (t["clientFusion"] ?? []).filter((f) => !f["defaiteLe"]);
  if (new Set(vivantes.map((f) => f["absorbeId"])).size !== vivantes.length) {
    throw new ErreurControle("client_fusions_une_vivante_par_absorbee");
  }
}

export function dossierEnMemoire(initial: Tables = {}): BaseEnMemoire {
  return prismaEnMemoire(initial, {
    clesPrimaires: {
      rencontreSuivi: ["rencontreId"],
      battementCircuit: ["nom"],
      alerteVisio: ["cle"],
      calendlyReport: ["ancienEventUri"],
      clientTestInterne: ["clientId"],
      clientFusionElement: ["fusionId", "type", "elementId"],
      projetContact: ["projetId", "contactId", "role"],
    },
    uniques: {
      rencontre: [["calendlyEventId"]],
      rencontreSuivi: [["rencontreId"]],
      rendezVousSuivi: [["calendlyEventId"]],
      compteRendu: [["rencontreId", "version"]],
      projet: [["numero"]],
      client: [["numero"]],
      alerteVisio: [["cle"]],
      battementCircuit: [["nom"]],
      calendlyReport: [["ancienEventUri"], ["nouvelEventUri"]],
    },
    defauts: {
      rencontre: () => ({
        estTestInterne: false,
        rattachementStatut: "a_classer",
        repriseHistorique: false,
        statut: null,
        clientId: null,
        projetId: null,
        clientProposeId: null,
        motifProposition: null,
        calendlyEventId: null,
        debutPrevu: null,
        finPrevue: null,
        createdAt: new Date(),
      }),
      rencontreParticipant: () => ({ clientId: null, contactId: null, emailHash: null }),
      fait: () => ({
        statut: "propose",
        clientId: null,
        projetId: null,
        suivi: null,
        contactSujetId: null,
        contactLocuteurId: null,
        createdAt: new Date(),
      }),
      compteRendu: () => ({ statut: "brouillon", createdAt: new Date() }),
      alerteVisio: () => ({
        premiereLe: new Date(),
        envoyeeLe: null,
        essais: 0,
        dernierEssaiLe: null,
      }),
      clientFusion: () => ({
        le: new Date(),
        defaiteLe: null,
        emiseVersPartnersLe: null,
        sirenReporte: false,
        sirenAbsorbeAvant: null,
      }),
      projet: () => ({ statut: "ouvert", createdAt: new Date() }),
      clientContact: () => ({ statut: "actif", estContactFacturation: false }),
      clientContactAdresse: () => ({ ajouteeLe: new Date() }),
      calendlyReport: () => ({ reporteLe: new Date() }),
    },
    verifier: controler,
  });
}

let n = 0;
/** Un identifiant au format UUID, lisible dans les tests. */
export function id(prefixe = 0): string {
  n += 1;
  return `00000000-0000-4000-${String(prefixe).padStart(4, "0")}-${String(n).padStart(12, "0")}`;
}

/** Une fiche client minimale. */
export function fiche(partiel: Partial<Ligne> & { raisonSociale: string }): Ligne {
  return {
    id: id(1),
    numero: `AXI-CLI-${String(n).padStart(3, "0")}`,
    type: "entreprise",
    siren: null,
    siret: null,
    contactEmail: null,
    notes: null,
    contexteIa: null,
    besoinsIdentifies: null,
    statut: "prospect",
    ...partiel,
  };
}

/** Un rendez-vous Calendly du type « Discutons » (liste blanche). */
export function rendezVousCalendly(partiel: Partial<Ligne> = {}): Ligne {
  const k = id(9).slice(-12);
  return {
    id: `cal_${k}`,
    eventTypeName: "Discutons de votre projet IA",
    linkedJobApplicationId: null,
    status: "scheduled",
    startTime: new Date("2026-10-06T08:00:00Z"),
    endTime: new Date("2026-10-06T08:45:00Z"),
    inviteeName: "Camille Prospect",
    inviteeEmail: "camille@exemple-fictif.fr",
    location: "https://meet.google.com/abc-defg-hij",
    eventUri: `https://api.calendly.com/scheduled_events/ev-${k}`,
    inviteeUri: `https://api.calendly.com/scheduled_events/ev-${k}/invitees/i`,
    rawPayload: { event: { location: { type: "google_conference" } } },
    ...partiel,
  };
}

/** La clé de chiffrement de test (64 hex), le temps d'un test. */
export const CLE_TEST = "0".repeat(63) + "1";
