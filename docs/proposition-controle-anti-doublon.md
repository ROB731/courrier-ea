# Proposition — contrôle des destinataires déjà contactés

## Objectif

Avant de générer une nouvelle campagne, **COURRIER EA** doit comparer la liste que vous venez de recevoir avec les courriers dont le statut est réellement **« Envoyé »**. L’objectif est de ne pas réimprimer ou réenvoyer un courrier à une entreprise déjà traitée, tout en évitant d’écarter par erreur une entreprise différente.

> La base de comparaison principale doit être l’historique des destinataires marqués **« Envoyé »**. Une fiche présente dans le répertoire, mais jamais marquée envoyée, ne doit pas être exclue automatiquement.

## Les données utilisées

| Source | Utilisation | Niveau de confiance |
|---|---|---|
| Destinataires des campagnes au statut « Envoyé » | Référence pour savoir ce qui a effectivement été envoyé | Principal |
| Répertoire de destinataires | Aide à reconnaître les coordonnées et les variantes de nom | Secondaire |
| Nouvelle liste importée | Liste à analyser avant la génération | À qualifier |
| Décisions de contrôle précédentes | Mémorisation des faux doublons et des variantes connues | Complémentaire |

## Règles de comparaison recommandées

L’application ne doit pas faire une comparaison brute des noms. Elle construit d’abord une version normalisée de chaque valeur : majuscules, accents retirés, espaces multiples supprimés, ponctuation neutralisée et numéros de téléphone réduits à leurs chiffres. Ainsi, `NPG`, `N.P.G.` et `npg` peuvent être reconnus comme la même entité sans modifier les données originales.

| Résultat | Règle | Décision proposée |
|---|---|---|
| **Déjà envoyé — confirmé** | Même e-mail ou même téléphone ; ou même nom d’entreprise normalisé dans un envoi passé | Exclure par défaut |
| **À vérifier** | Nom très similaire, mais coordonnées absentes ou différentes | Présenter une comparaison à valider manuellement |
| **Nouveau** | Aucune correspondance fiable dans l’historique « Envoyé » | Inclure par défaut |
| **Préparé, non envoyé** | Correspondance avec une ancienne campagne, mais statut toujours « À envoyer » | Ne pas exclure ; afficher une information |

Pour le rapprochement incertain, une comparaison de similarité de nom peut être utilisée uniquement pour **attirer votre attention**, jamais pour supprimer automatiquement un destinataire. Par exemple, `CFAO INFRASTRUCTURE` et `CFAO-INFRASTRUCTURE CI` seraient proposés comme un rapprochement à vérifier, avec les informations de la dernière campagne.

## Le parcours proposé

```text
Importer la nouvelle liste
          ↓
Associer les colonnes au modèle Word
          ↓
Analyser les destinataires déjà envoyés
          ↓
Voir trois listes : Nouveaux / Déjà envoyés / À vérifier
          ↓
Valider ou corriger les cas incertains
          ↓
Générer seulement la liste retenue
          ↓
Marquer « Envoyé » après diffusion réelle
```

L’écran de contrôle afficherait notamment le nom importé, le destinataire historique correspondant, la dernière campagne, la date d’envoi et la raison du rapprochement. Vous conserveriez toujours trois options : **exclure**, **inclure malgré tout**, ou **indiquer qu’il ne s’agit pas de la même entreprise**.

## Garde-fous indispensables

La fonctionnalité doit être prudente. Elle ne doit jamais marquer un courrier comme envoyé automatiquement, ni effacer une information historique. L’exclusion automatique ne concerne que les correspondances certaines. Les rapprochements incertains passent dans une file de revue humaine.

Une action « Ce n’est pas le même destinataire » permettra de mémoriser une exception. À l’inverse, une action « Même destinataire » enregistrera une variante de nom. Les contrôles suivants deviendront donc plus fiables au fil du temps.

## Mise en œuvre recommandée dans COURRIER EA

La prochaine version peut ajouter un écran **« Vérifier les envois précédents »** entre l’import des données et la génération. En base, chaque résultat de comparaison conservera la règle déclenchée, le destinataire historique éventuellement retrouvé, la décision prise et la date. Le tableau de campagne gardera ainsi une trace claire de pourquoi un destinataire a été exclu ou réintégré.

La première version doit privilégier les comparaisons exactes (e-mail, téléphone, nom d’organisation normalisé), l’affichage des rapprochements incertains et l’exclusion par défaut des seuls envois confirmés. Les variantes mémorisées et les scores de similarité peuvent ensuite améliorer progressivement la détection.
