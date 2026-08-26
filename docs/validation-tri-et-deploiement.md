# Validation du tri post-import et du déploiement

La construction locale valide les contrôles TypeScript, les tests unitaires et le bundle de production après l’ajout des opérations de liste : ajout manuel contrôlé, retrait d’une ligne, réintégration, exclusion et actions par catégories de tri.

La version publiée est accessible sur `https://courrierapp-9r2dsc8n.manus.space/` après la correction Docker. La page publique répond correctement, ce qui confirme que la reprise de l’installation système a permis à l’image de production de démarrer. Une publication explicite du checkpoint `dce2f56c` a été déclenchée après la modification du Dockerfile et s’est achevée sans erreur de build ; elle correspond à l’image contenant les reprises `apt-get` et `--fix-missing`.

Le contrôle de l’URL publique racine a confirmé la disponibilité de la version publiée. Une URL de vérification avec le préfixe `/atelier/campagnes/nouvelle` a été écartée : elle ne correspond pas à une route applicative définie. La vérification du parcours de campagne doit utiliser la route `/campagnes/nouvelle`.

La route publique correcte `/campagnes/nouvelle?v=dce2f56c` charge l’écran de connexion sécurisé, ce qui confirme le bon service de l’application reconstruite derrière le domaine public. Cette réponse, associée au checkpoint de publication explicite réussi, constitue la preuve de disponibilité post-correctif Docker.

Le service de publication a ensuite confirmé explicitement le succès du déploiement et l’association du domaine `courrierapp-9r2dsc8n.manus.space`. Cette confirmation valide l’image reconstruite avec le Dockerfile corrigé.

Après cette confirmation, la route publique fraîche `https://courrierapp-9r2dsc8n.manus.space/?deployment=validated` a été recontrôlée et a rendu normalement la page d’accueil complète de COURRIER EA. La disponibilité post-déploiement est donc confirmée.
