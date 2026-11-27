import { useEffect, useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AiAssistProvider,
  useAiAssist,
} from "@/components/ai-sidebar/ai-assist-context";

const fetchAiStatus = vi.fn();

vi.mock("@/components/ai-sidebar/ai-api", () => ({
  fetchAiStatus: () => fetchAiStatus(),
}));

function Host() {
  const { registerPanelOpener } = useAiAssist();
  const [open, setOpen] = useState(false);
  useEffect(() => registerPanelOpener(() => setOpen(true)), [registerPanelOpener]);
  return (
    <div data-testid="panel" data-open={open ? "true" : "false"}>
      panel
    </div>
  );
}

function Trigger() {
  const { openPanel, bridgeError } = useAiAssist();
  return (
    <>
      <button
        type="button"
        data-testid="open-panel"
        onClick={() => {
          void openPanel();
        }}
      >
        open
      </button>
      <span data-testid="bridge-error">{bridgeError ?? ""}</span>
    </>
  );
}

describe("AiAssist openPanel", () => {
  beforeEach(() => {
    fetchAiStatus.mockReset();
  });

  it("opens without assist apply binding", async () => {
    fetchAiStatus.mockResolvedValue({ enabled: true, provider: "mock" });
    render(
      <AiAssistProvider>
        <Host />
        <Trigger />
      </AiAssistProvider>,
    );
    fireEvent.click(screen.getByTestId("open-panel"));
    await waitFor(() =>
      expect(screen.getByTestId("panel")).toHaveAttribute("data-open", "true"),
    );
  });

  it("sets bridgeError when AI disabled", async () => {
    fetchAiStatus.mockResolvedValue({ enabled: false, provider: "mock" });
    render(
      <AiAssistProvider>
        <Host />
        <Trigger />
      </AiAssistProvider>,
    );
    fireEvent.click(screen.getByTestId("open-panel"));
    await waitFor(() =>
      expect(screen.getByTestId("bridge-error")).toHaveTextContent(
        "ai_unavailable",
      ),
    );
  });
});
