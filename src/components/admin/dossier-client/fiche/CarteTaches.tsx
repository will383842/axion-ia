// Carte « Tâches » du Résumé (lot B3). Composant serveur, sans JavaScript client : le formulaire
// se replie par <details>, les boutons sont des formulaires serveur. Terracotta = en retard ou
// aujourd'hui, bleu = à venir, vert = fait ; toujours une icône ET un mot.

import Link from "next/link";
import { CalendarCheck, CalendarClock, CircleCheck, ListTodo, Plus, RotateCcw } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AdminBloc } from "@/components/admin/ui/AdminBloc";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import {
  ajouterTacheFormAction,
  marquerFaiteFormAction,
  rouvrirTacheFormAction,
} from "@/features/dossier-client/fiche/actions-taches";
import {
  etatDeLaTache,
  INTITULE_MAX,
  RESPONSABLE_MAX,
  RESPONSABLE_PAR_DEFAUT,
  type EtatTache,
  type TacheDeLaFiche,
} from "@/features/dossier-client/fiche/taches";
import { formatDateFrShort } from "@/lib/format-date-fr";

export const TACHES_VISIBLES = 3;

const ETAT: Readonly<Record<EtatTache, { mot: string; icone: LucideIcon; classe: string }>> = {
  en_retard: {
    mot: "En retard",
    icone: CalendarClock,
    classe: "text-[color:var(--color-admin-bloc-terracotta-title)]",
  },
  aujourdhui: {
    mot: "Aujourd'hui",
    icone: CalendarClock,
    classe: "text-[color:var(--color-admin-bloc-terracotta-title)]",
  },
  a_venir: {
    mot: "À venir",
    icone: CalendarCheck,
    classe: "text-[color:var(--color-admin-bloc-bleu-title)]",
  },
};

const champCls =
  "min-h-11 rounded border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-bg)] px-2";
const mutedCls = "text-[color:var(--color-admin-fg-muted)]";

function Cachees({
  clientId,
  tacheId,
}: {
  clientId: string;
  tacheId?: string;
}): React.ReactElement {
  return (
    <>
      <input type="hidden" name="clientId" value={clientId} />
      {tacheId ? <input type="hidden" name="tacheId" value={tacheId} /> : null}
    </>
  );
}

function Ligne({
  t,
  clientId,
  jour,
  peutEcrire,
}: {
  t: TacheDeLaFiche;
  clientId: string;
  jour: string;
  peutEcrire: boolean;
}): React.ReactElement {
  const fait = t.faiteLe !== null;
  const etat = ETAT[etatDeLaTache(t.avantLe, jour)];
  const Icone = fait ? CircleCheck : etat.icone;
  return (
    <li className="flex flex-wrap items-center justify-between gap-[var(--space-admin-3)] border-t border-[color:var(--color-admin-border)] py-[var(--space-admin-3)] first:border-t-0">
      <div className="min-w-0 flex-1 text-[length:var(--text-admin-sm)]">
        <p className="font-semibold">{t.intitule}</p>
        <p className={`flex flex-wrap items-center gap-x-[var(--space-admin-3)] ${mutedCls}`}>
          <span
            className={`inline-flex items-center gap-1 font-semibold ${
              fait ? "text-[color:var(--color-admin-bloc-vert-title)]" : etat.classe
            }`}
          >
            <Icone aria-hidden className="h-4 w-4" />
            {fait ? `Faite le ${formatDateFrShort(t.faiteLe)}` : etat.mot}
          </span>
          <span>avant le {formatDateFrShort(new Date(`${t.avantLe}T00:00:00.000Z`))}</span>
          <span>Responsable : {t.responsable}</span>
          {t.personne !== null ? <span>Personne : {t.personne}</span> : null}
          {t.prestation !== null ? <span>Prestation : {t.prestation}</span> : null}
        </p>
      </div>
      {peutEcrire ? (
        <form action={fait ? rouvrirTacheFormAction : marquerFaiteFormAction}>
          <Cachees clientId={clientId} tacheId={t.id} />
          <AdminButton type="submit" variant="secondary" icon={fait ? RotateCcw : CircleCheck}>
            {fait ? "Rouvrir" : "Marquer comme faite"}
          </AdminButton>
        </form>
      ) : null}
    </li>
  );
}

