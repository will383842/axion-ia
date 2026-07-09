// Cockpit — HUB DE PILOTAGE : logique PURE (aucune I/O, aucun Prisma).
//
// Les autres vues répondent chacune à une question (« qui est chargé ? »,
// « qu'encaisse-t-on ? »). Le hub répond à une seule : **qu'est-ce qui ne va
// pas, maintenant ?** Il agrège les signaux des trois piliers — planning (A),
// conformité formateur (B), rémunération (C) — que rien ne réunissait.
//
// ── Ce hub n'est PAS le moteur d'alertes Qualiopi ────────────────────────────
// `server/qualiopi/alertes/evaluateur.ts` surveille la CONFORMITÉ de l'organisme
// (documents, BPF, certification, factures impayées). Il ignore totalement les
// conflits de formateur, les sessions non staffées, la surcharge et les relevés
// d'honoraires. Les deux ne se recouvrent pas : celui-ci est opérationnel,
// celui-là est réglementaire.
//
// ── Pourquoi une fonction pure ───────────────────────────────────────────────
// Elle reçoit des données déjà lues (`HubEntrees`) et `maintenant` en paramètre.
// Aucun `new Date()` implicite : un hub dont le verdict dépend de l'heure du test
// est un hub qu'on ne peut pas tester. La lecture vit dans `hub-queries.ts`.
//
// ── Ce qui est CRITIQUE, et ce qui ne l'est pas ──────────────────────────────
// Critique = l'exécution est compromise, ou l'organisme s'expose : un formateur
// double-booké ne peut pas être à deux endroits ; un formateur non conforme
// envoyé chez un client engage la responsabilité solidaire (art. L.8222-1) ;
// une session qui démarre sous 7 jours sans personne pour l'animer.
// Attention = de l'argent ou du confort en jeu, pas l'exécution.

import { findConflicts, mobiliseLeFormateur } from "./conflicts";
import { niveauCharge, type ChargeFormateur } from "./charge";
import { planningDetailHref, type PlanningEvent } from "./types";

export type NiveauSignal = "critique" | "attention";

export type CodeSignal =
  | "session_non_staffee"
  | "conflit_formateur"
  | "formateur_non_conforme"
  | "surcharge_formateur"
  | "releve_a_valider"
  | "anomalie_remuneration";

/** Une entrée cliquable d'un signal — le pilote doit pouvoir agir en un clic. */
export interface SignalItem {
  label: string;
  href: string;
}

export interface Signal {
  code: CodeSignal;
  niveau: NiveauSignal;
  titre: string;
  /** Ce que le pilote doit comprendre, et pourquoi ça compte. */
  explication: string;
  items: SignalItem[];
}

/** Délai sous lequel une session non staffée devient critique. */
export const JOURS_AVANT_CRITIQUE = 7;

/** Formateur affecté, vu par le moteur de conformité (pilier B). */
export interface ConformiteFormateur {
  trainerId: string;
  nom: string;
  conforme: boolean;
  /** Manquements BLOQUANTS (les alertes n'empêchent pas d'affecter). */
  nbBloquants: number;
}

/** Relevé d'honoraires en attente d'un humain (pilier C). */
export interface ReleveEnAttente {
  id: string;
  trainerNom: string;
  totalTtcCents: number;
}

/** Ligne de rémunération portant un motif d'anomalie (pilier C). */
export interface AnomalieRemuneration {
  id: string;
  trainerNom: string;
  motif: string;
}

export interface HubEntrees {
  /** Prestations du mois, DÉDUPLIQUÉES par `key` (pas la Map jour→events). */
  events: readonly PlanningEvent[];
  charges: readonly ChargeFormateur[];
  conformites: readonly ConformiteFormateur[];
  relevesEnAttente: readonly ReleveEnAttente[];
  anomalies: readonly AnomalieRemuneration[];
}

/* ────────────────────────────────────────────────────────────────────────────── */

/** Une prestation encore à venir (ou en cours) : le passé ne s'arbitre plus. */
function estAVenir(e: PlanningEvent, maintenant: Date): boolean {
  const fin = e.fin ?? e.debut;
  return fin.getTime() >= maintenant.getTime();
}

function joursAvant(e: PlanningEvent, maintenant: Date): number {
  return (e.debut.getTime() - maintenant.getTime()) / 86_400_000;
}

