# Proposition d’évolution — COURRIER EA multi-champs

## Principe proposé

La base reste volontairement simple : **un modèle Word** et **une source de données contenant les destinataires**. La différence est que le modèle ne se limite plus au seul champ `{{DESTINATAIRE}}`. Il peut recevoir plusieurs champs de fusion, chacun remplacé avec la valeur de la ligne correspondante.

> COURRIER EA ne modifie jamais le texte, les styles, les marges ni la structure du modèle Word. Il ne remplace que les champs de fusion explicitement présents dans le modèle et reliés à une donnée validée.

## Exemple concret

Dans le fichier Excel, une ligne peut contenir les informations suivantes :

| Destinataire | Contact | Fonction | Téléphone | Localité | Adresse | E-mail |
|---|---|---|---|---|---|---|
| VIGASSISTANCE | Mme Awa Traoré | Directrice commerciale | +225 01 02 03 04 05 | Abidjan, Cocody | 12, rue des Jardins | contact@exemple.ci |

Dans le modèle Word, vous placez uniquement les champs nécessaires à l’endroit voulu :

```text
À l’attention de {{CONTACT}}
{{FONCTION}}
{{DESTINATAIRE}}
{{ADRESSE}}
{{LOCALITE}}
Tél. : {{TELEPHONE}}
```

Le courrier généré devient alors personnalisé pour chaque ligne sans reconstruction du document. Vous pourrez continuer à n’utiliser que `{{DESTINATAIRE}}` lorsque les autres informations ne sont pas utiles.

## Champs standards à prévoir

La première version multi-champs doit rester facile à utiliser. Je recommande de proposer des champs standards, tout en autorisant l’ajout d’autres champs personnalisés.

| Catégorie | Champs suggérés | Utilisation courante |
|---|---|---|
| Entreprise | `{{DESTINATAIRE}}`, `{{ADRESSE}}`, `{{LOCALITE}}` | Bloc d’adresse et en-tête du courrier |
| Contact | `{{CIVILITE}}`, `{{CONTACT}}`, `{{FONCTION}}` | Formule d’appel ou ligne « À l’attention de » |
| Coordonnées | `{{TELEPHONE}}`, `{{EMAIL}}` | Fiche de suivi, bon de livraison, contact commercial |
| Courrier | `{{DATE}}`, `{{OBJET}}`, `{{REFERENCE}}` | Personnalisation de la campagne ou des dossiers |
| Champs libres | `{{VILLE_LIVRAISON}}`, `{{NUMERO_CLIENT}}`, etc. | Cas métiers propres à votre activité |

Les champs du Word resteront contrôlés par une liste blanche. Si le modèle contient `{{TELEPHONE}}`, COURRIER EA vérifiera qu’une colonne ou une valeur a été associée à ce champ ; aucune autre partie du texte ne sera touchée.

## Trois manières d’apporter les données

### 1. Fichier Excel — la méthode recommandée

Excel est le format le plus fiable pour une campagne importante. COURRIER EA lira les en-têtes de colonnes, par exemple « Téléphone », « Ville » ou « Contact », puis proposera une correspondance automatique avec les champs du Word. Vous pourrez la corriger avant génération et l’enregistrer comme profil réutilisable.

| Colonne détectée | Proposition automatique | Action utilisateur |
|---|---|---|
| `Téléphone` | `{{TELEPHONE}}` | Confirmer ou modifier |
| `Ville` | `{{LOCALITE}}` | Confirmer ou modifier |
| `Nom contact` | `{{CONTACT}}` | Confirmer ou modifier |
| `Adresse entreprise` | `{{ADRESSE}}` | Confirmer ou modifier |

### 2. Tableau dans un PDF

Vous pourrez déposer un PDF contenant un tableau. L’application extraira les colonnes, présentera un tableau de contrôle et demandera une validation humaine avant toute génération. Cette étape est importante car la lecture d’un tableau PDF peut déplacer des cellules, surtout lorsque le document provient d’un scan ou que le tableau est complexe.

Pour un PDF scanné, une lecture OCR sera proposée. Le résultat devra toujours être relu dans l’écran de contrôle avant de créer les courriers.

### 3. Copier-coller

Pour une petite liste reçue par e-mail, WhatsApp ou message, vous pourrez coller un tableau directement dans COURRIER EA. L’application acceptera notamment les colonnes séparées par des tabulations, des virgules, des points-virgules ou des retours à la ligne.

Exemple de collage :

```text
Destinataire;Téléphone;Localité
VIGASSISTANCE;+225 01 02 03 04 05;Abidjan
NPG;+225 05 06 07 08 09;Bouaké
```

