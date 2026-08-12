// Server Component — les 6 différenciateurs « Ce qui nous distingue » de la home.
//
// Refonte Will 2026-08-10, en deux temps :
//
// 1. Forme — les anciennes cartes (petit cadre + icône ronde terracotta + deux
//    lignes) faisaient vieillot et tombaient à 2 par ligne. Désormais bande
//    visuelle 16:9 par bloc, 3 par ligne dès md, accent rotatif sur les 5
//    teintes services (fin du tout-terracotta).
//
// 2. Fond — première version des bandes jugée VIDE (« ça ne fait pas top »), et
//    libellés jugés trop basiques (« Zéro intermédiaire », « De A à Z »…). Deux
//    corrections liées :
//      · chaque bande porte un CHIFFRE-CLÉ (0 junior, 5 métiers, 18 territoires…)
//        — elle informe au lieu de décorer, et se lit comme finie ;
//      · les titres passent du slogan au fait concret et chiffré.
//
// ⚠️ Les promesses ci-dessous sont une reformulation des affirmations DÉJÀ
// validées dans la version précédente — aucune nouvelle promesse commerciale
// n'a été introduite. En particulier « aucun junior en relais » reprend
// exactement « tous seniors expérimentés » : rien n'est dit du statut
// (salarié / sous-traitant) des intervenants.
//
// Les six visuels sont branchés depuis `home-images.ts` (photos Unsplash curées
// en AVIF local, 16:9 1600×900). Le chiffre-clé de la bande s'efface alors au
// profit de la photo ; le ratio étant identique dans les deux modes, la bascule
// se fait à CLS = 0. Les crédits photographes sont rendus sous la grille —
// obligation CGU, ne pas les retirer sans retirer les photos.

import { Users, Layers, MapPin, BadgeCheck, Target, Sparkles } from "lucide-react";

import { FadeInOnView } from "@/components/motion/FadeInOnView";
import type { ServiceAccent } from "@/content/services-visual";
import { homeImageFor } from "@/content/home/home-images";
import { getHomePhotoCredit } from "@/content/home/home-photos";
import { UnsplashCreditList } from "@/components/media/UnsplashCreditList";

import { FeatureMediaCard } from "@/components/marketing/FeatureMediaCard";

interface Differentiator {
  accent: ServiceAccent;
  Icon: typeof Users;
  statFigure: string;
  statLabelFr: string;
  statLabelEn: string;
  titleFr: string;
  titleEn: string;
  descFr: string;
  descEn: string;
  /** Clé du visuel dans `HOME_IMAGES` / `HOME_PHOTO_CREDITS`. */
  slot: string;
}

