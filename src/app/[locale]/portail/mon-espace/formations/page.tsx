/**
 * Espace stagiaire — mes formations.
 *
 * Une formation par carte, avec ses dates et son état. L'ancienne version les
 * empilait dans une liste à puces où le statut tenait dans une pastille grise
 * indistincte des dates : le bénéficiaire ne pouvait pas voir d'un coup d'œil
 * laquelle était en cours.
 */

import { CalendarDays } from "lucide-react";

import { CoquilleStagiaire } from "../_coquille";

/**
 * Libellés d'état. « Inscrit » et « En cours » disent au bénéficiaire où il en
 * est ; « Abandon » et « Exclu » sont les valeurs du système, adoucies pour être
 * lues par la personne concernée sans être trompeuses.
 */
const ETATS: Record<string, { label: string; ton: "attente" | "actif" | "neutre" }> = {
  planifiee: { label: "Inscrit", ton: "attente" },
  presente: { label: "En cours", ton: "actif" },
  abandon: { label: "Interrompue", ton: "neutre" },
  exclu: { label: "Interrompue", ton: "neutre" },
};

const TONS: Record<"attente" | "actif" | "neutre", string> = {
  attente: "bg-sand-deep text-mocha",
  actif: "bg-sage-soft text-sage",
  neutre: "bg-sand text-fg-muted",
};

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function MesFormationsPage({ params }: PageProps) {
  const { locale } = await params;

  return (
    <CoquilleStagiaire section="formations" locale={locale}>
      {(espace) => (
        <>
          <header className="mb-8">
            <h1 className="text-mocha font-serif text-2xl font-semibold sm:text-3xl">
              Mes formations
            </h1>
            <p className="text-fg-soft mt-2 text-sm">
              Les formations auxquelles vous êtes inscrit, et leurs dates.
            </p>
          </header>

          {espace.formations.length === 0 ? (
            <EtatVide />
          ) : (
            <ul className="space-y-4">
              {espace.formations.map((f, i) => {
                const etat = ETATS[f.statut] ?? { label: f.statut, ton: "neutre" as const };
                return (
                  <li
                    key={`${f.titre}-${i}`}
                    className="bg-paper shadow-card rounded-xl p-5 sm:p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h2 className="text-mocha font-serif text-lg leading-snug font-semibold">
                        {f.titre}
                      </h2>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${TONS[etat.ton]}`}
                      >
                        {etat.label}
                      </span>
                    </div>
                    <p className="text-fg-soft mt-3 flex items-center gap-2 text-sm">
                      <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
                      {f.dateFin && f.dateFin.getTime() !== f.dateDebut.getTime()
                        ? `Du ${formatDate(f.dateDebut)} au ${formatDate(f.dateFin)}`
                        : formatDate(f.dateDebut)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </CoquilleStagiaire>
  );
}

function EtatVide() {
  return (
    <div className="bg-paper shadow-card rounded-xl p-8 text-center">
      <p className="text-mocha font-serif text-base font-semibold">Aucune formation enregistrée</p>
      <p className="text-fg-soft mx-auto mt-2 max-w-sm text-sm leading-relaxed">
        Dès que votre inscription sera enregistrée, votre formation apparaîtra ici avec ses dates.
      </p>
    </div>
  );
}
