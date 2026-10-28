// « Où en sont les réponses » : le suivi du questionnaire avant audit, personne par personne
// (2026-10-27). Composant SERVEUR, lecture seule : il ne déclenche aucun envoi et n'affiche jamais
// le contenu d'une réponse — seulement des états, des dates, des comptes et des identités.
// ⛔ Le code du dirigeant n'y figure nulle part ; les autres codes se lisent « …abcd ».

import type { QuestionnaireDeLaFiche } from "@/features/dossier-client/questionnaires-de-la-fiche";
import {
  ligneEquipe,
  phraseEnTete,
  type LignePersonne,
  type SuiviParPersonne as Suivi,
} from "@/features/questionnaire-preaudit/personnes";
import type { SuiviLu } from "@/features/questionnaire-preaudit/suivi-par-personne";

import { AdminBadge } from "../ui/AdminBadge";
import { AdminBloc, type AdminBlocTeinte } from "../ui/AdminBloc";
import { AdminTable, type AdminTableColumn } from "../ui/AdminTable";

import { LireBrouillonPreaudit, type ActionLireBrouillon } from "./LireBrouillonPreaudit";

const FORMAT_JOUR_HEURE = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const FORMAT_JOUR = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
});

/** « 26/10 à 09:00 », heure de Paris. */
const jourHeure = (d: Date): string => {
  const p = Object.fromEntries(FORMAT_JOUR_HEURE.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p["day"]}/${p["month"]} à ${p["hour"]}:${p["minute"]}`;
};
const jour = (d: Date): string => FORMAT_JOUR.format(d);

const HEURE_MS = 3_600_000;
const SAUVEGARDE_TROP_ANCIENNE_H = 36;

interface Ligne {
  readonly l: LignePersonne;
  readonly titre: string;
}

function teinteDe(s: Suivi): AdminBlocTeinte {
  if (!s.equipe.connue) return "gris";
  return phraseEnTete(s).startsWith("Tout est reçu") ? "vert" : "ambre";
}

function badgeDeLaReponse(l: LignePersonne): React.ReactElement {
  switch (l.etat) {
    case "recu":
      return (
        <AdminBadge tone="success">
          Reçue{l.recuLe ? ` le ${jourHeure(l.recuLe)}` : ""}
          {l.pasEncoreLue ? " · pas encore lue" : ""}
        </AdminBadge>
      );
    case "ecartee":
      return <AdminBadge tone="outline">Mise de côté</AdminBadge>;
    case "en_cours":
      return <AdminBadge tone="warning">En train de remplir</AdminBadge>;
    case "ouvert":
      return <AdminBadge tone="neutral">Ouvert, rien d&apos;enregistré</AdminBadge>;
    case "pas_de_lien_prevu":
      return <AdminBadge tone="outline">Pas de lien prévu</AdminBadge>;
    case "lien_sans_code":
      return <AdminBadge tone="outline">Lien sans code</AdminBadge>;
    default:
      return <AdminBadge tone="outline">Pas de nouvelles</AdminBadge>;
  }
}

function texteDuTaux(l: LignePersonne): string {
  const t = l.taux;
  if (t === null || t.pourcentage === null) return "—";
  let s = `${t.essentiellesRemplies} sur ${t.essentiellesTotal} questions essentielles (${t.pourcentage} %)`;
  if (t.reponsesEnPlus > 0) {
    s += ` · ${t.reponsesEnPlus} réponse${t.reponsesEnPlus > 1 ? "s" : ""} détaillée${t.reponsesEnPlus > 1 ? "s" : ""} en plus`;
  }
  return t.estimation ? `${s} (estimation)` : s;
}

function texteDuLienDirigeant(q: QuestionnaireDeLaFiche): string {
  switch (q.invitationStatut) {
    case "sent":
      return q.envoyeLe ? `E-mail envoyé le ${jourHeure(q.envoyeLe)}` : "E-mail envoyé";
    case "bounced":
      return "E-mail rejeté par la boîte du destinataire";
    case "failed":
      return "E-mail : échec d'envoi";
    case "cancelled":
      return "E-mail annulé";
    default:
      return "E-mail pas encore parti";
  }
}

function texteDuLien(l: LignePersonne, q: QuestionnaireDeLaFiche): string {
  switch (l.role) {
    case "dirigeant":
      return texteDuLienDirigeant(q);
    case "referent":
      return "proposé au dirigeant (transmis ? visible seulement s'il est ouvert)";
    case "journee_dirigeant":
      return "lien de la journée type du dirigeant";
    case "non_retrouvee":
      return "lien absent de la liste du dirigeant";
    default:
      if (l.etat === "pas_de_lien_prevu") return "pas de lien (choix du dirigeant)";
      if (l.etat === "lien_sans_code") return "lien sans code : suivi impossible";
      return "préparé par le dirigeant (transmis ? visible seulement s'il est ouvert)";
  }
}

function texteOuvert(l: LignePersonne, s: Suivi, afficherOuvertures: boolean): string {
  if (!afficherOuvertures) return "non suivi";
  if (s.ouverturesIndisponibles) return "suivi des ouvertures indisponible";
  if (l.ouverture === null) return "pas encore";
  const n = l.ouverture.nombre;
  return `${n} fois, dernière le ${jourHeure(l.ouverture.derniere)}`;
}

/** Les lignes à montrer, avec un titre sans jamais d'identité réservée à un autre rôle. */
function lignesAMontrer(s: Suivi, voitBrouillons: boolean): Ligne[] {
  let anonyme = 0;
  const nomVisible = (l: LignePersonne): string | null => {
    if (l.nom === null) return null;
    if (l.sourceNom === "brouillon" && !voitBrouillons) return null;
    // Équipe lue dans le brouillon du dirigeant : ses noms sont du brouillon, même étiquetés « equipe ».
    if (l.sourceNom === "equipe" && s.equipe.source === "brouillon" && !voitBrouillons) return null;
    return l.nom;
  };
  const titre = (l: LignePersonne): string => {
    const nom = nomVisible(l);
    const fonction = nom !== null && l.fonction ? ` · ${l.fonction}` : "";
    const code = l.codeCourt === null ? "sans code" : `lien ${l.codeCourt}`;
    switch (l.role) {
      case "dirigeant":
        return l.aVerifier ? "Dirigeant (réponse reçue sans son code : à vérifier)" : "Dirigeant";
      case "referent":
        return `Référent informatique${nom !== null ? ` : ${nom}` : ""}${
          l.codeCourt !== null ? ` (${code})` : ""
        }`;
      case "journee_dirigeant":
        return "Journée type du dirigeant (en plus, hors du total)";
      case "non_retrouvee":
        return `Personne non retrouvée dans l'équipe (${code})${nom !== null ? ` : ${nom}` : ""}`;
      default:
        return `${nom ?? `Collaborateur ${++anonyme}`}${fonction}${
          l.rapprochement === "nom" ? " (rapprochée par le nom, à vérifier)" : ""
        }`;
    }
  };
  const toutes: LignePersonne[] = [
    s.dirigeant,
    ...s.collaborateurs,
    ...s.referents,
    ...(s.journeeDirigeant === null ? [] : [s.journeeDirigeant]),
  ];
  return toutes.map((l) => ({ l, titre: titre(l) }));
}

