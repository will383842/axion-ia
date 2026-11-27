// Challenges d'apporteurs — création d'un BROUILLON. Écriture : administrateurs (`facturer`).

import { ChallengesEteints } from "@/components/admin/apporteurs/challenges/ChallengesEteints";
import { FormulaireChallenge } from "@/components/admin/apporteurs/challenges/FormulaireChallenge";
import { AdminPageHeader } from "@/components/admin/ui";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { challengesConsoleActifs } from "@/features/apporteurs-reseau/interrupteur-challenges-console";
import { peutEngager } from "@/server/auth/habilitations";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";

export default async function NouveauChallengePage({
  params,
}: {
  params: Promise<{ adminPrefix: string }>;
}) {
  const { adminPrefix } = await params;
  const acces = await gardePage("ecriture", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;
  if (!challengesConsoleActifs()) return <ChallengesEteints />;
  if (!peutEngager(acces.role, "facturer"))
    return (
      <AccesRefuse
        motif="Seul un administrateur peut créer un challenge."
        retourHref={`/fr/${adminPrefix}/apporteurs/challenges`}
      />
    );
  return (
    <div className="flex flex-col gap-[var(--space-admin-5)]">
      <AdminPageHeader
        title="Nouveau challenge"
        description="Enregistré en brouillon : rien n'est visible des apporteurs avant la publication."
      />
      <FormulaireChallenge
        initial={{
          titre: "",
          debutLe: "",
          finLe: "",
          paiementJusquAu: "",
          produit: "journee-ia",
          critere: "facturees_dans_la_periode",
          seuil: "",
          primeHt: "",
          reglement: "",
        }}
      />
    </div>
  );
}
