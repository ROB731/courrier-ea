export type PrintableWindow = { print: () => void } | null;

export function launchPdfPrint(
  pdfUrl: string,
  openWindow: (url: string) => PrintableWindow,
  schedule: (callback: () => void) => void,
): boolean {
  const printableWindow = openWindow(pdfUrl);
  if (!printableWindow) return false;
  schedule(() => printableWindow.print());
  return true;
}
