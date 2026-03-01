"use client";

import { Button } from "../ui/button";

type Props = { error: Error & { digest?: string }; reset: () => void };

function GlobalError({ error, reset }: Props) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-transparent">
      <div className="flex flex-col items-center justify-center gap-4">
        <h2 className="text-lg font-medium">Something went wrong!</h2>
        <h5 className="text-error">{error.message}</h5>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}

export default GlobalError;
