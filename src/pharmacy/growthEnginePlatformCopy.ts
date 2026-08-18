/**
 * Shared Growth Engine copy for LOCAL vs NATIONAL product mode.
 * Do not globally rename "pharmacy". PharmaConnect serves pharmacies;
 * it is not itself a pharmacy.
 */
import type { GrowthPlatform } from "./commercialMarketContextService.ts";
import { resolveGrowthPlatform } from "./growthPlatformResolverService.ts";

export interface GrowthEnginePlatformCopy {
  platform: GrowthPlatform;
  programmeLabel: string;
  hubTitle: string;
  hubLead: string;
  businessStepTitle: string;
  businessStepSubtitle: string;
  marketStepTitle: string;
  marketStepSubtitle: string;
  websiteStepTitle: string;
  websiteStepSubtitle: string;
  planStepTitle: string;
  planStepSubtitle: string;
  generateStepTitle: string;
  generateStepSubtitle: string;
  dashboardStepTitle: string;
  stepperAriaLabel: string;
  readinessBusiness: string;
  readinessWebsite: string;
  readinessMarket: string;
  readinessIntelligence: string;
  readinessGenerator: string;
  evidencePharmacyProfile: string;
  emptyCampaignNote: string;
  generateCta: string;
}

const LOCAL_COPY: GrowthEnginePlatformCopy = {
  platform: "local",
  programmeLabel: "Your pharmacy programme",
  hubTitle: "Your Pharmacy Programme",
  hubLead: "Four commercial reports tell you where you stand, how you compare, what is missing, and what to do next — then create and publish your campaign.",
  businessStepTitle: "Your Pharmacy",
  businessStepSubtitle: "Import from your website and Google — confirm what we found",
  marketStepTitle: "Your Local Market",
  marketStepSubtitle: "See how you compare to nearby pharmacies",
  websiteStepTitle: "Your Website Report",
  websiteStepSubtitle: "What your website contains and what is missing",
  planStepTitle: "Your Growth Plan",
  planStepSubtitle: "One evidence-backed campaign recommendation",
  generateStepTitle: "Create Content",
  generateStepSubtitle: "Build your campaign pages and supporting content",
  dashboardStepTitle: "Your Dashboard",
  stepperAriaLabel: "Pharmacy growth reports",
  readinessBusiness: "Your Pharmacy complete",
  readinessWebsite: "Your Website Report complete",
  readinessMarket: "Your Local Market complete",
  readinessIntelligence: "Evidence reviewed",
  readinessGenerator: "Content creation ready",
  evidencePharmacyProfile: "your pharmacy profile",
  emptyCampaignNote:
    "No evidence-backed campaign is available yet. Complete Your Pharmacy, Your Local Market, and Your Website Report to unlock a recommendation.",
  generateCta: "Open Campaign Builder →",
};

const NATIONAL_COPY: GrowthEnginePlatformCopy = {
  platform: "national",
  programmeLabel: "National digital-growth programme",
  hubTitle: "National Digital Growth Programme",
  hubLead: "National market intelligence for a digital-growth business serving UK community pharmacies — not a local pharmacy workflow.",
  businessStepTitle: "Your Business",
  businessStepSubtitle: "National digital-growth identity and commercial services",
  marketStepTitle: "National Market",
  marketStepSubtitle: "Organic ranking keywords and search competitors — local Google Places is not applicable",
  websiteStepTitle: "Your Website Report",
  websiteStepSubtitle: "What your website contains and what is missing",
  planStepTitle: "Your Growth Plan",
  planStepSubtitle: "Evidence-backed national commercial recommendation",
  generateStepTitle: "Create Content",
  generateStepSubtitle: "Create approved Growth Plan drafts for review — patient-service Campaign Builder is not used",
  dashboardStepTitle: "Your Dashboard",
  stepperAriaLabel: "National digital-growth reports",
  readinessBusiness: "National business identity confirmed",
  readinessWebsite: "Website report available",
  readinessMarket: "National market intelligence (Google Places not required)",
  readinessIntelligence: "National commercial intelligence loaded",
  readinessGenerator: "Approved Growth Plan content",
  evidencePharmacyProfile: "your national commercial profile",
  emptyCampaignNote:
    "No eligible national commercial action is available in persisted Growth Plan Intelligence. Local pharmacy prerequisites are not required.",
  generateCta: "Create approved content →",
};

export function growthEnginePlatformCopy(slugOrPlatform: string | GrowthPlatform): GrowthEnginePlatformCopy {
  const platform =
    slugOrPlatform === "national" || slugOrPlatform === "local"
      ? slugOrPlatform
      : resolveGrowthPlatform(slugOrPlatform).platform;
  return platform === "national" ? NATIONAL_COPY : LOCAL_COPY;
}

export function customerReadinessLabelForPlatform(platform: GrowthPlatform, label: string): string {
  const copy = growthEnginePlatformCopy(platform);
  const map: Record<string, string> = {
    "Business Profile complete": copy.readinessBusiness,
    "Website analysed": copy.readinessWebsite,
    "Local Healthcare analysed": copy.readinessMarket,
    "National market intelligence": copy.readinessMarket,
    "Growth Intelligence complete": copy.readinessIntelligence,
    "National commercial intelligence": copy.readinessIntelligence,
    "Generator available": copy.readinessGenerator,
    "National content generation": copy.readinessGenerator,
  };
  if (map[label]) return map[label];
  if (platform === "local") {
    return label.replace(/generator/gi, "content creation").replace(/registry/gi, "page tracker");
  }
  return label;
}
