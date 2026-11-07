/**
 * Fiche admin d'un devis à formules sans formule retenue : le montant se détermine au choix du
 * client. Affiche un résumé des formules proposées (montants HT en centimes → euros) à la place
 * de « 0,00 € » et « Aucune ligne ». Pur, sans état : rendu serveur.
 */
import type { VueFormules } from "@/server/qualiopi/devis/vue-formules";

export const LIBELLE_MONTANT_AU_CHOIX = "Montant déterminé au choix du client";

const eur = (cents: number): string =>
  `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export function ResumeFormulesDevis({ vue }: { vue: VueFormules }) {
  return (
    <div data-testid="resume-formules-devis">
      <p className="mb-2 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        {LIBELLE_MONTANT_AU_CHOIX}
      </p>
      <ul className="space-y-1 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
        {vue.formules.map((f) => {
          const mensuel = f.abonnement?.periodes[0]?.mensuelNetHtCents ?? null;
          return (
            <li key={f.formule}>
              <span className="font-medium">{f.titre}</span> —{" "}
              <span className="tabular-nums">{eur(f.totalHtCents)} HT</span>
              {mensuel !== null && mensuel > 0 ? (
                <>
                  {" "}
                  + <span className="tabular-nums">{eur(mensuel)} HT</span> / mois
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
