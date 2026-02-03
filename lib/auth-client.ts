// lib/auth-client.ts
import { signOut as nextSignOut } from "next-auth/react";

function sendActivityBeacon(payload: unknown) {
  try {
    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      const blob = new Blob([JSON.stringify(payload)], {
        type: "application/json",
      });
      return (navigator as any).sendBeacon("/api/activity", blob);
    }
  } catch {}
  return false;
}

export async function signOut() {
  // 1) Try non-blocking beacon first (redirect abort সমস্যা এড়াতে)
  const activityPayload = {
    entityType: "auth",
    entityId: "self",
    action: "sign_out" as const,
  };
  const sent = sendActivityBeacon(activityPayload);

  // 2) Fallback: keepalive fetch (await না করে fire-and-forget)
  if (!sent) {
    try {
      fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activityPayload),
        keepalive: true,
        cache: "no-store",
      }).catch(() => {});
    } catch {}
  }

  // 3) NextAuth signOut → server-side /api/auth/signout হিট হবে এবং রিডাইরেক্ট করবে
  await nextSignOut({ redirect: true, callbackUrl: "/auth/sign-in" });
  return true;
}

export const signUp = {
  email: async (
    userData: { name: string; email: string; password: string; role?: string },
    callbacks: {
      onRequest?: () => void;
      onSuccess?: () => void;
      onError?: (ctx: { error: { message: string } }) => void;
    }
  ) => {
    try {
      callbacks?.onRequest?.();
      
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Signup failed");
      }

      callbacks?.onSuccess?.();
    } catch (error) {
      callbacks?.onError?.({
        error: {
          message: error instanceof Error ? error.message : "An error occurred during signup",
        },
      });
    }
  },
};

export default { signOut, signUp };
