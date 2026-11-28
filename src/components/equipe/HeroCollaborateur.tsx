import { Check } from "lucide-react";
import { Container } from "@/components/layout/Container";
import type { ContenuFiche, FichePublique } from "@/lib/equipe";
import { ActionsFiche } from "./ActionsFiche";
import { PastilleCategorie } from "./PastilleCategorie";
import { PortraitCollaborateur } from "./PortraitCollaborateur";

/** « 27 novembre 2026 » : fuseau UTC, pour que la date affichée soit celle de la donnée. */
export function dateLisible(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Héros de la fiche : l'UNIQUE H1 (le nom), puis la réponse auto-portante.
 * Sur mobile le texte passe avant la photo (la réponse est l'élément LCP, rapide) ;
 * le portrait a un conteneur carré réservé : CLS 0.
 */
export function HeroCollaborateur({
  fiche,
  contenu,
}: {
  fiche: FichePublique;
  contenu: ContenuFiche;
}) {
  // Dirigeant principal : le nom de famille en terracotta italique (deux mots exactement).
  const mots = fiche.nom.split(" ");
  const nomEnDeuxTemps = fiche.estDirigeantPrincipal && mots.length >= 2;
  const premiers = mots.slice(0, -1).join(" ");
  const dernier = mots[mots.length - 1];
  return (
    <header
      style={{
        backgroundImage: "radial-gradient(at 92% 8%, rgba(194, 74, 27, 0.1) 0px, transparent 55%)",
      }}
      className="bg-bg text-fg relative pt-8 pb-14 sm:pt-10 sm:pb-18 lg:pt-12 lg:pb-22"
    >
      <Container>
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14">
          <div className="max-w-2xl">
            <PastilleCategorie categorie={fiche.categorie} />
            <h1 className="display-editorial text-fg mt-5">
              {nomEnDeuxTemps ? (
                <>
                  {premiers}{" "}
                  <span
                    className="text-terracotta italic"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {dernier}
                  </span>
                </>
              ) : (
                fiche.nom
              )}
            </h1>
            <p className="text-fg-soft mt-4 text-lg font-semibold sm:text-xl">
              {contenu.sousTitre}
            </p>
            {/* Réponse auto-portante : les trois accroches déclarées au JSON-LD (`speakable`). */}
            <p
              className="speakable text-fg-soft mt-6 text-lg leading-relaxed sm:text-xl"
              itemProp="text"
              data-answer=""
            >
              {fiche.reponseQui}
            </p>
            {contenu.pastilles.length > 0 ? (
              <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2.5">
                {contenu.pastilles.map((p) => (
                  <li key={p} className="text-fg-soft inline-flex items-center gap-2 text-sm">
                    <Check aria-hidden="true" className="text-terracotta h-4 w-4" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <ActionsFiche fiche={fiche} contenu={contenu} emplacement="hero" />
            </div>
            <p className="text-fg-muted mt-6 text-sm">
              Mis à jour le{" "}
              <time dateTime={contenu.dateMiseAJour}>{dateLisible(contenu.dateMiseAJour)}</time>
            </p>
          </div>
          <figure className="mx-auto w-full max-w-60 sm:max-w-sm lg:mx-0 lg:ml-auto lg:max-w-md">
            <PortraitCollaborateur
              fiche={fiche}
              priority
              sizes="(min-width: 1024px) 420px, (min-width: 640px) 384px, 240px"
              className="border-border bg-paper border"
            />
            <figcaption className="text-fg-muted mt-3 text-center text-sm lg:text-left">
              {fiche.nom}
              {fiche.fonction ? `, ${fiche.fonction}` : ""}
            </figcaption>
          </figure>
        </div>
      </Container>
    </header>
  );
}
