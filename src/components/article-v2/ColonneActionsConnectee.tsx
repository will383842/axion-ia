import { getQualiopiPublicIdentity } from "@/server/qualiopi/config/public-identity";
import { ColonneActions } from "./ColonneActions";

/** Variante qui lit l'identité Qualiopi publiée : la mention n'est rendue que si elle existe. */
export async function ColonneActionsConnectee({ gabarit }: { readonly gabarit: string }) {
  const identite = await getQualiopiPublicIdentity();
  return <ColonneActions gabarit={gabarit} qualiopiPublie={identite != null} />;
}
