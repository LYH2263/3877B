import * as React from "react";

import { cn } from "@/lib/utils";
import type { SensitiveWordMatch } from "@/lib/sensitive-words";

export interface HighlightedInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  matches?: SensitiveWordMatch[];
  invalid?: boolean;
  inputClassName?: string;
}

const HighlightedInput = React.forwardRef<HTMLInputElement, HighlightedInputProps>(
  ({ className, value, onChange, matches = [], invalid, inputClassName, id, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    const setRefs = (element: HTMLInputElement | null) => {
      inputRef.current = element;
      if (typeof ref === "function") {
        ref(element);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLInputElement | null>).current = element;
      }
    };

    const renderHighlightedContent = () => {
      if (matches.length === 0) {
        return <span>{value}</span>;
      }

      const sorted = [...matches].sort((a, b) => a.start - b.start);
      const merged: SensitiveWordMatch[] = [];
      for (const m of sorted) {
        if (merged.length === 0 || m.start >= merged[merged.length - 1].end) {
          merged.push(m);
        } else {
          const last = merged[merged.length - 1];
          merged[merged.length - 1] = {
            ...last,
            end: Math.max(last.end, m.end),
            level: last.level === "forbidden" ? last.level : m.level
          };
        }
      }

      const nodes: React.ReactNode[] = [];
      let lastIndex = 0;

      for (const match of merged) {
        if (match.start > lastIndex) {
          nodes.push(<span key={`text-${lastIndex}`}>{value.slice(lastIndex, match.start)}</span>);
        }
        const matchText = value.slice(match.start, match.end);
        const highlightClass =
          match.level === "forbidden"
            ? "bg-red-200/60 text-red-700 underline decoration-red-400 decoration-wavy rounded px-0.5"
            : "bg-amber-200/60 text-amber-700 underline decoration-amber-400 decoration-wavy rounded px-0.5";
        nodes.push(
          <mark key={`match-${match.start}-${match.end}`} className={highlightClass}>
            {matchText}
          </mark>
        );
        lastIndex = match.end;
      }

      if (lastIndex < value.length) {
        nodes.push(<span key={`text-${lastIndex}`}>{value.slice(lastIndex)}</span>);
      }

      return nodes;
    };

    const sharedTextStyle = "h-10 w-full rounded-xl px-3 py-2 text-sm whitespace-nowrap overflow-hidden";

    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border bg-white transition-all flex items-center",
          invalid
            ? "border-red-400 shadow-[0_0_0_3px_rgba(248,113,113,0.2)]"
            : "border-slate-300 shadow-[0_1px_2px_rgba(16,24,40,0.05)] focus-within:ring-2 focus-within:ring-brand-300",
          className
        )}
      >
        <div
          aria-hidden="true"
          className={cn(
            sharedTextStyle,
            "pointer-events-none absolute inset-0 flex items-center text-transparent",
            inputClassName
          )}
        >
          {renderHighlightedContent()}
        </div>
        <input
          id={id}
          ref={setRefs}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid || undefined}
          className={cn(
            sharedTextStyle,
            "relative z-10 bg-transparent text-slate-800 placeholder:text-slate-400 focus-visible:outline-none",
            inputClassName
          )}
          {...props}
        />
      </div>
    );
  }
);
HighlightedInput.displayName = "HighlightedInput";

export { HighlightedInput };
