// Admin — le hub des imprimés.
//
// Demande Will 2026-08-17 : « un onglet qui rassemble tous les imprimés, et en
// sous-onglet catalogue, flyer A5, etc. » Jusqu'ici il n'y avait qu'un onglet
// isolé, `catalogue-imprime`, qui ne parlait que des PRIX du livre KDP : le
// catalogue A4 et le flyer n'avaient nulle part où aller.
//
// Cette page ne recopie rien : elle dérive de `IMPRIMES`. Le jour où un
// quatrième imprimé arrive, il apparaît ici sans qu'on y touche.
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageHeader } from "@/components/admin/ui";
import { IMPRIMES } from "@/content/imprimes";
import { mesurerImprime } from "@/features/admin-imprimes/mesurer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Imprimés · Axion-IA" };

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function ImprimesPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const lignes = await Promise.all(
    IMPRIMES.map(async (i) => {
      const m = await mesurerImprime(i);
      return {
        imprime: i,
        enLigne: m.filter((f) => f.present).length,
        total: m.length,
        manquants: m.filter((f) => !f.present).map((f) => f.nom),
      };
    }),
  );

  const totalManquants = lignes.reduce((n, l) => n + l.manquants.length, 0);

  return (
    <div>
      <AdminPageHeader
        title="Imprimés"
        description="Tout ce qui part sur du papier. Un imprimé ne se corrige pas une fois distribué : chaque sous-onglet dit ce qui est en ligne, ce qui ne l’est volontairement pas, et ce qu’il faut vérifier avant un tirage."
      />

      <div style={{ display: "grid", gap: "var(--space-admin-4)" }}>
        {lignes.map(({ imprime, enLigne, total, manquants }) => (
          <a
            key={imprime.id}
            href={`/fr/${adminPrefix}/imprimes/${imprime.id}`}
            // `admin-card` ne pose PAS `display` : une ancre resterait `inline`,
            // son padding ne mettrait rien en page et le fond se peindrait
            // par-dessus le contenu voisin. Mesuré en production le 2026-08-03.
            // `admin-card-inline` porte le `display: block`.
            className="admin-card admin-card-inline"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: "var(--space-admin-3)",
              }}
            >
              <h2 className="admin-section-title" style={{ marginBottom: 0 }}>
                {imprime.nom}
              </h2>
              <ArrowRight size={18} aria-hidden="true" style={{ flex: "none", opacity: 0.6 }} />
            </div>

            <div style={{ fontSize: "0.85em", opacity: 0.7, marginTop: 4 }}>{imprime.format}</div>

            <p style={{ marginTop: "var(--space-admin-2)", marginBottom: 0 }}>{imprime.resume}</p>

            <div style={{ marginTop: "var(--space-admin-3)", fontSize: "0.88em", opacity: 0.8 }}>
              {total > 0 ? (
                <>
                  {enLigne}/{total} fichier(s) en ligne
                  {manquants.length > 0 ? (
                    <b> — {manquants.join(", ")} absent(s), le lien public renverra 404</b>
                  ) : null}
                </>
              ) : (
                "Aucun fichier publié — cet imprimé vit hors ligne."
              )}
              {imprime.fichiersHorsLigne.length > 0
                ? ` · ${imprime.fichiersHorsLigne.length} fichier(s) volontairement hors ligne`
                : null}
            </div>
          </a>
        ))}
      </div>

      <p style={{ marginTop: "var(--space-admin-4)", opacity: 0.75 }}>
        {IMPRIMES.length} imprimés
        {totalManquants > 0 ? (
          <b> · {totalManquants} fichier(s) manquant(s) au total</b>
        ) : (
          " · tous les fichiers attendus sont en place"
        )}
        . Les fichiers destinés à l’imprimeur ne sont jamais publiés : un PDF avec fond perdu et
        repères de coupe n’est pas un document de communication.
      </p>
    </div>
  );
}
