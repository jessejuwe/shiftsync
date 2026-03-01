"use client";

import { useEffect } from "react";

import { useHandleError } from "@/hooks/use-handle-error";
import { errorEmitter } from "@/lib/event-emitter";
import { Error } from "@/types/general";

export default function ErrorListener() {
  const { handleError } = useHandleError();

  useEffect(() => {
    function onError(error: Error) {
      handleError(error);
    }

    errorEmitter.on("error", onError);

    return () => {
      errorEmitter.off("error", onError);
    };
  }, [handleError]);

  return null;
}
