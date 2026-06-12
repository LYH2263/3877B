import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
  steps: string[];
}

export function OnboardingProgress({ currentStep, totalSteps, steps }: OnboardingProgressProps) {
  return (
    <div className="mb-8">
      <div className="mb-4 flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={index} className="flex flex-1 flex-col items-center">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all",
                index < currentStep
                  ? "border-brand-500 bg-brand-500 text-white"
                  : index === currentStep
                    ? "border-brand-500 bg-white text-brand-600"
                    : "border-slate-200 bg-slate-50 text-slate-400"
              )}
            >
              {index < currentStep ? <Check className="h-5 w-5" /> : index + 1}
            </div>
            <span
              className={cn(
                "mt-2 text-xs",
                index <= currentStep ? "text-slate-700" : "text-slate-400"
              )}
            >
              {step}
            </span>
          </div>
        ))}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-500 transition-all duration-500"
          style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
        />
      </div>
    </div>
  );
}
