/**
 * Review Centre V2 — customer-facing campaign review after generation.
 */

export const REVIEW_CENTRE_VERSION = 1;

export type ReviewCentreGroupId =
  | "service-page"
  | "local-pages"
  | "patient-guide"
  | "faqs"
  | "blogs"
  | "gbp-posts"
  | "social-posts"
  | "emails"
  | "images";

export type ReviewCentreAssetStatus = "ready" | "approved" | "needs-improvement";

export interface ReviewCentreGroupDef {
  id: ReviewCentreGroupId;
  label: string;
}

export const REVIEW_CENTRE_GROUPS: ReviewCentreGroupDef[] = [
  { id: "service-page", label: "Service Page" },
  { id: "local-pages", label: "Local Pages" },
  { id: "patient-guide", label: "Patient Guide" },
  { id: "faqs", label: "FAQs" },
  { id: "blogs", label: "Blogs" },
  { id: "gbp-posts", label: "GBP Posts" },
  { id: "social-posts", label: "Social Posts" },
  { id: "emails", label: "Emails" },
  { id: "images", label: "Images" },
];

export const REVIEW_CENTRE_ASSET_TYPE_TO_GROUP: Record<string, ReviewCentreGroupId> = {
  "service-page": "service-page",
  "local-area-pages": "local-pages",
  guides: "patient-guide",
  faq: "faqs",
  blog: "blogs",
  gbp: "gbp-posts",
  social: "social-posts",
  email: "emails",
  images: "images",
};

export const REVIEW_CENTRE_CUSTOMER_TYPE_LABELS: Record<string, string> = {
  "service-page": "Service Page",
  "local-area-pages": "Local Pages",
  guides: "Patient Guide",
  faq: "FAQs",
  blog: "Blog",
  gbp: "Google Business Profile Post",
  social: "Social Post",
  email: "Email",
  images: "Image",
};

export function reviewCentreStatusLabel(status: ReviewCentreAssetStatus): string {
  if (status === "approved") return "Approved";
  if (status === "needs-improvement") return "Needs Improvement";
  return "Ready for Review";
}

export interface ReviewCentreAsset {
  key: string;
  title: string;
  summary: string;
  typeLabel: string;
  groupId: ReviewCentreGroupId;
  groupLabel: string;
  status: ReviewCentreAssetStatus;
  statusLabel: string;
  previewUrl: string | null;
  count: number;
  improveMessage: string | null;
  commercialService?: string | null;
  whyRecommended?: string | null;
  evidenceSource?: string | null;
  priority?: string | null;
  generationStatus?: string | null;
  reviewStatus?: string | null;
  published?: boolean;
  indexed?: boolean;
  gapId?: string | null;
  recommendationId?: string | null;
  provenance?: string | null;
  evidence?: string[];
  customerIntent?: string | null;
  targetAudience?: string | null;
  contentAction?: string | null;
  existingPageUrl?: string | null;
  reasonForCreation?: string | null;
  confidence?: string | null;
}

export interface ReviewCentreGroup {
  id: ReviewCentreGroupId;
  label: string;
  assets: ReviewCentreAsset[];
}

export interface ReviewCentreNextAction {
  title: string;
  detail: string;
}

export interface ReviewCentreView {
  slug: string;
  campaignId: string;
  campaignName: string;
  totalAssets: number;
  approvedCount: number;
  needsImprovementCount: number;
  readyCount: number;
  generated: boolean;
  allApproved: boolean;
  canPublish: boolean;
  nextAction: ReviewCentreNextAction;
  groups: ReviewCentreGroup[];
  publishUrl: string;
  published: boolean;
  indexed: boolean;
  readyForReview: boolean;
}

export interface ReviewCentreCampaignState {
  improvements: Record<string, string>;
}

export interface ReviewCentreSession {
  version: number;
  slug: string;
  updatedAt: string;
  campaigns: Record<string, ReviewCentreCampaignState>;
}

export const REVIEW_CENTRE_IMPROVE_MESSAGE = "We'll improve this before publishing.";
