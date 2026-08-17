/**
 * Quelles villes sont PRÉ-RENDUES AU BUILD — critère unique, deux consommateurs.
 *
 * POURQUOI CE FICHIER EXISTE (2026-08-16, audit GEO/AEO, GEO-118)
 *
 * Le hub `/implantations/[region]/[ville]` affiche un bloc « articles mentionnant
 * {ville} » qui LIT LA BASE. Or le build tourne avec les URLs stub (ADR 0026) :
 * sous `stub.invalid`, la requête rend `[]` et le bloc n'est pas rendu.
 *
 * Pour les ~2 100 villes générées à la demande (`dynamicParams`), ça ne prête pas
 * à conséquence : leur premier rendu a lieu AU RUNTIME, avec la vraie base — le
 * bloc est là. Mais les villes pré-rendues au build, elles, servent la version
 * VIDE pendant `revalidate` = 24 h. Comme on déploie plus souvent qu'une fois par
 * jour, elles ne repassent jamais par un rendu peuplé : le bloc est
 * structurellement absent — et ce sont précisément Paris, Lyon, Marseille…, les
 * pages qui pèsent le plus.
 *
 * ⚠️ L'audit décrivait « les ~480 hubs villes qui ne régénèrent jamais ». Le
 * compte et la population touchée sont tous deux inexacts : le défaut ne frappe
 * QUE les villes pré-rendues (40 aujourd'hui), et le reste va bien. La nuance
 * change le correctif — il devient borné et vérifiable.
 *
 * Le remède est de revalider ces pages juste après l'atterrissage (job `warm`).
 * Ce qui suppose que la liste chauffée soit EXACTEMENT celle qui a été
 * pré-rendue. Recopier le seuil dans le workflow rejouerait le défaut d'origine :
 * deux endroits qui décrivent le même ensemble finissent par diverger, et c'est
 * exactement ce genre de divergence que GEO-118 constate. D'où ce module :
 * `generateStaticParams` et le script de chauffe lisent LA MÊME source.
 */

import { VILLES, type Ville } from "./index";

/**
 * Seuil de population au-delà duquel une ville est pré-rendue au build.
 *
 * Fixé le 2026-05-27 : le build T3 saturait le disque du runner GitHub (« No
 * space left on device »). S'y limiter fait passer le SSG de 17 629 à ~13 500
 * routes (~5 Go et 8 min économisés). Les villes sous le seuil restent
 * indexables — sitemap et balises sont identiques — elles sont simplement
 * rendues au premier passage du robot.
 */
export const SEUIL_PRERENDU_HUB_VILLE = 100_000;

/** Les villes que `generateStaticParams` pré-rend au build. */
export function villesPrerenduesAuBuild(): readonly Ville[] {
  return VILLES.filter((v) => v.population >= SEUIL_PRERENDU_HUB_VILLE);
}

/**
 * Les chemins publics de ces hubs, locale comprise.
 *
 * Sert au job `warm` du déploiement : ce sont les URLs à revalider pour que le
 * bloc DB-dépendant cesse d'être servi vide.
 */
export function cheminsHubsVillesPrerendus(locale = "fr"): readonly string[] {
  return villesPrerenduesAuBuild().map((v) => `/${locale}/implantations/${v.region}/${v.slug}`);
}
