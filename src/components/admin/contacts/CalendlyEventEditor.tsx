"use client";
// use-client: form interactif (états locaux + Server Action via useTransition).
//
// Sprint Notif Infra 2026-05-26 / fix P1-6 audit 2026-05-27.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  creerFicheDepuisRendezVousAction,
  rechercherFichesRattachablesAction,
  updateCalendlyEventAction,
} from "@/features/admin-calendly/actions";
import { toParisLocalInput, fromParisLocalInput } from "@/lib/calendar-grid";

/**
 * Une fiche proposée au rattachement — calculée côté serveur par
 * `features/admin-calendly/fiches-rattachables.ts`. Recopié ici en type
 * structurel plutôt qu'importé : ce composant client ne doit rien tirer d'un
 * module qui lit la base.
 */
interface FicheRattachable {
  readonly id: string;
  readonly libelle: string;
  /** Le titre du groupe, calculé côté serveur (même ordre que la liste). */
  readonly intitule: string;
}

interface Initial {
  readonly inviteeName: string | null;
  readonly inviteeEmail: string | null;
  readonly inviteePhone: string | null;
  readonly startTime: string | null;
  readonly endTime: string | null;
  readonly location: string | null;
  readonly status: string;
  readonly notes: string | null;
  readonly linkedSubmissionId: string | null;
}

interface Props {
  readonly id: string;
  readonly initial: Initial;
  /** Les fiches proposées au rattachement (vide = seule « Aucune fiche »). */
  readonly fichesRattachables?: ReadonlyArray<FicheRattachable>;
  /**
   * Échange apporteur rattaché à rien (2026-10-07) : ce que Calendly a CONFIRMÉ,
   * montré avant de créer la fiche. `null` : pas de création proposée.
   */
  readonly creationFiche?: {
    readonly nom: string | null;
    readonly email: string;
    readonly telephone: string | null;
  } | null;
}

