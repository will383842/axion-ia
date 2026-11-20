/**
 * Fiche d'un formateur — blocs de LECTURE (présentation seulement).
 *
 * Extraits de `page.tsx` pour être rendus et testés isolément. Aucune requête,
 * aucun calcul métier : la page passe des valeurs déjà lues et ce fichier les
 * affiche. Composants serveur, aucun JavaScript client.
 */

import { Ban, CalendarClock, CircleCheck, TriangleAlert, UserX } from "lucide-react";

import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminBloc } from "@/components/admin/ui/AdminBloc";
import { AdminBlocRepliable } from "@/components/admin/ui/AdminBlocRepliable";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";

const TEXTE = "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";
const TEXTE_DISCRET = "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]";

const ICONE = "inline-block shrink-0 align-[-0.125em]";

type TonCarte = "destructive" | "warning" | "success" | "neutre";
const BORDURE_CARTE: Record<TonCarte, string> = {
  destructive: "border-l-[color:var(--color-admin-destructive)]",
  warning: "border-l-[color:var(--color-admin-warning)]",
  success: "border-l-[color:var(--color-admin-success)]",
  neutre: "border-l-[color:var(--color-admin-border)]",
};

/** Liste de cartes (remplace les tableaux serrés). */
function ListeCartes({
  titre,
  children,
}: {
  titre: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <ul
      aria-label={titre}
      className="m-0 mt-[var(--space-admin-4)] flex list-none flex-col gap-[var(--space-admin-4)] p-0"
    >
      {children}
    </ul>
  );
}

function Carte({
  ton,
  children,
}: {
  ton: TonCarte;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <li
      data-ton={ton}
      className={`flex flex-col gap-[var(--space-admin-2)] rounded-[var(--radius-admin-lg)] border border-l-4 border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)] sm:flex-row sm:items-start sm:gap-[var(--space-admin-4)] ${BORDURE_CARTE[ton]}`}
    >
      {children}
    </li>
  );
}

/** Encadré teinté lisible (motifs, remarques). */
function Encadre({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <p className="m-0 rounded-[var(--radius-admin-md)] border-l-4 border-l-[color:var(--color-admin-warning)] bg-[color:var(--color-admin-warning-soft)] p-[var(--space-admin-3)] text-[length:var(--text-admin-base)] text-[color:var(--color-admin-warning-fg)]">
      {children}
    </p>
  );
}

/* ----------------------------------------------------------------- Tuiles */

