"use client";

import { useRouter } from "next/navigation";
import { useActionState, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AUTH_REDIRECT_PATH } from "@/config/auth";
import type { CoverLetterFeedback } from "@/types/cover-letter";
import { removeCoverLetter } from "../api-client";

export function DeleteCoverLetterButton({
  id,
  companyName,
  disabled,
  onPendingChange,
}: {
  id: string;
  companyName: string;
  disabled: boolean;
  onPendingChange: (pending: boolean) => void;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [showError, setShowError] = useState(false);
  const [state, formAction, pending] = useActionState<CoverLetterFeedback, FormData>(async () => {
    onPendingChange(true);
    setShowError(true);
    try {
      const result = await removeCoverLetter(id);
      if (!result.ok) return result.feedback;
      router.replace(AUTH_REDIRECT_PATH);
      router.refresh();
      return {};
    } finally {
      onPendingChange(false);
    }
  }, {});

  return (
    <div className="mt-10 border-t border-line pt-6">
      <button
        type="button"
        disabled={disabled || pending}
        className="min-h-12 text-sm font-semibold text-muted underline underline-offset-4 disabled:opacity-50"
        onClick={() => {
          setShowError(false);
          dialog.current?.showModal();
        }}
      >
        지원 카드 삭제
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-lg border border-line bg-surface p-6 text-foreground shadow-md backdrop:bg-foreground/30 sm:p-8"
      >
        <h2 id={titleId} className="text-xl font-bold">
          지원 카드를 삭제할까요?
        </h2>
        <p
          id={descriptionId}
          className="mt-4 text-sm leading-relaxed text-muted [overflow-wrap:anywhere]"
        >
          <strong className="font-semibold text-foreground">{companyName}</strong>의 자소서 문항과
          경험, 연결된 면접 기록이 함께 삭제돼요. 삭제한 내용은 되돌릴 수 없어요.
        </p>
        <form action={formAction} className="mt-6" aria-busy={pending}>
          {showError && state.error && (
            <p role="alert" className="mb-4 text-sm text-danger">
              {state.error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              variant="secondary"
              autoFocus
              disabled={pending}
              onClick={() => dialog.current?.close()}
            >
              취소
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "삭제하고 있어요…" : "삭제하기"}
            </Button>
          </div>
          <p role="status" className="sr-only">
            {pending ? "지원 카드를 삭제하고 있어요." : ""}
          </p>
        </form>
      </dialog>
    </div>
  );
}
