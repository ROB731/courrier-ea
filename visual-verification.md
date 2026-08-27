# Vérification visuelle du 27 août 2026

La route `/suivi` affiche le tableau global « Suivi des envois », les compteurs de résultats, à envoyer et envoyés, les contrôles de recherche et de filtres, ainsi que les actions Exporter Excel, Exporter CSV et Imprimer. Les statuts sont lisibles dans le tableau et les campagnes sont visibles par ligne.

La route `/campagnes` affiche l’historique avec le statut de génération « Prête » et un second badge de cycle « Ouverte ». La hiérarchie visuelle, la navigation latérale et l’appel à l’action Nouvelle campagne sont cohérents avec le reste de l’espace de travail.

La capture a été réalisée sur le serveur de développement à 1280×900 en pleine page. Aucun problème de rendu bloquant n’a été observé sur ces deux routes.
## Vérification de production

La version actuellement publiée sur `courrierapp-9r2dsc8n.manus.space` sert encore une révision antérieure : `/campagnes` n’affiche pas le badge « Ouverte » et `/suivi` retourne 404. Une nouvelle publication est donc nécessaire après les derniers changements ; la validation locale reste correcte.
