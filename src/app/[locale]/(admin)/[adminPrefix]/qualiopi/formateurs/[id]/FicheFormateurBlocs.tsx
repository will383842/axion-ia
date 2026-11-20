/**
 * Fiche d'un formateur — blocs de LECTURE (présentation seulement).
 *
 * Extraits de `page.tsx` pour être rendus et testés isolément. Aucune requête,
 * aucun calcul métier : la page passe des valeurs déjà lues et ce fichier les
 * affiche. Composants serveur, aucun JavaScript client.
 */

import { Ban, TriangleAlert } from "lucide-react";

import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminBloc } from "@/components/admin/ui/AdminBloc";
import { AdminBlocRepliable } from "@/components/admin/ui/AdminBlocRepliable";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";

const COLONNE =
  "px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-left text-[length:var(--text-admin-xs)] font-semibold text-[color:var(--color-admin-fg-muted)]";
const CELLULE =
  "px-[var(--space-admin-3)] py-[var(--space-admin-2)] align-top text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";
const TEXTE = "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";
const TEXTE_DISCRET = "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]";

const ICONE = "inline-block shrink-0 align-[-0.125em]";

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
            <div className="mt-[var(--space-admin-3)] overflow-x-auto">
              <table className="w-full min-w-[28rem] border-collapse">
                <caption className="sr-only">Manquements du dossier documentaire</caption>
                <thead>
                  <tr>
                    <th scope="col" className={COLONNE}>
                      Gravité
                    </th>
                    <th scope="col" className={COLONNE}>
                      Manquement
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bloquants.map((m) => (
                    <tr key={m.code} className="border-t border-[color:var(--color-admin-border)]">
                      <td className={CELLULE}>
                        <AdminBadge tone="destructive">
                          <Ban size={14} aria-hidden="true" className={ICONE} /> Bloquant
                        </AdminBadge>
                      </td>
                      <td className={CELLULE}>{m.message}</td>
                    </tr>
                  ))}
                  {alertes.map((m) => (
                    <tr key={m.code} className="border-t border-[color:var(--color-admin-border)]">
                      <td className={CELLULE}>
                        <AdminBadge tone="warning">
                          <TriangleAlert size={14} aria-hidden="true" className={ICONE} /> Alerte
                        </AdminBadge>
                      </td>
                      <td className={`${CELLULE} text-[color:var(--color-admin-fg-muted)]`}>
                        {m.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
        <div className="mt-[var(--space-admin-3)] overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse">
            <caption className="sr-only">Incidents consignés</caption>
            <thead>
              <tr>
                <th scope="col" className={COLONNE}>
                  Date
                </th>
                <th scope="col" className={COLONNE}>
                  Incident
                </th>
                <th scope="col" className={COLONNE}>
                  Session
                </th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((i) => (
                <tr key={i.id} className="border-t border-[color:var(--color-admin-border)]">
                  <td className={CELLULE}>{i.dateIncident.toLocaleDateString("fr-FR")}</td>
                  <td className={CELLULE}>{i.titre}</td>
                  <td className={CELLULE}>{i.session !== null ? i.session.numero : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
        <div className="mt-[var(--space-admin-3)] overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse">
            <caption className="sr-only">Derniers refus de mission</caption>
            <thead>
              <tr>
                <th scope="col" className={COLONNE}>
                  Date
                </th>
                <th scope="col" className={COLONNE}>
                  Mission refusée
                </th>
                <th scope="col" className={COLONNE}>
                  Motif
                </th>
              </tr>
            </thead>
            <tbody>
              {missions.derniersRefus.map((r, i) => (
                <tr
                  key={`${r.session.numero}-${i}`}
                  className="border-t border-[color:var(--color-admin-border)]"
                >
                  <td className={CELLULE}>
                    {r.reponduAt !== null ? r.reponduAt.toLocaleDateString("fr-FR") : "—"}
                  </td>
                  <td className={CELLULE}>
                    {r.session.titreSession} ({r.session.numero})
                  </td>
                  <td className={CELLULE}>{r.motifRefus !== null ? `« ${r.motifRefus} »` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
