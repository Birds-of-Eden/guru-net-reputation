// components/onboarding/onboarding-form-skeleton.tsx

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function OnboardingFormSkeleton() {
  return (
    <div className="min-h-screen bg-linear-to-br from-purple-50 via-pink-50 to-orange-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Step Indicator Skeleton */}
        <Card className="mb-8 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={`step-${index}`} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <Skeleton className="h-10 w-10 rounded-full mb-2" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  {index < 4 && (
                    <Skeleton className="h-0.5 w-12 mx-2 mt-[-20px]" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Form Card Skeleton */}
        <Card className="shadow-2xl">
          <CardHeader className="bg-linear-to-r from-purple-600 to-pink-600 text-white p-6">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48 bg-white/20" />
              <Skeleton className="h-4 w-96 bg-white/20" />
            </div>
          </CardHeader>

          <CardContent className="p-8 space-y-6">
            {/* Form Fields Skeleton */}
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`field-${index}`} className="space-y-2">
                <Skeleton className="h-4 w-32" /> {/* Label */}
                <Skeleton className="h-10 w-full rounded-md" /> {/* Input */}
              </div>
            ))}

            {/* Textarea Field Skeleton */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" /> {/* Label */}
              <Skeleton className="h-32 w-full rounded-md" /> {/* Textarea */}
            </div>

            {/* Grid Fields Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={`grid-field-${index}`} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full rounded-md" />
                </div>
              ))}
            </div>

            {/* Action Buttons Skeleton */}
            <div className="flex justify-between pt-6 border-t">
              <Skeleton className="h-11 w-32 rounded-md" /> {/* Previous */}
              <div className="flex gap-3">
                <Skeleton className="h-11 w-28 rounded-md" /> {/* Save Draft */}
                <Skeleton className="h-11 w-28 rounded-md" /> {/* Next */}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Progress Bar Skeleton */}
        <div className="mt-6 space-y-2">
          <div className="flex justify-between items-center">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}
