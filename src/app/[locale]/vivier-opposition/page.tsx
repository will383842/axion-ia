import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { routing } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { buildProductMetadata } from "@/lib/seo";

// Page de confirmation de l'OPPOSITION à la conservation en vivier (lot L4).
//
// Elle n'agit pas : tout s'est déjà produit dans `/api/vivier-opposition`, qui
// redirige ici avec le résultat. Elle ne fait donc que RENDRE COMPTE — et c'est
// sa seule raison d'être : une opposition dont on ne voit pas l'effet n'a pas
// l'air d'avoir marché, et la personne réécrit, ou recommence.
//
// Aucun bouton de confirmation, contrairement à la page de désabonnement : le
// lien de l'email vaut déjà décision. Redemander « êtes-vous sûr ? » pour
// l'exercice d'un DROIT ajouterait un obstacle là où la loi en interdit.
//
// Non indexée : page de service atteignable uniquement par lien signé.

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; already?: string; reason?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const meta = await buildProductMetadata({
    locale,
    path: "/vivier-opposition",
    title: "Conservation de votre candidature · Axion-IA",
    description:
      "Confirmation de votre opposition à la conservation de votre candidature dans le vivier Axion-IA.",
    alternates: { fr: "/vivier-opposition", en: "/vivier-opposition" },
  });
  return { ...meta, robots: { index: false, follow: false } };
}

/** Message par motif d'échec — jamais de jargon technique brut à l'écran. */
function echec(reason: string | undefined): { titre: string; detail: string } {
  switch (reason) {
    case "missing_token":
    case "malformed_token":
    case "invalid_signature":
    case "wrong_audience":
    case "invalid_subject":
    case "malformed_payload":
      return {
        titre: "Ce lien n’est pas valide.",
        detail:
          "Il a peut-être été tronqué par votre messagerie. Copiez-le entièrement depuis l’email, ou écrivez-nous : nous traiterons votre demande à la main.",
      };
    case "expired":
      return {
        titre: "Ce lien a expiré.",
        detail:
          "Votre droit d’opposition, lui, n’expire pas. Écrivez-nous et nous retirerons votre candidature du vivier.",
      };
    case "unknown_application":
      return {
        titre: "Cette candidature n’existe plus.",
        detail:
          "Elle a probablement déjà été supprimée : il n’y a donc plus rien à conserver, ni à retirer.",
      };
    default:
      return {
        titre: "Une erreur est survenue.",
        detail:
          "Votre opposition n’a peut-être pas été enregistrée. Écrivez-nous pour que nous la traitions manuellement — c’est immédiat.",
      };
  }
}

export default async function VivierOppositionPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { status, already, reason } = await searchParams;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const ok = status === "ok";
  const dejaOppose = already === "1";
  const ko = echec(reason);

  return (
    <>
      <Section
        titleAs="h1"
        eyebrow="RGPD · Vivier candidats"
        title={ok ? "C’est" : "Votre"}
        titleEm={ok ? "enregistré" : "demande"}
        description={
          ok
            ? "Votre candidature ne sera pas conservée dans notre vivier."
            : "Nous n’avons pas pu enregistrer votre opposition automatiquement."
        }
      />

      <Section>
        <Container className="text-fg-soft max-w-2xl space-y-6 text-base leading-relaxed">
          <div
            role={ok ? "status" : "alert"}
            className={
              ok
                ? "border-sage/40 bg-sage/10 rounded-xl border-2 p-5"
                : "border-accent-red/40 bg-accent-red/10 rounded-xl border-2 p-5"
            }
          >
            <p className="text-fg text-base font-semibold">
              {ok
                ? dejaOppose
                  ? "Vous vous étiez déjà opposé(e)."
                  : "Votre opposition est enregistrée."
                : ko.titre}
            </p>
            <p className="text-fg-soft mt-2 text-sm leading-relaxed">
              {ok
                ? "Effet immédiat, sans justification à fournir. Votre candidature n’entrera pas dans notre vivier de recrutement."
                : ko.detail}
            </p>
          </div>

          {ok ? (
            <>
              <p>
                Cette opposition ne concerne que la <strong>conservation en vivier</strong>. Si vous
                avez une candidature en cours, elle continue d’être étudiée normalement — s’y
                opposer serait vous retirer du recrutement auquel vous avez postulé.
              </p>
              <p>
                Elle est indépendante de la lettre d’information : se retirer du vivier ne vous en
                désinscrit pas, et réciproquement. Les deux listes sont séparées.
              </p>
              <p>
                Pour demander la suppression complète de vos données, écrivez-nous à{" "}
                <a className="text-primary underline" href="mailto:contact@axion-ia.com">
                  contact@axion-ia.com
                </a>
                .
              </p>
            </>
          ) : (
            <p>
              Écrivez-nous à{" "}
              <a className="text-primary underline" href="mailto:contact@axion-ia.com">
                contact@axion-ia.com
              </a>{" "}
              : votre demande sera traitée, lien valide ou non.
            </p>
          )}

          <Cta href="/" size="lg">
            Retour à l’accueil →
          </Cta>
        </Container>
      </Section>
    </>
  );
}
