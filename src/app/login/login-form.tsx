"use client";

import { ArrowRight, Loader2, ShieldAlert } from "lucide-react";
import { useFormState, useFormStatus } from "react-dom";

import { loginAction } from "@/app/actions/auth";
import type { LoginState } from "@/lib/types/forms";
import { MotionButton } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Reveal } from "@/components/ui/motion";

const initialState: LoginState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useFormState(loginAction, initialState);

  return (
    <Reveal>
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />

        <Field label="Username" htmlFor="username">
          <Input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            placeholder="nelsen"
          />
        </Field>

        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••••••"
          />
        </Field>

        {state.error !== null && (
          <div
            role="alert"
            className="flex items-start gap-2.5 border border-danger bg-surface px-3 py-2.5"
          >
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-danger" />
            <p className="font-mono text-[11px] leading-relaxed text-danger">
              {state.error}
            </p>
          </div>
        )}

        <SubmitButton />

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Tidak ada halaman pendaftaran. Untuk mengubah kredensial, perbarui{" "}
          <code className="border border-border bg-surface px-1 font-mono text-[10px]">
            ADMIN_USERNAME
          </code>{" "}
          dan{" "}
          <code className="border border-border bg-surface px-1 font-mono text-[10px]">
            ADMIN_PASSWORD
          </code>
          , lalu deploy ulang.
        </p>
      </form>
    </Reveal>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <MotionButton
      type="submit"
      variant="accent"
      size="lg"
      disabled={pending}
      className="mt-1 w-full"
    >
      {pending ? (
        <>
          <Loader2 className="size-3.5 animate-spin" />
          Memverifikasi
        </>
      ) : (
        <>
          Masuk
          <ArrowRight className="size-3.5" />
        </>
      )}
    </MotionButton>
  );
}
