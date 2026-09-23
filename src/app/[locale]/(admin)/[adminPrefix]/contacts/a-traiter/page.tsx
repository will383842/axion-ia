/**
 * Boîte de réception — vue « À traiter ».
 *
 * 🔑 LA QUESTION DU MATIN N'EST PAS « QUELLE CATÉGORIE ? », C'EST « QU'EST-CE
 *    QUI ATTEND UNE RÉPONSE ? ». La boîte offrait huit portes triées par
 *    PROVENANCE — presse, partenariats, investisseurs… — dont cinq n'avaient
 *    jamais rien contenu, et aucune ne répondait à cette question-là.
 *
 * Cette vue est la liste des messages : sans réponse, ni traités, ni archivés,
 * **le plus ancien en tête** — celui qui a le plus attendu se lit en premier.
 * Les apporteurs en sont exclus comme de toute la boîte : leur file se pilote
 * dans `/contacts/commercial`.
 *
 * Les trois critères sont FORCÉS, pas proposés : une vue nommée « À traiter »
 * qu'une URL pourrait élargir en silence ne vaudrait pas mieux qu'un filtre.
 *
 * 🔑 `basePath` reste « contacts/messages », et ce n'est pas un raccourci. Les
 *    onglets « Archivés » et « Corbeille » se construisent dessus : pointés sur
 *    cette vue, ils demanderaient des lignes archivées à un écran qui force
 *    « sans réponse, ni traité ni archivé » — trois onglets dont deux seraient
 *    vides par construction. Ils ramènent donc à la liste complète, où ils ont
 *    un sens. Le lien de détail, lui, ne dépend pas de `basePath` : il vise
 *    toujours la fiche canonique.
 */

import { SubmissionsV2 } from "../../submissions/_v2/SubmissionsV2";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ContactsATraiterPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  await gardePage("consultation", `/fr/${adminPrefix}/login`);

  const sp = await searchParams;
  return (
    <SubmissionsV2
      adminPrefix={adminPrefix}
      searchParams={{ ...sp, replyStatus: "unanswered", tri: "ancien" }}
      basePath="contacts/messages"
      perimetre="hors-apporteurs"
      title="À traiter"
    />
  );
}
