//app/admin/clients/onboarding/page.tsx

"use client";

import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { OnboardingFormData } from "@/types/onboarding";
import { useOnboardingAutosave } from "@/hooks/use-onboarding-autosave";
import { AutosaveIndicator } from "@/components/onboarding/autosave-indicator";
import { StepIndicator } from "@/components/onboarding/step-indicator";

// ⚡ OPTIMIZED: Dynamic imports - Load components only when needed!
const AddClientAskPage = lazy(() => import("@/components/onboarding/AddClientAsk").then(m => ({ default: m.AddClientAskPage })));
const GeneralInfo = lazy(() => import("@/components/onboarding/general-info").then(m => ({ default: m.GeneralInfo })));
const WebsiteInfo = lazy(() => import("@/components/onboarding/website-info").then(m => ({ default: m.WebsiteInfo })));
const BiographyInfo = lazy(() => import("@/components/onboarding/biography-info").then(m => ({ default: m.BiographyInfo })));
const ImageGallery = lazy(() => import("@/components/onboarding/image-gallery").then(m => ({ default: m.ImageGallery })));
const SocialMediaInfo = lazy(() => import("@/components/onboarding/social-media-info").then(m => ({ default: m.SocialMediaInfo })));
const OtherInfo = lazy(() => import("@/components/onboarding/other-info").then(m => ({ default: m.OtherInfo })));
const PackageInfo = lazy(() => import("@/components/onboarding/package-info").then(m => ({ default: m.PackageInfo })));
const TemplateSelection = lazy(() => import("@/components/onboarding/template-selection").then(m => ({ default: m.TemplateSelection })));
const ArticlesSelection = lazy(() => import("@/components/onboarding/articles-selection").then(m => ({ default: m.ArticlesSelection })));
const ReviewInfo = lazy(() => import("@/components/onboarding/review-info").then(m => ({ default: m.ReviewInfo })));

const steps = [
  { id: 1, title: "Add Client", component: AddClientAskPage },
  { id: 2, title: "General Info", component: GeneralInfo },
  { id: 3, title: "Website Info", component: WebsiteInfo },
  { id: 4, title: "Biography", component: BiographyInfo },
  { id: 5, title: "Image Gallery", component: ImageGallery },
  { id: 6, title: "Social Media", component: SocialMediaInfo },
  { id: 7, title: "Other Info", component: OtherInfo },
  { id: 8, title: "Package", component: PackageInfo },
  { id: 9, title: "Template", component: TemplateSelection },
  { id: 10, title: "Articles", component: ArticlesSelection },
  { id: 11, title: "Review", component: ReviewInfo },
];

export default function OnboardingPage() {
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<OnboardingFormData>({
    name: "",
    progress: 0,
    socialLinks: [],
    selectedArticles: [],
  });
  const [draftRestored, setDraftRestored] = useState(false);

  // Auto-advance to step 2 if user is starting new client
  useEffect(() => {
    const startNew = searchParams.get("new");
    const startExisting = searchParams.get("existing");
    const clientDataParam = searchParams.get("clientData");

    if (startNew === "true") {
      setCurrentStep(2);
    } else if (startExisting === "true" && clientDataParam) {
      try {
        const clientData = JSON.parse(decodeURIComponent(clientDataParam));
        // Populate form with existing client data
        setFormData({
          name: clientData.name || "",
          company: clientData.company || "",
          designation: clientData.designation || "",
          location: clientData.location || "",
          websites: clientData.websites || [],
          biography: clientData.biography || "",
          companywebsite: clientData.companywebsite || "",
          companyaddress: clientData.companyaddress || "",
          email: clientData.email || "",
          phone: clientData.phone || "",
          birthdate: clientData.birthdate || "",
          status: clientData.status || "",
          packageId: clientData.packageId || "",
          socialLinks: clientData.socialLinks || [],
          imageDrivelink: clientData.imageDrivelink || "",
          amId: clientData.amId || "",
          startDate: clientData.startDate || "",
          dueDate: clientData.dueDate || "",
          progress: 0,
          selectedArticles: [],
          clientId: clientData.id,
        });
        setCurrentStep(2);
      } catch (error) {
        console.error("Error parsing client data:", error);
        setCurrentStep(2); // Still advance to step 2 even if parsing fails
      }
    }
  }, [searchParams]);

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
  const { saveStatus, hasDraft, clearDraft, lastSavedAt } = useOnboardingAutosave(
    formData,
    currentStep,
    {
      storageKey: "onboarding-draft-clients",
      debounceMs: 2000,
      onRestore: handleRestoreDraft,
    }
  );

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
    return <div>Step not found</div>;
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

      <div className="min-h-screen relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50">
        {/* Animated Gradient Orbs */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-violet-400/30 to-purple-400/30 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-br from-fuchsia-400/30 to-pink-400/30 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "2s" }}
        />

        {/* Grid Pattern Overlay */}
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      </div>

      {/* Content Container */}
      <div className="relative z-10">
        <div className="mt-8">
          <StepIndicator
            steps={steps}
            currentStep={currentStep}
            onStepClick={goToStep}
          />

          {/* Main Content Card */}
          <div className="relative">
            {/* Card Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 via-purple-500/20 to-fuchsia-500/20 rounded-3xl blur-2xl" />

            {/* Actual Card */}
            <div className="relative bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-6 sm:p-8 md:p-12 lg:p-16 animate-in fade-in slide-in-from-bottom duration-700">
              {/* Decorative Corner Elements */}
              <div className="absolute top-0 left-0 w-20 h-20 bg-gradient-to-br from-violet-500/10 to-transparent rounded-tl-3xl" />
              <div className="absolute bottom-0 right-0 w-20 h-20 bg-gradient-to-tl from-fuchsia-500/10 to-transparent rounded-br-3xl" />

              {/* ⚡ OPTIMIZED: Suspense wrapper for lazy-loaded components */}
              <Suspense fallback={
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-violet-600" />
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
      </div>

      <style jsx global>{`
        .bg-grid-pattern {
          background-image: linear-gradient(
              to right,
              rgba(139, 92, 246, 0.1) 1px,
              transparent 1px
            ),
            linear-gradient(
              to bottom,
              rgba(139, 92, 246, 0.1) 1px,
              transparent 1px
            );
          background-size: 40px 40px;
        }
      `}</style>
      </div>
    </>
  );
}
