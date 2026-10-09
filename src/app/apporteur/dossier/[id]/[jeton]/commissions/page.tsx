// GRILLE DE RÉFÉRENCE des commissions, RÉSERVÉE AUX APPORTEURS (décision de Will, 2026-10-09).
//
// `/apporteur/dossier/<apporteurId>/<jeton>/commissions` : la grille n'est visible qu'avec le lien
// personnel d'un apporteur (même contrôle que son espace, `lireDossierParLien`). Elle était
// publique sous `/fr/apporteur-affaires/commissions` ; cette adresse n'affiche plus qu'un message
// sobre, sans aucun chiffre.
//
// Le contrat (annexe 1, A1.7) renvoie à « la grille de référence que la Société publie » : elle
// est publiée À SES DESTINATAIRES, les apporteurs, produit par produit et datée.
// 🔑 Aucun chiffre écrit ici : tout vient de `grilleDeReference()` (regles.ts + pricing.ts), que
// la garde `la-grille-de-reference-est-celle-du-contrat.spec.ts` compare au contrat.

import type { Metadata } from "next";

import { lireDossierParLien } from "@/features/apporteurs-reseau/donnees";
import {
  DATE_PUBLICATION_GRILLE,
  depuisLeDeLaLigne,
  grilleDeReference,
} from "@/features/apporteurs-reseau/grille-reference";
import historique from "@/features/apporteurs-reseau/grille-reference-historique.json";
import { GRILLE_RESERVEE } from "@/features/apporteurs-reseau/grille-reservee";
import { ID_DOSSIER_EXEMPLE } from "@/features/apporteurs-reseau/jeton";

import { Coquille, EcranEtat } from "../Coquille";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Grille de référence des commissions — Axion-IA" },
  robots: { index: false, follow: false, nocache: true },
};

interface PageProps {
  params: Promise<{ id: string; jeton: string }>;
}

/** « 05/10/2026 » depuis « 2026-10-05 ». */
const dateFr = (iso: string) => {
  const [a, m, j] = iso.split("-");
  return `${j}/${m}/${a}`;
};

export default async function GrilleDesCommissionsPage({ params }: PageProps) {
  const { id, jeton } = await params;
  // Seul un vrai lien personnel, valide, d'une fiche dans le réseau ouvre la grille. Sinon (lien
  // d'exemple de l'aperçu, lien invalide ou périmé, fiche retirée) : le message sobre, sans aucun
  // chiffre et sans 404 brutal (décision de Will, 09/10).
  const dossier =
    id.toLowerCase() === ID_DOSSIER_EXEMPLE ? null : await lireDossierParLien(id, jeton);
  if (!dossier || dossier.restreint) {
    return (
      <Coquille>
        <EcranEtat
          pastilleTexte="Réservé"
          titre={GRILLE_RESERVEE.titre}
          ligne={GRILLE_RESERVEE.texte}
        />
      </Coquille>
    );
  }
  const grille = grilleDeReference();

  return (
    <Coquille titre="Grille de référence des commissions">
      <p className="text-fg-soft mt-5 text-[16px] leading-relaxed">
        Produits créés après la signature de votre contrat : annexe 1, A1.7. Les produits de votre
        contrat gardent la commission qui y figure.
      </p>
      <p className="text-fg-muted mt-2 text-[14px]">
        Montants hors taxes. Une commission est due dans les conditions de votre contrat. Grille
        publiée le {dateFr(DATE_PUBLICATION_GRILLE)} ; chaque ligne indique depuis quand son montant
        s&apos;applique.
      </p>

      <div className="mt-6 grid gap-8">
        {grille.map((t) => (
          <section key={t.cle} aria-labelledby={`grille-${t.cle.replace(/\s/g, "-")}`}>
            <h2
              id={`grille-${t.cle.replace(/\s/g, "-")}`}
              className="font-serif text-[22px] font-medium"
            >
              {t.titre}
            </h2>
            <p className="text-fg-soft mt-1 text-[14px]">{t.regle}</p>
            <div className="border-border bg-paper mt-3 overflow-x-auto rounded-2xl border">
              <table className="w-full text-left text-[14px]">
                <thead className="bg-sand text-fg">
                  <tr>
                    {t.colonnes.map((c) => (
                      <th key={c} scope="col" className="px-3 py-2 font-semibold">
                        {c}
                      </th>
                    ))}
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Depuis le
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {t.lignes.map((l) => (
                    <tr key={l.cellules.join("|")} className="border-border border-t">
                      {l.cellules.map((c, i) => (
                        <td
                          key={`${i}-${c}`}
                          className={
                            i === l.cellules.length - 1
                              ? "text-terracotta-deep px-3 py-2 font-semibold"
                              : "px-3 py-2"
                          }
                        >
                          {c}
                        </td>
                      ))}
                      <td className="text-fg-muted px-3 py-2 whitespace-nowrap">
                        {(() => {
                          const d = depuisLeDeLaLigne(t, l, historique);
                          return d ? dateFr(d) : "—";
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <a
        href={`/apporteur/dossier/${dossier.id}/${jeton}`}
        className="text-terracotta-deep mt-8 inline-flex min-h-[48px] items-center gap-2 text-[17px] font-bold underline underline-offset-4"
      >
        ← Retour à mon espace
      </a>
    </Coquille>
  );
}
