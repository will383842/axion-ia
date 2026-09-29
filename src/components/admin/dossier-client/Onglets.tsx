/**
 * Les quatre onglets du dossier client sur la fiche : Synthèse, Projets,
 * Échanges, Personnes (chantier visio, plan §3.9, PR 3).
 *
 * Composants SERVEUR, sans état, sans accès à la base : ils reçoivent ce que la
 * page a lu par `features/dossier-client/queries.ts`, APRÈS la vérification du
 * rôle (décision A2). Aucune bibliothèque cliente : les formulaires sont des
 * formulaires HTML reliés à des actions serveur.
 *
 * Tout est en texte brut : aucun HTML venant d'une donnée n'est interprété.
 */

import Link from "next/link";

import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import type {
  Consolidation,
  PorteeConsolidee,
  ValeurConsolidee,
} from "@/features/dossier-client/consolider-faits";
import {
  LIBELLE_ROLE_PROJET,
  LIBELLE_RUBRIQUE,
  LIBELLE_STATUT_PROJET,
  LIBELLE_STATUT_RENCONTRE,
  LIBELLE_TYPE_FAIT,
  valeurLisible,
} from "@/features/dossier-client/libelles";
import { TYPES_DE_FAITS } from "@/server/visio/types-de-faits";
import type {
  FaitARanger,
  PersonneDuDossier,
  ProjetDuDossier,
  RencontreDuDossier,
} from "@/features/dossier-client/queries";
import {
  ajouterPersonneFormAction,
  basculerOppositionIaFormAction,
  creerProjetFormAction,
} from "@/features/dossier-client/actions";
import { formatDateFrShort } from "@/lib/format-date-fr";
import type { EmailOutboxStatus, FaitType } from "../../../../prisma/generated/client";

const titreCls =
  "mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]";
const carteCls =
  "mb-[var(--space-admin-5)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]";
const mutedCls = "text-[color:var(--color-admin-fg-muted)]";
const listeCls = "space-y-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]";
const lienCls = "text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline";
const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]";

type Tone = "neutral" | "info" | "success" | "warning" | "destructive";

const TON_STATUT_PROJET: Readonly<Record<string, Tone>> = {
  ouvert: "info",
  en_pause: "warning",
  gagne: "success",
  perdu: "destructive",
  abandonne: "neutral",
  termine: "success",
};

// ─────────────────────────────────────────────────────────────────────────────
// Briques partagées (fiche, page projet, « Préparer »)
// ─────────────────────────────────────────────────────────────────────────────

const MENTION_ETAT: Readonly<Record<ValeurConsolidee["etat"], string | null>> = {
  courante: null,
  a_trancher: "à trancher : plusieurs valeurs ont été dites",
  a_reconfirmer: "à reconfirmer : remise en cause",
  avant_reouverture: "dite avant la réouverture du projet : à reconfirmer",
  effacee: "valeur effacée",
};

/** Une valeur consolidée : la valeur retenue, ou la mention qui explique la case vide. */
export function LigneValeur({ v }: { v: ValeurConsolidee }): React.ReactElement {
  const mention = MENTION_ETAT[v.etat];
  const valeurs =
    v.etat === "courante" || v.etat === "a_trancher"
      ? [...new Set(v.faits.map((f) => valeurLisible(f)))]
      : [];
  return (
    <li className="flex flex-wrap items-baseline gap-[var(--space-admin-2)]">
      <span className="font-medium">{LIBELLE_TYPE_FAIT[v.type]} :</span>
      {valeurs.length > 0 ? <span>{valeurs.join(" · ")}</span> : null}
      {v.depassee ? <AdminBadge tone="destructive">dépassée</AdminBadge> : null}
      {mention !== null ? (
        <span className="text-[color:var(--color-admin-warning)]">({mention})</span>
      ) : null}
    </li>
  );
}

