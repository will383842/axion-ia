/**
 * BrancheOpcoBloc — bloc « Branche et OPCO » de la fiche client (lot OPCO A7b).
 *
 * Avant : l'IDCC, l'OPCO et l'effectif ne se voyaient pas sur la fiche, et ne
 * se saisissaient que dans la liste des clients, avec deux sélecteurs d'OPCO.
 * Ici : lecture en tuiles, puis « Modifier » sur place (UN seul sélecteur,
 * l'OPCO typé) pour qui peut écrire. Lecture seule sinon. Rien pour un
 * particulier, qui n'a ni branche ni OPCO.
 *
 * Server Component ; seul le formulaire replié est un composant client.
 * L'OPCO se lit par la règle unique (`opcoDuClient` / `nomOpcoDuClient`).
 */

import type { ReactNode } from "react";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { ClientBrancheForm } from "@/components/admin/qualiopi/ClientBrancheForm";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { nomOpcoDuClient, opcoDuClient } from "@/server/qualiopi/financements/opco-referentiel";
import { suggererOpco } from "@/server/qualiopi/financements/opco-suggestion";
import type { CompanySize } from "@/server/qualiopi/crm/types";

export interface BrancheOpcoClient {
  id: string;
  type: string;
  idcc: string | null;
  conventionCollective: string | null;
  taille: CompanySize | null;
  effectif: number | null;
  effectifSource: string | null;
  effectifReleveLe: Date | null;
  opco: string | null;
  opcoIdentifie: string | null;
  opcoEnveloppeAnnuelleCents: number | null;
  opcoNumeroAdherent: string | null;
  opcoAdhesionOffreMobilites: boolean | null;
  opcoVersementVolontaire: boolean | null;
}

interface Props {
  client: BrancheOpcoClient;
  peutEcrire: boolean;
  /** Place laissée sous l'effectif (ex. « Rafraîchir depuis l'INSEE », lot A7d). */
  complementEffectif?: ReactNode;
}

const EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

function ouiNon(v: boolean | null): string {
  return v === null ? "Non renseigné" : v ? "Oui" : "Non";
}

const labelCls =
  "text-[length:var(--text-admin-xs)] tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase";
const valeurCls =
  "mt-0.5 text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]";
const noteCls = "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";

function Tuile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-bg)] px-[var(--space-admin-3)] py-[var(--space-admin-2)]">
      <p className={labelCls}>{label}</p>
      {children}
    </div>
  );
}

export function BrancheOpcoBloc({
  client,
  peutEcrire,
  complementEffectif,
}: Props): React.ReactElement | null {
  if (client.type === "particulier") return null;

  const opco = opcoDuClient(client);
  // L'OPCO typé n'est pas posé : ce qui s'affiche vient du texte libre — une suggestion.
  const suggestion = suggererOpco(client);
  const opcoAffiche = opco !== null ? nomOpcoDuClient(client) : null;
  const estSuggestion = client.opco === null && opco !== null;
  const sourceEffectif =
    client.effectifSource === "insee"
      ? "INSEE (borne basse de la tranche)"
      : client.effectifSource === "saisie"
        ? "Saisi"
        : null;

  return (
    <section
      aria-labelledby={`branche-opco-${client.id}`}
      className="mb-[var(--space-admin-8)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]"
    >
      <div className="mb-[var(--space-admin-3)] flex flex-wrap items-center justify-between gap-[var(--space-admin-3)]">
        <h2
          id={`branche-opco-${client.id}`}
          className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]"
        >
          Branche et OPCO
        </h2>
        {!peutEcrire ? <AdminBadge tone="outline">Lecture seule</AdminBadge> : null}
      </div>

      <div className="grid grid-cols-2 gap-[var(--space-admin-3)] sm:grid-cols-3 lg:grid-cols-6">
        <Tuile label="IDCC">
          <p className={`${valeurCls} font-mono`}>{client.idcc ?? "—"}</p>
          {client.conventionCollective ? (
            <p className={`${noteCls} truncate`} title={client.conventionCollective}>
              {client.conventionCollective}
            </p>
          ) : null}
        </Tuile>

        <Tuile label="Effectif">
          <p className={valeurCls}>{client.effectif ?? "Inconnu"}</p>
          {client.effectif !== null && sourceEffectif !== null ? (
            <p className={noteCls}>
              {sourceEffectif}
              {client.effectifReleveLe ? ` · ${formatDateFrShort(client.effectifReleveLe)}` : ""}
            </p>
          ) : null}
          {complementEffectif}
        </Tuile>

        <Tuile label="OPCO">
          <p className={valeurCls}>{opcoAffiche ?? "À déterminer"}</p>
          {estSuggestion ? (
            <AdminBadge tone="warning" className="mt-[var(--space-admin-1)]">
              suggéré
            </AdminBadge>
          ) : null}
        </Tuile>

        <Tuile label="Enveloppe annuelle">
          <p className={valeurCls}>
            {client.opcoEnveloppeAnnuelleCents === null
              ? "—"
              : EUR.format(client.opcoEnveloppeAnnuelleCents / 100)}
          </p>
        </Tuile>

        <Tuile label="N° d'adhérent">
          <p className={`${valeurCls} font-mono`}>{client.opcoNumeroAdherent ?? "—"}</p>
        </Tuile>

        <Tuile label="Versement volontaire">
          <p className={valeurCls}>{ouiNon(client.opcoVersementVolontaire)}</p>
        </Tuile>

        {opco === "mobilites" ? (
          <Tuile label="Offre Mobilités">
            <p className={valeurCls}>{ouiNon(client.opcoAdhesionOffreMobilites)}</p>
          </Tuile>
        ) : null}
      </div>

      {peutEcrire ? (
        <div className="mt-[var(--space-admin-3)]">
          <ClientBrancheForm
            id={client.id}
            idcc={client.idcc}
            taille={client.taille}
            opco={client.opco}
            suggestion={suggestion}
            effectif={client.effectif}
            complet
            enveloppeCents={client.opcoEnveloppeAnnuelleCents}
            numeroAdherent={client.opcoNumeroAdherent}
            adhesionMobilites={client.opcoAdhesionOffreMobilites}
            versementVolontaire={client.opcoVersementVolontaire}
          />
        </div>
      ) : null}
    </section>
  );
}