export function CalendlyEventEditor({
  id,
  initial,
  fichesRattachables = [],
  creationFiche = null,
}: Props): React.ReactElement {
  const router = useRouter();
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState<ReadonlyArray<FicheRattachable>>([]);
  const [infoRecherche, setInfoRecherche] = useState<string | null>(null);
  const [confirmerCreation, setConfirmerCreation] = useState(false);
  const [infoCreation, setInfoCreation] = useState<string | null>(null);
  // Les résultats de recherche s'ajoutent à la liste, sans doublon.
  const vus = new Set(fichesRattachables.map((f) => f.id));
  const options = [...fichesRattachables, ...resultats.filter((f) => !vus.has(f.id))];

  function chercher() {
    setInfoRecherche(null);
    startTransition(async () => {
      const r = await rechercherFichesRattachablesAction({ id, q: recherche });
      if (!r.ok) {
        setInfoRecherche(r.error);
        return;
      }
      setResultats(r.fiches);
      setInfoRecherche(
        r.fiches.length === 0
          ? "Aucune fiche trouvée. Vous pouvez créer la fiche depuis ce rendez-vous."
          : `${r.fiches.length} fiche(s) trouvée(s) : choisissez-la dans la liste, puis enregistrez.`,
      );
    });
  }

  function creer() {
    setInfoCreation(null);
    startTransition(async () => {
      const r = await creerFicheDepuisRendezVousAction({ id });
      setConfirmerCreation(false);
      if (r.ok) {
        setInfoCreation(r.message);
        router.refresh();
      } else {
        setInfoCreation(r.error);
      }
    });
  }
  const [state, setState] = useState({
    inviteeName: initial.inviteeName ?? "",
    inviteeEmail: initial.inviteeEmail ?? "",
    inviteePhone: initial.inviteePhone ?? "",
    // Les champs `datetime-local` sont lus comme des heures de PARIS.
    // `initial.*` est de l'ISO UTC : le tronquer afficherait l'heure UTC (un
    // RDV de 11:30 s'affichait « 09:30 »). Cf. `toParisLocalInput`.
    startTime: initial.startTime ? toParisLocalInput(new Date(initial.startTime)) : "",
    endTime: initial.endTime ? toParisLocalInput(new Date(initial.endTime)) : "",
    location: initial.location ?? "",
    status: initial.status,
    notes: initial.notes ?? "",
    linkedSubmissionId: initial.linkedSubmissionId ?? "",
  });
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    startTransition(async () => {
      const r = await updateCalendlyEventAction({
        id,
        inviteeName: state.inviteeName || null,
        inviteeEmail: state.inviteeEmail || null,
        inviteePhone: state.inviteePhone || null,
        // `new Date("2026-07-23T11:30")` interpréterait la saisie dans le fuseau
        // du NAVIGATEUR : un aller-retour sans modification décalait le créneau
        // de l'offset, à chaque enregistrement. On l'interprète en heure de Paris.
        startTime: fromParisLocalInput(state.startTime)?.toISOString() ?? null,
        endTime: fromParisLocalInput(state.endTime)?.toISOString() ?? null,
        location: state.location || null,
        status: state.status as "scheduled" | "canceled" | "completed" | "no_show",
        notes: state.notes || null,
        linkedSubmissionId: state.linkedSubmissionId || null,
      });
      if (r.ok) {
        setDone(true);
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="admin-form space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="admin-field">
          <label htmlFor="inviteeName" className="admin-label">
            Nom invité
          </label>
          <input
            id="inviteeName"
            className="admin-input"
            value={state.inviteeName}
            onChange={(e) => setState({ ...state, inviteeName: e.target.value })}
            maxLength={255}
            disabled={isPending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="inviteeEmail" className="admin-label">
            Email invité
          </label>
          <input
            id="inviteeEmail"
            type="email"
            className="admin-input"
            value={state.inviteeEmail}
            onChange={(e) => setState({ ...state, inviteeEmail: e.target.value })}
            maxLength={255}
            disabled={isPending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="inviteePhone" className="admin-label">
            Téléphone
          </label>
          <input
            id="inviteePhone"
            className="admin-input"
            value={state.inviteePhone}
            onChange={(e) => setState({ ...state, inviteePhone: e.target.value })}
            maxLength={40}
            disabled={isPending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="status" className="admin-label">
            Statut
          </label>
          <select
            id="status"
            className="admin-input"
            value={state.status}
            onChange={(e) => setState({ ...state, status: e.target.value })}
            disabled={isPending}
          >
            <option value="scheduled">Programmé</option>
            <option value="completed">Terminé</option>
            <option value="canceled">Annulé</option>
            <option value="no_show">Absent</option>
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="startTime" className="admin-label">
            Début
          </label>
          <input
            id="startTime"
            type="datetime-local"
            className="admin-input"
            value={state.startTime}
            onChange={(e) => setState({ ...state, startTime: e.target.value })}
            disabled={isPending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="endTime" className="admin-label">
            Fin
          </label>
          <input
            id="endTime"
            type="datetime-local"
            className="admin-input"
            value={state.endTime}
            onChange={(e) => setState({ ...state, endTime: e.target.value })}
            disabled={isPending}
          />
        </div>
        <div className="admin-field sm:col-span-2">
          <label htmlFor="location" className="admin-label">
            Lieu / URL Meet
          </label>
          <input
            id="location"
            className="admin-input"
            value={state.location}
            onChange={(e) => setState({ ...state, location: e.target.value })}
            maxLength={500}
            disabled={isPending}
          />
        </div>
        <div className="admin-field sm:col-span-2">
          <label htmlFor="linkedSubmissionId" className="admin-label">
            Fiche rattachée (facultatif)
          </label>
          {/* Un SÉLECTEUR, plus une saisie d'UUID (2026-09-19) : recopier un
              identifiant depuis l'URL d'un autre onglet est un geste que
              personne ne faisait — 37 rendez-vous sur 37 restaient rattachés
              à rien. Les fiches proposées sont celles de la même personne,
              puis les récentes du même public. */}
          <select
            id="linkedSubmissionId"
            className="admin-input"
            value={state.linkedSubmissionId}
            onChange={(e) => setState({ ...state, linkedSubmissionId: e.target.value })}
            disabled={isPending}
          >
            <option value="">Aucune fiche</option>
            {[...new Set(options.map((f) => f.intitule))].map((intitule) => (
              <optgroup key={intitule} label={intitule}>
                {options
                  .filter((f) => f.intitule === intitule)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.libelle}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          {/* Recherche libre (2026-10-07, cas « Krafft ») : nom, prénom, adresse ou
              téléphone, un seul mot accepté, sur TOUTES les fiches du même public. */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="search"
              aria-label="Chercher une fiche"
              className="admin-input min-w-0 flex-1"
              placeholder="Chercher : nom, prénom, adresse e-mail ou téléphone"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (recherche.trim().length >= 2) chercher();
                }
              }}
              maxLength={120}
              disabled={isPending}
            />
            <button
              type="button"
              className="admin-button admin-button-secondary"
              onClick={chercher}
              disabled={isPending || recherche.trim().length < 2}
            >
              Chercher
            </button>
          </div>
          {infoRecherche ? (
            <p role="status" className="admin-help mt-1">
              {infoRecherche}
            </p>
          ) : null}
          {creationFiche && !state.linkedSubmissionId ? (
            <div className="mt-3">
              {confirmerCreation ? (
                <div className="admin-alert" role="group" aria-label="Confirmer la création">
                  <p>
                    Créer une fiche apporteur avec ce que Calendly a confirmé — aucun e-mail ne part
                    :
                  </p>
                  <ul className="mt-1 list-disc pl-5">
                    <li>Nom : {creationFiche.nom || "—"}</li>
                    <li>Adresse : {creationFiche.email}</li>
                    <li>Téléphone : {creationFiche.telephone || "—"}</li>
                  </ul>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="admin-button"
                      onClick={creer}
                      disabled={isPending}
                    >
                      Confirmer la création
                    </button>
                    <button
                      type="button"
                      className="admin-button admin-button-secondary"
                      onClick={() => setConfirmerCreation(false)}
                      disabled={isPending}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="admin-button admin-button-secondary"
                  onClick={() => setConfirmerCreation(true)}
                  disabled={isPending}
                >
                  Créer la fiche apporteur depuis ce rendez-vous
                </button>
              )}
            </div>
          ) : null}
          {infoCreation ? (
            <p role="status" className="admin-help mt-1">
              {infoCreation}
            </p>
          ) : null}
        </div>
        <div className="admin-field sm:col-span-2">
          <label htmlFor="notes" className="admin-label">
            Notes admin
          </label>
          <textarea
            id="notes"
            className="admin-input admin-textarea"
            value={state.notes}
            onChange={(e) => setState({ ...state, notes: e.target.value })}
            maxLength={5000}
            rows={4}
            disabled={isPending}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="admin-alert admin-alert-error">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="admin-alert admin-alert-success">
          Modifications enregistrées.
        </p>
      )}

      <button type="submit" className="admin-button" disabled={isPending}>
        {isPending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
