// Chronologie unique de l'onglet Activité (lot B2). Composant SERVEUR, lecture seule, sans JavaScript.
// Une liste ordonnée par jour (le plus récent en haut) ; chaque ligne porte une icône (aria-hidden)
// ET un mot, jamais la couleur seule. Jamais d'adresse e-mail ni de corps de message.

import Link from "next/link";
import { CalendarDays, ListChecks, Mail, MessageSquare, StickyNote, Wallet } from "lucide-react";

import type {
  EvenementActivite,
  JourDeChronologie,
  TypeActivite,
} from "@/features/dossier-client/fiche/chronologie";
import { htEtTtc } from "./montants";
import { TEINTE_NUANCE } from "./teintes-activite";

const ICONE = {
  rendez_vous: CalendarDays,
  email: Mail,
  message: MessageSquare,
  note: StickyNote,
  tache: ListChecks,
  argent: Wallet,
} as const;

const MOT: Readonly<Record<TypeActivite, string>> = {
  rendez_vous: "Rendez-vous",
  email: "E-mail",
  message: "Message",
  note: "Note",
  tache: "Tâche",
  argent: "Argent",
};

const FORMAT_ENTIER = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const FORMAT_CENTIMES = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Un paiement reçu s'écrit en TTC (« 720 € TTC »), espaces insécables. */
function ttcSeul(cents: number): string {
  const f = cents % 100 === 0 ? FORMAT_ENTIER : FORMAT_CENTIMES;
  return `${f.format(cents / 100).replace(/[  ]/g, " ")} € TTC`; // price-exempt
}

const heure = (d: Date): string =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

function Montant({ m }: { m: NonNullable<EvenementActivite["montant"]> }): React.ReactElement {
  if (m.base === "ttc") {
    return <span className="block font-medium tabular-nums">{ttcSeul(m.cents)}</span>;
  }
  const { ht, ttc } = htEtTtc(m.cents);
  return (
    <span className="block tabular-nums">
      <span className="font-medium">{ht}</span>
      <span className="block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        {ttc}
      </span>
    </span>
  );
}

function Ligne({ e }: { e: EvenementActivite }): React.ReactElement {
  const Icone = ICONE[e.type];
  return (
    <li className="flex flex-wrap items-start gap-x-[var(--space-admin-3)] gap-y-[var(--space-admin-1)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
      <span
        className={`inline-flex min-h-[44px] items-center gap-[var(--space-admin-2)] rounded-full border px-[var(--space-admin-3)] ${TEINTE_NUANCE[e.nuance]}`}
      >
        <Icone size={14} aria-hidden="true" />
        <span>{e.mot ?? MOT[e.type]}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium break-words">{e.titre}</p>
        <p className="text-[color:var(--color-admin-fg-muted)]">
          <span className="tabular-nums">{heure(e.date)}</span> · {e.etat}
          {e.destinataire != null && e.destinataire !== "" ? ` · à ${e.destinataire}` : ""}
        </p>
        {e.montant !== undefined ? <Montant m={e.montant} /> : null}
        {e.texte != null && e.texte !== "" ? (
          <p className="mt-[var(--space-admin-1)] break-words whitespace-pre-line">{e.texte}</p>
        ) : null}
        {e.lien !== null ? (
          <Link href={e.lien} className="admin-link inline-flex min-h-[44px] items-center">
            {e.libelleLien ?? "Ouvrir"}
          </Link>
        ) : null}
      </div>
    </li>
  );
}

function Jours({ jours }: { jours: ReadonlyArray<JourDeChronologie> }): React.ReactElement {
  return (
    <ol aria-label="Activité de la fiche" className="space-y-[var(--space-admin-4)]">
      {jours.map((j, i) => (
        <li key={`${j.jour}-${i}`}>
          <h3 className="text-[length:var(--text-admin-sm)] font-semibold">{j.libelle}</h3>
          <ul className="divide-y divide-[color:var(--color-admin-border)]">
            {j.evenements.map((e) => (
              <Ligne key={e.cle} e={e} />
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

export function Chronologie({
  jours,
  epinglees = [],
  sourcesEnPanne = 0,
}: {
  jours: ReadonlyArray<JourDeChronologie>;
  /** Notes épinglées (filtre Notes) : bloc à part, liste plate, avant le regroupement par jour. */
  epinglees?: ReadonlyArray<EvenementActivite>;
  /** Sources en panne : la chronologie est incomplète, et on le dit. */
  sourcesEnPanne?: number;
}): React.ReactElement {
  const vide = jours.length === 0 && epinglees.length === 0;
  return (
    <div>
      {sourcesEnPanne > 0 ? (
        <p role="alert" className="admin-alert admin-alert-warning mb-[var(--space-admin-3)]">
          <span>Une partie de l&apos;activité n&apos;a pas pu être lue.</span>
        </p>
      ) : null}
      {vide ? (
        sourcesEnPanne > 0 ? null : (
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Aucune activité pour l&apos;instant.
          </p>
        )
      ) : (
        <>
          {epinglees.length > 0 ? (
            <section aria-labelledby="notes-epinglees" className="mb-[var(--space-admin-4)]">
              <h3 id="notes-epinglees" className="text-[length:var(--text-admin-sm)] font-semibold">
                Épinglées
              </h3>
              <ul className="divide-y divide-[color:var(--color-admin-border)]">
                {epinglees.map((e) => (
                  <Ligne key={e.cle} e={e} />
                ))}
              </ul>
            </section>
          ) : null}
          {jours.length > 0 ? <Jours jours={jours} /> : null}
        </>
      )}
    </div>
  );
}
