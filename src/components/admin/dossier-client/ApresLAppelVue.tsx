/**
 * « Après l'appel » : l'écran unique du geste quotidien (chantier visio, PR 4 ;
 * plan §3.13) — rendu comme une VUE de la page du rendez-vous
 * (`rendez-vous/rencontres/[rencontreId]?vue=apres-l-appel`), pour ne pas
 * ajouter une page à la console (cliquet de poids, ADR 0058).
 *
 * Dans l'ordre :
 *   1. le RANGEMENT : la fiche proposée (« Confirmer le client proposé »), une
 *      autre fiche (« Ranger chez… »), ou « Créer la fiche prospect » — par la
 *      porte unique, SIREN proposé par l'annuaire et confirmé d'un clic.
 *      Jamais de rangement automatique (A4) ;
 *   2. le PROJET du rendez-vous : un projet ouvert, ou « nouveau projet » ;
 *   3. les FAITS proposés (cochés d'avance seulement s'ils sont validables en
 *      lot) et la NOTE MANUELLE (sept champs et une case) ;
 *   4. l'issue, la suite et son échéance (relance proposée par défaut) ;
 *   5. UN bouton : « Valider et préparer le devis ».
 *
 * La page appelante a DÉJÀ posé la garde (`gardeLectureEchanges`, A2) et lu la
 * rencontre. Composant SERVEUR, sans JavaScript : des formulaires HTML reliés à
 * des actions qui revérifient le rôle.
 */

import Link from "next/link";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import {
  creerProspectAction,
  rangerRencontreAction,
  validerApresLAppelAction,
} from "@/features/dossier-client/actions-rencontres";
import { LIBELLE_TYPE_FAIT } from "@/features/dossier-client/libelles";
import { CHAMPS_DE_LA_NOTE } from "@/features/dossier-client/note-manuelle";
import {
  lireFichesVivantes,
  lireProjetsCourts,
  type RencontreDetaillee,
} from "@/features/dossier-client/queries-rencontres";
import { rechercherSiren } from "@/features/dossier-client/recherche-entreprises";
import { suiteParDefaut } from "@/features/dossier-client/suite-proposee";
import { validableEnLot } from "@/features/dossier-client/valider";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { timeInParis } from "@/lib/calendar-grid";

const carteCls =
  "mb-[var(--space-admin-5)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]";
const titreCls =
  "mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]";
const mutedCls = "text-[color:var(--color-admin-fg-muted)]";
const lienCls = "text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline";
const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]";
const labelCls = "flex flex-col gap-1 text-[length:var(--text-admin-sm)]";

/** Pourquoi cette fiche est proposée, en français. */
const LIBELLE_MOTIF: Readonly<Record<string, string>> = {
  email_calendly: "même adresse e-mail que la fiche",
  contact_connu: "l'adresse d'une personne de la fiche",
  domaine_email: "même domaine d'entreprise qu'une personne de la fiche",
  entreprise_declaree: "le nom d'entreprise donné dans la réservation",
  demande_liee: "une demande envoyée depuis le site",
  report: "le rendez-vous qu'il remplace était chez ce client",
  choix_extension: "choisie au démarrage de l'enregistrement",
  contenu_compte_rendu: "déduite du compte rendu",
};

