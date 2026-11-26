import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test-utils/intl";
import type { BoardApplication, BoardSlot } from "@/lib/progress/dto";
import { ConfirmSlotDrawer } from "./confirm-slot-drawer";

function sampleApp(): BoardApplication {
  return {
    id: "app-1",
    company: "株式会社WeStyle",
    companyId: "co-1",
    companyUrl: null,
    companyNotes: null,
    role: "Engineer",
    platformId: "p-1",
    platformCode: "doda",
    platformName: null,
    recruiterId: null,
    recruiterName: null,
    appliedOn: "2026-11-01",
    jobPosting: {
      jobUrl: null,
      salaryBandText: null,
      benefitsText: null,
      jdText: null,
      processNotes: null,
      workLocationText: null,
      jobNotes: null,
    },
    hasJobPosting: false,
    hasFeedback: false,
    outcome: "in_progress",
    offerDecision: null,
    nextPrepNote: null,
    nextPrep: "",
    derivedNextPrep: "",
    currentStageKind: "interview_1",
    currentStageId: "st-1",
    conflict: false,
    interview: {
      id: "iv-1",
      start: "2026-11-25T14:00:00+09:00",
      end: "2026-11-25T15:00:00+09:00",
      mode: "google_meet",
      meetingUrl: null,
      locationText: null,
      status: "scheduled",
    },
    stageInterviews: [],
    proposal: null,
    stages: [],
  };
}

function slot(id: string, start: string, end: string): BoardSlot {
  return { id, start, end, status: "proposed" };
}

describe("ConfirmSlotDrawer", () => {
  it("preselects the third candidate when it matches the current interview", () => {
    const onConfirm = vi.fn();
    const slots = [
      slot("s1", "2026-11-24T01:00:00.000Z", "2026-11-24T02:00:00.000Z"),
      slot("s2", "2026-11-25T01:00:00.000Z", "2026-11-25T02:00:00.000Z"),
      slot("s3", "2026-11-25T05:00:00.000Z", "2026-11-25T06:00:00.000Z"),
      slot("s4", "2026-11-27T01:00:00.000Z", "2026-11-27T02:00:00.000Z"),
    ];
    renderWithIntl(
      <ConfirmSlotDrawer
        app={sampleApp()}
        slots={slots}
        currentInterview={sampleApp().interview}
        onConfirm={onConfirm}
        onClose={() => undefined}
      />,
      "ja",
    );
    expect(screen.getByTestId("confirm-slot-radio-s3")).toBeChecked();
    expect(screen.getByTestId("confirm-slot-submit")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("confirm-slot-submit"));
    expect(onConfirm).toHaveBeenCalledWith("s3");
  });

  it("keeps confirm disabled when no candidate matches the current interview", () => {
    const slots = [
      slot("s1", "2026-11-24T01:00:00.000Z", "2026-11-24T02:00:00.000Z"),
      slot("s2", "2026-11-25T01:00:00.000Z", "2026-11-25T02:00:00.000Z"),
    ];
    renderWithIntl(
      <ConfirmSlotDrawer
        app={sampleApp()}
        slots={slots}
        currentInterview={sampleApp().interview}
        onConfirm={() => undefined}
        onClose={() => undefined}
      />,
      "ja",
    );
    expect(screen.getByTestId("confirm-current-interview")).toBeInTheDocument();
    expect(screen.getByTestId("confirm-slot-radio-s1")).not.toBeChecked();
    expect(screen.getByTestId("confirm-slot-radio-s2")).not.toBeChecked();
    expect(screen.getByTestId("confirm-slot-submit")).toBeDisabled();
  });
});
