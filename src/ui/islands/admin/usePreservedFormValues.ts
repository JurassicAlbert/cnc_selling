'use client';

import { useState } from 'react';

/**
 * `docs/CHECKLIST.md`'s "Form state survives validation errors" — a real,
 * systemic gap, not a one-off. React 19's `<form action={fn}>` (what
 * `useActionState` renders through) calls the DOM's own `form.reset()` after
 * the action's promise settles — on a validation FAILURE just as much as a
 * success — which snaps every uncontrolled field back to its currently
 * rendered `defaultValue`. Every admin create/edit form in this panel uses
 * `defaultValue={record?.field}` (correct for pre-filling an edit form, but
 * wrong after a failed submission, since `record` never changed): a staff
 * member fixing one typo'd field on a 20-field product form loses all 20
 * on the very error message meant to help them fix it.
 *
 * The fix doesn't require converting every field to a fully controlled
 * input (a much larger, more error-prone change across ~16 forms). Since
 * `form.reset()` reads whatever `defaultValue` is CURRENTLY rendered, it's
 * enough to update `defaultValue` to the user's own last-submitted value
 * before the reset happens — resetting "to itself" is invisible to the
 * user. `capture(formData)` does that: call it as the very first line of a
 * `useActionState` action, synchronously, before the `await` — the
 * resulting re-render (with fresh `defaultValue`s) always lands before
 * React's post-action reset.
 *
 * `submitted` distinguishes "never submitted yet" (fall back to the real
 * record) from "submitted, and this specific field was left unchecked/
 * empty" (show exactly that, not the record's original value) — needed for
 * checkboxes, whose absence from `FormData` is otherwise indistinguishable
 * from "not submitted at all."
 */
export function usePreservedFormValues() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  // MUI's `Select` and `Checkbox` (unlike a plain `TextField`) track
  // controlled-vs-uncontrolled status internally and log a console warning
  // if `defaultValue`/`defaultChecked` changes after their first render —
  // which is exactly what `capture` does on purpose. The standard React fix
  // for "I want a fresh default after this point" is a `key` bump forcing a
  // clean remount instead of a same-instance prop change; `resetKey` is that
  // key — pass it to every `select` `TextField` and `Checkbox` this hook
  // feeds (plain text/number fields don't need it, MUI doesn't warn there).
  const [resetKey, setResetKey] = useState(0);

  function capture(formData: FormData): void {
    const next: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') {
        next[key] = value;
      }
    }
    setValues(next);
    setSubmitted(true);
    setResetKey((k) => k + 1);
  }

  /** `defaultValue` helper: the just-submitted value once `capture` has run, otherwise the record's own value. */
  function fieldValue(name: string, recordValue: string | null | undefined): string {
    return submitted ? (values[name] ?? '') : (recordValue ?? '');
  }

  /** `defaultChecked` helper — a checkbox absent from `FormData` means "unchecked," not "unset." */
  function fieldChecked(name: string, recordValue: boolean | undefined): boolean {
    return submitted ? values[name] === 'on' : (recordValue ?? false);
  }

  return { capture, fieldValue, fieldChecked, resetKey };
}
