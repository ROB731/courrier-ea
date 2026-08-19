# Validation du parcours de sortie de campagne

Le parcours corrigé rend les prérequis de génération visibles en permanence : nom de campagne, modèle Word et liste Excel. Après la liste Excel, l’utilisateur peut déployer la liste complète des destinataires et consulter les alertes de noms longs sans être bloqué.

Une campagne au statut « prête » affiche un bloc dédié avec trois commandes : « Télécharger le PDF complet », « Imprimer toutes les lettres » et « Télécharger le ZIP Word ». Les deux liens de téléchargement utilisent explicitement l’attribut de téléchargement et ciblent les fichiers générés de la campagne. L’impression ouvre le PDF consolidé dans un nouvel onglet puis appelle l’impression ; une consigne de secours indique d’utiliser Ctrl+P ou Cmd+P si la boîte native ne s’ouvre pas.

Les contrôles automatisés valident la présence des trois actions et des deux liens téléchargeables, ainsi que l’ouverture et l’impression du PDF ou le cas d’une fenêtre bloquée. La suite complète comporte 19 tests réussis ; la vérification TypeScript et la construction de production sont également réussies.
