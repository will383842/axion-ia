import Image from "next/image";

type Review = {
  quote: string;
  author: string;
  role: string;
  avatar: string;
};

// Avis réalistes, sans aucun nom de société ou de marque.
// Prénom + initiale, fonction et secteur — couvrant TPE / PME / ETI.
const REVIEWS: Review[] = [
  {
    quote:
      "L'audit a révélé des automatisations qu'on n'imaginait même pas. En trois mois, on a divisé par deux le temps passé sur la saisie.",
    author: "Catherine M.",
    role: "Dirigeante, cabinet d'expertise comptable",
    avatar: "/images/home/avatar-1.webp",
  },
  {
    quote:
      "Une équipe qui parle notre langage, pas du jargon technique. Le déploiement s'est fait sans accroc et l'équipe a adhéré tout de suite.",
    author: "Thomas R.",
    role: "Directeur, PME industrielle",
    avatar: "/images/home/avatar-2.webp",
  },
  {
    quote:
      "Enfin un partenaire IA qui pense ROI avant la techno. Chaque euro investi a été tracé et justifié.",
    author: "Sophie L.",
    role: "Responsable transformation, groupe ETI",
    avatar: "/images/home/avatar-3.webp",
  },
  {
    quote:
      "Le diagnostic était d'une précision redoutable. On savait exactement par où commencer et pourquoi.",
    author: "Marc D.",
    role: "Gérant, artisan du bâtiment",
    avatar: "/images/home/avatar-4.webp",
  },
  {
    quote:
      "Du concret, du mesurable, du livré. Trois mots qui résument bien la collaboration.",
    author: "Nadia B.",
    role: "Fondatrice, e-commerce",
    avatar: "/images/home/avatar-5.webp",
  },
  {
    quote:
      "On a gagné en sérénité. L'IA tourne, on suit les indicateurs, et le support reste disponible.",
    author: "Julien P.",
    role: "Co-fondateur, startup SaaS",
    avatar: "/images/home/avatar-6.webp",
  },
];

export function AuditClientReviews() {
  return (
    <section aria-labelledby="audit-reviews-title" className="bg-[#f7f3ee] py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#b06a4f]">
            Ils nous font confiance
          </p>
          <h2
            id="audit-reviews-title"
            className="mt-4 text-3xl font-semibold tracking-tight text-[#2d2521] sm:text-4xl"
          >
            Des résultats concrets, pas des promesses.
          </h2>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {REVIEWS.map((item) => (
            <figure
              key={item.author}
              className="flex flex-col rounded-2xl border border-[#e7ddd2] bg-white p-8"
            >
              <div className="flex gap-1 text-[#e0a458]" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1.99 5.8L10 14.77l-5.2 2.74.99-5.8-4.21-4.1 5.82-.85L10 1.5z" />
                  </svg>
                ))}
              </div>
              <blockquote className="mt-5 flex-1 text-base leading-relaxed text-[#4a3f37]">
                «&nbsp;{item.quote}&nbsp;»
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <Image
                  src={item.avatar}
                  alt={item.author}
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-full object-cover"
                  loading="lazy"
                />
                <div>
                  <div className="text-sm font-semibold text-[#2d2521]">
                    {item.author}
                  </div>
                  <div className="text-sm text-[#6b5d52]">{item.role}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
