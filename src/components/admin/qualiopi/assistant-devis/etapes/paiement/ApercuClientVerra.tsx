"use client";
// use-client: aperçu sous useDeferredValue pour ne jamais bloquer la saisie.

/**
 * « Ce que le client verra » (fiche E15). N'affiche que les formules proposées ; les montants
 * viennent de `calculs.ts` (HT ; le taux de TVA est reçu en paramètre). Aucun montant
 * d'exemple, aucune phrase d'engagement : le détail par phase vient de l'aperçu serveur.
 */
import { FileText } from "lucide-react";
import { useDeferredValue } from "react";

import { AdminCard } from "@/components/admin/ui/AdminCard";

import {
  eurosEnCents,
  totauxFormuleA,
  totauxLignes,
  totauxMiseEnServiceB,
  type Totaux,
} from "../../calculs";
import { propositionEffective } from "../../etat";
import type { EtatAssistant } from "../../types";

const EUROS = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const euros = (c: number): string => EUROS.format(c / 100);

function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-[var(--space-admin-3)] py-[var(--space-admin-1)] ${
        libelle === "Total TTC"
          ? "mt-[var(--space-admin-2)] border-t border-[color:var(--color-admin-border)] pt-[var(--space-admin-3)] font-semibold"
          : ""
      }`}
    >
      <dt className="text-[color:var(--color-admin-fg-muted)]">{libelle}</dt>
      <dd className="m-0 text-right whitespace-nowrap tabular-nums">{valeur}</dd>
    </div>
  );
}

/** HT, TVA et TTC d'un total ; le taux vient des calculs (paramètre), jamais d'ici. */
function LignesTotaux({ t, libelleHt }: { t: Totaux; libelleHt: string }) {
  return (
    <>
      <Ligne libelle={libelleHt} valeur={euros(t.htCents)} />
      <Ligne libelle="TVA" valeur={euros(t.tvaCents)} />
      <Ligne libelle="Total TTC" valeur={euros(t.ttcCents)} />
    </>
  );
}

const montantLu = (saisie: string): string => {
  const c = eurosEnCents(saisie);
  return c === null ? "—" : euros(c);
};

export function ApercuClientVerra({
  etat,
  tvaStandardPct,
}: {
  etat: EtatAssistant;
  tvaStandardPct: number;
}) {
  const e = useDeferredValue(etat);
  const p = propositionEffective(e);
  const a = p === "A" || p === "AB";
  const b = p === "B" || p === "AB";
  return (
    <aside aria-label="Ce que le client verra" className="w-full shrink-0 lg:w-[22rem]">
      <AdminCard as="div" className="flex flex-col gap-[var(--space-admin-6)]">
        <p className="flex items-center gap-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold">
          <FileText size={20} aria-hidden="true" className="shrink-0" />
          Ce que le client verra
        </p>
        {p === "prix_unique" ? (
          <dl className="m-0">
            <LignesTotaux t={totauxLignes(e.lignes, tvaStandardPct)} libelleHt="Total HT" />
          </dl>
        ) : null}
        {a ? (
          <section aria-label="Aperçu de la formule A">
            <p className="mb-[var(--space-admin-2)] font-semibold">Formule A</p>
            <dl className="m-0">
              <LignesTotaux t={totauxFormuleA(e, tvaStandardPct)} libelleHt="Mise en place (HT)" />
              <Ligne
                libelle={`Maintenance (${e.achat.maintenance.regle === "obligatoire" ? "obligatoire" : "facultative"})`}
                valeur={`${montantLu(e.achat.maintenance.mensuelEur)} HT / mois`}
              />
              {e.achat.hebergement === "axion" && e.achat.hebergementMensuelEur.trim() !== "" ? (
                <Ligne
                  libelle="Hébergement chez Axion-IA"
                  valeur={`${montantLu(e.achat.hebergementMensuelEur)} HT / mois`}
                />
              ) : null}
            </dl>
          </section>
        ) : null}
        {b ? (
          <section aria-label="Aperçu de la formule B">
            <p className="mb-[var(--space-admin-2)] font-semibold">Formule B</p>
            <dl className="m-0">
              <LignesTotaux
                t={totauxMiseEnServiceB(e, tvaStandardPct)}
                libelleHt="Mise en service (HT)"
              />
              <Ligne
                libelle="Abonnement"
                valeur={`${montantLu(e.abonnement.mensuelCatalogueEur)} HT / mois`}
              />
            </dl>
          </section>
        ) : null}
      </AdminCard>
    </aside>
  );
}
