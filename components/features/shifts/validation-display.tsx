"use client";

import { AlertCircle, AlertTriangle } from "lucide-react";
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

function ValidationItem({
  item,
  onAssignSuggestion,
}: {
  item: ValidationResult;
  onAssignSuggestion?: (userId: string) => void;
}) {
  const Icon = item.type === "block" ? AlertCircle : AlertTriangle;
  const label = VALIDATION_LABELS[item.code] ?? item.code;
  const hasSuggestions = item.suggestions && item.suggestions.length > 0;

  return (
    <Alert variant={item.type === "block" ? "destructive" : "default"}>
      <Icon className="size-4 shrink-0" />
      <AlertTitle className="flex items-center gap-2">
        <Badge variant={item.type === "block" ? "destructive" : "secondary"}>
          {label}
        </Badge>
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <p className="leading-relaxed">{item.message}</p>
        {hasSuggestions && (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Suggested alternatives
            </p>
            <div className="flex flex-wrap gap-2">
              {item.suggestions!.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 shadow-sm"
                >
                  <span className="text-sm font-medium">{s.name}</span>
                  {s.email && (
                    <span className="text-muted-foreground text-xs">({s.email})</span>
                  )}
                  {onAssignSuggestion && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-1"
                      onClick={() => onAssignSuggestion(s.id)}
                    >
                      Assign instead
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

export function ValidationDisplay({
  blocks,
  warnings,
  onAssignSuggestion,
}: ValidationDisplayProps) {
  const hasBlocks = blocks.length > 0;
  const hasWarnings = warnings.length > 0;

  if (!hasBlocks && !hasWarnings) return null;

  return (
    <div className="space-y-3">
      {hasBlocks && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-destructive">Blocking issues</h4>
          {blocks.map((item, i) => (
            <ValidationItem
              key={`${item.code}-${i}`}
              item={item}
              onAssignSuggestion={onAssignSuggestion}
            />
          ))}
        </div>
      )}
      {hasWarnings && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Warnings</h4>
          {warnings.map((item, i) => (
            <ValidationItem
              key={`${item.code}-${i}`}
              item={item}
              onAssignSuggestion={onAssignSuggestion}
            />
          ))}
        </div>
      )}
    </div>
  );
}
