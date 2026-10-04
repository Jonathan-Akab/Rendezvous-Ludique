"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "./forms";
import type { ActionState } from "@/lib/forms";

/** A form around a server action that shows the action's success/error message. */
export function ActionForm({
  action,
  children,
  submitLabel,
  submitClassName = "btn btn-primary",
  className = "space-y-4",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submitLabel: string;
  submitClassName?: string;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {children}
      <FormMessage state={state} />
      <SubmitButton className={submitClassName}>{submitLabel}</SubmitButton>
    </form>
  );
}