/** Formateur d'un événement, `null` compris quand la clé est simplement absente. */
function formateurDe(e: PlanningEvent): string | null {
  return e.formateurId ?? null;
}

/** Euros lisibles pour un humain, à partir de centimes. */
function euros(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}

/**
 * Sessions à venir que personne n'anime. Avec la timeline, le seul écran qui les
 * rend visibles — et la seule chose qu'un pilote doit corriger avant que le
 * client ne s'en aperçoive.
 */
function signalNonStaffees(
  events: readonly PlanningEvent[],
  maintenant: Date,
  adminPrefix: string,
): Signal | null {
  const orphelines = events.filter(
    (e) => mobiliseLeFormateur(e) && estAVenir(e, maintenant) && formateurDe(e) === null,
  );
  if (orphelines.length === 0) return null;

  const imminente = orphelines.some((e) => joursAvant(e, maintenant) <= JOURS_AVANT_CRITIQUE);
  return {
    code: "session_non_staffee",
    niveau: imminente ? "critique" : "attention",
    titre: `${orphelines.length} prestation(s) sans formateur`,
    explication: imminente
      ? `Au moins une démarre sous ${JOURS_AVANT_CRITIQUE} jours et personne ne l'anime.`
      : "Aucune n'est imminente, mais elles doivent être staffées.",
    items: [...orphelines]
      .sort((a, b) => a.debut.getTime() - b.debut.getTime())
      .map((e) => ({
        label: `${e.titre} — ${e.clientNom ?? "client inconnu"}`,
        href: planningDetailHref(adminPrefix, e),
      })),
  };
}

/**
 * Formateurs à qui l'on demande d'être à deux endroits à la fois. Toujours
 * critique : contrairement à une surcharge, un chevauchement ne s'absorbe pas.
 *
 * `findConflicts` exclut déjà la cible elle-même et les prestations annulées, et
 * traite les créneaux jointifs comme non conflictuels.
 */
function signalConflits(
  events: readonly PlanningEvent[],
  maintenant: Date,
  adminPrefix: string,
): Signal | null {
  const parFormateur = new Map<string, PlanningEvent[]>();
  for (const e of events) {
    const fid = formateurDe(e);
    if (fid === null || !estAVenir(e, maintenant)) continue;
    const acc = parFormateur.get(fid) ?? [];
    acc.push(e);
    parFormateur.set(fid, acc);
  }

  const items: SignalItem[] = [];
  const vus = new Set<string>();
  for (const liste of parFormateur.values()) {
    for (const cible of liste) {
      for (const autre of findConflicts(cible, liste)) {
        // Une paire (A,B) se voit deux fois : depuis A, puis depuis B. On la
        // normalise pour ne l'annoncer qu'une seule fois.
        const paire = [cible.key, autre.key].sort().join("|");
        if (vus.has(paire)) continue;
        vus.add(paire);
        items.push({
          label: `${cible.formateurNom ?? "Formateur"} : « ${cible.titre} » chevauche « ${autre.titre} »`,
          href: planningDetailHref(adminPrefix, cible),
        });
      }
    }
  }
  if (items.length === 0) return null;

  return {
    code: "conflit_formateur",
    niveau: "critique",
    titre: `${items.length} conflit(s) de formateur`,
    explication: "Un formateur est affecté à deux prestations qui se chevauchent.",
    items,
  };
}

/**
 * Formateurs non conformes AFFECTÉS à une prestation à venir. Un formateur non
 * conforme au repos n'est pas une urgence ; envoyé chez un client, il expose
 * l'organisme (responsabilité solidaire, Qualiopi ind. 27).
 */
function signalNonConformes(
  events: readonly PlanningEvent[],
  conformites: readonly ConformiteFormateur[],
  maintenant: Date,
  adminPrefix: string,
): Signal | null {
  const affectes = new Set<string>();
  for (const e of events) {
    const fid = formateurDe(e);
    if (fid !== null && mobiliseLeFormateur(e) && estAVenir(e, maintenant)) affectes.add(fid);
  }

  const fautifs = conformites.filter((c) => !c.conforme && affectes.has(c.trainerId));
  if (fautifs.length === 0) return null;

  return {
    code: "formateur_non_conforme",
    niveau: "critique",
    titre: `${fautifs.length} formateur(s) non conforme(s) affecté(s)`,
    explication:
      "Pièces bloquantes manquantes alors qu'une prestation est planifiée. Envoyer ce formateur expose l'organisme.",
    items: [...fautifs]
      .sort((a, b) => b.nbBloquants - a.nbBloquants || a.nom.localeCompare(b.nom, "fr"))
      .map((c) => ({
        label: `${c.nom} — ${c.nbBloquants} pièce(s) bloquante(s)`,
        href: `/fr/${adminPrefix}/qualiopi/formateurs/${c.trainerId}`,
      })),
  };
}

