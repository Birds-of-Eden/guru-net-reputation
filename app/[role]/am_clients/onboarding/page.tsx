// app/[role]/am_clients/onboarding/page.tsx

"use client";

import { useState, useCallback, useMemo, lazy, Suspense } from "react";
import type { OnboardingFormData } from "@/types/onboarding";
import { useOnboardingAutosave } from "@/hooks/use-onboarding-autosave";
import { AutosaveIndicator } from "@/components/onboarding/autosave-indicator";
import { StepIndicator } from "@/components/onboarding/step-indicator";
import { OnboardingFormSkeleton } from "@/components/onboarding/onboarding-form-skeleton";

// ⚡ OPTIMIZED: Dynamic imports - Load components only when needed!
const GeneralInfo = lazy(() => import("@/components/onboarding/general-info").then(m => ({ default: m.GeneralInfo })));
const WebsiteInfo = lazy(() => import("@/components/onboarding/website-info").then(m => ({ default: m.WebsiteInfo })));
const BiographyInfo = lazy(() => import("@/components/onboarding/biography-info").then(m => ({ default: m.BiographyInfo })));
const ImageGallery = lazy(() => import("@/components/onboarding/image-gallery").then(m => ({ default: m.ImageGallery })));
const SocialMediaInfo = lazy(() => import("@/components/onboarding/social-media-info").then(m => ({ default: m.SocialMediaInfo })));
const OtherInfo = lazy(() => import("@/components/onboarding/other-info").then(m => ({ default: m.OtherInfo })));
const PackageInfo = lazy(() => import("@/components/onboarding/package-info").then(m => ({ default: m.PackageInfo })));
const TemplateSelection = lazy(() => import("@/components/onboarding/template-selection").then(m => ({ default: m.TemplateSelection })));
const ReviewInfo = lazy(() => import("@/components/onboarding/review-info").then(m => ({ default: m.ReviewInfo })));

const steps = [
  { id: 1, title: "General Info", component: GeneralInfo },
  { id: 2, title: "Website Info", component: WebsiteInfo },
  { id: 3, title: "Biography", component: BiographyInfo },
  { id: 4, title: "Image Gallery", component: ImageGallery },
  { id: 5, title: "Social Media", component: SocialMediaInfo },
  { id: 6, title: "Other Info", component: OtherInfo },
  { id: 7, title: "Package", component: PackageInfo },
  { id: 8, title: "Template", component: TemplateSelection },
  { id: 9, title: "Review", component: ReviewInfo },
];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<OnboardingFormData>({
    name: "",
    socialLinks: [],
    progress: 0,
    selectedArticles: [],
  });
  const [draftRestored, setDraftRestored] = useState(false);

  // ⚡ OPTIMIZED: Memoize handler to prevent re-creation
  const updateFormData = useCallback((data: Partial<OnboardingFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  }, []);

  // Callback for draft restoration
  const handleRestoreDraft = useCallback((restoredData: OnboardingFormData) => {
    setFormData(restoredData);
    setDraftRestored(true);
  }, []);

  // Auto-save hook
  const { saveStatus, hasDraft, clearDraft, lastSavedAt } =
    useOnboardingAutosave(formData, currentStep, {
      storageKey: "onboarding-draft-am-clients",
      debounceMs: 2000,
      onRestore: handleRestoreDraft,
    });

  // ⚡ OPTIMIZED: Memoize navigation handlers
  const nextStep = useCallback(() => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep]);

  const previousStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback((stepId: number) => {
    setCurrentStep(stepId);
  }, []);

  // ⚡ OPTIMIZED: Memoize component lookup (only recalculates when step changes)
  const CurrentStepComponent = useMemo(
    () => steps.find((step) => step.id === currentStep)?.component,
    [currentStep]
  );

  if (!CurrentStepComponent) {
    return <OnboardingFormSkeleton />;
  }

  return (
    <>
      {/* Auto-save Indicator */}
      <AutosaveIndicator
        status={saveStatus}
        hasDraft={hasDraft}
        lastSavedAt={lastSavedAt}
        onClearDraft={clearDraft}
      />

      <div className="min-h-screen bg-linear-to-br from-purple-50 via-pink-50 to-orange-50 py-12">
        <div>
          <StepIndicator
            steps={steps}
            currentStep={currentStep}
            onStepClick={goToStep}
          />
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8 md:p-12">
            {/* ⚡ OPTIMIZED: Suspense wrapper for lazy-loaded components with skeleton */}
            <Suspense fallback={
              <div className="space-y-6 animate-pulse py-8">
                {/* Form Fields Skeleton */}
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={`field-${index}`} className="space-y-2">
                    <div className="h-4 w-32 bg-gray-200 rounded" />
                    <div className="h-10 w-full bg-gray-200 rounded-md" />
                  </div>
                ))}
                {/* Buttons Skeleton */}
                <div className="flex justify-between pt-6">
                  <div className="h-11 w-32 bg-gray-200 rounded-md" />
                  <div className="flex gap-3">
                    <div className="h-11 w-28 bg-gray-200 rounded-md" />
                    <div className="h-11 w-28 bg-gray-200 rounded-md" />
                  </div>
                </div>
              </div>
            }>
              <CurrentStepComponent
                formData={formData}
                updateFormData={updateFormData}
                onNext={nextStep}
                onPrevious={previousStep}
                clearDraft={clearDraft}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </>
  );
}
