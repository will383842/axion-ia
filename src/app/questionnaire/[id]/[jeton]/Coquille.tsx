// En-tête de marque, colonne de lecture et écrans de fin du questionnaire en
// ligne (merci, déjà envoyé, lien invalide), communs à toutes ses pages.
// Composants SERVEUR : aucun JavaScript envoyé au navigateur. Textes : UX §1.6-1.8.

import { ADRESSE_CONTACT, TEXTES } from "./textes";

export function Coquille({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-border border-b">
        <div className="mx-auto flex h-16 max-w-2xl items-center gap-2.5 px-5 sm:px-8">
          <span aria-hidden="true" className="bg-terracotta h-2.5 w-2.5 rounded-full" />
          <span className="font-serif text-[22px] font-medium">{TEXTES.marque}</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-16 sm:px-8">{children}</main>
    </>
  );
}

const icone = (d: string, className = "h-5 w-5") => (
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
const COCHE = "M5 12.5l4.5 4.5L19 7.5";
const ENVELOPPE = "M3 6h18v12H3zM3 7l9 6 9-6";

const pastille =
  "bg-terracotta-soft text-terracotta-deep inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[16px] font-semibold";
const boutonEcrire =
  "bg-terracotta hover:bg-terracotta-deep focus-visible:outline-terracotta mt-6 inline-flex min-h-[56px] items-center justify-center gap-2 rounded-full px-8 text-[19px] font-bold text-white focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-solid";

/** Merci (§1.6), déjà envoyé (§1.7), lien invalide (§1.8). */
export function EcranDeFin({ variante }: { variante: "merci" | "deja" | "invalide" }) {
  if (variante === "merci") {
    return (
      <section aria-labelledby="fin-titre">
        <div className="bg-paper bg-halo-warm shadow-card rounded-3xl p-7 text-center sm:p-10">
          <span className="bg-sage mx-auto grid h-20 w-20 place-items-center rounded-full text-white">
            {icone(COCHE, "h-9 w-9")}
          </span>
          <h1
            id="fin-titre"
            className="mt-6 font-serif text-[40px] leading-tight font-medium tracking-tight"
          >
            {TEXTES.merciTitre}
          </h1>
          <p className="text-fg-soft mt-3 text-[20px] leading-relaxed">{TEXTES.merciLigne}</p>
        </div>
        <ol className="mt-5 grid gap-3">
          <li className="bg-paper shadow-card flex items-center gap-3 rounded-2xl p-4">
            <span className="bg-sage grid h-11 w-11 shrink-0 place-items-center rounded-full text-white">
              {icone(COCHE)}
            </span>
            <span className="text-[18px] font-semibold">{TEXTES.merciVosReponses}</span>
            <span className="bg-sage-soft text-sage ml-auto rounded-full px-3 py-0.5 text-[16px] font-semibold">
              {TEXTES.merciRecues}
            </span>
          </li>
          <li className="bg-paper shadow-card flex items-center gap-3 rounded-2xl p-4">
            <span className="bg-terracotta-soft text-terracotta-deep grid h-11 w-11 shrink-0 place-items-center rounded-full">
              {icone(ENVELOPPE)}
            </span>
            <span className="text-[18px] font-semibold">{TEXTES.merciNotreEmail}</span>
            <span className="bg-terracotta-soft text-terracotta-deep ml-auto rounded-full px-3 py-0.5 text-[16px] font-semibold">
              {TEXTES.merciEnsuite}
            </span>
          </li>
        </ol>
        <p className="text-fg-soft mt-6 text-center text-[18px]">{TEXTES.merciFermer}</p>
      </section>
    );
  }
  const deja = variante === "deja";
  return (
    <section
      aria-labelledby="fin-titre"
      className="bg-paper bg-halo-warm shadow-card rounded-3xl p-7 sm:p-10"
    >
      <span className={pastille}>{deja ? TEXTES.dejaPastille : TEXTES.invalidePastille}</span>
      <h1
        id="fin-titre"
        className="mt-4 font-serif text-[34px] leading-tight font-medium tracking-tight sm:text-[40px]"
      >
        {deja ? TEXTES.dejaTitre : TEXTES.invalideTitre}
      </h1>
      <p className="text-fg-soft mt-3 text-[20px] leading-relaxed">
        {deja ? TEXTES.dejaLigne : TEXTES.invalideLigne}
      </p>
      <a href={`mailto:${ADRESSE_CONTACT}`} className={boutonEcrire}>
        {icone(ENVELOPPE)} {TEXTES.nousEcrire}
      </a>
      <p className="text-fg-soft mt-3 text-[17px]">{ADRESSE_CONTACT}</p>
    </section>
  );
}
