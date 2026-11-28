import { Check } from "lucide-react";
import { Container } from "@/components/layout/Container";
import type { ContenuFiche, FichePublique } from "@/lib/equipe";
import { ActionsFiche } from "./ActionsFiche";
import { PastilleCategorie } from "./PastilleCategorie";
import { PortraitCollaborateur } from "./PortraitCollaborateur";
import { ChiffresCles } from "./visuels/ChiffresCles";
import { iconeDe } from "./visuels/icones";
import { HALO_TERRACOTTA } from "./visuels/SectionFiche";

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
 * Héros de la fiche : l'UNIQUE H1 (le nom), puis la réponse auto-portante, sur fond foncé.
 * Sur mobile le texte passe avant la photo (la réponse est l'élément LCP, rapide) ;
 * le portrait a un conteneur carré réservé : CLS 0. Aucune animation sur H1 ni réponse.
 * `chiffres` (≥ 2) : rangée de chiffres clés, dernière rangée du héros. `pastillesDetaillees` :
 * preuves avec icône ; à défaut, `contenu.pastilles` avec l'icône « coche ».
 */
export function HeroCollaborateur({
  fiche,
  contenu,
  chiffres,
  pastillesDetaillees,
}: {
  fiche: FichePublique;
  contenu: ContenuFiche;
  chiffres?: ReadonlyArray<{ valeur: string; libelle: string; icone?: string }>;
  pastillesDetaillees?: ReadonlyArray<{ libelle: string; icone?: string }>;
}) {
  // Dirigeant principal : le nom de famille en terracotta italique (deux mots exactement).
  const mots = fiche.nom.split(" ");
  const nomEnDeuxTemps = fiche.estDirigeantPrincipal && mots.length >= 2;
  const premiers = mots.slice(0, -1).join(" ");
  const dernier = mots[mots.length - 1];
  const preuves: ReadonlyArray<{ libelle: string; icone?: string }> = (
    pastillesDetaillees && pastillesDetaillees.length > 0
      ? pastillesDetaillees
      : contenu.pastilles.map((libelle) => ({ libelle }))
  ).slice(0, 4);
  return (
    <header style={HALO_TERRACOTTA} data-fond="fonce" className="bg-mocha text-mocha-fg relative">
      <Container className="py-14 sm:py-18 lg:py-24">
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="max-w-2xl lg:max-w-none">
            <span className="bg-bg inline-flex rounded-full px-3 py-1">
              <PastilleCategorie categorie={fiche.categorie} />
            </span>
            <h1 className="display-editorial text-mocha-fg mt-5">
              {nomEnDeuxTemps ? (
                <>
                  {premiers}{" "}
                  <span
                    className="text-terracotta-on-mocha italic"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {dernier}
                  </span>
                </>
              ) : (
                fiche.nom
              )}
            </h1>
            <p className="text-mocha-fg mt-4 text-lg font-semibold">{contenu.sousTitre}</p>
            {/* Réponse auto-portante : les trois accroches déclarées au JSON-LD (`speakable`). */}
            <p
              className="speakable text-mocha-fg mt-6 max-w-2xl text-xl leading-snug sm:text-2xl"
              itemProp="text"
              data-answer=""
            >
              {fiche.reponseQui}
            </p>
            {preuves.length > 0 ? (
              <ul className="mt-7 flex flex-wrap gap-2.5">
                {preuves.map((p) => {
                  const Icone = p.icone ? iconeDe(p.icone) : Check;
                  return (
                    <li
                      key={p.libelle}
                      className="border-border-on-mocha bg-mocha-soft/60 text-mocha-fg inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm"
                    >
                      <Icone
                        aria-hidden="true"
                        focusable="false"
                        className="text-terracotta-on-mocha h-4 w-4"
                      />
                      <span>{p.libelle}</span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center [&>a]:w-full sm:[&>a]:w-auto">
              <ActionsFiche fiche={fiche} contenu={contenu} emplacement="hero" fond="fonce" />
            </div>
            <p className="text-mocha-fg mt-6 text-sm">
              Mis à jour le{" "}
              <time dateTime={contenu.dateMiseAJour}>{dateLisible(contenu.dateMiseAJour)}</time>
            </p>
          </div>
          <figure className="relative mx-auto w-full max-w-56 sm:max-w-sm lg:mx-0 lg:ml-auto lg:max-w-md">
            <svg
              aria-hidden="true"
              focusable="false"
              viewBox="0 0 100 100"
              className="stroke-terracotta pointer-events-none absolute -inset-5 h-[calc(100%+2.5rem)] w-[calc(100%+2.5rem)] fill-none opacity-50"
            >
              <path d="M8 50a42 42 0 0 1 42-42" strokeWidth="0.8" strokeLinecap="round" />
              <path d="M92 50a42 42 0 0 1-42 42" strokeWidth="0.8" strokeLinecap="round" />
            </svg>
            <PortraitCollaborateur
              fiche={fiche}
              priority
              sizes="(min-width: 1024px) 420px, (min-width: 640px) 384px, 224px"
              className="border-border-on-mocha relative border"
            />
            <figcaption className="text-mocha-fg mt-3 text-center text-sm lg:text-left">
              {fiche.nom}
              {fiche.fonction ? `, ${fiche.fonction}` : ""}
            </figcaption>
          </figure>
        </div>
        {chiffres ? <ChiffresCles chiffres={chiffres} /> : null}
      </Container>
    </header>
  );
}