/** Formateurs au-delà du seuil de surcharge. À arbitrer, pas à ignorer. */
function signalSurcharge(charges: readonly ChargeFormateur[], adminPrefix: string): Signal | null {
  const surcharges = charges.filter((c) => niveauCharge(c.tauxPct) === "surcharge");
  if (surcharges.length === 0) return null;

  return {
    code: "surcharge_formateur",
    niveau: "attention",
    titre: `${surcharges.length} formateur(s) en surcharge`,
    explication: "Quasi saturés sur le mois : arbitrer (report, renfort, sous-traitance).",
    items: surcharges.map((c) => ({
      label: `${c.nom} — ${c.tauxPct} % (${c.joursMobilises}/${c.capaciteJours} j)`,
      href: `/fr/${adminPrefix}/qualiopi/formateurs/${c.trainerId}`,
    })),
  };
}

/** Relevés d'honoraires qu'un humain n'a pas encore relus : de l'argent en attente. */
function signalReleves(releves: readonly ReleveEnAttente[], adminPrefix: string): Signal | null {
  if (releves.length === 0) return null;
  const totalTtc = releves.reduce((t, r) => t + r.totalTtcCents, 0);
  return {
    code: "releve_a_valider",
    niveau: "attention",
    titre: `${releves.length} relevé(s) d'honoraires à traiter`,
    explication: `${euros(totalTtc)} TTC attendent une relecture avant facturation.`,
    items: releves.map((r) => ({
      label: `${r.trainerNom} — ${euros(r.totalTtcCents)} TTC`,
      href: `/fr/${adminPrefix}/qualiopi/remuneration/${r.id}`,
    })),
  };
}

/** Montants que le moteur a refusé de deviner (barème absent, heures absentes…). */
function signalAnomalies(
  anomalies: readonly AnomalieRemuneration[],
  adminPrefix: string,
): Signal | null {
  if (anomalies.length === 0) return null;
  return {
    code: "anomalie_remuneration",
    niveau: "attention",
    titre: `${anomalies.length} anomalie(s) de rémunération`,
    explication: "Le moteur a refusé de deviner un montant. Une ligne à 0 € s'y cache peut-être.",
    items: anomalies.map((a) => ({
      label: `${a.trainerNom} — ${a.motif}`,
      href: `/fr/${adminPrefix}/qualiopi/remuneration`,
    })),
  };
}

const ORDRE_NIVEAU: Record<NiveauSignal, number> = { critique: 0, attention: 1 };

/**
 * Le hub : tous les signaux actifs, les critiques d'abord, puis les plus gros.
 * Un tableau vide n'est pas un échec — c'est le seul bon résultat possible.
 *
 * `maintenant` est un paramètre, jamais un `new Date()` caché : le verdict d'un
 * hub ne doit pas dépendre de l'instant où le test s'exécute.
 */
export function construireHub(
  entrees: HubEntrees,
  maintenant: Date,
  adminPrefix: string,
): Signal[] {
  const signaux = [
    signalNonStaffees(entrees.events, maintenant, adminPrefix),
    signalConflits(entrees.events, maintenant, adminPrefix),
    signalNonConformes(entrees.events, entrees.conformites, maintenant, adminPrefix),
    signalSurcharge(entrees.charges, adminPrefix),
    signalReleves(entrees.relevesEnAttente, adminPrefix),
    signalAnomalies(entrees.anomalies, adminPrefix),
  ].filter((s): s is Signal => s !== null);

  return signaux.sort((a, b) => {
    const d = ORDRE_NIVEAU[a.niveau] - ORDRE_NIVEAU[b.niveau];
    return d !== 0 ? d : b.items.length - a.items.length;
  });
}

/** Y a-t-il au moins un signal critique ? Pilote le bandeau de tête de la page. */
export function aDesSignauxCritiques(signaux: readonly Signal[]): boolean {
  return signaux.some((s) => s.niveau === "critique");
}
