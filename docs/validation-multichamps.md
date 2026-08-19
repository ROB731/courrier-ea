# Validation de la fusion multi-champs

Le moteur Python a été contrôlé avec un modèle Word contenant les cinq champs `{{DESTINATAIRE}}`, `{{CONTACT}}`, `{{ADRESSE}}`, `{{LOCALITE}}` et `{{TELEPHONE}}`.

L’inspection du modèle a détecté les cinq champs et le champ obligatoire `{{DESTINATAIRE}}`. L’aperçu PDF a montré que les cinq valeurs sont injectées sans reconstruire le document. La génération de lot a produit deux fichiers Word dans l’archive ZIP et un PDF consolidé de deux pages. Chaque page présente les données spécifiques du destinataire correspondant.

L’assistant de campagne a aussi été contrôlé sur bureau et sur mobile. Les étapes de nommage, de sélection de modèle, d’import Excel, de collage de tableau et de contrôle avant génération sont lisibles dans les deux formats. Sur mobile, les cartes et le panneau de prévisualisation se présentent en une colonne sans masquer les actions essentielles.
