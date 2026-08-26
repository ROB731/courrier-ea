export type AutoPreparationInput = {
  templateId: string;
  fields: string[];
  headers: string[];
  rowCount: number;
  mappings: Record<string, string>;
};

/**
 * Le contrôle est automatique dès que le modèle, une ligne et la correspondance
 * obligatoire {{DESTINATAIRE}} sont disponibles. Les champs optionnels peuvent
 * encore être associés ou modifiés sans empêcher la revue initiale.
 */
export function isAutoPreparationReady({ templateId, fields, headers, rowCount, mappings }: AutoPreparationInput) {
  const recipientColumn = mappings.DESTINATAIRE;
  return Boolean(templateId && fields.length > 0 && rowCount > 0 && recipientColumn && headers.includes(recipientColumn));
}
