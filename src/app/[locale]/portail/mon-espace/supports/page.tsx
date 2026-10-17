/**
 * Espace stagiaire — « Mes supports » (lot L08).
 *
 * Les supports pédagogiques de la formation (livret, mémo, exercices). Chaque
 * ouverture est journalisée (`remises_retours`) : la page dit au stagiaire s'il
 * l'a déjà ouvert, et à l'organisme qu'il l'a reçu.
 *
 * Éteint (`qualiopi.pedagogie.actif`) : la page n'existe pas (404).
 */

import { Download } from "lucide-react";
import { notFound } from "next/navigation";

import { CoquilleStagiaire } from "../_coquille";
import { chargerEspaceStagiaire } from "../_chargement";
import { lirePedagogie } from "@/server/qualiopi/pedagogie/interrupteur";
import { lireMesSupports } from "@/server/qualiopi/pedagogie/mes-supports-service";
import { verifierToken } from "@/server/qualiopi/portail/portail-service";
import { getPortailToken } from "@/server/qualiopi/portail/cookie";

const LIBELLES: Record<string, string> = {
  livret_stagiaire: "Livret du stagiaire",
  memo: "Mémo",
  exercices: "Exercices",
  slides_stagiaire: "Support de présentation",
};

const date = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Paris",
});

export default async function MesSupportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<React.ReactElement> {
  const { locale } = await params;
  if ((await lirePedagogie()) === "eteint") notFound();

  // Le refus d'accès (cookie absent ou expiré) est rendu par la coquille.
  const espace = await chargerEspaceStagiaire();
  let supports: Awaited<ReturnType<typeof lireMesSupports>> = [];
  if (espace.etat === "ok") {
    const token = await getPortailToken();
    const acces = token ? await verifierToken(token) : null;
    supports = acces ? await lireMesSupports(acces.traineeId) : [];
  }

  return (
    <CoquilleStagiaire section="documents" locale={locale}>
      {() => (
        <>
          <header className="mb-8">
            <h1 className="text-mocha font-serif text-2xl font-semibold sm:text-3xl">
              Mes supports
            </h1>
            <p className="text-fg-soft mt-2 text-sm">
              Les supports de votre formation, à relire autant que nécessaire.
            </p>
          </header>
          {supports.length === 0 ? (
            <div className="bg-paper shadow-card rounded-xl p-8 text-center">
              <p className="text-mocha font-serif text-base font-semibold">
                Aucun support pour l’instant
              </p>
              <p className="text-fg-soft mx-auto mt-2 max-w-sm text-sm leading-relaxed">
                Vos supports apparaîtront ici dès qu’ils seront disponibles.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {supports.map((s) => (
                <li
                  key={s.id}
                  className="bg-paper shadow-card flex flex-wrap items-center justify-between gap-4 rounded-xl p-5"
                >
                  <div className="min-w-0">
                    <p className="text-mocha font-serif text-base font-semibold">
                      {LIBELLES[s.type] ?? s.titre}
                    </p>
                    <p className="text-fg-muted mt-0.5 text-xs">
                      {s.sessionTitre} · version {s.version} · mis à disposition le{" "}
                      {date.format(s.remisLe)}
                      {s.vuLe ? ` · ouvert le ${date.format(s.vuLe)}` : " · pas encore ouvert"}
                    </p>
                  </div>
                  <a
                    href={`/${locale}/portail/mon-espace/supports/${s.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-terracotta hover:text-terracotta-deep inline-flex shrink-0 items-center gap-1.5 text-sm font-medium"
                  >
                    <Download className="size-4" aria-hidden="true" />
                    Ouvrir
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </CoquilleStagiaire>
  );
}
