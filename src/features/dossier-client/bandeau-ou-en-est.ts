/**
 * Le bandeau « Où en est ce client » de la fiche (fiche client à 7 onglets, étape 1, 25/10/2026).
 *
 * PUR : reçoit des lectures déjà faites, ne lit rien, n'envoie rien. Quatre lignes, dans cet
 * ordre : prochain rendez-vous · questionnaire · dernier e-mail · prestations et devis.
 * Vocabulaire du glossaire : Rendez-vous, Questionnaire, Premier e-mail, Rappel, Prestation.
 * ⛔ Ni adresse de destinataire ni corps d'e-mail : des dates, des états et des comptes.
 */

import { motsDEtat } from "@/features/questionnaire-preaudit/personnes";

import type { EchangeDuFil } from "./fil-des-echanges";
import type { QuestionnaireDeLaFiche } from "./questionnaires-de-la-fiche";

export interface EntreeBandeau {
  readonly maintenant: Date;
  readonly rendezVous: ReadonlyArray<{
    readonly titre: string;
    readonly debutPrevu: Date | null;
    readonly statut: string | null;
    readonly estTestInterne: boolean;
  }>;
  readonly questionnaires: ReadonlyArray<
    Pick<QuestionnaireDeLaFiche, "envoyeLe" | "closLe" | "reponses"> &
      Partial<Pick<QuestionnaireDeLaFiche, "parPersonne" | "parPersonneEnPanne">>
  >;
  readonly fil: ReadonlyArray<EchangeDuFil>;
  readonly prestations: ReadonlyArray<{ readonly statut: string }>;
  readonly nbDevis: number;
  /**
   * Les lectures qui n'ont pas répondu. Une lecture en panne n'est PAS « rien » : la ligne dit
   * « lecture impossible » (sinon Will croirait qu'aucun questionnaire n'est parti et le renverrait).
   */
  readonly enPanne?: ReadonlyArray<LigneBandeau["cle"]>;
  /** Sources du fil illisibles (`FilLu.sourcesEnPanne`) : « aucun e-mail » n'est alors pas sûr. */
  readonly sourcesDuFilEnPanne?: number;
}

export const TEXTE_LECTURE_IMPOSSIBLE = "lecture impossible";

const enPanne = (e: EntreeBandeau, cle: LigneBandeau["cle"]): boolean =>
  e.enPanne?.includes(cle) === true;

export interface LigneBandeau {
  readonly cle: "rendez_vous" | "questionnaire" | "email" | "prestations";
  readonly libelle: string;
  readonly texte: string;
  /** Onglet de la fiche où l'on voit le détail. */
  readonly onglet: string;
}

const jourHeure = (d: Date): string =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

const jour = (d: Date): string =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "short",
  }).format(d);

const pluriel = (n: number, un: string, plusieurs: string): string =>
  `${n} ${n > 1 ? plusieurs : un}`;

function ligneRendezVous(e: EntreeBandeau): LigneBandeau {
  if (enPanne(e, "rendez_vous")) {
    return {
      cle: "rendez_vous",
      libelle: "Prochain rendez-vous",
      texte: TEXTE_LECTURE_IMPOSSIBLE,
      onglet: "rendez-vous",
    };
  }
  const aVenir = e.rendezVous
    .filter(
      (r) =>
        !r.estTestInterne &&
        r.debutPrevu !== null &&
        r.debutPrevu.getTime() >= e.maintenant.getTime() &&
        (r.statut === null || r.statut === "planifie"),
    )
    .sort((a, b) => a.debutPrevu!.getTime() - b.debutPrevu!.getTime());
  const prochain = aVenir[0];
  return {
    cle: "rendez_vous",
    libelle: "Prochain rendez-vous",
    texte:
      prochain === undefined
        ? "aucun rendez-vous à venir"
        : `${jourHeure(prochain.debutPrevu!)} · ${prochain.titre}`,
    onglet: "rendez-vous",
  };
}

