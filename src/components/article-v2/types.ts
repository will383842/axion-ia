/**
 * Types partagés des gabarits d'articles (S2). Isolés de `ArticleGabarit.tsx`
 * pour que les huit fichiers de gabarit et l'aiguillage ne s'importent pas en
 * cercle. `ArticleGabarit.tsx` les ré-exporte (compatibilité avec S1).
 */
import type { Locale } from "@/i18n/routing";
import type { TocItem } from "@/components/seo/ArticleTOC";
import type { ArticlePrevNext } from "@/components/content-gen/ArticlePrevNext";
import type { ArticlePeopleAlsoAsk } from "@/components/content-gen/ArticlePeopleAlsoAsk";
import type { EncartEnVideo } from "@/components/videos/EncartEnVideo";
import type { SuggestedContent } from "@/components/suggested/SuggestedContent";
import type { GabaritArticle } from "@/server/content-gen/blog/gabarits";
import type { BlogArticleView } from "@/server/content-gen/blog/loader";
import type { getManonByline } from "@/lib/seo/manon-person";

type ProprietesCommunes<T> = T extends (props: infer P) => unknown ? P : never;

/** Bloc de corps d'un article en fichier (prose brute, hors HTML). */
export type BlocCorps =
  | { readonly kind: "ol"; readonly items: ReadonlyArray<string> }
  | { readonly kind: "p"; readonly text: string };

export interface ArticleGabaritProps {
  readonly gabarit: GabaritArticle;
  readonly view: BlogArticleView;
  readonly locale: Locale;
  /** HTML du corps (article en base), brut : sanitisé, ancres des H2 posées. */
  readonly html: string | null;
  /** Corps d'un article en fichier, quand `html` est null. */
  readonly blocs: ReadonlyArray<BlocCorps> | null;
  /** Table des matières brute (H2 posés par `buildToc`, ou extraction FS). */
  readonly tocItems: ReadonlyArray<TocItem>;
  readonly pageUrl: string;
  readonly chapo: string | null;
  readonly titre: { readonly lead: string; readonly em?: string | undefined };
  readonly tldr: string | null;
  readonly filAriane: ReadonlyArray<{ readonly href: string; readonly label: string }>;
  readonly auteurHref: string;
  readonly bylineManon: Awaited<ReturnType<typeof getManonByline>>;
  readonly emettreJsonLdAuteur: boolean;
  readonly sourcesVerifiees: Date | null;
  readonly villeAncree: { readonly href: string; readonly nom: string } | null;
  readonly precedentSuivant: ProprietesCommunes<typeof ArticlePrevNext>["prev"] extends infer P
    ? { readonly prev: P; readonly next: P }
    : never;
  readonly questionsAssociees: ProprietesCommunes<typeof ArticlePeopleAlsoAsk>["items"];
  readonly suggestions: ProprietesCommunes<typeof SuggestedContent> extends { items: infer I }
    ? I
    : never;
  readonly themeEncart: ProprietesCommunes<typeof EncartEnVideo>["theme"] | null;
  /** Nœuds JSON-LD déjà calculés par la page (identiques à ceux de la V1). */
  readonly jsonLd: ReadonlyArray<object>;
}
