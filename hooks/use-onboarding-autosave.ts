import { useEffect, useRef, useState, useCallback } from "react";
import type { OnboardingFormData } from "@/types/onboarding";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

interface UseOnboardingAutosaveOptions {
  storageKey: string;
  debounceMs?: number;
  onRestore?: (data: OnboardingFormData) => void;
}

interface AutosaveReturn {
  saveStatus: AutoSaveStatus;
  hasDraft: boolean;
  clearDraft: () => void;
  manualSave: () => void;
  lastSavedAt: Date | null;
}

/**
 * Custom hook for auto-saving onboarding form data to localStorage
 * with debouncing, draft restoration, and status tracking
 */
export function useOnboardingAutosave(
  formData: OnboardingFormData,
  currentStep: number,
  options: UseOnboardingAutosaveOptions
): AutosaveReturn {
  const { storageKey, debounceMs = 2000, onRestore } = options;
  
  const [saveStatus, setSaveStatus] = useState<AutoSaveStatus>("idle");
  const [hasDraft, setHasDraft] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const isRestoringRef = useRef(false);

  // Check for existing draft on mount
  useEffect(() => {
    const checkDraft = () => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          setHasDraft(true);
          const parsed = JSON.parse(saved);
          
          // Restore draft if callback provided and not already restoring
          if (onRestore && !isRestoringRef.current) {
            isRestoringRef.current = true;
            
            // Convert base64 back to File if profile picture was saved
            if (parsed.formData?.profilePictureBase64) {
              try {
                const { data, name, type } = parsed.formData.profilePictureBase64;
                const byteString = atob(data.split(',')[1]);
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) {
                  ia[i] = byteString.charCodeAt(i);
                }
                const blob = new Blob([ab], { type });
                const file = new File([blob], name, { type });
                parsed.formData.profilePicture = file;
              } catch (err) {
                console.warn("Failed to restore profile picture:", err);
              }
              delete parsed.formData.profilePictureBase64;
            }
            
            onRestore(parsed.formData);
            
            // Update last saved timestamp
            if (parsed.timestamp) {
              setLastSavedAt(new Date(parsed.timestamp));
            }
          }
        }
      } catch (error) {
        console.error("Failed to check for draft:", error);
      }
    };
    
    checkDraft();
  }, [storageKey, onRestore]);

  const saveDraft = useCallback(() => {
    try {
      setSaveStatus("saving");
      
      // Clone formData to avoid mutations
      const dataToSave = { ...formData };
      
      // Handle File objects (profile picture)
      if (dataToSave.profilePicture instanceof File) {
        const file = dataToSave.profilePicture;
        const reader = new FileReader();
        
        reader.onload = () => {
          const base64 = reader.result as string;
          const saveData = {
            ...dataToSave,
            profilePictureBase64: {
              data: base64,
              name: file.name,
              type: file.type,
            },
          };
          delete saveData.profilePicture;
          
          const payload = {
            formData: saveData,
            currentStep,
            timestamp: new Date().toISOString(),
          };
          
          localStorage.setItem(storageKey, JSON.stringify(payload));
          setSaveStatus("saved");
          setHasDraft(true);
          setLastSavedAt(new Date());
          
          // Reset to idle after 2 seconds
          setTimeout(() => setSaveStatus("idle"), 2000);
        };
        
        reader.onerror = () => {
          throw new Error("Failed to read file");
        };
        
        reader.readAsDataURL(file);
      } else {
        // No file to handle, save directly
        const payload = {
          formData: dataToSave,
          currentStep,
          timestamp: new Date().toISOString(),
        };
        
        localStorage.setItem(storageKey, JSON.stringify(payload));
        setSaveStatus("saved");
        setHasDraft(true);
        setLastSavedAt(new Date());
        
        // Reset to idle after 2 seconds
        setTimeout(() => setSaveStatus("idle"), 2000);
      }
    } catch (error) {
      console.error("Failed to save draft:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }, [formData, currentStep, storageKey]);

  // Auto-save with debouncing
  useEffect(() => {
    // Don't auto-save during initial restore
    if (isRestoringRef.current) {
      isRestoringRef.current = false;
      return;
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for debounced save
    saveTimeoutRef.current = setTimeout(() => {
      saveDraft();
    }, debounceMs);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [formData, currentStep, debounceMs, saveDraft]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setHasDraft(false);
      setLastSavedAt(null);
      setSaveStatus("idle");
    } catch (error) {
      console.error("Failed to clear draft:", error);
    }
  }, [storageKey]);

  const manualSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveDraft();
  }, [saveDraft]);

  return {
    saveStatus,
    hasDraft,
    clearDraft,
    manualSave,
    lastSavedAt,
  };
}
