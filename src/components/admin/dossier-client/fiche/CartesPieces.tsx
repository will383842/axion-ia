/**
 * Devis et factures en cartes (lot B7). Affichage seul : « Envoyer un rappel » est un LIEN vers la page
 * de la facture, où le rappel existe déjà ; rien n'est envoyé depuis la fiche.
 */

import Link from "next/link";
import { Bell } from "lucide-react";

import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { htEtTtc } from "./montants";
import {
  dateCourte,
  estFactureOuverte,
  encaisseCents,
  montantEnEuros,
  resteDuNetCents,
  montantHt,
  montantTtc,
  paiementPartiel,
  type FacturePourArgent,
} from "@/features/dossier-client/fiche/argent-de-la-fiche";

export type TonStatut = "neutral" | "info" | "success" | "warning" | "destructive";
export type CorrespondanceStatut = Record<string, { label: string; tone: TonStatut }>;

const carteCls =
  "rounded-[var(--radius-admin-md,8px)] border border-[color:var(--color-admin-border)] bg-white p-[var(--space-admin-4)]";
const lienNumeroCls =
  "font-mono text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline";
const petitCls = "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";

function Statut({
  map,
  statut,
}: {
  map: CorrespondanceStatut;
  statut: string;
}): React.ReactElement {
  const e = map[statut];
  return (
    <AdminBadge tone={e?.tone ?? "neutral"} dot>
      {e?.label ?? statut.replace(/_/g, " ")}
    </AdminBadge>
  );
}

export function CartesDevis({
  devis,
  qBase,
  statuts,
}: {
  devis: ReadonlyArray<{
    id: string;
    numero: string;
    statut: string;
    montantTotalHtCents: number;
    createdAt: Date;
  }>;
  qBase: string;
  statuts: CorrespondanceStatut;
}): React.ReactElement {
  return (
    <ul className="grid grid-cols-1 gap-[var(--space-admin-3)] lg:grid-cols-2">
      {devis.map((d) => {
        const m = htEtTtc(d.montantTotalHtCents);
        return (
          <li key={d.id} className={carteCls}>
            <div className="flex flex-wrap items-center justify-between gap-[var(--space-admin-2)]">
              <Link href={`${qBase}/devis/${d.id}`} className={lienNumeroCls}>
                {d.numero}
              </Link>
              <Statut map={statuts} statut={d.statut} />
            </div>
            <p className="mt-[var(--space-admin-2)] font-semibold tabular-nums">{m.ht}</p>
            <p className={`${petitCls} tabular-nums`}>{m.ttc}</p>
            <p className={petitCls}>Devis du {dateCourte(d.createdAt)}</p>
          </li>
        );
      })}
    </ul>
  );
}

type FactureCarte = FacturePourArgent & {
  id: string;
  numero: string;
  emiseAt: Date | null;
  createdAt: Date;
  echeanceAt: Date | null;
};

export function CartesFactures({
  factures,
  qBase,
  statuts,
}: {
  factures: readonly FactureCarte[];
  qBase: string;
  statuts: CorrespondanceStatut;
}): React.ReactElement {
  return (
    <ul className="grid grid-cols-1 gap-[var(--space-admin-3)] lg:grid-cols-2">
      {factures.map((f) => {
        const estAvoir = f.avoirDeId !== null;
        const ttcConnu = f.montantTtcCents !== null;
        const partiel = paiementPartiel(f);
        const reste = resteDuNetCents(f);
        const ouverteDue = !estAvoir && estFactureOuverte(f.statut) && reste > 0;
        const avant = f.echeanceAt ? ` avant le ${dateCourte(f.echeanceAt)}` : "";
        // Sans TTC en base, le chiffre mêle HT et TTC : on ne l'étiquette ni HT ni TTC, on le dit.
        const somme = (c: number): string =>
          ttcConnu ? montantTtc(c) : `${montantEnEuros(c)}\u00a0€ (TTC non renseigné)`;
        return (
          <li key={f.id} className={carteCls}>
            <div className="flex flex-wrap items-center justify-between gap-[var(--space-admin-2)]">
              <span className="flex items-center gap-[var(--space-admin-2)]">
                <Link href={`${qBase}/facturation/${f.id}`} className={lienNumeroCls}>
                  {f.numero}
                </Link>
                {estAvoir ? <AdminBadge tone="outline">Avoir</AdminBadge> : null}
              </span>
              <Statut map={statuts} statut={f.statut} />
            </div>
            <p className="mt-[var(--space-admin-2)] font-semibold tabular-nums">
              {montantHt(f.montantHtCents)}
            </p>
            <p className={`${petitCls} tabular-nums`}>
              {ttcConnu ? montantTtc(f.montantTtcCents as number) : "TTC non renseigné"}
            </p>
            <p className={petitCls}>
              {estAvoir ? "Avoir" : "Facture"} du {dateCourte(f.emiseAt ?? f.createdAt)}
            </p>
            {partiel ? (
              <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] tabular-nums">
                Payée en partie : {somme(partiel.recuCents)} reçus, {somme(partiel.resteCents)}{" "}
                restent à encaisser{avant}.
              </p>
            ) : ouverteDue && encaisseCents(f) === 0 ? (
              <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] tabular-nums">
                {somme(reste)} restent à encaisser{avant}.
              </p>
            ) : null}
            {ouverteDue && (partiel !== null || f.statut === "en_retard") ? (
              <div className="mt-[var(--space-admin-3)]">
                <AdminButton
                  href={`${qBase}/facturation/${f.id}`}
                  variant="secondary"
                  size="md"
                  icon={Bell}
                >
                  Envoyer un rappel
                </AdminButton>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
