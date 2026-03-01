"use client";

import Image from "next/image";
import Link from "next/link";
import { Home } from "lucide-react";

import { Button } from "../ui/button";
// import { images } from "@/constants";

export default function NotFound404() {
  return (
    <div className="flex h-[calc(100vh-5rem)] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* <Image src={images.notFound} alt="Not Found" className="size-64" /> */}
        <h2 className="text-lg font-medium">Not Found</h2>
        <p className="text-muted-foreground">Oops, this page doesn't exist.</p>
        <Link href="/">
          <Button variant="secondary">
            <Home size={12} /> Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
