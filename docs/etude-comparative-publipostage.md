# Étude comparative — Applications de publipostage et d’automatisation documentaire

**Objet :** identifier les principes les plus utiles à reprendre dans **COURRIER EA** avant d’implémenter le publipostage multi-champs.

## Conclusion rapide

Le marché se répartit en quatre familles complémentaires : le publipostage classique Word/Excel, les générateurs de documents par champs, les outils d’automatisation de workflow et les extracteurs de tableaux PDF. Pour COURRIER EA, la meilleure inspiration n’est pas de reproduire une suite complète de gestion documentaire ; c’est de combiner la simplicité du publipostage Word avec un écran moderne de correspondance des données et un contrôle fiable avant impression.

> **Recommandation :** construire un « assistant de fusion guidé » : modèle Word → détection des champs → import Excel ou collage → correspondance des colonnes → contrôle des erreurs → aperçu → génération. L’import de tableaux PDF doit rester une option avancée avec validation obligatoire.

| Décision | Recommandation pour COURRIER EA |
|---|---|
| Source principale | Excel ou collage de tableau |
| Modèle de document | Word `.docx` avec champs explicites `{{...}}` |
| Fonction clé | Correspondance visuelle entre colonnes et champs du courrier |
| Contrôle préalable | Tableau des valeurs manquantes, lignes longues et erreurs de format |
| Sortie | PDF complet imprimable, ZIP Word, fichiers individuels |
| Source PDF | Oui, mais uniquement après contrôle humain des tableaux extraits |

## 1. Les quatre types de solutions étudiées

### 1.1. Publipostage Word + Excel

Le publipostage Word est le modèle de référence le plus simple. Microsoft recommande que les noms de colonnes du tableur correspondent aux champs attendus dans le document, que les données soient préparées dans la première feuille et que les formats sensibles soient contrôlés avant la fusion. Le processus inclut l’édition de la liste des destinataires, la prévisualisation des résultats, puis l’impression ou l’envoi. [1]

| Ce que ce modèle apporte | Ce que COURRIER EA doit améliorer |
|---|---|
| Une ligne Excel = un courrier | Afficher clairement cette relation dans l’interface |
| Champs de fusion dans le document | Utiliser une syntaxe lisible : `{{TELEPHONE}}`, `{{LOCALITE}}` |
| Prévisualisation avant impression | Prévisualiser automatiquement la première ligne, les lignes longues et les lignes signalées |
| Filtre des destinataires | Permettre de décocher ou d’exclure certaines lignes dans COURRIER EA |
| Impression groupée | Donner un bouton direct « Imprimer toutes les lettres » |

**Inspiration à retenir :** la liste de destinataires doit être visible et modifiable avant la génération. C’est une pratique simple mais très importante pour éviter d’imprimer un courrier à un mauvais destinataire. [1]

### 1.2. Générateurs de documents par champs

Les outils spécialisés tels que Documentero, Plumsail Documents et Formstack Documents transforment un modèle en document généré à partir de données. Documentero met en avant les champs entre accolades, la génération Word/PDF depuis un tableur et une logique où chaque ligne du tableau produit un document. [2] Plumsail organise le processus autour d’un modèle, de données injectées, de la conversion PDF et de destinations comme l’e-mail ou le stockage cloud. [3] Formstack introduit l’idée utile de **test de fusion** et de suivi des générations/diffusions. [4]

> « Each row represents data for one document. » — Documentero, à propos de la génération par lot depuis un tableur. [2]

| Pratique observée | Adaptation recommandée pour COURRIER EA |
|---|---|
| Champs spéciaux dans le modèle | Détecter tous les `{{CHAMPS}}` sans toucher au reste du Word |
| Formulaire généré selon les champs | Créer un écran de correspondance plutôt qu’un formulaire technique |
| Génération en lot depuis un tableur | Conserver une ligne = un courrier |
| Test de génération | Ajouter un bouton « Tester cette ligne » avant la génération globale |
| Historique des générations | Conserver les campagnes, fichiers, erreurs et statuts d’envoi |
| Profils réutilisables | Enregistrer les règles de correspondance d’un Excel récurrent |

**Inspiration à retenir :** COURRIER EA doit proposer les fonctionnalités de ces outils sans leur complexité. La valeur est dans le modèle réutilisable, le test avant lot et l’historique ; elle n’est pas dans une API ou des dizaines de connecteurs à ce stade.

### 1.3. Gestion documentaire et workflow

Les plateformes de gestion documentaire structurent les champs du modèle comme des métadonnées. Microsoft 365 permet par exemple d’associer les champs d’un modèle à des colonnes de bibliothèque et fait apparaître les valeurs générées comme métadonnées. [5] Cette approche est particulièrement utile pour classer, filtrer et retrouver les documents après génération.