function ligneQuestionnaire(e: EntreeBandeau): LigneBandeau {
  if (enPanne(e, "questionnaire")) {
    return {
      cle: "questionnaire",
      libelle: "Questionnaire",
      texte: TEXTE_LECTURE_IMPOSSIBLE,
      onglet: "questionnaire",
    };
  }
  const envoyes = e.questionnaires
    .filter((q) => q.envoyeLe !== null)
    .sort((a, b) => b.envoyeLe!.getTime() - a.envoyeLe!.getTime());
  const aLire = e.questionnaires.reduce((s, q) => s + q.reponses.aTraiter, 0);
  let texte: string;
  if (envoyes.length === 0) {
    texte = "pas encore envoyé";
  } else {
    const dernier = envoyes[0]!;
    texte = `envoyé le ${jour(dernier.envoyeLe!)}`;
    const p = dernier.parPersonne?.suivi;
    if (dernier.parPersonneEnPanne === true) {
      texte += " · suivi par personne : lecture impossible";
    } else if (p != null && p.equipe.connue) {
      // Qui a répondu sur combien (2026-10-27) : le suivi personne par personne remplace le simple compte.
      texte += ` · ${p.total.recus} sur ${p.total.attendus} reçus`;
      if (p.collab.enCours > 0) texte += ` · ${p.collab.enCours} en train de remplir`;
      const pasLues = [p.dirigeant, ...p.collaborateurs, ...p.referents].filter(
        (l) => l.pasEncoreLue,
      ).length;
      if (pasLues > 0)
        texte += ` · ${pluriel(pasLues, "réponse pas encore lue", "réponses pas encore lues")}`;
    } else if (p != null) {
      texte += ` · dirigeant : ${motsDEtat(p.dirigeant.etat)} · équipe pas encore déclarée`;
    } else if (aLire > 0) {
      texte += ` · ${pluriel(aLire, "réponse à lire", "réponses à lire")}`;
    } else if (e.questionnaires.some((q) => q.reponses.dirigeant > 0)) texte += " · réponses lues";
    else texte += " · pas de réponse";
  }
  return { cle: "questionnaire", libelle: "Questionnaire", texte, onglet: "questionnaire" };
}

function ligneEmail(e: EntreeBandeau): LigneBandeau {
  const incomplet = enPanne(e, "email") || (e.sourcesDuFilEnPanne ?? 0) > 0;
  // Le fil est trié du plus récent au plus ancien ; on garde le dernier e-mail PARTI : un e-mail
  // en échec, rebondi, annulé ou encore en attente n'est pas « parti ».
  const parti = e.fil.find(
    (x) =>
      x.genre === "email" && x.statutEmail === "sent" && x.date.getTime() <= e.maintenant.getTime(),
  );
  let texte: string;
  if (parti !== undefined) {
    texte = `${parti.titre} · ${jour(parti.date)}`;
    if (incomplet) texte += " · lecture incomplète";
  } else {
    texte = incomplet ? TEXTE_LECTURE_IMPOSSIBLE : "aucun e-mail envoyé";
  }
  return { cle: "email", libelle: "Dernier e-mail", texte, onglet: "emails" };
}

function lignePrestations(e: EntreeBandeau): LigneBandeau {
  const enCours = e.prestations.filter((p) => p.statut === "ouvert" || p.statut === "gagne").length;
  const prestations = enPanne(e, "prestations")
    ? TEXTE_LECTURE_IMPOSSIBLE
    : e.prestations.length === 0
      ? "aucune prestation"
      : enCours === 0
        ? `${pluriel(e.prestations.length, "prestation", "prestations")} (aucune en cours)`
        : pluriel(enCours, "prestation en cours", "prestations en cours");
  const devis = e.nbDevis === 0 ? "aucun devis" : pluriel(e.nbDevis, "devis", "devis");
  return {
    cle: "prestations",
    libelle: "Prestations",
    texte: `${prestations} · ${devis}`,
    onglet: "prestations",
  };
}

export function construireBandeau(e: EntreeBandeau): ReadonlyArray<LigneBandeau> {
  return [ligneRendezVous(e), ligneQuestionnaire(e), ligneEmail(e), lignePrestations(e)];
}
