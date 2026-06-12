import * as React from "react";

import { cn } from "@/lib/utils";
import type { SensitiveWordMatch } from "@/lib/sensitive-words";

export interface HighlightedTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  matches?: SensitiveWordMatch[];
  invalid?: boolean;
  textareaClassName?: string;
}

const HighlightedTextarea = React.forwardRef<HTMLTextAreaElement, HighlightedTextareaProps>(
  ({ className, value, onChange, matches = [], invalid, textareaClassName, id, ...props }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
    const highlightRef = React.useRef<HTMLDivElement | null>(null);

    const setRefs = (element: HTMLTextAreaElement | null) => {
      textareaRef.current = element;
      if (typeof ref === "function") {
        ref(element);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = element;
      }
    };

    const handleScroll = () => {
      if (textareaRef.current && highlightRef.current) {
        highlightRef.current.scrollTop = textareaRef.current.scrollTop;
        highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
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

    const sharedTextStyle =
      "min-h-[100px] w-full rounded-xl px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap";

    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border bg-white transition-all",
          invalid
            ? "border-red-400 shadow-[0_0_0_3px_rgba(248,113,113,0.2)]"
            : "border-slate-300 focus-within:ring-2 focus-within:ring-brand-300",
          className
        )}
      >
        <div
          ref={highlightRef}
          aria-hidden="true"
          className={cn(
            sharedTextStyle,
            "pointer-events-none absolute inset-0 overflow-hidden text-transparent",
            textareaClassName
          )}
        >
          {renderHighlightedContent()}
          {value.endsWith("\n") || value === "" ? <span>&nbsp;</span> : null}
        </div>
        <textarea
          id={id}
          ref={setRefs}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          aria-invalid={invalid || undefined}
          className={cn(
            sharedTextStyle,
            "relative z-10 resize-none bg-transparent text-slate-800 placeholder:text-slate-400 focus-visible:outline-none",
            textareaClassName
          )}
          {...props}
        />
      </div>
    );
  }
);
HighlightedTextarea.displayName = "HighlightedTextarea";

export { HighlightedTextarea };
