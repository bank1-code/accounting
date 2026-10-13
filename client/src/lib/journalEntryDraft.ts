export type JournalEntrySourceLine = {
  accountId: number;
  costCenterId?: number | null;
  branchId?: number | null;
  debit: string | number;
  credit: string | number;
  description?: string | null;
};

export type JournalEntrySource = {
  description: string | null;
  reference: string | null;
  lines: JournalEntrySourceLine[];
};

export type JournalEntryDraft = {
  form: { description: string; reference: string; date: string };
  lines: Array<{ accountId: number; costCenterId?: number; branchId?: number; debit: string; credit: string; description?: string }>;
};

function localIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Creates an unsaved, editable journal-entry draft and deliberately excludes all identity and posting fields. */
export function createJournalEntryDraftFrom(source: JournalEntrySource, now = new Date()): JournalEntryDraft {
  return {
    form: { description: source.description || "", reference: source.reference || "", date: localIsoDate(now) },
    lines: source.lines.map((line) => ({
      accountId: line.accountId,
      ...(line.costCenterId == null ? {} : { costCenterId: line.costCenterId }),
      ...(line.branchId == null ? {} : { branchId: line.branchId }),
      debit: String(line.debit ?? "0"),
      credit: String(line.credit ?? "0"),
      ...(line.description == null ? {} : { description: line.description }),
    })),
  };
}
