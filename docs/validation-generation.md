# Validation de génération documentaire

La génération de contrôle a utilisé une copie du modèle Word d’origine dont le seul nom destinataire a été remplacé par le champ strict `{{DESTINATAIRE}}`. Deux lettres ont été produites, avec `VIGASSISTANCE` puis un nom volontairement long.

Le PDF consolidé conserve l’en-tête, le positionnement des blocs, la signature, les marges et la pagination du modèle. Le nom long revient correctement à la ligne dans la zone destinataire, sans provoquer de seconde page. Ce comportement justifie l’alerte de vérification affichée dans l’application pour les noms de plus de 30 caractères.

## Validation de l’interface

Les écrans de vue d’ensemble, de création de campagne et d’historique ont été contrôlés sur un affichage de bureau de 1 280 pixels de large. La navigation, les actions principales, les zones d’import et les états vides sont lisibles, hiérarchisés et cohérents avec le style de l’application.

Les écrans principaux ont également été contrôlés sur 375 pixels de large. La navigation passe en en-tête compact, les cartes se redistribuent en une colonne et les zones d’import conservent leurs libellés et leurs contrôles. Les erreurs métier sont couvertes par les tests de procédures : format de fichier invalide, modèle sans ou avec plusieurs champs de fusion, absence de colonne `Destinataire`, modèle ou campagne inaccessible, et échec de génération.