| Bonne pratique | Adaptation pour COURRIER EA |
|---|---|
| Définir un type pour chaque champ | Texte, téléphone, e-mail, date, nombre ou liste |
| Conserver les métadonnées de campagne | Nom de l’entreprise, localité, statut d’envoi, date de génération |
| Limiter les changements risqués | Prévenir avant de renommer ou de changer le type d’un champ |
| Utiliser les données pour la recherche | Filtrer l’historique par localité, modèle, date ou statut |

Microsoft précise qu’un changement incompatible de type de champ peut entraîner une perte de données dans une colonne liée ; ce signal confirme qu’il faut verrouiller les types simples dès la création d’un champ dans COURRIER EA. [5]

**Inspiration à retenir :** créer un petit registre de champs par modèle, avec un nom, un libellé, un type et une règle de validation. Il sera beaucoup plus sûr que de remplacer n’importe quel texte trouvé dans le Word.

### 1.4. Extraction de tableaux PDF

Les outils d’automatisation savent extraire texte et tableaux d’un PDF. Les paramètres réellement utiles sont le choix des pages, l’indication qu’une première ligne contient les en-têtes, la fusion de tableaux qui passent d’une page à une autre, et l’optimisation pour les données structurées. [6]

Cependant, l’extraction de tableau d’un PDF n’est pas équivalente à l’import Excel. Microsoft indique notamment que l’extraction de tableaux n’utilise pas d’OCR pour du texte non sélectionnable d’un PDF scanné. [6]

| Type de PDF | Fiabilité attendue | Réponse à mettre dans COURRIER EA |
|---|---|---|
| PDF exporté depuis Excel ou un logiciel | Bonne | Extraire le tableau, détecter les en-têtes, afficher une grille de contrôle |
| PDF avec un tableau réparti sur plusieurs pages | Moyenne | Proposer la fusion de pages, puis demander une validation |
| PDF scanné lisible | Variable | Utiliser OCR, afficher un indicateur de confiance et exiger une validation ligne par ligne si nécessaire |
| Scan de faible qualité | Faible | Recommander Excel ou un collage manuel plutôt que générer automatiquement |

**Inspiration à retenir :** le PDF doit être une source secondaire. La règle produit doit être : **aucun document ne peut être généré depuis un tableau PDF tant que l’utilisateur n’a pas validé le tableau détecté**.

## 2. Le parcours que les meilleures solutions ont en commun

Les outils étudiés convergent vers le même parcours fiable, même si leurs interfaces diffèrent.

```text
Modèle document
      ↓
Détection des champs de fusion
      ↓
Source de données (Excel / collage / PDF)
      ↓
Correspondance champ ← colonne
      ↓
Validation et correction des erreurs
      ↓
Test / aperçu
      ↓
Génération en lot
      ↓
Téléchargement, impression, historique et suivi
```

| Étape | Ce que COURRIER EA doit faire | Ce qu’il faut éviter |
|---|---|---|
| Détection | Lister tous les champs du Word | Remplacer automatiquement tout texte similaire |
| Correspondance | Suggérer, puis demander confirmation | Faire confiance uniquement au nom de colonne |
| Validation | Signaler les champs vides et les valeurs longues | Bloquer toute la campagne pour une seule ligne à corriger |
| Aperçu | Montrer une ligne normale et une ligne à risque | Limiter le contrôle au premier destinataire |
| Sortie | Fournir PDF, ZIP Word et impression | Envoyer l’utilisateur chercher les fichiers dans un historique peu visible |
| Réutilisation | Enregistrer le modèle et le profil de colonnes | Refaire le paramétrage à chaque campagne |

## 3. Les fonctions à intégrer dans la prochaine version

### Priorité 1 — À construire maintenant

| Fonction | Pourquoi elle est prioritaire | Exemple |
|---|---|---|
| Détection multi-champs | Base de tout le publipostage évolué | Le modèle contient `{{CONTACT}}` et `{{TELEPHONE}}` |
| Assistant de correspondance | Évite les associations incorrectes | Colonne « Ville » → `{{LOCALITE}}` |
| Types de données | Préserve les téléphones et dates | `+225 01 02 03 04 05` reste du texte |
| Collage de tableau | Très utile pour une petite liste reçue par message | Coller un tableau séparé par `;` ou par tabulations |
| Contrôle des lignes | Évite une génération incomplète | « 2 lignes sans téléphone ; générer les 21 autres » |
| Prévisualisation ciblée | Protège la mise en page | Aperçu de la valeur la plus longue |
| Profil de colonnes | Fait gagner du temps sur les fichiers récurrents | « Liste fournisseurs 2026 » |

### Priorité 2 — À construire après stabilisation

| Fonction | Rôle |
|---|---|
| Import de tableau PDF | Dépanner les listes reçues en PDF |
| OCR de PDF scanné | Lire des tableaux non sélectionnables, avec contrôle renforcé |
| Filtres et groupes | Générer uniquement les destinataires d’une localité ou d’un segment |
| Valeurs communes de campagne | Définir une même date, référence ou objet sans l’ajouter dans chaque ligne Excel |
| Duplication de campagne | Reprendre le même modèle et les mêmes correspondances |
| Journal de qualité | Retrouver les lignes ignorées, corrigées ou générées |

