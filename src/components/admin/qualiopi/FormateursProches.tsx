/**
 * FormateursProches — encadré de la fiche client (lot L15c, ADR 0066 ; W6).
 *
 * Server Component, aucun JavaScript envoyé au navigateur (la console est au
 * bord de son cliquet de poids). Il LIT : aucune affectation ici, elle reste
 * sur la fiche session avec ses gardes. Commune affichée, jamais l'adresse.
 * Usage interne : ces chiffres ne sont jamais montrés aux formateurs.
 */

import Link from "next/link";

import { formatDateFrShort } from "@/lib/format-date-fr";
import {
  LIBELLE_GROUPE,
  SEUIL_AVIS_SATISFACTION,
  type FormateurClasse,
} from "@/server/qualiopi/formateurs-proches/classer";
import type { ResultatProches } from "@/server/qualiopi/formateurs-proches/formateurs-proches-service";

const LIBELLE_STATUT: Readonly<Record<string, string>> = {
  salarie: "salarié",
  sous_traitant: "indépendant",
  dirigeant: "dirigeant",
};

const CADRE =
  "mb-[var(--space-admin-6)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]";
const DOUX = "text-[color:var(--color-admin-fg-soft)]";

function Ligne({ f, formateursBase }: { f: FormateurClasse; formateursBase: string }) {
  const s = f.stats;
  const marques = [
    LIBELLE_STATUT[f.statut] ?? f.statut,
    f.franceEntiere ? "se déplace partout" : null,
    f.intervientDansLaRegion ? "intervient dans la région" : null,
  ].filter(Boolean);
  return (
    <li className="flex flex-wrap items-baseline gap-x-[var(--space-admin-3)] py-1">
      <Link href={`${formateursBase}/${f.id}`} className="font-semibold underline">
        {f.nom}
      </Link>
      <span className={DOUX}>{f.commune ?? "lieu à compléter"}</span>
      {f.distanceKm !== null ? <span>{f.distanceKm} km</span> : null}
      <span className={DOUX}>{marques.join(" · ")}</span>
      <span className={DOUX}>
        {s.formationsRealisees} formation{s.formationsRealisees > 1 ? "s" : ""} réalisée
        {s.formationsRealisees > 1 ? "s" : ""}
        {" · "}
        {s.satisfaction
          ? `satisfaction ${s.satisfaction.moyenne.toLocaleString("fr-FR")}/5 (${s.satisfaction.avis} avis)`
          : `moins de ${SEUIL_AVIS_SATISFACTION} avis`}
        {s.derniereFormation ? ` · dernière le ${formatDateFrShort(s.derniereFormation)}` : ""}
      </span>
    </li>
  );
}

export function FormateursProches({
  resultat,
  formateursBase,
}: {
  resultat: ResultatProches | null;
  formateursBase: string;
}) {
  if (resultat === null) {
    return (
      <section aria-labelledby="formateurs-proches" className={CADRE} role="status">
        <h2 id="formateurs-proches" className="font-semibold">
          Formateurs proches
        </h2>
        <p className={DOUX}>Encadré indisponible pour le moment.</p>
      </section>
    );
  }
  const { depart, groupes, approximatif } = resultat;
  return (
    <section aria-labelledby="formateurs-proches" className={CADRE}>
      <h2 id="formateurs-proches" className="font-semibold">
        Formateurs proches
      </h2>
      <p className={DOUX}>
        {depart.sorte === "lieu"
          ? `Distances calculées depuis : ${depart.libelle}${approximatif ? " (commune approximative)" : ""}.`
          : depart.sorte === "distanciel"
            ? `Prochaine formation : ${depart.libelle}.`
            : "Indiquez un code postal sur la fiche client ou sur la prochaine session pour classer par distance."}
      </p>
      {groupes.length === 0 ? (
        <p className={DOUX}>Aucun formateur actif.</p>
      ) : (
        groupes.map((g) => (
          <div key={g.cle} className="mt-[var(--space-admin-3)]">
            <h3 className="text-[length:var(--text-admin-xs)] font-semibold uppercase">
              {LIBELLE_GROUPE[g.cle]}
            </h3>
            <ul>
              {g.formateurs.map((f) => (
                <Ligne key={f.id} f={f} formateursBase={formateursBase} />
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
