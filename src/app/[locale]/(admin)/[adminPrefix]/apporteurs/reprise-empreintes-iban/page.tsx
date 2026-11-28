// Reprise des empreintes IBAN (plan changement d'IBAN §3.3) : essai à blanc puis application, depuis la console.
// Super administrateur SEUL (l'action le contrôle aussi côté serveur). Des COMPTES uniquement, jamais un IBAN.
// Page serveur sans JavaScript client : le résultat revient dans l'adresse (chiffres seulement).

import { redirect } from "next/navigation";

import { AdminCard, AdminPageHeader } from "@/components/admin/ui";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { repriseEmpreintesIbanAction } from "@/features/apporteurs-reseau/actions-reprise-empreintes-iban";
import { gardePage } from "@/server/auth/garde-page";
import { peutEngager } from "@/server/auth/habilitations";

export const dynamic = "force-dynamic";

const CHIFFRES = [
  "vus",
  "dejaAJour",
  "aCalculer",
  "calcules",
  "sansIban",
  "illisible",
  "echec",
] as const;
const LIBELLES: Record<(typeof CHIFFRES)[number], string> = {
  vus: "Fiches signées lues",
  dejaAJour: "Déjà à jour",
  aCalculer: "À calculer",
  calcules: "Calculées",
  sansIban: "Ignorées : sans IBAN",
  illisible: "Ignorées : IBAN illisible",
  echec: "Ignorées : écriture échouée",
};

export default async function RepriseEmpreintesIbanPage({
  params,
  searchParams,
}: {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { adminPrefix } = await params;
  const acces = await gardePage("consultation", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;
  const permis = peutEngager(acces.role, "valider_changement_iban");
  const sp = await searchParams;
  const base = `/fr/${adminPrefix}/apporteurs/reprise-empreintes-iban`;

  async function lancer(fd: FormData) {
    "use server";
    const appliquer = fd.get("mode") === "appliquer";
    if (appliquer && fd.get("confirme") !== "on") {
      redirect(`${base}?erreur=${encodeURIComponent("Cochez la confirmation pour appliquer.")}`);
    }
    const r = await repriseEmpreintesIbanAction({ appliquer });
    if (!r.ok) redirect(`${base}?erreur=${encodeURIComponent(r.message)}`);
    const c = r.comptes;
    const q = new URLSearchParams({
      mode: appliquer ? "appliquer" : "essai",
      vus: String(c.vus),
      dejaAJour: String(c.dejaAJour),
      aCalculer: String(c.aCalculer),
      calcules: String(c.calcules),
      sansIban: String(c.ignores.sansIban),
      illisible: String(c.ignores.illisible),
      echec: String(c.ignores.ecritureEchouee),
    });
    redirect(`${base}?${q.toString()}`);
  }

  const chiffre = (k: string) => (/^\d{1,7}$/.test(sp[k] ?? "") ? sp[k] : null);
  const aUnResultat = CHIFFRES.every((k) => chiffre(k) !== null);

  return (
    <div className="flex flex-col gap-[var(--space-admin-5)]">
      <AdminPageHeader
        title="Reprise des empreintes IBAN"
        description="Inscrit le compte courant de chaque fiche signée dans l'historique, pour que la comparaison « compte déjà connu » couvre tout le réseau. Ne modifie aucune fiche ; rejouable sans effet."
      />
      {sp.erreur ? (
        <p role="alert" className="text-[color:var(--color-admin-danger)]">
          {sp.erreur.slice(0, 200)}
        </p>
      ) : null}
      {aUnResultat ? (
        <AdminCard as="section">
          <p role="status">
            {sp.mode === "appliquer" ? "Reprise appliquée." : "Essai à blanc : rien n'a été écrit."}
          </p>
          <ul>
            {CHIFFRES.map((k) => (
              <li key={k}>
                {LIBELLES[k]} : {chiffre(k)}
              </li>
            ))}
          </ul>
        </AdminCard>
      ) : null}
      <AdminCard as="section">
        {permis ? (
          <div className="flex flex-col gap-[var(--space-admin-4)]">
            <form action={lancer}>
              <input type="hidden" name="mode" value="essai" />
              <button type="submit" className="admin-button">
                Essai à blanc
              </button>
            </form>
            <form action={lancer} className="flex flex-col gap-[var(--space-admin-3)]">
              <input type="hidden" name="mode" value="appliquer" />
              <label>
                <input type="checkbox" name="confirme" /> Je confirme avoir lu l&apos;essai à blanc
                et je veux écrire l&apos;historique.
              </label>
              <button type="submit" className="admin-button">
                Appliquer
              </button>
            </form>
          </div>
        ) : (
          <p>Seul le super administrateur peut lancer cette reprise.</p>
        )}
      </AdminCard>
    </div>
  );
}