### Priorité 3 — À envisager plus tard

| Fonction | Pourquoi attendre |
|---|---|
| Envoi e-mail de masse | Nécessite une validation des adresses, des règles d’envoi et un suivi de délivrabilité |
| WhatsApp / SMS | Utile si les numéros sont présents, mais suppose un accord de contact et une intégration distincte |
| Signatures électroniques | Pertinent pour contrats, mais pas nécessaire au publipostage imprimé actuel |
| API et connecteurs externes | À réserver lorsqu’un logiciel métier doit alimenter COURRIER EA automatiquement |
| Sections conditionnelles complexes | Puissant mais risqué pour la stabilité visuelle initiale des lettres |

## 4. Décisions de conception recommandées

### A. Syntaxe de champ

Conserver la syntaxe actuelle, très lisible : `{{NOM_DU_CHAMP}}`.

```text
{{DESTINATAIRE}}
{{CONTACT}}
{{TELEPHONE}}
{{LOCALITE}}
{{ADRESSE}}
```

Cette syntaxe est cohérente avec les outils de génération qui utilisent des tags visibles dans le modèle. [2]

### B. Registre de champs du modèle

À chaque import Word, COURRIER EA doit créer une petite fiche du modèle :

| Champ | Libellé | Type | Obligatoire | Exemple |
|---|---|---|---:|---|
| `{{DESTINATAIRE}}` | Entreprise | Texte | Oui | VIGASSISTANCE |
| `{{CONTACT}}` | Personne à contacter | Texte | Non | Mme Awa Traoré |
| `{{TELEPHONE}}` | Téléphone | Texte | Non | +225 01 02 03 04 05 |
| `{{LOCALITE}}` | Localité | Texte | Non | Abidjan, Cocody |
| `{{ADRESSE}}` | Adresse | Texte long | Non | 12, rue des Jardins |

### C. Correspondance explicite, jamais implicite

L’application peut proposer une correspondance automatique, mais l’utilisateur doit pouvoir la confirmer. Par exemple :

| Champ du Word | Suggestion trouvée | Décision |
|---|---|---|
| `{{DESTINATAIRE}}` | Colonne « Société » | Confirmer |
| `{{TELEPHONE}}` | Colonne « Mobile » | Confirmer ou changer |
| `{{LOCALITE}}` | Colonne « Ville » | Confirmer |
| `{{ADRESSE}}` | Aucune | Choisir une colonne ou laisser vide |

### D. Préservation de la mise en page

La promesse fondamentale de COURRIER EA reste intacte : **le modèle Word est le maître visuel**. L’application ne doit changer que les tags strictement reconnus. Les champs longs doivent être signalés, non tronqués silencieusement.

## 5. Feuille de route retenue

| Version | Contenu | Résultat utilisateur |
|---|---|---|
| V2 — Multi-champs essentiel | Excel, collage, registre des champs, correspondance, contrôle et aperçu | Générer des courriers avec téléphone, localité, adresse et contact |
| V2.1 — Productivité | Profils de correspondance, filtres, duplication de campagne et valeurs communes | Réutiliser rapidement les mêmes formats de liste |
| V3 — Import avancé | Tableau PDF, OCR, validation de confiance et correction manuelle | Exploiter aussi des listes reçues en PDF |
| V4 — Diffusion | E-mail, suivi de distribution, éventuellement WhatsApp/SMS | Passer de l’impression à un parcours d’envoi multicanal |

## Décision à confirmer avant développement

Je recommande de commencer la V2 avec ces cinq champs : `{{DESTINATAIRE}}`, `{{CONTACT}}`, `{{TELEPHONE}}`, `{{LOCALITE}}` et `{{ADRESSE}}`.

Le développement doit débuter par Excel et le collage de tableau. Le PDF restera la troisième source, après validation du fonctionnement multi-champs sur les données structurées.

## Références

[1] [Microsoft Support — Mail merge using an Excel spreadsheet](https://support.microsoft.com/en-us/word/mail-merge-using-an-excel-spreadsheet)

[2] [Documentero — Document Generation & Automation](https://documentero.com/)

[3] [Plumsail Documents — Introduction](https://plumsail.com/docs/documents/v1.x/user-guide/introduction.html)

[4] [Formstack Documents — Merges Overview](https://help.formstack.com/hc/en-us/articles/44593149438099-Merges-Overview)

[5] [Microsoft Learn — Map fields of a modern template to library columns](https://learn.microsoft.com/en-us/microsoft-365/documentprocessing/content-assembly-map-fields?view=o365-worldwide)

[6] [Microsoft Learn — PDF actions](https://learn.microsoft.com/en-us/power-automate/desktop-flows/actions-reference/pdf)
