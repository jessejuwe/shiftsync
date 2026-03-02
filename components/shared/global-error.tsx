"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "../ui/button";

type Props = { error: Error & { digest?: string }; reset: () => void };

function GlobalError({ error, reset }: Props) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/30 p-4">
      <div className="flex max-w-md flex-col items-center gap-6 rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-7 text-destructive" />
        </div>
        <div className="space-y-2 text-center">
          <h2 className="text-xl font-semibold text-foreground">
            Something went wrong
          </h2>
          <p className="text-sm text-muted-foreground">
            {error.message || "An unexpected error occurred. Please try again."}
          </p>
        </div>
        <Button onClick={reset} variant="default">
          Try again
        </Button>
      </div>
    </div>
  );
}

export default GlobalError;