const DIFFERENTIATORS: readonly Differentiator[] = [
  {
    accent: "terracotta",
    Icon: Users,
    statFigure: "0",
    statLabelFr: "junior en relais",
    statLabelEn: "junior in the loop",
    titleFr: "Aucun intermédiaire",
    titleEn: "No middleman",
    descFr:
      "Vous traitez directement avec les formateurs, auditeurs, développeurs et implémenteurs qui interviennent chez vous. Tous seniors.",
    descEn:
      "You deal directly with the trainers, auditors, developers and implementers who work on your site. All seniors.",
    slot: "why-01-aucun-intermediaire",
  },
  {
    accent: "primary",
    Icon: Layers,
    statFigure: "5",
    statLabelFr: "métiers, une seule équipe",
    statLabelEn: "disciplines, one team",
    titleFr: "Cinq métiers réunis",
    titleEn: "Five disciplines under one roof",
    descFr:
      "Formation, coaching, audit, automatisation, plateforme sur mesure. Vous n'arbitrez entre aucun prestataire et vous ne recollez aucun livrable.",
    descEn:
      "Training, coaching, audit, automation, custom platform. No vendors to arbitrate between, no deliverables to stitch back together.",
    slot: "why-02-cinq-metiers",
  },
  {
    accent: "sage",
    Icon: MapPin,
    statFigure: "18",
    statLabelFr: "territoires couverts",
    statLabelEn: "territories covered",
    titleFr: "13 régions et 5 DROM",
    titleEn: "13 régions and 5 DROM",
    descFr:
      "Toute la France métropolitaine et ultramarine, plus les entreprises francophones à l'étranger. Sur site — ou à distance quand c'est plus efficace.",
    descEn:
      "All of metropolitan and overseas France, plus French-speaking companies abroad. On site — or remote when that works better.",
    slot: "why-03-couverture",
  },
  {
    accent: "ochre",
    Icon: BadgeCheck,
    // ⚠️ Cette carte disait « Jamais de commercial » / « 0 commercial entre
    // nous » — RETIRÉ le 2026-08-10 (Will). Axion-IA RECRUTE des commerciaux :
    // catégorie « Commercial / Vente » dans src/content/careers/categories.ts,
    // page /devenir-commercial-ia, postes « directeur commercial » et
    // « responsable réseau commercial ». Se vanter de ne pas en avoir se
    // contredisait avec les propres offres d'emploi du site.
    // Reformulé sur la continuité de l'intervenant — reprise de la promesse
    // déjà validée « un seul interlocuteur senior, du premier atelier à la mise
    // en production ». Ne PAS réintroduire d'angle anti-commercial ici.
    statFigure: "1",
    statLabelFr: "expert, du cadrage à la livraison",
    statLabelEn: "expert, from scoping to delivery",
    titleFr: "Le même expert du début à la fin",
    titleEn: "The same expert from start to finish",
    descFr:
      "L'intervenant senior qui cadre votre besoin est celui qui le réalise et qui vous le livre. Pas de passage de relais en cours de route.",
    descEn:
      "The senior who scopes your need is the one who builds it and hands it over. No handover midway.",
    slot: "why-04-meme-expert",
  },
  {
    accent: "plum",
    Icon: Target,
    statFigure: "0",
    statLabelFr: "solution sur étagère",
    statLabelEn: "off-the-shelf solution",
    titleFr: "Votre rythme, pas le nôtre",
    titleEn: "Your pace, not ours",
    descFr:
      "Votre planning, vos outils, vos contraintes métier. Rien n'est plaqué depuis un catalogue — on part de ce que vous avez déjà.",
    descEn:
      "Your schedule, your tools, your business constraints. Nothing lifted from a catalogue — we start from what you already run.",
    slot: "why-05-votre-rythme",
  },
  {
    accent: "terracotta",
    Icon: Sparkles,
    statFigure: "1",
    statLabelFr: "seul niveau d'exigence",
    statLabelEn: "single standard",
    titleFr: "La même exigence pour tous",
    titleEn: "The same standard for everyone",
    descFr:
      "Un artisan seul reçoit le même niveau qu'un groupe coté. Objectifs posés au départ, résultats mesurés à l'arrivée.",
    descEn:
      "A solo craftsman gets the same level as a listed group. Goals set upfront, results measured at the end.",
    slot: "why-06-meme-exigence",
  },
] as const;

export function WhyDifferentiators({ isFr }: { isFr: boolean }) {
  return (
    // Paliers md → lg. (Historique : ces grilles avaient dû éviter `sm:` parce
    // que `--breakpoint-sm` manquait dans le `@theme` et que Tailwind v4 émettait
    // alors les règles `sm:` APRÈS `md:`/`lg:`. Le jeton a été déclaré le
    // 2026-08-10 dans globals.css — l'ordre est rétabli, `sm:` est de nouveau
    // utilisable partout.)
    <>
      <ul className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
        {DIFFERENTIATORS.map((card, idx) => {
          const image = homeImageFor(card.slot, isFr);
          return (
            <li key={card.titleFr} className="h-full">
              <FadeInOnView delay={idx * 40} className="h-full">
                <FeatureMediaCard
                  index={idx + 1}
                  accent={card.accent}
                  Icon={card.Icon}
                  title={isFr ? card.titleFr : card.titleEn}
                  description={isFr ? card.descFr : card.descEn}
                  stat={{
                    figure: card.statFigure,
                    label: isFr ? card.statLabelFr : card.statLabelEn,
                  }}
                  {...(image ? { image } : {})}
                />
              </FadeInOnView>
            </li>
          );
        })}
      </ul>
      <UnsplashCreditList
        credits={DIFFERENTIATORS.map((c) => getHomePhotoCredit(c.slot)).filter(
          (c): c is NonNullable<typeof c> => Boolean(c),
        )}
      />
    </>
  );
}