function ConservationEtSauvegarde({
  q,
  p,
}: {
  q: QuestionnaireDeLaFiche;
  p: SuiviLu;
}): React.ReactElement {
  const c = p.controle;
  const sauvegarde = q.derniereSauvegarde;
  const age =
    sauvegarde instanceof Date ? (new Date().getTime() - sauvegarde.getTime()) / HEURE_MS : null;
  const alerte =
    c.illisibles > 0 ||
    sauvegarde === undefined ||
    sauvegarde === null ||
    sauvegarde === "illisible" ||
    (age !== null && age > SAUVEGARDE_TROP_ANCIENNE_H);
  const reponses = `${c.reponses} réponse${c.reponses > 1 ? "s" : ""}`;
  const brouillons = `${c.brouillons} brouillon${c.brouillons > 1 ? "s" : ""}`;
  const lisibles =
    c.illisibles > 0
      ? `${c.illisibles} illisible${c.illisibles > 1 ? "s" : ""} (la clé de chiffrement est-elle bien en place ?)`
      : "tous lisibles";
  const derniere =
    sauvegarde instanceof Date
      ? `dernière sauvegarde de la base réussie le ${jourHeure(sauvegarde)}`
      : sauvegarde === "illisible"
        ? "dernière sauvegarde : lecture impossible"
        : "aucune sauvegarde réussie de la base trouvée";
  return (
    <p
      data-bloc="conservation"
      data-alerte={alerte ? "oui" : "non"}
      className={`mt-[var(--space-admin-2)] rounded-[var(--radius-admin-md)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] ${
        alerte
          ? "bg-[color:var(--color-admin-warning-soft)] text-[color:var(--color-admin-warning-fg)]"
          : "bg-[color:var(--color-admin-neutral-soft)] text-[color:var(--color-admin-fg-muted)]"
      }`}
    >
      Conservation : {reponses} et {brouillons} gardés, {lisibles} · rien n&apos;est supprimé
      automatiquement (5 ans) · {derniere}
    </p>
  );
}

