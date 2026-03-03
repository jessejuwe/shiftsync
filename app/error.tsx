"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

import { GlobalError } from "@/components/shared";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.warn(error);
  }, [error]);

  return <GlobalError error={error} reset={reset} />;
}
