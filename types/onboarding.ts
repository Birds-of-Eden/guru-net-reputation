export interface OnboardingFormData {
  // Personal Information
  name: string;
  // Name related keywords (stored in User.user_field_06 as JSON)
  keywords?: string[];
  birthdate?: string;
  gender?: "male" | "female" | "other";
  location?: string;
  company?: string;
  designation?: string;
  companyaddress?: string;
  companywebsite?: string;
  status?: string;
  // Profile avatar URL
  avatar?: string;
  // AM assignment
  amId?: string;
  startDate?: string;
  dueDate?: string;
  profilePicture?: File;

  // Optional: reference to an existing client to fetch dynamic data (e.g., articleTopics)
  clientId?: string;

  // Contact Information
  email?: string;
  phone?: string;
  password?: string;
  recoveryEmail?: string;

  // Website Information
  websites?: string[];

  // Biography
  biography?: string;

  // Image Gallery (supports string drive link or JSON: { driveLink, items: [{ title, link }] })
  imageDrivelink?:
    | string
    | {
        driveLink?: string;
        items?: Array<{ title: string; link: string }>;
      }
    | Array<{ title: string; link: string }>;
  imageFolderId?: string;
  imageCount?: number;

  // Social Media
  socialLinks: Array<{
    platform: string;
    url: string;
    username?: string;
    email?: string;
    phone?: string;
    password?: string;
    notes?: string;
  }>;

  // Arbitrary additional info (will be saved to Client.otherField as JSON)
  // Multi-sheet spreadsheet structure with id, name, columns, rows
  otherField?: Array<{
    id: string; // Unique sheet identifier
    name: string; // Sheet name
    columns: string[]; // Column headers
    rows: string[][]; // 2D array of cell values
  }>;

  // Package & Template
  packageId?: string;
  templateId?: string; // ✅ Added templateId field

  // Progress
  progress: number;

  // UI state: selected article ids (indexes in dynamic list)
  selectedArticles: number[];

  // Locally managed article topics (for ArticlesSelection step)
  articleTopics?: ArticleTopic[];
  
  // New: Article categories with titles and drafts
  articleCategories?: ArticleCategory[];
}

// Shared type for article topics used in onboarding flows
export type ArticleTopic = {
  topicname: string;
  status?: string;
  usedDate?: string | null;
  usedCount?: number;
};

// New structure for article categories with titles and drafts
export type ArticleCategory = {
  category: string;
  titles: Array<{
    title: string;
    draftLink: string;
    draftStatus: "Approved" | "Pending" | "Revision";
    status?: string;
    usedCount?: number;
    usedDate?: string | null;
  }>;
};

export interface StepProps {
  formData: OnboardingFormData;
  updateFormData: (data: Partial<OnboardingFormData>) => void;
  onNext: () => void;
  onPrevious: () => void;
  clearDraft?: () => void;
}
