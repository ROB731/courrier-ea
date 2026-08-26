// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ query: "", removeCalls: [] as unknown[] }));

vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("wouter", () => ({ useLocation: () => ["/destinataires", vi.fn()] }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ recipients: { list: { invalidate: vi.fn() } } }),
    recipients: {
      list: { useQuery: (input: { query: string }) => ({ data: input.query ? [{ id: "r-1", name: "Atelier Recherche", source: "manual", values: { EMAIL: "contact@atelier.test" } }] : [{ id: "r-1", name: "Atelier Recherche", source: "manual", values: { EMAIL: "contact@atelier.test" } }, { id: "r-2", name: "Bureau Exemple", source: "import", values: { EMAIL: "bureau@example.test" } }], isLoading: false, error: null }) },
      create: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }) },
      update: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }) },
      remove: { useMutation: () => ({ mutate: (input: unknown) => state.removeCalls.push(input), isPending: false, error: null }) },
    },
  },
}));

import RecipientsDirectory from "./RecipientsDirectory";

describe("RecipientsDirectory — recherche et suppression protégée", () => {
  beforeEach(() => { state.query = ""; state.removeCalls = []; });
  afterEach(() => cleanup());

  it("filtre rapidement par nom ou e-mail et permet d’effacer la recherche", async () => {
    render(<RecipientsDirectory />);
    const search = screen.getByRole("searchbox", { name: "Rechercher un destinataire par nom ou e-mail" });
    fireEvent.change(search, { target: { value: "contact@atelier.test" } });
    await waitFor(() => expect(screen.getByText("Atelier Recherche")).toBeTruthy());
    expect(screen.queryByText("Bureau Exemple")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Effacer la recherche" }));
    expect(screen.getByText("Bureau Exemple")).toBeTruthy();
  });

  it("demande une confirmation avant d’appeler la suppression", () => {
    render(<RecipientsDirectory />);
    fireEvent.click(screen.getAllByRole("button", { name: "Retirer" })[0]);
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText("Supprimer ce destinataire ?")).toBeTruthy();
    expect(state.removeCalls).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Retirer" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Oui, supprimer" }));
    expect(state.removeCalls).toEqual([{ id: "r-1" }]);
  });
});