export function SuiviParPersonne({
  q,
  ficheHref,
  afficherOuvertures,
  voitBrouillons,
  peutExporter,
  lireBrouillon,
}: {
  q: QuestionnaireDeLaFiche;
  ficheHref: string;
  /** Interrupteur `QUESTIONNAIRE_SUIVI_ENABLED` : ouvertures notées. */
  afficherOuvertures: boolean;
  /** Super-administrateur, interrupteur allumé : peut voir les noms tirés d'un brouillon. */
  voitBrouillons: boolean;
  /** Super-administrateur, interrupteur d'export allumé. */
  peutExporter: boolean;
  lireBrouillon: ActionLireBrouillon | undefined;
}): React.ReactElement | null {
  if (q.parPersonneEnPanne === true) {
    return <p>Suivi par personne : lecture impossible pour le moment.</p>;
  }
  const p = q.parPersonne;
  if (p == null) return null;
  const s = p.suivi;
  const lignes = lignesAMontrer(s, voitBrouillons);

  const colonnes: ReadonlyArray<AdminTableColumn<Ligne>> = [
    {
      key: "personne",
      header: "Personne",
      cell: ({ titre }) => <span className="font-medium">{titre}</span>,
    },
    { key: "lien", header: "Lien", cell: ({ l }) => texteDuLien(l, q) },
    { key: "ouvert", header: "Ouvert", cell: ({ l }) => texteOuvert(l, s, afficherOuvertures) },
    {
      key: "brouillon",
      header: "Brouillon",
      cell: ({ l }) => (
        <>
          {l.brouillonMajLe ? `enregistré le ${jourHeure(l.brouillonMajLe)}` : "—"}
          {lireBrouillon !== undefined && l.brouillonId !== null ? (
            <LireBrouillonPreaudit brouillonId={l.brouillonId} action={lireBrouillon} />
          ) : null}
        </>
      ),
    },
    { key: "reponse", header: "Réponse", cell: ({ l }) => badgeDeLaReponse(l) },
    { key: "taux", header: "Taux", cell: ({ l }) => texteDuTaux(l) },
  ];

  return (
    <AdminBloc
      teinte={teinteDe(s)}
      titre="Où en sont les réponses"
      niveau={3}
      className="mt-[var(--space-admin-2)]"
      id={`suivi-${q.id}`}
    >
      <div data-bloc="suivi-par-personne" className="space-y-[var(--space-admin-2)]">
        <p className="font-medium">{phraseEnTete(s)}</p>
        {s.equipe.connue ? <p>{ligneEquipe(s)}</p> : null}
        {s.effectif !== null && (s.equipe.source !== "brouillon" || voitBrouillons) ? (
          <p className="text-[length:var(--text-admin-xs)]">
            Effectif indiqué par le dirigeant : {s.effectif.tranche}
            {s.effectif.remarque === "liste_incomplete"
              ? " · la liste semble incomplète"
              : s.effectif.remarque === "liste_depasse"
                ? " · la liste dépasse l'effectif indiqué"
                : ""}
          </p>
        ) : null}
        {s.fichesSansNom > 0 ? (
          <p className="text-[length:var(--text-admin-xs)]">
            {s.fichesSansNom} fiche{s.fichesSansNom > 1 ? "s" : ""} de l&apos;équipe sans prénom ni
            nom : pas de ligne possible.
          </p>
        ) : null}
        {q.expireLe ? (
          <p className="text-[length:var(--text-admin-xs)]">
            Le lien reçoit des réponses jusqu&apos;au {jour(q.expireLe)}.
          </p>
        ) : null}
        <AdminTable
          columns={colonnes}
          rows={lignes}
          getRowId={({ l }) => l.cle}
          caption="Réponses attendues, personne par personne"
        />
        <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          Taux = questions essentielles de son parcours (celles que tout le monde voit sans cliquer
          « Aller plus loin »).
        </p>
        <ConservationEtSauvegarde q={q} p={p} />
        {peutExporter ? (
          <p>
            <a
              className="admin-link"
              href={`${ficheHref}/questionnaire/export?q=${encodeURIComponent(q.id)}`}
            >
              Télécharger une copie de toutes les réponses (à garder en lieu sûr)
            </a>
          </p>
        ) : null}
      </div>
    </AdminBloc>
  );
}
