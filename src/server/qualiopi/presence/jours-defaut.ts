/**
 * Journées PROPOSÉES par défaut à la création d'une session (décision D14).
 *
 * Sans génération automatique, `session_jours` reste vide : le formateur devrait
 * saisir les journées à la main, et jusqu'à 52 fois pour une session récurrente.
 * Une table qu'on ne remplit pas ne corrige rien.
 *
 * ⚠️ CE SONT DES PROPOSITIONS, PAS DES HORAIRES CONSTATÉS.
 *
 * La distinction est ce qui sépare ce module du « 09h00–17h00 » codé en dur que
 * tout ce chantier s'emploie à supprimer. Ce dernier était invisible, non
 * corrigeable, et atterrissait tel quel sur une pièce à valeur probante. Ici les
 * journées sont écrites en base, affichées à l'admin, modifiables avant toute
 * signature, et portent `horairesConfirmes = false` tant que personne ne les a
 * validées. Une valeur par défaut assumée et visible se défend ; la même valeur
 * muette ne se défend pas.
 *
 * Logique pure — aucun import Prisma, aucune horloge.
 */

import type { JourSession } from "./creneaux";

/** Heures de formation effectives d'une journée pleine, par défaut. */
export const HEURES_JOURNEE_PLEINE = 7;

/** Début de journée proposé. L'admin le corrige si sa session commence ailleurs. */
export const HEURE_DEBUT_DEFAUT = "09:00";

/**
 * Pause méridienne ajoutée à l'amplitude, en minutes.
 *
 * Une journée de 7 h de formation s'étale sur 8 h (09:00–17:00). En dessous du
 * seuil d'une demi-journée, il n'y a pas de pause à compter : 4 h de formation
 * tiennent en 09:00–13:00.
 */
const PAUSE_MERIDIENNE_MIN = 60;
const SEUIL_DEMI_JOURNEE_HEURES = 4;

/** Plafond de sécurité : au-delà, c'est une saisie erronée, pas un parcours. */
export const MAX_JOURS_GENERES = 60;