export function TuilesFormateur({
  sessionsAnimees,
  sessionsAVenir,
  nbBloquants,
  nbAlertes,
  missionsRefusees,
}: {
  sessionsAnimees: number;
  sessionsAVenir: number;
  nbBloquants: number;
  nbAlertes: number;
  missionsRefusees: number;
}): React.ReactElement {
  return (
    <div
      data-testid="tuiles-formateur"
      className="mb-[var(--space-admin-5)] grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2 lg:grid-cols-4"
    >
      <AdminStatCard
        label="Sessions animées"
        value={sessionsAnimees}
        tone="info"
        icon={CircleCheck}
      />
      <AdminStatCard label="Sessions à venir" value={sessionsAVenir} icon={CalendarClock} />
      <AdminStatCard
        label="Manquements bloquants"
        value={nbBloquants}
        tone={nbBloquants > 0 ? "destructive" : "success"}
        icon={Ban}
        {...(nbAlertes > 0 ? { meta: `${nbAlertes} alerte${nbAlertes > 1 ? "s" : ""}` } : {})}
      />
      <AdminStatCard
        label="Missions refusées"
        value={missionsRefusees}
        tone={missionsRefusees > 0 ? "warning" : "success"}
        icon={UserX}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- Activité */

export function BlocActivite({
  sessionsAnimees,
  sessionsAVenir,
}: {
  sessionsAnimees: number;
  sessionsAVenir: number;
}): React.ReactElement {
  return (
    <AdminBloc teinte="bleu" niveau={2} titre="Activité (calculée automatiquement)">
      <p className={`m-0 ${TEXTE}`}>
        <strong>{sessionsAnimees}</strong> session{sessionsAnimees > 1 ? "s" : ""} Qualiopi animée
        {sessionsAnimees > 1 ? "s" : ""}
        {sessionsAVenir > 0 ? (
          <>
            {" "}
            · <strong>{sessionsAVenir}</strong> à venir
          </>
        ) : null}
        .
      </p>
    </AdminBloc>
  );
}

/* ------------------------------------------------------------- Conformité */

export interface ManquementLu {
  code: string;
  message: string;
}

export function BlocConformite({
  nbManquements,
  bloquants,
  alertes,
  estSousTraitant,
  cumulIllisible,
  montantRetenuCents,
  approcheVigilanceCents,
  seuilVigilanceCents,
}: {
  nbManquements: number;
  bloquants: ManquementLu[];
  alertes: ManquementLu[];
  estSousTraitant: boolean;
  cumulIllisible: boolean;
  montantRetenuCents: number;
  approcheVigilanceCents: number;
  seuilVigilanceCents: number;
}): React.ReactElement {
  const teinte = bloquants.length > 0 ? "terracotta" : alertes.length > 0 ? "ambre" : "vert";
  return (
    <AdminBloc teinte={teinte} niveau={2} titre="Conformité documentaire">
      {nbManquements === 0 ? (
        <p className={`m-0 ${TEXTE}`}>
          <AdminBadge tone="success">Complet</AdminBadge> Dossier complet — aucun manquement.
        </p>
      ) : (
        <>
          <p className={`m-0 ${TEXTE}`}>
            {bloquants.length > 0 ? (
              <strong>
                <Ban size={14} aria-hidden="true" className={ICONE} /> {bloquants.length} manquement
                {bloquants.length > 1 ? "s" : ""} bloquant
                {bloquants.length > 1 ? "s" : ""} — ce formateur ne devrait pas être affecté.
              </strong>
            ) : (
              <strong>Aucun manquement bloquant.</strong>
            )}
          </p>

          {bloquants.length + alertes.length > 0 && (
            <ListeCartes titre="Manquements du dossier documentaire">
              {bloquants.map((m) => (
                <Carte key={m.code} ton="destructive">
                  <AdminBadge tone="destructive" plein>
                    <Ban size={16} aria-hidden="true" className={ICONE} /> Bloquant
                  </AdminBadge>
                  <span className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
                    {m.message}
                  </span>
                </Carte>
              ))}
              {alertes.map((m) => (
                <Carte key={m.code} ton="warning">
                  <AdminBadge tone="warning" plein>
                    <TriangleAlert size={16} aria-hidden="true" className={ICONE} /> Alerte
                  </AdminBadge>
                  <span
                    className={`text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]`}
                  >
                    {m.message}
                  </span>
                </Carte>
              ))}
            </ListeCartes>
          )}
        </>
      )}

      {estSousTraitant && (
        <>
          <p className={`mt-[var(--space-admin-3)] mb-0 ${TEXTE}`}>
            Cumul retenu pour le seuil URSSAF :{" "}
            {cumulIllisible ? (
              <strong>illisible (seuil réputé atteint)</strong>
            ) : (
              <strong>{(montantRetenuCents / 100).toLocaleString("fr-FR")} € HT</strong>
            )}
          </p>
          <AdminBlocRepliable titre="Comment ce cumul est lu" className="mt-[var(--space-admin-3)]">
            <p className={`m-0 ${TEXTE_DISCRET}`}>
              Honoraires facturés : relevés validés, reçus ou payés. L&apos;attestation est demandée
              à partir de {(approcheVigilanceCents / 100).toLocaleString("fr-FR")} € HT et exigée à
              partir de {(seuilVigilanceCents / 100).toLocaleString("fr-FR")} € HT — y compris avant
              une mission qui ferait atteindre ce montant.
            </p>
          </AdminBlocRepliable>
        </>
      )}
    </AdminBloc>
  );
}

/* -------------------------------------------------------------- Fiabilité */

export interface IncidentLu {
  id: string;
  dateIncident: Date;
  titre: string;
  session: { numero: string } | null;
}

export function BlocFiabilite({
  resume,
  tauxIncidentsBloquants,
  incidentsBloquants,
  niveauVigilance,
  incidents,
}: {
  resume: string;
  tauxIncidentsBloquants: number | null;
  incidentsBloquants: number;
  niveauVigilance: string;
  incidents: IncidentLu[];
}): React.ReactElement {
  return (
    <AdminBloc teinte="violet" niveau={2} titre="Fiabilité (24 derniers mois)">
      <p className={`m-0 ${TEXTE}`}>
        {resume}
        {tauxIncidentsBloquants !== null && incidentsBloquants > 0 && (
          <> Soit {tauxIncidentsBloquants} % des missions.</>
        )}
      </p>

      {niveauVigilance !== "aucune" && (
        <p className={`mt-[var(--space-admin-2)] mb-0 ${TEXTE}`}>
          <AdminBadge tone={niveauVigilance === "vigilance_forte" ? "destructive" : "warning"}>
            {niveauVigilance === "vigilance_forte" ? "Vigilance forte" : "À surveiller"}
          </AdminBadge>{" "}
          — à prendre en compte lors de la reconduction (article 8). Cette mention n&apos;empêche
          pas de l&apos;affecter.
        </p>
      )}

      {incidents.length > 0 && (
        <ListeCartes titre="Incidents consignés">
          {incidents.map((i) => (
            <Carte key={i.id} ton="warning">
              <AdminBadge tone="warning" plein>
                <TriangleAlert size={16} aria-hidden="true" className={ICONE} />{" "}
                {i.dateIncident.toLocaleDateString("fr-FR")}
              </AdminBadge>
              <div className="flex flex-col gap-[var(--space-admin-1)]">
                <span className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
                  {i.titre}
                </span>
                <span className={TEXTE_DISCRET}>
                  Session : {i.session !== null ? i.session.numero : "—"}
                </span>
              </div>
            </Carte>
          ))}
        </ListeCartes>
      )}

      <AdminBlocRepliable titre="Où consigner un incident" className="mt-[var(--space-admin-3)]">
        <p className={`m-0 ${TEXTE_DISCRET}`}>
          Les incidents se consignent depuis le registre des incidents, en désignant
          l&apos;intervenant mis en cause.
        </p>
      </AdminBlocRepliable>
    </AdminBloc>
  );
}

/* --------------------------------------------------------------- Missions */

export interface RefusLu {
  reponduAt: Date | null;
  motifRefus: string | null;
  session: { numero: string; titreSession: string };
}

export interface MissionsLues {
  proposees: number;
  acceptees: number;
  refusees: number;
  enAttente: number;
  sansReponse: number;
  expirees: number;
  absences: number;
  derniersRefus: RefusLu[];
}

export function BlocMissions({
  missions,
  /** Phrase déjà composée pour un indépendant ; `null` = lecture « missions proposées ». */
  libelleIndependant,
}: {
  missions: MissionsLues;
  libelleIndependant: string | null;
}): React.ReactElement {
  const absences =
    missions.absences > 0
      ? `${missions.absences} absence${missions.absences > 1 ? "s" : ""} consignée${missions.absences > 1 ? "s" : ""} (désistement ou annulation tardive).`
      : "Aucune absence consignée.";
  const independant = libelleIndependant !== null;
  return (
    <AdminBloc
      teinte="gris"
      niveau={2}
      titre={independant ? "Missions (24 derniers mois)" : "Missions proposées (24 derniers mois)"}
    >
      {independant ? (
        <p className={`m-0 ${TEXTE}`}>
          {libelleIndependant}. {absences}
        </p>
      ) : missions.proposees === 0 ? (
        <>
          <AdminEmptyState
            variant="inline"
            title="Aucune mission proposée par l'outil à ce jour."
          />
          <p className={`m-0 ${TEXTE}`}>{absences}</p>
        </>
      ) : (
        <p className={`m-0 ${TEXTE}`}>
          {`${missions.proposees} proposée${missions.proposees > 1 ? "s" : ""} · ` +
            `${missions.acceptees} acceptée${missions.acceptees > 1 ? "s" : ""} · ` +
            `${missions.refusees} refusée${missions.refusees > 1 ? "s" : ""} · ` +
            `${missions.enAttente} en attente de réponse · ` +
            `${missions.sansReponse} sans réponse dans le délai · ` +
            `${missions.expirees} expirée${missions.expirees > 1 ? "s" : ""}.`}{" "}
          {absences}
        </p>
      )}

      {!independant && missions.derniersRefus.length > 0 && (
        <ListeCartes titre="Derniers refus de mission">
          {missions.derniersRefus.map((r, i) => (
            <Carte key={`${r.session.numero}-${i}`} ton="destructive">
              <AdminBadge tone="destructive" plein>
                <UserX size={16} aria-hidden="true" className={ICONE} /> Refusée
                {r.reponduAt !== null ? ` le ${r.reponduAt.toLocaleDateString("fr-FR")}` : ""}
              </AdminBadge>
              <div className="flex flex-col gap-[var(--space-admin-2)]">
                <span className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
                  {r.session.titreSession}{" "}
                  <AdminBadge tone="neutral">{r.session.numero}</AdminBadge>
                </span>
                {r.motifRefus !== null ? (
                  <Encadre>
                    <strong>Motif :</strong> {`« ${r.motifRefus} »`}
                  </Encadre>
                ) : null}
              </div>
            </Carte>
          ))}
        </ListeCartes>
      )}

      <AdminBlocRepliable titre="Où consigner une absence" className="mt-[var(--space-admin-3)]">
        <p className={`m-0 ${TEXTE_DISCRET}`}>
          Une absence se consigne depuis la fiche de session (« Déclarer une absence ») ou depuis le
          registre des incidents.
        </p>
      </AdminBlocRepliable>
    </AdminBloc>
  );
}
