import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",

        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",

        destructive:
          "bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",

        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",

        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",

        link: "text-primary underline-offset-4 [a&]:hover:underline",
      },

      status: {
        draft:
          "bg-cyan-100 text-cyan-700 border border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-400 dark:border-cyan-500/30",

        published: "bg-primary text-primary-foreground",
      },

      swap: {
        PENDING:
          "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30",
        PENDING_MANAGER:
          "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30",
        APPROVED:
          "bg-green-100 text-green-700 border border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/30",
        REJECTED:
          "bg-red-100 text-red-700 border border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30",
        CANCELLED: "bg-muted bg-muted text-muted-foreground",
      },

      tag: {
        skill:
          "bg-emerald-100 text-emerald-700 border border-emerald-200 font-normal dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/20",
        location:
          "bg-indigo-100 text-indigo-700 border border-indigo-200 font-normal dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/20",
        day: "bg-cyan-100 text-cyan-700 border border-cyan-200 font-normal dark:bg-cyan-500/15 dark:text-cyan-400 dark:border-cyan-500/30",
      },

      role: {
        manager:
          "bg-purple-100 text-purple-700 border border-purple-200 font-normal dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/20",
      },
    },

    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  status,
  swap,
  tag,
  role,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      data-status={status}
      data-swap={swap}
      data-tag={tag}
      data-role={role}
      className={cn(
        badgeVariants({ variant, status, swap, tag, role }),
        className,
      )}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
