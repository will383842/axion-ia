type Segment = "TPE" | "PME" | "ETI";

type Realisation = {
  segment: Segment;
  sector: string;
  title: string;
  outcome: string;
};

// 8 réalisations diversifiées, couvrant TPE / PME / ETI.
// Aucun nom de société ou de marque — secteur + résultat mesurable uniquement.
const REALISATIONS: Realisation[] = [
  {
    segment: "TPE",
    sector: "Artisan du bâtiment",
    title: "Devis générés automatiquement",
    outcome: "70 % de temps gagné sur la rédaction des devis.",
  },
  {
    segment: "TPE",
    sector: "Cabinet d'expertise comptable",
    title: "Saisie comptable assistée par IA",
    outcome: "Temps de saisie divisé par deux en trois mois.",
  },
  {
    segment: "TPE",
    sector: "Restaurant & hôtellerie",
    title: "Réponses aux avis & réservations",
    outcome: "Taux de réponse aux avis clients multiplié par trois.",
  },
  {
    segment: "PME",
    sector: "Industrie & production",
    title: "Maintenance prédictive",
    outcome: "Arrêts non planifiés réduits de 30 %.",
  },
  {
    segment: "PME",
    sector: "E-commerce",
    title: "Service client augmenté 24/7",
    outcome: "Première réponse en moins de 2 minutes, jour et nuit.",
  },
  {
    segment: "PME",
    sector: "Agence immobilière",
    title: "Qualification automatique des leads",
    outcome: "+40 % de rendez-vous réellement qualifiés.",
  },
  {
    segment: "ETI",
    sector: "Réseau de distribution",
    title: "Prévision de la demande",
    outcome: "Surstock réduit de 25 % sur les références clés.",
  },
  {
    segment: "ETI",
    sector: "Groupe de cliniques",
    title: "Synthèse automatisée des dossiers",
    outcome: "8 heures par semaine libérées pour chaque praticien.",
  },
];

const SEGMENT_LABEL: Record<Segment, string> = {
  TPE: "TPE",
  PME: "PME",
  ETI: "ETI & grands comptes",
};

// Dupliqué pour une boucle de défilement continue (translateX -50%).
const RAIL_ITEMS = [...REALISATIONS, ...REALISATIONS];

function RealisationCard({ item }: { item: Realisation }) {
  return (
    <article className="flex w-[320px] shrink-0 flex-col rounded-2xl border border-[#e7ddd2] bg-white p-7 shadow-[0_1px_2px_rgba(45,37,33,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-[#f3e9e2] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#b06a4f]">
          {SEGMENT_LABEL[item.segment]}
        </span>
        <span className="text-sm font-medium text-[#6b5d52]">{item.sector}</span>
      </div>
      <h3 className="mt-5 text-lg font-semibold leading-snug text-[#2d2521]">
        {item.title}
      </h3>
      <p className="mt-3 text-base leading-relaxed text-[#6b5d52]">
        {item.outcome}
      </p>
    </article>
  );
}

export function AuditRealisations() {
  return (
    <section aria-labelledby="audit-realisations-title" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#b06a4f]">
            Réalisations
          </p>
          <h2
            id="audit-realisations-title"
            className="mt-4 text-3xl font-semibold tracking-tight text-[#2d2521] sm:text-4xl"
          >
            Des projets livrés, pour toutes les tailles d'entreprise.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-[#6b5d52]">
            De l'artisan à l'ETI, chaque mission part d'un audit et se termine par
            un résultat mesurable. Voici un aperçu de ce que nous déployons.
          </p>
        </div>
      </div>

      <div className="relative mt-16 overflow-hidden">
        {/* Dégradés latéraux pour un fondu propre en entrée/sortie */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-white to-transparent sm:w-24"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-white to-transparent sm:w-24"
        />
        <ul className="case-rail flex w-max items-stretch gap-6 px-6">
          {RAIL_ITEMS.map((item, i) => (
            <li key={`${item.segment}-${item.sector}-${i}`} aria-hidden={i >= REALISATIONS.length}>
              <RealisationCard item={item} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
