// Coquille du dossier en ligne de l'apporteur : bandeau de marque, colonne de lecture
// étroite (mobile d'abord), et les écrans d'état (lien invalide, dossier reçu, signé).
// Composants SERVEUR : aucun JavaScript envoyé au navigateur.

import { ADRESSE_CONTACT, TEXTES } from "./textes";

export function Coquille({ titre, children }: { titre?: string; children: React.ReactNode }) {
  return (
    <>
      <header className="bg-terracotta text-white">
        <div className="mx-auto w-full max-w-xl px-4 pt-4 pb-5 sm:px-6">
          <p className="text-[13px] font-bold tracking-[0.08em] uppercase">
            {TEXTES.marque} · {TEXTES.surtitre}
          </p>
          {titre ? (
            <p className="mt-1 font-serif text-[26px] leading-tight font-medium">{titre}</p>
          ) : null}
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl px-4 pt-5 pb-16 sm:px-6">{children}</main>
    </>
  );
}

export const icone = (d: string, className = "h-5 w-5") => (
  <svg
    className={`${className} shrink-0`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);
export const COCHE = "M5 12.5l4.5 4.5L19 7.5";
const ENVELOPPE = "M3 6h18v12H3zM3 7l9 6 9-6";

const pastille =
  "bg-terracotta-soft text-terracotta-deep inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[16px] font-semibold";

/** Un écran d'état : pastille, titre, une ligne, et ce qui suit. */
export function EcranEtat({
  pastilleTexte,
  titre,
  ligne,
  succes = false,
  children,
}: {
  pastilleTexte: string;
  titre: string;
  ligne: string;
  succes?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section aria-labelledby="etat-titre" className="bg-paper bg-halo-warm shadow-card rounded-3xl p-6 sm:p-8">
      {succes ? (
        <span className="bg-sage grid h-16 w-16 place-items-center rounded-full text-white">
          {icone(COCHE, "h-8 w-8")}
        </span>
      ) : (
        <span className={pastille}>{pastilleTexte}</span>
      )}
      <h1
        id="etat-titre"
        className="mt-4 font-serif text-[30px] leading-tight font-medium tracking-tight sm:text-[36px]"
      >
        {titre}
      </h1>
      <p className="text-fg-soft mt-3 text-[18px] leading-relaxed">{ligne}</p>
      {children}
    </section>
  );
}

/** La page NEUTRE : lien faux, révoqué, inconnu, dossier refusé ou résilié. */
export function EcranInvalide() {
  return (
    <EcranEtat pastilleTexte={TEXTES.invalidePastille} titre={TEXTES.invalideTitre} ligne={TEXTES.invalideLigne}>
      <a
        href={`mailto:${ADRESSE_CONTACT}`}
        className="bg-terracotta hover:bg-terracotta-deep focus-visible:outline-terracotta mt-6 inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full px-7 text-[18px] font-bold text-white focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-solid"
      >
        {icone(ENVELOPPE)} {TEXTES.nousEcrire}
      </a>
      <p className="text-fg-soft mt-3 text-[16px]">{ADRESSE_CONTACT}</p>
    </EcranEtat>
  );
}
