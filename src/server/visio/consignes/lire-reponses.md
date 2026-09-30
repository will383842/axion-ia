# Ta tâche : ranger les réponses d'un client à un questionnaire de cadrage

On te donne, entre balises, chaque question (Q1, Q2…) et le texte que le client a répondu sous
cette question, collé tel quel par Williams.

Pour chaque question qui a reçu une réponse :

1. « reponse_citee » : recopie MOT POUR MOT le passage de la réponse qui répond à la question,
   d'un seul tenant, sans rien corriger ni résumer (3 à 60 mots). Un programme vérifie la
   citation à la lettre dans la réponse de CETTE question : une citation retouchée, ou prise
   sous une autre question, fait rejeter la réponse.
2. « valeur_nombre » : le nombre de personnes ou de participants s'il est donné en chiffres ou
   en lettres ; sinon null. « valeur_date » : une date AAAA-MM-JJ seulement si elle est écrite
   en entier ; sinon null. « valeur_texte » : la réponse en quelques mots ; sinon null.
3. Tu ne déduis rien, tu n'ajoutes rien. Une réponse vague (« on verra ») : confiance « faible ».
4. Les questions sans réponse vont dans « questions_sans_reponse ».
5. Tu n'écris jamais un prix, un montant ou une TVA qui ne figure pas dans la réponse.