/** Les valeurs d'une portée, filtrées sur une liste de types (ordre de la liste). */
export function ListeValeurs({
  portee,
  types,
  vide,
}: {
  portee: PorteeConsolidee | undefined;
  types?: ReadonlyArray<FaitType>;
  vide: string;
}): React.ReactElement {
  const valeurs = (portee?.valeurs ?? []).filter(
    (v) => types === undefined || types.includes(v.type),
  );
  if (valeurs.length === 0)
    return <p className={`text-[length:var(--text-admin-sm)] ${mutedCls}`}>{vide}</p>;
  return (
    <ul className={listeCls}>
      {valeurs.map((v) => (
        <LigneValeur key={`${v.type}:${v.cle}`} v={v} />
      ))}
    </ul>
  );
}

/** Les suivis ouverts (engagements, questions, objections…) d'une portée. */
export function ListeSuivis({
  portee,
  vide,
}: {
  portee: PorteeConsolidee | undefined;
  vide: string;
}): React.ReactElement {
  const suivis = portee?.suivisOuverts ?? [];
  if (suivis.length === 0)
    return <p className={`text-[length:var(--text-admin-sm)] ${mutedCls}`}>{vide}</p>;
  return (
    <ul className={listeCls}>
      {suivis.map((f) => (
        <li key={f.id}>
          <span className="font-medium">{LIBELLE_TYPE_FAIT[f.type]} :</span> {valeurLisible(f)}{" "}
          <span className={mutedCls}>({formatDateFrShort(f.constateLe)})</span>
        </li>
      ))}
    </ul>
  );
}