L’application transformera ce contenu en tableau avant de vous demander d’associer chaque colonne au bon champ de fusion.

## Parcours recommandé dans l’application

```text
1. Importer ou choisir le modèle Word
                ↓
2. COURRIER EA détecte les champs {{...}} du modèle
                ↓
3. Importer Excel / PDF / coller un tableau
                ↓
4. Vérifier les colonnes et faire les correspondances
                ↓
5. Corriger les valeurs manquantes ou incohérentes
                ↓
6. Prévisualiser deux cas : un nom normal et la ligne la plus longue
                ↓
7. Générer le PDF complet, les Word séparés et le ZIP
```

## Contrôles qui préserveront la qualité de la lettre

Avant toute génération, l’application doit effectuer les contrôles suivants :

| Contrôle | Règle proposée | Résultat |
|---|---|---|
| Champs Word | Seuls les champs `{{...}}` sont modifiables | Mise en page et texte fixe protégés |
| Correspondances | Chaque champ Word doit avoir une source ou une valeur par défaut | Aucun champ vide imprévu |
| Valeurs obligatoires | Par exemple, `{{DESTINATAIRE}}` obligatoire | Les lignes incomplètes sont isolées |
| Longueur | Alerte si une valeur risque de créer un retour à la ligne | Prévisualisation renforcée |
| Téléphone | Conservation du format texte, y compris les zéros et le préfixe `+225` | Numéros non déformés |
| PDF / collage | Aperçu de tableau obligatoire avant fusion | Erreurs d’extraction visibles avant impression |

Une ligne incomplète ne doit pas bloquer toute la campagne : COURRIER EA indiquera les lignes concernées, permettra de les corriger, de les ignorer temporairement ou de générer uniquement les lignes prêtes.

## Améliorations prioritaires du projet

### Version suivante recommandée : « Multi-champs essentiel »

Cette version apporte la valeur la plus directe tout en restant très simple à apprendre.

| Priorité | Amélioration | Bénéfice concret |
|---:|---|---|
| 1 | Détection de tous les champs `{{...}}` dans le Word | Le modèle devient réellement réutilisable |
| 2 | Écran de correspondance colonnes → champs | Vous choisissez une fois où va chaque donnée |
| 3 | Import Excel avec conservation des numéros de téléphone au format texte | Moins d’erreurs de données |
| 4 | Collage direct de tableau | Création rapide d’une petite campagne |
| 5 | Tableau de correction des données manquantes | Pas besoin de retourner dans Excel pour un petit correctif |
| 6 | Prévisualisation de la première ligne et de la ligne la plus longue | Protection renforcée de la mise en page |

### Version complémentaire : « Sources avancées et productivité »

Après le multi-champs essentiel, ces améliorations faciliteront les campagnes plus complexes.

| Amélioration | Fonctionnement proposé |
|---|---|
| Import de tableau PDF | Extraction puis validation du tableau avant fusion |
| Profils de correspondance | Enregistrer « mon Excel clients » pour éviter de refaire le paramétrage |
| Valeurs par défaut | Par exemple, une date ou un objet commun à toute la campagne |
| Filtres de destinataires | Générer uniquement une ville, un commercial ou un groupe de clients |
| Duplicata de campagne | Reprendre un modèle, les règles et les réglages d’une campagne passée |
| Journal de contrôle | Conserver les lignes ignorées, corrigées et générées |

### Évolutions ultérieures utiles

Lorsque le flux de publipostage sera stabilisé, COURRIER EA pourra intégrer un envoi par e-mail, des modèles de SMS/WhatsApp à partir des mêmes données, des rôles d’utilisateur, une validation avant impression et une bibliothèque de modèles classée par usage.

## Recommandation de démarrage

Je recommande de construire d’abord le **multi-champs essentiel** avec les cinq champs suivants : `{{DESTINATAIRE}}`, `{{CONTACT}}`, `{{TELEPHONE}}`, `{{LOCALITE}}` et `{{ADRESSE}}`. Excel et le collage de tableau doivent arriver avant l’import de PDF, car ils sont plus fiables et couvrent la majorité des besoins immédiats.

L’import PDF peut ensuite être ajouté avec un écran de vérification renforcé, sans compromettre la fiabilité du courrier.

## Décision attendue

Pour lancer la prochaine version, il suffit de confirmer :

1. les champs qui doivent être disponibles dès le départ ;
2. si le bloc d’adresse doit comporter une, deux ou trois lignes ;
3. si le PDF sera surtout un tableau numérique, un tableau scanné, ou les deux ;
4. si les numéros de téléphone serviront seulement à être imprimés ou aussi à préparer un envoi WhatsApp/SMS ultérieur.
