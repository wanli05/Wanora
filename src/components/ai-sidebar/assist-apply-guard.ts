/**
 * Guards AI "apply to draft" mutations so stale sessions cannot write the wrong record.
 * All checks run before any draft mutation.
 */

export type RecordApplyGuardInput = {
  mounted: boolean;
  /** True while the record editor form is open. */
  editorOpen: boolean;
  /** Id of the row currently in the editor; "" for unsaved new; null/undefined if closed. */
  currentRecordId: string | null | undefined;
  /** Id captured when assist opened; null = unsaved new row. */
  expectedRecordId: string | null;
};

export function canApplyToRecordDraft(input: RecordApplyGuardInput): boolean {
  if (!input.mounted) return false;
  if (!input.editorOpen) return false;
  if (input.expectedRecordId) {
    return input.currentRecordId === input.expectedRecordId;
  }
  // Unsaved new row: editor must still be on an empty-id draft.
  return input.currentRecordId === "";
}

export type ProfileApplyGuardInput = {
  mounted: boolean;
  /** Profile extras editor open. */
  editorOpen: boolean;
};

export function canApplyToProfileDraft(input: ProfileApplyGuardInput): boolean {
  return input.mounted && input.editorOpen;
}
