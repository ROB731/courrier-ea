// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  sourceHeaders: ["Entreprise", "Téléphone"],
  prepareCalls: [] as unknown[],
}));

vi.mock("@/lib/files", () => ({ readFileAsBase64: vi.fn(async () => "ZmljaGllci10ZXN0") }));
vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/DirectoryRecipientPicker", () => ({ DirectoryRecipientPicker: () => null }));
vi.mock("wouter", () => ({ useLocation: () => ["/campagnes/nouvelle", vi.fn()] }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ courrier: { templates: { invalidate: vi.fn() }, campaigns: { invalidate: vi.fn() } } }),
    courrier: {
      templates: {
        useQuery: () => ({ data: [{ id: "template-12345678", name: "Lettre", fields: ["DESTINATAIRE", "TELEPHONE"] }], isLoading: false }),
      },
      uploadTemplate: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }) },
      importExcel: {
        useMutation: (options: { onSuccess?: (result: unknown) => void } = {}) => ({
          mutate: vi.fn(() => options.onSuccess?.({
            fileKey: "listes/test.xlsx",
            fileUrl: "https://storage.test/listes/test.xlsx",
            sourceType: "excel",
            columnName: testState.sourceHeaders[0] ?? "",
            headers: testState.sourceHeaders,
            rows: [{ rowNumber: 2, name: "Entreprise test", issues: [], values: { Entreprise: "Entreprise test", "Téléphone": "+22501020304" } }],
          })),
          isPending: false,
          error: null,
        }),
      },
      importPastedTable: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }) },
      prepareRecipients: {
        useMutation: (options: { onSuccess?: (result: unknown) => void } = {}) => ({
          mutate: vi.fn((input: unknown) => {
            testState.prepareCalls.push(input);
            options.onSuccess?.({
              recipients: [{ sourceRow: 2, name: "Entreprise test", values: { DESTINATAIRE: "Entreprise test", TELEPHONE: "+22501020304" }, warning: null, issues: [], includeInGeneration: true, dedupeStatus: "new", dedupeReason: null, matchedCampaignName: null }],
              validCount: 1,
              invalidCount: 0,
              sentConfirmedCount: 0,
              reviewCount: 0,
              directory: { created: 0, updated: 0 },
            });
          }),
          isPending: false,
          error: null,
        }),
      },
      classifyManualRecipient: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }) },
      preview: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }) },
      createCampaign: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }) },
    },
  },
}));

import NewCampaign from "./NewCampaign";

describe("NewCampaign — contrôle automatique après import Excel", () => {
  beforeEach(() => {
    testState.sourceHeaders = ["Entreprise", "Téléphone"];
    testState.prepareCalls = [];
  });

  afterEach(() => cleanup());

  it("prépare les destinataires, ouvre le modal et applique les décisions de tri", async () => {
    render(<NewCampaign />);
    fireEvent.change(screen.getByLabelText("Choisir un modèle"), { target: { value: "template-12345678" } });
    const input = document.querySelectorAll('input[type="file"]')[1] as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["contenu"], "destinataires.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })] } });

    await waitFor(() => expect(testState.prepareCalls).toHaveLength(1));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Contrôle de la liste importée" })).toBeTruthy();
    expect(screen.getByText("Entreprise test")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tout retirer" }));
    expect(screen.getByRole("button", { name: "Continuer avec 0 destinataire" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tout inclure" }));
    expect(screen.getByRole("button", { name: "Continuer avec 1 destinataire" })).toBeTruthy();
  });

  it("n’exécute pas le contrôle avant une correspondance obligatoire valide et conserve le recontrôle manuel", async () => {
    testState.sourceHeaders = ["Société sans correspondance", "Téléphone"];
    render(<NewCampaign />);
    fireEvent.change(screen.getByLabelText("Choisir un modèle"), { target: { value: "template-12345678" } });
    const input = document.querySelectorAll('input[type="file"]')[1] as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["contenu"], "destinataires.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })] } });

    await waitFor(() => expect(screen.getByRole("button", { name: "Recontrôler les données" })).toBeTruthy());
    expect(testState.prepareCalls).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Recontrôler les données" }).hasAttribute("disabled")).toBe(true);
  });
});
