import { describe, expect, it, vi } from "vitest";
import { launchPdfPrint } from "./campaignOutput";

describe("launchPdfPrint", () => {
  it("ouvre le PDF groupé et lance l’impression lorsqu’une fenêtre est disponible", () => {
    const print = vi.fn();
    const openWindow = vi.fn().mockReturnValue({ print });
    const schedule = vi.fn(callback => callback());

    expect(launchPdfPrint("/manus-storage/campagne.pdf", openWindow, schedule)).toBe(true);
    expect(openWindow).toHaveBeenCalledWith("/manus-storage/campagne.pdf");
    expect(schedule).toHaveBeenCalledOnce();
    expect(print).toHaveBeenCalledOnce();
  });

  it("ne déclenche pas une impression quand le navigateur bloque la nouvelle fenêtre", () => {
    const schedule = vi.fn();
    expect(launchPdfPrint("/manus-storage/campagne.pdf", () => null, schedule)).toBe(false);
    expect(schedule).not.toHaveBeenCalled();
  });
});