export function CarteTaches(props: {
  clientId: string;
  ficheHref: string;
  jour: string;
  peutEcrire: boolean;
  ouvertes: ReadonlyArray<TacheDeLaFiche>;
  faites: ReadonlyArray<TacheDeLaFiche>;
  personnes: ReadonlyArray<{ id: string; nom: string }>;
  prestations: ReadonlyArray<{ id: string; libelle: string }>;
}): React.ReactElement {
  const { clientId, ficheHref, jour, peutEcrire, ouvertes, faites, personnes, prestations } = props;
  const visibles = ouvertes.slice(0, TACHES_VISIBLES);
  const retard = ouvertes.filter((t) => etatDeLaTache(t.avantLe, jour) === "en_retard").length;
  return (
    <AdminBloc
      teinte={retard > 0 ? "terracotta" : "bleu"}
      niveau={2}
      titre={
        <span className="inline-flex items-center gap-2">
          <ListTodo aria-hidden className="h-5 w-5" />
          Ce que je dois faire
        </span>
      }
    >
      {visibles.length === 0 ? (
        <p className={`text-[length:var(--text-admin-sm)] ${mutedCls}`}>
          Aucune tâche ouverte sur cette fiche.
        </p>
      ) : (
        <ul>
          {visibles.map((t) => (
            <Ligne key={t.id} t={t} clientId={clientId} jour={jour} peutEcrire={peutEcrire} />
          ))}
        </ul>
      )}
      {ouvertes.length > visibles.length ? (
        <p className="text-[length:var(--text-admin-sm)]">
          {ouvertes.length - visibles.length} autre(s) tâche(s) ouverte(s).
        </p>
      ) : null}
      <p className="mt-[var(--space-admin-2)]">
        <Link
          href={`${ficheHref}?onglet=activite&filtre=taches`}
          className="inline-flex min-h-11 items-center text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
        >
          Voir toutes les tâches
        </Link>
      </p>
      {faites.length > 0 ? (
        <div className="mt-[var(--space-admin-3)]">
          <h3 className="text-[length:var(--text-admin-sm)] font-semibold">Faites récemment</h3>
          <ul>
            {faites.map((t) => (
              <Ligne key={t.id} t={t} clientId={clientId} jour={jour} peutEcrire={peutEcrire} />
            ))}
          </ul>
        </div>
      ) : null}
      {peutEcrire ? (
        <details className="mt-[var(--space-admin-3)]">
          <summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-[length:var(--text-admin-sm)] font-semibold">
            <Plus aria-hidden className="h-4 w-4" />
            Ajouter une tâche
          </summary>
          <form
            action={ajouterTacheFormAction}
            className="mt-[var(--space-admin-2)] grid grid-cols-1 gap-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] sm:grid-cols-2"
          >
            <Cachees clientId={clientId} />
            <label className="flex flex-col gap-1 sm:col-span-2">
              Ce qu&apos;il y a à faire
              <input
                type="text"
                name="intitule"
                required
                maxLength={INTITULE_MAX}
                className={champCls}
              />
            </label>
            <label className="flex flex-col gap-1">
              Avant le
              <input type="date" name="avantLe" required defaultValue={jour} className={champCls} />
            </label>
            <label className="flex flex-col gap-1">
              Responsable
              <input
                type="text"
                name="responsable"
                defaultValue={RESPONSABLE_PAR_DEFAUT}
                maxLength={RESPONSABLE_MAX}
                className={champCls}
              />
            </label>
            <label className="flex flex-col gap-1">
              Personne (facultatif)
              <select name="contactId" defaultValue="" className={champCls}>
                <option value="">Aucune</option>
                {personnes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              Prestation (facultatif)
              <select name="projetId" defaultValue="" className={champCls}>
                <option value="">Aucune</option>
                {prestations.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.libelle}
                  </option>
                ))}
              </select>
            </label>
            <div className="sm:col-span-2">
              <AdminButton type="submit" variant="secondary" icon={Plus}>
                Ajouter la tâche
              </AdminButton>
            </div>
          </form>
        </details>
      ) : null}
    </AdminBloc>
  );
}