export async function ApresLAppelVue({
  r,
  locale,
  adminPrefix,
  erreur,
}: {
  r: RencontreDetaillee;
  locale: string;
  adminPrefix: string;
  erreur: string | null;
}) {
  const rdvBase = `/${locale}/${adminPrefix}/rendez-vous`;
  const client = r.client;
  const [projets, fiches, annuaire] = await Promise.all([
    client ? lireProjetsCourts(client.id) : Promise.resolve([]),
    client ? Promise.resolve([]) : lireFichesVivantes(),
    client === null && r.entrepriseDeclaree.nom
      ? rechercherSiren(r.entrepriseDeclaree.nom, r.entrepriseDeclaree.ville)
      : Promise.resolve(null),
  ]);
  const maintenant = new Date();
  const suite = suiteParDefaut(maintenant);
  const propositionsSiren = annuaire && annuaire.ok ? annuaire.propositions : [];
  const ficheHref = client ? `/${locale}/${adminPrefix}/qualiopi/clients/${client.id}` : null;

  return (
    <AdminPageShell width="wide">
      <div className="mb-[var(--space-admin-4)]">
        <Link
          href={`${rdvBase}?vue=point`}
          className={`text-[length:var(--text-admin-xs)] ${lienCls}`}
        >
          ← Rendez-vous
        </Link>
      </div>

      <AdminPageHeader
        title="Après l'appel"
        description={`${r.titre}${
          r.debutPrevu ? ` — ${formatDateFrShort(r.debutPrevu)} à ${timeInParis(r.debutPrevu)}` : ""
        }`}
        meta={
          <>
            {r.estTestInterne ? <AdminBadge tone="warning">test interne</AdminBadge> : null}
            {r.repriseHistorique ? <AdminBadge tone="neutral">historique</AdminBadge> : null}
          </>
        }
      />

      {erreur !== null ? (
        <p
          role="alert"
          className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-danger)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]"
        >
          {erreur}
        </p>
      ) : null}

      {/* ── Qui ─────────────────────────────────────────────────────────── */}
      <section className={carteCls}>
        <h2 className={titreCls}>Qui</h2>
        <p className="text-[length:var(--text-admin-sm)]">
          {r.titulaire?.nom ?? r.participants.find((p) => p.role === "client")?.nom ?? "—"}
          {r.titulaire?.email ? <span className={mutedCls}> · {r.titulaire.email}</span> : null}
          {r.entrepriseDeclaree.nom ? (
            <span className={mutedCls}>
              {" "}
              · entreprise déclarée : {r.entrepriseDeclaree.nom}
              {r.entrepriseDeclaree.ville ? ` (${r.entrepriseDeclaree.ville})` : ""}
            </span>
          ) : null}
        </p>
        {r.reponsesFormulaire.length > 0 ? (
          <dl className="mt-[var(--space-admin-3)] space-y-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
            {r.reponsesFormulaire.map((x) => (
              <div key={x.question}>
                <dt className={`text-[length:var(--text-admin-xs)] ${mutedCls}`}>{x.question}</dt>
                <dd>{x.reponse}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </section>

      {/* ── 1. Le rangement ─────────────────────────────────────────────── */}
      <section className={carteCls}>
        <h2 className={titreCls}>1. Chez quel client ?</h2>
        {client && ficheHref ? (
          <p className="text-[length:var(--text-admin-sm)]">
            Rangé chez{" "}
            <Link href={ficheHref} className={lienCls}>
              {client.raisonSociale} ({client.numero})
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-[var(--space-admin-4)]">
            {r.clientPropose ? (
              <form
                action={rangerRencontreAction}
                className="flex flex-wrap items-center gap-[var(--space-admin-3)]"
              >
                <input type="hidden" name="rencontreId" value={r.id} />
                <input type="hidden" name="clientId" value={r.clientPropose.id} />
                <span className="text-[length:var(--text-admin-sm)]">
                  Proposé : <strong>{r.clientPropose.raisonSociale}</strong> (
                  {r.clientPropose.numero})
                  {r.motifProposition ? (
                    <span className={mutedCls}> — {LIBELLE_MOTIF[r.motifProposition]}</span>
                  ) : null}
                </span>
                <button type="submit" className="admin-button">
                  Confirmer le client proposé
                </button>
              </form>
            ) : (
              <p className={`text-[length:var(--text-admin-sm)] ${mutedCls}`}>
                Aucune fiche ne ressemble à ce rendez-vous.
              </p>
            )}

            {fiches.length > 0 ? (
              <form
                action={rangerRencontreAction}
                className="flex flex-wrap items-end gap-[var(--space-admin-3)]"
              >
                <input type="hidden" name="rencontreId" value={r.id} />
                <label className={labelCls}>
                  Ranger chez une autre fiche
                  <select name="clientId" className={inputCls} defaultValue="">
                    <option value="" disabled>
                      Choisir…
                    </option>
                    {fiches.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.raisonSociale} ({f.numero})
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="admin-button-ghost">
                  Ranger
                </button>
              </form>
            ) : null}

            <form
              action={creerProspectAction}
              className="grid gap-[var(--space-admin-3)] sm:grid-cols-2"
            >
              <input type="hidden" name="rencontreId" value={r.id} />
              <p className="font-medium sm:col-span-2">
                Créer la fiche prospect depuis ce rendez-vous
              </p>
              <label className={labelCls}>
                Nom de l&apos;entreprise
                <input
                  name="raisonSociale"
                  required
                  maxLength={250}
                  defaultValue={r.entrepriseDeclaree.nom ?? r.titulaire?.nom ?? ""}
                  className={inputCls}
                />
              </label>
              <label className={labelCls}>
                Ville
                <input
                  name="ville"
                  maxLength={120}
                  defaultValue={r.entrepriseDeclaree.ville ?? ""}
                  className={inputCls}
                />
              </label>
              <fieldset className="text-[length:var(--text-admin-sm)] sm:col-span-2">
                <legend className="font-medium">SIREN</legend>
                {annuaire !== null && !annuaire.ok ? (
                  <p className={mutedCls}>
                    L&apos;annuaire des entreprises ne répond pas : la fiche sera créée sans SIREN,
                    « SIREN à compléter ».
                  </p>
                ) : null}
                {propositionsSiren.map((p, i) => (
                  <label key={p.siren} className="flex items-center gap-[var(--space-admin-2)]">
                    <input type="radio" name="siren" value={p.siren} defaultChecked={i === 0} />
                    <span>
                      {p.nom} — {p.siren}
                      {p.ville ? ` (${p.ville})` : ""}
                    </span>
                  </label>
                ))}
                {propositionsSiren[0] ? (
                  <input type="hidden" name="sirenPropose" value={propositionsSiren[0].siren} />
                ) : null}
                <label className="flex items-center gap-[var(--space-admin-2)]">
                  <input
                    type="radio"
                    name="siren"
                    value="aucun"
                    defaultChecked={propositionsSiren.length === 0}
                  />
                  <span>Aucun de ceux-là : SIREN à compléter plus tard</span>
                </label>
              </fieldset>
              <label className={`${labelCls} sm:col-span-2`}>
                Si l&apos;adresse est déjà connue sur une autre fiche : pourquoi créer quand même ?
                (facultatif)
                <input name="motif" maxLength={300} className={inputCls} />
              </label>
              <div className="sm:col-span-2">
                <button type="submit" className="admin-button">
                  Créer la fiche prospect
                </button>
              </div>
            </form>
          </div>
        )}
      </section>

      {/* ── 2 à 5. Projet, faits, note, suite — un seul bouton ─────────────── */}
      {client ? (
        <form action={validerApresLAppelAction} id="note">
          <input type="hidden" name="rencontreId" value={r.id} />

          <section className={carteCls}>
            <h2 className={titreCls}>2. Quel projet ?</h2>
            <div className="space-y-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
              {projets.map((p) => (
                <label key={p.id} className="flex items-center gap-[var(--space-admin-2)]">
                  <input
                    type="radio"
                    name="projet"
                    value={p.id}
                    defaultChecked={
                      r.projetId === p.id || (r.projetId === null && projets.length === 1)
                    }
                  />
                  {p.titre} <span className={mutedCls}>({p.numero})</span>
                </label>
              ))}
              <label className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
                <input
                  type="radio"
                  name="projet"
                  value="nouveau"
                  defaultChecked={projets.length === 0}
                />
                Nouveau projet :
                <input
                  name="projetTitre"
                  maxLength={200}
                  defaultValue={`Projet ${client.raisonSociale}`.slice(0, 200)}
                  className={`${inputCls} max-w-md`}
                />
              </label>
              <label className="flex items-center gap-[var(--space-admin-2)]">
                <input type="radio" name="projet" value="aucun" />
                Aucun projet pour l&apos;instant (activité et effectif seulement)
              </label>
            </div>
          </section>

          {r.faits.length > 0 ? (
            <section className={carteCls}>
              <h2 className={titreCls}>3. Ce que le client a dit — à valider</h2>
              <p
                className={`mb-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] ${mutedCls}`}
              >
                Les cases non cochées d&apos;avance se valident une par une : budget, décideur,
                confiance faible, ou pas encore rangé dans un projet.
              </p>
              <ul className="space-y-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
                {r.faits
                  .filter((f) => f.statut !== "valide")
                  .map((f) => (
                    <li key={f.id}>
                      <label className="flex items-start gap-[var(--space-admin-2)]">
                        <input
                          type="checkbox"
                          name="fait"
                          value={f.id}
                          defaultChecked={validableEnLot(f)}
                        />
                        <span>
                          <span className="font-medium">{LIBELLE_TYPE_FAIT[f.type]}</span>
                          {f.question ? (
                            <span className={mutedCls}> ({f.question})</span>
                          ) : null} : {f.enonce}
                          {f.portee === "a_ranger" ? (
                            <span className={mutedCls}> — à ranger dans le projet choisi</span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}

          <section className={carteCls}>
            <h2 className={titreCls}>
              {r.faits.length > 0 ? "4." : "3."} Note (pas d&apos;enregistrement)
            </h2>
            <div className="grid gap-[var(--space-admin-3)] sm:grid-cols-2">
              {CHAMPS_DE_LA_NOTE.map((c) => (
                <label key={c.champ} className={labelCls}>
                  {c.libelle}
                  <input name={c.champ} maxLength={1000} className={inputCls} />
                </label>
              ))}
              <label className="flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
                <input type="checkbox" name="objection" />
                Une objection a été exprimée
              </label>
              <label className={labelCls}>
                Laquelle (facultatif)
                <input name="objectionTexte" maxLength={1000} className={inputCls} />
              </label>
            </div>
          </section>

          <section className={carteCls}>
            <h2 className={titreCls}>Et ensuite ?</h2>
            <div className="grid gap-[var(--space-admin-3)] sm:grid-cols-3">
              <label className={labelCls}>
                Le rendez-vous
                <select
                  name="issue"
                  defaultValue={r.suivi?.issue ?? "eu_lieu"}
                  className={inputCls}
                >
                  <option value="eu_lieu">A eu lieu</option>
                  <option value="absent">Absent</option>
                  <option value="reporte">Reporté</option>
                </select>
              </label>
              <label className={labelCls}>
                La suite
                <select name="suite" defaultValue={r.suivi?.suite ?? "devis"} className={inputCls}>
                  <option value="devis">Devis à envoyer</option>
                  <option value="relance">Relance</option>
                  <option value="proposition">Proposition à faire</option>
                  <option value="aucune">Pas de suite</option>
                </select>
              </label>
              <label className={labelCls}>
                Pour le
                <input
                  type="date"
                  name="suiteLe"
                  defaultValue={r.suivi?.suiteLe?.toISOString().slice(0, 10) ?? suite.suiteLe}
                  className={inputCls}
                />
              </label>
            </div>
          </section>

          <button type="submit" className="admin-button">
            Valider et préparer le devis
          </button>
        </form>
      ) : (
        <p className={`text-[length:var(--text-admin-sm)] ${mutedCls}`}>
          Rangez d&apos;abord ce rendez-vous chez un client : la note et la suite s&apos;écrivent
          ensuite sur sa fiche.
        </p>
      )}
    </AdminPageShell>
  );
}