export function Trous({ trous }: { trous: ReadonlyArray<number> }): React.ReactElement | null {
  if (trous.length === 0) return null;
  return (
    <p className={`text-[length:var(--text-admin-sm)] ${mutedCls}`}>
      Jamais abordé : {trous.map((r) => LIBELLE_RUBRIQUE[r] ?? `rubrique ${r}`).join(", ")}.
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Synthèse
// ─────────────────────────────────────────────────────────────────────────────

/**
 * « Ce que fait la société » : les types de la rubrique 1 du compte rendu,
 * DÉRIVÉS de `TYPES_DE_FAITS` et dans son ordre — un type ajouté à la
 * rubrique 1 apparaît ici sans rien retoucher.
 */
export const TYPES_SOCIETE: ReadonlyArray<FaitType> = (
  Object.keys(TYPES_DE_FAITS) as FaitType[]
).filter((t) => TYPES_DE_FAITS[t].rubrique === 1);

/** Le bloc d'un projet dans la synthèse. */
export const TYPES_BLOC_PROJET: ReadonlyArray<FaitType> = [
  "besoin",
  "decideur",
  "budget",
  "echeance",
  "financement",
  "prochaine_etape",
];

export function OngletSynthese({
  consolidation,
  projets,
  ficheHref,
}: {
  consolidation: Consolidation;
  projets: ReadonlyArray<ProjetDuDossier>;
  ficheHref: string;
}): React.ReactElement {
  return (
    <div>
      <section className={carteCls}>
        <h2 className={titreCls}>Ce que fait la société</h2>
        <ListeValeurs
          portee={consolidation.entreprise}
          types={TYPES_SOCIETE}
          vide="Rien de validé pour l'instant sur l'entreprise."
        />
      </section>

      {projets.length === 0 ? (
        <section className={carteCls}>
          <h2 className={titreCls}>Projets</h2>
          <p className={`text-[length:var(--text-admin-sm)] ${mutedCls}`}>
            Aucun projet. Créez-en un dans l&apos;onglet « Projets ».
          </p>
        </section>
      ) : (
        projets.map((p) => {
          const portee = consolidation.projets[p.id];
          return (
            <section key={p.id} className={carteCls} data-projet={p.id}>
              <div className="mb-[var(--space-admin-3)] flex flex-wrap items-center gap-[var(--space-admin-3)]">
                <h2 className="text-[length:var(--text-admin-base)] font-semibold">
                  <Link href={`${ficheHref}/projets/${p.id}`} className={lienCls}>
                    {p.titre}
                  </Link>
                </h2>
                <span className={`font-mono text-[length:var(--text-admin-xs)] ${mutedCls}`}>
                  {p.numero}
                </span>
                <AdminBadge tone={TON_STATUT_PROJET[p.statut] ?? "neutral"} dot>
                  {LIBELLE_STATUT_PROJET[p.statut]}
                </AdminBadge>
                <Link href={`${ficheHref}/preparer?projet=${p.id}`} className={lienCls}>
                  Préparer le prochain échange →
                </Link>
              </div>
              <ListeValeurs
                portee={portee}
                types={TYPES_BLOC_PROJET}
                vide="Rien de validé pour ce projet."
              />
              <h3 className="mt-[var(--space-admin-4)] mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-semibold">
                Engagements et questions en cours
              </h3>
              <ListeSuivis portee={portee} vide="Aucun engagement ni question en cours." />
            </section>
          );
        })
      )}

      <section className={carteCls}>
        <h2 className={titreCls}>À valider et à ranger</h2>
        <p className="text-[length:var(--text-admin-sm)]">
          <span className="font-semibold tabular-nums">{consolidation.nbProposes}</span> information
          {consolidation.nbProposes > 1 ? "s" : ""} proposée
          {consolidation.nbProposes > 1 ? "s" : ""} pas encore validée
          {consolidation.nbProposes > 1 ? "s" : ""} ·{" "}
          <span className="font-semibold tabular-nums">{consolidation.nbARanger}</span> à ranger
          dans un projet{" "}
          {consolidation.nbARanger > 0 ? (
            <Link href={`${ficheHref}?onglet=projets`} className={lienCls}>
              (créer ou choisir un projet)
            </Link>
          ) : null}
        </p>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Projets
// ─────────────────────────────────────────────────────────────────────────────

export function OngletProjets({
  clientId,
  projets,
  faitsARanger,
  ficheHref,
  qBase,
  erreur,
}: {
  clientId: string;
  projets: ReadonlyArray<ProjetDuDossier>;
  faitsARanger: ReadonlyArray<FaitARanger>;
  ficheHref: string;
  qBase: string;
  erreur: string | null;
}): React.ReactElement {
  return (
    <div>
      <section className={carteCls}>
        <h2 className={titreCls}>Projets</h2>
        {projets.length === 0 ? (
          <p className={`text-[length:var(--text-admin-sm)] ${mutedCls}`}>
            Aucun projet pour l&apos;instant.
          </p>
        ) : (
          <ul className={listeCls}>
            {projets.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
                <Link href={`${ficheHref}/projets/${p.id}`} className={`font-medium ${lienCls}`}>
                  {p.titre}
                </Link>
                <span className={`font-mono text-[length:var(--text-admin-xs)] ${mutedCls}`}>
                  {p.numero}
                </span>
                <AdminBadge tone={TON_STATUT_PROJET[p.statut] ?? "neutral"} dot>
                  {LIBELLE_STATUT_PROJET[p.statut]}
                </AdminBadge>
                {p.devis.map((d) => (
                  <Link
                    key={d.id}
                    href={`${qBase}/devis/${d.id}`}
                    className={`font-mono text-[length:var(--text-admin-xs)] ${lienCls}`}
                  >
                    {d.numero}
                  </Link>
                ))}
                {p.nbQuestionnaires > 0 ? (
                  <span className={mutedCls}>
                    {p.nbQuestionnaires} questionnaire{p.nbQuestionnaires > 1 ? "s" : ""}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={carteCls} id="nouveau-projet">
        <h2 className={titreCls}>Nouveau projet</h2>
        {erreur !== null ? (
          <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]">
            {erreur}
          </p>
        ) : null}
        <form action={creerProjetFormAction} className="flex flex-col gap-[var(--space-admin-3)]">
          <input type="hidden" name="clientId" value={clientId} />
          <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
            Titre du projet (par exemple « Formation IA des équipes RH, automne »)
            <input name="titre" required maxLength={200} className={inputCls} />
          </label>
          {faitsARanger.length > 0 ? (
            <fieldset className="text-[length:var(--text-admin-sm)]">
              <legend className="mb-[var(--space-admin-2)] font-medium">
                Informations à ranger dans ce projet
              </legend>
              {faitsARanger.map((f) => (
                <label key={f.id} className="flex items-baseline gap-[var(--space-admin-2)]">
                  <input type="checkbox" name="faitARanger" value={f.id} />
                  <span>
                    <span className="font-medium">{LIBELLE_TYPE_FAIT[f.type]} :</span> {f.enonce}{" "}
                    <span className={mutedCls}>({formatDateFrShort(f.constateLe)})</span>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : null}
          <div>
            <button type="submit" className="admin-button">
              Créer le projet
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Échanges
// ─────────────────────────────────────────────────────────────────────────────

const LIBELLE_ENVOI = {
  a_valider: "à valider dans la file des e-mails",
  approuve: "validé, en cours d'envoi",
  envoye: "envoyé",
  refuse: "écarté",
} as const satisfies Record<EmailOutboxStatus, string>;

export function OngletEchanges({
  rencontres,
  projets,
  rendezVousBase,
  maintenant,
}: {
  rencontres: ReadonlyArray<RencontreDuDossier>;
  projets: ReadonlyArray<ProjetDuDossier>;
  rendezVousBase: string;
  maintenant: Date;
}): React.ReactElement {
  if (rencontres.length === 0) {
    return (
      <section className={carteCls}>
        <h2 className={titreCls}>Échanges</h2>
        <p className={`text-[length:var(--text-admin-sm)] ${mutedCls}`}>
          Aucun rendez-vous rangé sur cette fiche pour l&apos;instant.
        </p>
      </section>
    );
  }
  return (
    <section className={carteCls}>
      <h2 className={titreCls}>Échanges</h2>
      <ul className="space-y-[var(--space-admin-4)] text-[length:var(--text-admin-sm)]">
        {rencontres.map((r) => {
          const projet = projets.find((p) => p.id === r.projetId);
          const aVenir = r.debutPrevu !== null && r.debutPrevu.getTime() > maintenant.getTime();
          const statut =
            r.statut !== null
              ? LIBELLE_STATUT_RENCONTRE[r.statut]
              : aVenir
                ? LIBELLE_STATUT_RENCONTRE.planifie
                : r.issue === "absent"
                  ? LIBELLE_STATUT_RENCONTRE.absent
                  : LIBELLE_STATUT_RENCONTRE.tenu;
          return (
            <li
              key={r.id}
              data-rencontre={r.id}
              className="border-b border-[color:var(--color-admin-border)] pb-[var(--space-admin-3)]"
            >
              <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
                <span className="font-medium">{r.titre}</span>
                <span className={mutedCls}>
                  {r.debutPrevu !== null ? formatDateFrShort(r.debutPrevu) : "date inconnue"}
                </span>
                <AdminBadge tone="outline">{statut}</AdminBadge>
                {projet !== undefined ? (
                  <span className={mutedCls}>Projet : {projet.titre}</span>
                ) : null}
                {r.estTestInterne ? <AdminBadge tone="warning">test interne</AdminBadge> : null}
                {!aVenir && r.compteRenduValide === null ? (
                  <AdminBadge tone="warning">sans compte rendu validé</AdminBadge>
                ) : null}
                <Link href={`${rendezVousBase}/rencontres/${r.id}`} className={lienCls}>
                  Compte rendu →
                </Link>
              </div>
              {r.compteRenduValide !== null ? (
                <p className="mt-[var(--space-admin-2)] whitespace-pre-line">
                  <span className="font-medium">En bref : </span>
                  {r.compteRenduValide.enBref ?? "(compte rendu validé, sans résumé)"}
                </p>
              ) : null}
              {r.emailsSuivi.map((e, i) => (
                <p key={i} className={`mt-[var(--space-admin-1)] ${mutedCls}`}>
                  E-mail de suivi du {formatDateFrShort(e.creeLe)} :{" "}
                  {e.statut !== null ? LIBELLE_ENVOI[e.statut] : "retiré de la file"}
                </p>
              ))}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Personnes
// ─────────────────────────────────────────────────────────────────────────────

export function OngletPersonnes({
  clientId,
  personnes,
  projets,
  erreur,
}: {
  clientId: string;
  personnes: ReadonlyArray<PersonneDuDossier>;
  projets: ReadonlyArray<ProjetDuDossier>;
  erreur: string | null;
}): React.ReactElement {
  return (
    <div>
      <section className={carteCls}>
        <h2 className={titreCls}>Personnes</h2>
        {personnes.length === 0 ? (
          <p className={`text-[length:var(--text-admin-sm)] ${mutedCls}`}>
            Aucune personne sur cette fiche.
          </p>
        ) : (
          <ul className="space-y-[var(--space-admin-4)] text-[length:var(--text-admin-sm)]">
            {personnes.map((p) => (
              <li
                key={p.id}
                className="border-b border-[color:var(--color-admin-border)] pb-[var(--space-admin-3)]"
              >
                <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
                  <span className="font-medium">{p.nom}</span>
                  {p.fonction ? <span className={mutedCls}>{p.fonction}</span> : null}
                  {p.estContactFacturation ? (
                    <AdminBadge tone="info">contact de facturation</AdminBadge>
                  ) : null}
                  {p.statut === "parti" ? (
                    <AdminBadge tone="neutral">a quitté l&apos;entreprise</AdminBadge>
                  ) : null}
                  {!p.rencontree ? <AdminBadge tone="outline">jamais rencontrée</AdminBadge> : null}
                </div>
                {p.adresses.length > 0 ? (
                  <p className="mt-[var(--space-admin-1)]">
                    {p.adresses
                      .map((a) => `${a.email} (${a.nature === "pro" ? "pro" : "perso"})`)
                      .join(" · ")}
                  </p>
                ) : null}
                {p.roles.length > 0 ? (
                  <p className={`mt-[var(--space-admin-1)] ${mutedCls}`}>
                    {p.roles
                      .map((r) => {
                        const projet = projets.find((x) => x.id === r.projetId);
                        return `${projet?.titre ?? "projet"} : ${LIBELLE_ROLE_PROJET[r.role]}`;
                      })
                      .join(" · ")}
                  </p>
                ) : null}
                <form
                  action={basculerOppositionIaFormAction}
                  className="mt-[var(--space-admin-2)] flex flex-wrap items-center gap-[var(--space-admin-3)]"
                >
                  <input type="hidden" name="contactId" value={p.id} />
                  <input
                    type="hidden"
                    name="oppose"
                    value={p.oppositionIaLe === null ? "oui" : "non"}
                  />
                  {p.oppositionIaLe !== null ? (
                    <span className="text-[color:var(--color-admin-warning)]">
                      S&apos;oppose au traitement par IA depuis le{" "}
                      {formatDateFrShort(p.oppositionIaLe)} : aucun enregistrement ni dictée pour
                      cette personne.
                    </span>
                  ) : null}
                  <button type="submit" className="admin-button-ghost">
                    {p.oppositionIaLe === null
                      ? "Cette personne s'oppose au traitement par IA"
                      : "Lever l'opposition"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={carteCls}>
        <h2 className={titreCls}>Ajouter une personne</h2>
        {erreur !== null ? (
          <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]">
            {erreur}
          </p>
        ) : null}
        <form
          action={ajouterPersonneFormAction}
          className="grid grid-cols-1 gap-[var(--space-admin-3)] sm:grid-cols-2"
        >
          <input type="hidden" name="clientId" value={clientId} />
          <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
            Nom
            <input name="nom" maxLength={200} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
            Fonction
            <input name="fonction" maxLength={150} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
            E-mail
            <input name="email" type="email" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
            Téléphone
            <input name="telephone" maxLength={40} className={inputCls} />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="admin-button">
              Ajouter la personne
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
