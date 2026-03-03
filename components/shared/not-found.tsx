"use client";

import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";

import { Button } from "../ui/button";

export default function NotFound404() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/30 p-4">
      <div className="flex max-w-md flex-col items-center gap-6 rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted">
          <FileQuestion className="size-7 text-muted-foreground" />
        </div>
        <div className="space-y-2 text-center">
          <h2 className="text-xl font-semibold text-foreground">Page not found</h2>
          <p className="text-sm text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        <Link href="/">
          <Button variant="default">
            <Home className="mr-2 size-4" />
            Back to home
          </Button>
        </Link>
      </div>
    </div>
  );
}
