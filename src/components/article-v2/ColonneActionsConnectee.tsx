import { isQualiopiPublie } from "@/components/qualiopi/qualiopi-publie";
import { ColonneActions } from "./ColonneActions";

/** Variante qui lit l'identité Qualiopi publiée : la mention n'est rendue que si elle existe. */
export async function ColonneActionsConnectee({ gabarit }: { readonly gabarit: string }) {
  return <ColonneActions gabarit={gabarit} qualiopiPublie={await isQualiopiPublie()} />;
}
