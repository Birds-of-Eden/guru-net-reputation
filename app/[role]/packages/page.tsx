// app/[role]/packages/page.tsx

import { PackageCards } from "@/components/package-cards";

export default function Home() {
  return (
    <div className="p-4">
      <PackageCards />
    </div>
  );
}
