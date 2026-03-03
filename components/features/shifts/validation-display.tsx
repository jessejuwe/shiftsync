"use client";

import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VALIDATION_LABELS } from "@/lib/validation-messages";
import type { ValidationCode } from "@/lib/domain/shift-policy";

export interface ValidationResult {
  type: "block" | "warning";
  code: ValidationCode;
  message: string;
  suggestions?: { id: string; name: string; email: string }[];
}

interface ValidationDisplayProps {
  blocks: ValidationResult[];
  warnings: ValidationResult[];
  onAssignSuggestion?: (userId: string) => void;
}

function BlockItem({ item }: { item: ValidationResult }) {
  const label = VALIDATION_LABELS[item.code] ?? item.code;
  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4 shrink-0" />
      <AlertTitle className="flex items-center gap-2">
        <Badge variant="destructive">{label}</Badge>
      </AlertTitle>
      <AlertDescription>
        <p className="leading-relaxed">{item.message}</p>
      </AlertDescription>
    </Alert>
  );
}

function WarningItem({ item }: { item: ValidationResult }) {
  const Icon = AlertTriangle;
  const label = VALIDATION_LABELS[item.code] ?? item.code;
  return (
    <Alert
      className="border-warning/50 bg-warning/10 [&>svg]:text-warning dark:bg-warning/5"
    >
      <Icon className="size-4 shrink-0" />
      <AlertTitle className="flex items-center gap-2">
        <Badge
          variant="outline"
          className="border-warning/50 bg-warning/20 text-foreground"
        >
          {label}
        </Badge>
      </AlertTitle>
      <AlertDescription>
        <p className="leading-relaxed">{item.message}</p>
      </AlertDescription>
    </Alert>
  );
}

function SuggestedAlternatives({
  suggestions,
  onAssignSuggestion,
}: {
  suggestions: { id: string; name: string; email: string }[];
  onAssignSuggestion?: (userId: string) => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <div className="space-y-2 rounded-lg border border-success/50 bg-success/10 p-3 dark:bg-success/5">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="size-4 text-success" />
        <h4 className="text-sm font-medium text-success">Suggested alternatives</h4>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <div
            key={s.id}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-success/30 bg-background/80 px-3 py-2 shadow-sm dark:bg-success/10"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{s.name}</p>
              {s.email && (
                <p className="text-muted-foreground truncate text-xs">
                  {s.email}
                </p>
              )}
            </div>
            {onAssignSuggestion && (
              <Button
                size="sm"
                variant="outline"
                className="ml-1 shrink-0 border-success/30 hover:bg-success/20"
                onClick={() => onAssignSuggestion(s.id)}
              >
                Assign instead
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ValidationDisplay({
  blocks,
  warnings,
  onAssignSuggestion,
}: ValidationDisplayProps) {
  const hasBlocks = blocks.length > 0;
  const hasWarnings = warnings.length > 0;

  // Aggregate and dedupe suggestions from blocks + warnings
  const allSuggestions = [...blocks, ...warnings]
    .flatMap((item) => item.suggestions ?? [])
    .filter((s) => s.id && s.name);
  const seen = new Set<string>();
  const suggestions = allSuggestions.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
  const hasSuggestions = suggestions.length > 0;

  if (!hasBlocks && !hasWarnings && !hasSuggestions) return null;

  return (
    <div className="space-y-3">
      {hasBlocks && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-destructive">
            Blocking issues
          </h4>
          {blocks.map((item, i) => (
            <BlockItem key={`block-${item.code}-${i}`} item={item} />
          ))}
        </div>
      )}
      {hasWarnings && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-warning">Warnings</h4>
          {warnings.map((item, i) => (
            <WarningItem key={`warn-${item.code}-${i}`} item={item} />
          ))}
        </div>
      )}
      {hasSuggestions && (
        <SuggestedAlternatives
          suggestions={suggestions}
          onAssignSuggestion={onAssignSuggestion}
        />
      )}
    </div>
  );
}