function versHHMM(minutesDepuisMinuit: number): string {
  const h = Math.floor(minutesDepuisMinuit / 60);
  const m = minutesDepuisMinuit % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function minutesDe(heure: string): number {
  return Number(heure.slice(0, 2)) * 60 + Number(heure.slice(3, 5));
}

/** Vrai pour un samedi ou un dimanche (date ISO interprétée en UTC). */
function estWeekend(iso: string): boolean {
  const j = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return j === 0 || j === 6;
}

function jourSuivant(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Horaires proposés pour une journée portant `heures` heures de formation.
 *
 * Exposée pour être testée seule : c'est ici que se décide ce qui sera affiché
 * sur une feuille d'émargement si personne ne corrige.
 */
export function horairesProposes(heures: number): { heureDebut: string; heureFin: string } {
  const debut = minutesDe(HEURE_DEBUT_DEFAUT);
  const pause = heures > SEUIL_DEMI_JOURNEE_HEURES ? PAUSE_MERIDIENNE_MIN : 0;
  const fin = debut + Math.round(heures * 60) + pause;
  return { heureDebut: HEURE_DEBUT_DEFAUT, heureFin: versHHMM(fin) };
}

/**
 * Heures de formation EFFECTIVES d'une journée, déduites de ses horaires réels.
 *
 * Inverse exact de `horairesProposes` : on retranche la pause méridienne dès que
 * l'amplitude dépasse celle d'une demi-journée majorée de la pause. En dessous,
 * il n'y a pas de pause à retrancher — 09:00–13:00 fait bien 4 h de formation.
 *
 * 🔴 Utilité : `dureeReelleHeures` n'avait AUCUN écrivain côté sessions
 * collectives (seule la clôture AFEST 1-to-1 l'écrivait). Elle restait donc nulle
 * indéfiniment — la fiche session affichait « — h », le certificat de réalisation
 * sortait sans durée, et toute ventilation horaire OPCO était refusée faute de
 * durée. Les horaires, eux, étaient déjà déclarés dans `session_jours`.
 */
export function heuresEffectivesJournee(heureDebut: string, heureFin: string): number {
  const amplitude = minutesDe(heureFin) - minutesDe(heureDebut);
  if (!Number.isFinite(amplitude) || amplitude <= 0) return 0;
  const seuilAvecPause = SEUIL_DEMI_JOURNEE_HEURES * 60 + PAUSE_MERIDIENNE_MIN;
  const pause = amplitude > seuilAvecPause ? PAUSE_MERIDIENNE_MIN : 0;
  return Number(((amplitude - pause) / 60).toFixed(2));
}

/**
 * Durée totale de formation d'une session, somme de ses journées réellement
 * animées. `null` quand aucune journée n'est déclarée : on ne substitue PAS la
 * durée prévue au catalogue, qui n'est pas une constatation.
 */
export function heuresReellesDepuisJournees(
  jours: ReadonlyArray<{ heureDebut: string; heureFin: string }>,
): number | null {
  if (jours.length === 0) return null;
  const total = jours.reduce(
    (acc, j) => acc + heuresEffectivesJournee(j.heureDebut, j.heureFin),
    0,
  );
  return total > 0 ? Number(total.toFixed(2)) : null;
}

/**
 * Répartit une durée totale en journées de formation.
 *
 * 14 h → deux journées de 7 h. 10 h → une journée de 7 h et une demi-journée de
 * 3 h. 4 h → une seule demi-journée. Le reliquat forme toujours la DERNIÈRE
 * journée, jamais une journée intercalaire tronquée : c'est ainsi que les
 * sessions se déroulent réellement.
 */
export function repartirHeuresEnJournees(
  dureeHeures: number,
  heuresParJour: number = HEURES_JOURNEE_PLEINE,
): number[] {
  if (!Number.isFinite(dureeHeures) || dureeHeures <= 0) return [];
  if (!Number.isFinite(heuresParJour) || heuresParJour <= 0) return [];

  const journees: number[] = [];
  let restant = dureeHeures;
  while (restant > 0 && journees.length < MAX_JOURS_GENERES) {
    const part = Math.min(heuresParJour, restant);
    journees.push(Number(part.toFixed(2)));
    restant = Number((restant - part).toFixed(2));
  }
  return journees;
}

/**
 * Journées proposées pour une session, à partir de sa date de début et de sa
 * durée totale.
 *
 * Les week-ends sont sautés — une session de 14 h qui démarre un vendredi tient
 * le vendredi et le lundi, pas le vendredi et le samedi. C'est la même règle que
 * le repli de `genererCreneaux`, appliquée ici à la proposition initiale.
 *
 * 🔴 SAUF la première journée, qui est reprise telle quelle : elle n'est pas
 * déduite, c'est `dateDebutIso` que l'admin a saisi (cf. le commentaire dans le
 * corps de la fonction).
 *
 * @param dateDebutIso Jour civil `YYYY-MM-DD` (heure de Paris) du premier jour.
 * @param dureeHeures  Durée TOTALE de la session.
 * @param heuresParJour Heures effectives par journée pleine (défaut 7).
 */
export function genererJoursParDefaut(input: {
  dateDebutIso: string;
  dureeHeures: number;
  heuresParJour?: number;
}): JourSession[] {
  const parts = repartirHeuresEnJournees(input.dureeHeures, input.heuresParJour);
  if (parts.length === 0) return [];

  const jours: JourSession[] = [];
  let iso = input.dateDebutIso;
  for (const [rang, heures] of parts.entries()) {
    // 🔴 Le saut de week-end ne s'applique QU'À PARTIR DE LA DEUXIÈME journée.
    //
    // Constaté sur le premier dossier réel, AXI-SESS-2026-005 : session du
    // dimanche 16/08/2026, journée proposée le lundi 17/08. Le commentaire
    // d'origine assumait le raisonnement à voix haute — « personne ne planifie
    // délibérément le premier jour d'une formation un samedi » — et c'est ce
    // « personne » qui était faux.
    //
    // La distinction n'est pas de commodité, elle est de NATURE : les journées
    // suivantes sont DÉDUITES (une formation de 14 h démarrée un vendredi tient
    // vendredi + lundi, pas vendredi + samedi), la première est SAISIE. Déplacer
    // une donnée déduite est un service ; déplacer une donnée saisie est une
    // contradiction du choix de l'utilisateur.
    //
    // Ce que ça coûtait : ces journées portent les dates et horaires imprimés
    // sur la FEUILLE D'ÉMARGEMENT, pièce à valeur probante des indicateurs 9 et
    // 11. Confirmée telle quelle, la feuille aurait porté « 17/08 » quand la
    // convention porte « 16/08 » — deux pièces du même dossier qui se
    // contredisent, sur exactement ce que l'émargement sert à prouver.
    if (rang > 0) {
      while (estWeekend(iso)) iso = jourSuivant(iso);
    }
    jours.push({ date: iso, ...horairesProposes(heures) });
    iso = jourSuivant(iso);
  }
  return jours;
}
