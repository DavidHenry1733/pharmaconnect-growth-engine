/**
 * DATAFORSEO-ORGANIC-EVIDENCE-CLASSIFICATION-FIX-02 validation.
 * Uses stored fixtures only — no live Google Places or DataForSEO calls.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import * as organicMod from "../src/pharmacy/organicSearchEvidenceClassificationService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FIXTURE_DIR = path.join(ROOT, "fixtures/organic-search-evidence");
const GOOGLE_FIXTURE_DIR = path.join(ROOT, "fixtures/google-local-competitor-metrics");
const INTEL_DIR = path.join(ROOT, "data/pharmacy-competitor-intelligence");
const GROWTH_DIR = path.join(ROOT, "data/growth-engine");
const DISCOVERY_DIR = path.join(ROOT, "data/national-growth-engine");
const PROFILE_DIR = path.join(ROOT, "data/pharmacy-profiles");

type Step = { name: string; passed: boolean; detail?: string };
const steps: Step[] = [];

function record(name: string, passed: boolean, detail?: string): void {
  steps.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function hashFile(file: string): string {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function existingGeneratedEvidence(): string[] {
  const files: string[] = [];
  for (const dir of [INTEL_DIR, GROWTH_DIR, DISCOVERY_DIR, PROFILE_DIR]) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      files.push(path.join(dir, name));
    }
  }
  return files.sort();
}

function ownProfile(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    pharmacyName: "Fixture Town Pharmacy",
    website: "https://www.fixture-town.example",
    googlePlaceId: "ChIJ-fixture-own",
    googleBusinessRating: 4.2,
    googleBusinessReviewCount: 41,
    googleProfileOnboardingState: "configured",
    googleImportSnapshot: {
      status: "imported",
      importedAt: "2026-08-20T09:00:00.000Z",
      message: "Imported",
      googleBusinessUrl: "https://maps.google.com/?cid=1",
      searchPharmacyName: "Fixture Town Pharmacy",
      searchTown: "Fixture Town",
      searchPostcode: "S70 1AA",
      placeId: "ChIJ-fixture-own",
      businessName: "Fixture Town Pharmacy",
      address: "1 High Street, Fixture Town",
      town: "Fixture Town",
      postcode: "S70 1AA",
      phone: "01226 000000",
      website: "https://www.fixture-town.example",
      rating: 4.2,
      reviewCount: 41,
      photoCount: 6,
      categories: ["Pharmacy", "Health"],
      openingHours: [],
      googleMapsUrl: "https://maps.google.com",
      latitude: 53.553,
      longitude: -1.479,
      candidates: [],
      nationalWebsiteDetected: false,
    },
    ...overrides,
  };
}

function writeProfile(slug: string, data: Record<string, unknown>): string {
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  const file = path.join(PROFILE_DIR, `${slug}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify({ slug, updatedAt: "2026-08-21T10:00:00.000Z", version: 5, data }, null, 2),
  );
  return file;
}

function cleanup(files: string[]): void {
  for (const file of files) {
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch {
      /* ignore */
    }
  }
}

function hostsOf(rows: Array<{ host?: string; domain?: string; url?: string }>): string[] {
  return rows.map((row) => String(row.host || row.domain || row.url || "").toLowerCase());
}

async function main() {
  const organic = (organicMod as { default?: typeof organicMod }).default ?? organicMod;
  record(
    "classifier namespace exports builder",
    typeof organic.buildOrganicSearchEvidenceSection === "function" &&
      typeof organic.canonicalHostname === "function" &&
      typeof organic.domainsEquivalent === "function",
    Object.keys(organic).join(",") || "none",
  );
  const {
    ORGANIC_SEARCH_EVIDENCE_TITLE,
    ORGANIC_SEARCH_EVIDENCE_EXPLANATION,
    YOUR_PHARMACY_VISIBILITY_LABEL,
    VERIFIED_LOCAL_MATCH_LABEL,
    WIDER_LANDSCAPE_LABEL,
    canonicalHostname,
    domainsEquivalent,
    classifyWiderLandscapeKind,
    buildOrganicSearchEvidenceSection,
  } = organic;

  const dashboardSrc = fs.readFileSync(
    path.join(ROOT, "src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts"),
    "utf8",
  );
  const classifierSrc = fs.readFileSync(
    path.join(ROOT, "src/pharmacy/organicSearchEvidenceClassificationService.ts"),
    "utf8",
  );
  const metricsSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/googleLocalCompetitorMetricsService.ts"), "utf8");
  const pageSrc = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/masterAdminPlatformPage.ts"), "utf8");
  const workflowSrc = fs.readFileSync(
    path.join(ROOT, "src/pharmacy/masterAdminCommercialIntelligenceWorkflowService.ts"),
    "utf8",
  );

  record(
    "1. Section is named Organic Search Evidence — DataForSEO",
    ORGANIC_SEARCH_EVIDENCE_TITLE === "Organic Search Evidence — DataForSEO" &&
      pageSrc.includes("Organic Search Evidence — DataForSEO") &&
      !pageSrc.includes("DataForSEO organic-search competitors") &&
      !dashboardSrc.includes("DataForSEO organic-search competitors") &&
      !classifierSrc.includes("DataForSEO organic-search competitors"),
  );
  record(
    "UI explanation is present",
    ORGANIC_SEARCH_EVIDENCE_EXPLANATION.includes(
      "Only businesses independently verified through Google Places are treated as nearby local competitors.",
    ) && pageSrc.includes("ciOrganicEvidenceHtml") && pageSrc.includes("Your Pharmacy") &&
      pageSrc.includes("Verified Local Competitor Matches") &&
      pageSrc.includes("Wider Organic Landscape"),
  );
  record(
    "2. Google Places remains the only canonical local competitor source",
    classifierSrc.includes("loadCompetitorIntelligence") &&
      classifierSrc.includes("loadCompetitorSnapshot") &&
      !/from ["'].*dataForSeo/i.test(classifierSrc) &&
      !/from ["'].*dataForSeo/i.test(metricsSrc) &&
      dashboardSrc.includes("buildGoogleLocalProfileMetrics") &&
      dashboardSrc.includes("buildOrganicSearchEvidenceSection") &&
      /organicSearchEvidence/.test(dashboardSrc) &&
      !/organicSearchCompetitors/.test(dashboardSrc) &&
      pageSrc.includes("organicHtml") &&
      /execHtml\+metricsHtml\+gapHtml\+providerHtml\+compHtml\+organicHtml\+trafficHtml/.test(pageSrc) &&
      !pageSrc.includes("dashboard.organicSearchCompetitors") &&
      !pageSrc.includes("DataForSEO organic-search competitors"),
  );
  record(
    "Organic evidence is not imported by workflow completion",
    !/organicSearchEvidenceClassificationService/.test(workflowSrc) &&
      !/buildOrganicSearchEvidenceSection/.test(workflowSrc),
  );
  record(
    "19. No Yorkshire-specific production logic",
    !/yorkshire-pharmacy-and-health-clinic/i.test(dashboardSrc) &&
      !/yorkshire-pharmacy-and-health-clinic/i.test(classifierSrc) &&
      !/yorkshire-pharmacy-and-health-clinic/i.test(metricsSrc) &&
      !/yorkshire-pharmacy-and-health-clinic/i.test(pageSrc),
  );
  record(
    "Classifier does not call DataForSEO or Google adapters",
    !/dataForSeoNationalSearchAdapter/.test(classifierSrc) &&
      !/searchNationalGoogleOrganic/.test(classifierSrc) &&
      !/discoverLocalMarketCompetitors/.test(classifierSrc) &&
      !/runCompetitorIntelligencePipeline/.test(classifierSrc),
  );

  record(
    "12. Protocol/www/path/query/fragment normalisation",
    canonicalHostname("https://www.asda.com/stores/pharmacy?foo=1#reviews") === "asda.com" &&
      canonicalHostname("http://ASDA.com/") === "asda.com" &&
      canonicalHostname("asda.com/path") === "asda.com" &&
      domainsEquivalent("https://www.asda.com/stores/pharmacy?foo=1#reviews", "asda.com") &&
      domainsEquivalent("http://fixture-town.example/repeat-prescriptions", "https://www.fixture-town.example") &&
      domainsEquivalent("stores.asda.com", "www.asda.com") &&
      !domainsEquivalent("yell.com", "asda.com"),
  );

  const beforeEvidence = existingGeneratedEvidence();
  const beforeHashes = Object.fromEntries(beforeEvidence.map((f) => [f, hashFile(f)]));

  const created: string[] = [];
  try {
    const primarySlug = "organic-evidence-fixture-01";
    const otherSlug = "organic-evidence-fixture-02";
    const emptySlug = "organic-evidence-fixture-empty";

    fs.mkdirSync(INTEL_DIR, { recursive: true });
    fs.mkdirSync(GROWTH_DIR, { recursive: true });
    fs.mkdirSync(DISCOVERY_DIR, { recursive: true });

    const intel = readJson<Record<string, unknown>>(path.join(GOOGLE_FIXTURE_DIR, "intelligence-asda.json"));
    const snapshot = readJson<Record<string, unknown>>(path.join(GOOGLE_FIXTURE_DIR, "snapshot-other-tenant.json"));
    const discoveryPrimary = readJson<Record<string, unknown>>(path.join(FIXTURE_DIR, "discovery-primary.json"));
    const discoveryOther = readJson<Record<string, unknown>>(path.join(FIXTURE_DIR, "discovery-other-tenant.json"));

    const intelPath = path.join(INTEL_DIR, `${primarySlug}-intelligence.json`);
    const snapPath = path.join(GROWTH_DIR, `${otherSlug}-competitors.json`);
    const discoveryPath = path.join(DISCOVERY_DIR, `${primarySlug}-competitor-discovery.json`);
    const discoveryOtherPath = path.join(DISCOVERY_DIR, `${otherSlug}-competitor-discovery.json`);
    fs.writeFileSync(intelPath, JSON.stringify({ ...intel, slug: primarySlug }, null, 2));
    fs.writeFileSync(snapPath, JSON.stringify({ ...snapshot, slug: otherSlug }, null, 2));
    fs.writeFileSync(discoveryPath, JSON.stringify(discoveryPrimary, null, 2));
    fs.writeFileSync(discoveryOtherPath, JSON.stringify(discoveryOther, null, 2));
    created.push(
      intelPath,
      snapPath,
      discoveryPath,
      discoveryOtherPath,
      writeProfile(primarySlug, ownProfile()),
      writeProfile(otherSlug, ownProfile({
        pharmacyName: "Second Tenant Pharmacy",
        website: "https://second-tenant.example",
        googleImportSnapshot: {
          ...(ownProfile().googleImportSnapshot as Record<string, unknown>),
          website: "https://second-tenant.example",
          businessName: "Second Tenant Pharmacy",
        },
      })),
      writeProfile(emptySlug, ownProfile({ website: "https://empty-tenant.example" })),
    );

    const section = buildOrganicSearchEvidenceSection(primarySlug, ownProfile() as never);
    record("Section title on stored fixture", section.title === "Organic Search Evidence — DataForSEO");
    record(
      "Section explanation on stored fixture",
      section.explanation === ORGANIC_SEARCH_EVIDENCE_EXPLANATION,
    );
    record("Your Pharmacy subsection label", section.yourPharmacy.label === YOUR_PHARMACY_VISIBILITY_LABEL);
    record("Verified match subsection label", section.verifiedLocalMatches.label === VERIFIED_LOCAL_MATCH_LABEL);
    record("Wider landscape subsection label", section.widerLandscape.label === WIDER_LANDSCAPE_LABEL);

    record(
      "3. Tenant-domain results appear under Your Pharmacy",
      section.yourPharmacy.rows.length === 2 &&
        section.yourPharmacy.rows.every((row) => row.classification === "your_pharmacy") &&
        section.yourPharmacy.rows.every((row) => /fixture-town\.example$/.test(row.host)) &&
        section.yourPharmacy.rows.every((row) => /not a competitor/i.test(row.classificationReason)),
      `count=${section.yourPharmacy.rows.length}`,
    );
    record(
      "11. Tenant’s own domain is never called a competitor",
      !section.verifiedLocalMatches.rows.some((row) => /fixture-town\.example/.test(row.host)) &&
        !section.widerLandscape.rows.some((row) => /fixture-town\.example/.test(row.host)) &&
        section.yourPharmacy.rows.every((row) => row.classification !== "verified_local_match"),
    );

    const asdaRows = section.verifiedLocalMatches.rows.filter((row) => row.host === "asda.com" || row.host.endsWith(".asda.com"));
    const highStreet = section.verifiedLocalMatches.rows.find((row) => row.host === "example-highstreet.example");
    record(
      "4. Exact canonical-domain matches to Google competitors appear under Verified Local Competitor Matches",
      asdaRows.length === 2 && Boolean(highStreet) &&
        section.verifiedLocalMatches.rows.every((row) => row.classification === "verified_local_match"),
      `verified=${section.verifiedLocalMatches.rows.length}`,
    );
    record(
      "5. Matched rows show the verified Google business name",
      asdaRows.every((row) => row.matchedGoogleCompetitorName === "ASDA Pharmacy") &&
        highStreet?.matchedGoogleCompetitorName === "High Street Pharmacy" &&
        asdaRows.every((row) => /ASDA Pharmacy/.test(row.classificationReason)),
    );

    const widerHosts = hostsOf(section.widerLandscape.rows);
    record(
      "6. Directories appear under Wider Organic Landscape",
      section.widerLandscape.rows.some((row) => row.host === "yell.com" && row.landscapeKind === "directory"),
    );
    record(
      "7. Regulators appear under Wider Organic Landscape",
      section.widerLandscape.rows.some((row) => row.host === "pharmacyregulation.org" && row.landscapeKind === "regulator") &&
        section.widerLandscape.rows.some((row) => row.host === "gov.uk" && row.landscapeKind === "regulator"),
    );
    record(
      "8. Social pages appear under Wider Organic Landscape",
      section.widerLandscape.rows.some((row) => row.host === "facebook.com" && row.landscapeKind === "social"),
    );
    record(
      "9. Community/NHS/publisher results appear under Wider Organic Landscape",
      section.widerLandscape.rows.some((row) => row.host === "nhs.uk" && row.landscapeKind === "nhs_community") &&
        section.widerLandscape.rows.some((row) => row.host.endsWith("wikipedia.org") && row.landscapeKind === "publisher"),
    );
    const unmatched = section.widerLandscape.rows.find((row) => row.host === "unmatched-chemist.example");
    record(
      "10. Unmatched pharmacy domains are not called nearby competitors",
      Boolean(unmatched) &&
        unmatched?.classification === "wider_landscape" &&
        unmatched?.landscapeKind === "unmatched_pharmacy_website" &&
        /not a nearby physical competitor/i.test(unmatched?.classificationReason || "") &&
        unmatched?.matchedGoogleCompetitorName == null &&
        !widerHosts.some((host) => host.includes("fixture-town.example")),
    );
    record(
      "Directories/regulators/social are not verified local matches",
      !section.verifiedLocalMatches.rows.some((row) =>
        ["yell.com", "pharmacyregulation.org", "facebook.com", "nhs.uk", "gov.uk"].includes(row.host),
      ),
    );

    const asdaStored = section.verifiedLocalMatches.rows.find((row) => row.url.includes("asda.com/stores/pharmacy"));
    record(
      "13. DataForSEO evidence fields and provenance remain intact",
      asdaStored?.position === 1 &&
        asdaStored?.matchedQuery === "pharmacy fixture town" &&
        asdaStored?.url === "https://www.asda.com/stores/pharmacy?foo=1#reviews" &&
        asdaStored?.title === "ASDA Pharmacy Fixture Town" &&
        asdaStored?.description === "ASDA Pharmacy opening times and services." &&
        asdaStored?.source === "dataforseo-google-organic-live" &&
        asdaStored?.capturedAt === "2026-08-21T10:00:00.000Z" &&
        asdaStored?.taskId === "task-organic-fixture-1" &&
        asdaStored?.evidence === "DataForSEO Google organic SERP",
    );
    record(
      "Every row has a classification reason",
      [...section.yourPharmacy.rows, ...section.verifiedLocalMatches.rows, ...section.widerLandscape.rows].every(
        (row) => Boolean(row.classificationReason),
      ),
    );

    const emptySection = buildOrganicSearchEvidenceSection(emptySlug, ownProfile({ website: "https://empty-tenant.example" }) as never);
    record(
      "Empty subsections show accurate empty states",
      emptySection.generated === false &&
        emptySection.yourPharmacy.rows.length === 0 &&
        emptySection.verifiedLocalMatches.rows.length === 0 &&
        emptySection.widerLandscape.rows.length === 0 &&
        /tenant/.test(emptySection.yourPharmacy.emptyState) &&
        /Google Places/.test(emptySection.verifiedLocalMatches.emptyState) &&
        /No additional organic-search results/.test(emptySection.widerLandscape.emptyState),
    );

    record(
      "Landscape kind helper classifies social/directory/regulator",
      classifyWiderLandscapeKind("facebook.com", "", "") === "social" &&
        classifyWiderLandscapeKind("yell.com", "Pharmacy", "") === "directory" &&
        classifyWiderLandscapeKind("pharmacyregulation.org", "", "") === "regulator",
    );

    const { buildCommercialIntelligenceDashboard } = await import(
      "../src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts"
    );
    const dash = buildCommercialIntelligenceDashboard(primarySlug);
    const asdaRow = dash.competitorAnalysis.competitors.find((c) => c.name === "ASDA Pharmacy");
    const dashRating = dash.googleProfileMetrics.find((m) => m.id === "rating");
    const dashReviews = dash.googleProfileMetrics.find((m) => m.id === "reviews");
    const organicDash = dash.organicSearchEvidence;
    const googleNames = dash.competitorAnalysis.competitors.map((c) => c.name);

    record("14. Google competitor table remains unchanged", Boolean(asdaRow) && asdaRow?.rating.includes("3.1") && asdaRow?.reviews === "87" && Boolean(asdaRow?.distance.includes("7") && asdaRow?.address && asdaRow?.phone && asdaRow?.website));
    record(
      "Google table is not fed DataForSEO landscape domains",
      !googleNames.some((name) => /yell|facebook|wikipedia|gphc|nhs/i.test(name)) &&
        googleNames.includes("ASDA Pharmacy") &&
        googleNames.includes("High Street Pharmacy"),
    );
    record(
      "15. Google Profile Metrics remain unchanged",
      dash.sectionEvidence.googleProfileMetrics.evidenceSource === "google-places-live" &&
        dashRating?.sampleSize === 2 &&
        dashRating?.highestCompetitor === "4.6" &&
        dashReviews?.highestCompetitor === "140",
      dashRating?.localAverage,
    );
    record(
      "16. Gap Analysis remains unchanged",
      dash.googleProfileMetrics.every((m) => typeof m.gap === "string" && typeof m.opportunity === "string") &&
        dash.googleProfileMetrics.find((m) => m.id === "photos")?.gap === "Not Available" &&
        !JSON.stringify(dash.googleProfileMetrics).toLowerCase().includes("dataforseo"),
    );
    record(
      "17. Workflow completion remains unchanged",
      dash.generated === false &&
        dash.approved === false &&
        dash.canApprove === false &&
        dash.status === "pending_generation",
    );
    record(
      "Dashboard organic evidence uses classified buckets",
      organicDash.title === ORGANIC_SEARCH_EVIDENCE_TITLE &&
        organicDash.yourPharmacy.rows.length === 2 &&
        organicDash.verifiedLocalMatches.rows.some((row) => row.matchedGoogleCompetitorName === "ASDA Pharmacy") &&
        organicDash.widerLandscape.rows.some((row) => row.host === "yell.com"),
    );
    record(
      "Organic evidence is not a second local competitor summary",
      !pageSrc.includes("ciOrganic") ||
        (!/strongest local competitor/i.test(pageSrc.slice(pageSrc.indexOf("ciOrganicEvidenceHtml"))) &&
          pageSrc.includes("ciOrganicBucket('Your Pharmacy'") &&
          pageSrc.includes("ciOrganicBucket('Verified Local Competitor Matches'") &&
          pageSrc.includes("ciOrganicBucket('Wider Organic Landscape'")),
    );

    const otherDash = buildCommercialIntelligenceDashboard(otherSlug);
    record(
      "18. Another tenant remains compatible",
      otherDash.competitorAnalysis.competitors.some((c) => c.name === "Boots Pharmacy") &&
        otherDash.organicSearchEvidence.yourPharmacy.rows.some((row) => row.host === "second-tenant.example") &&
        otherDash.organicSearchEvidence.verifiedLocalMatches.rows.some(
          (row) => row.host === "boots.com" && row.matchedGoogleCompetitorName === "Boots Pharmacy",
        ) &&
        otherDash.organicSearchEvidence.widerLandscape.rows.some((row) => row.landscapeKind === "social") &&
        otherDash.googleProfileMetrics.find((m) => m.id === "rating")?.highestCompetitor === "4.2",
    );
    record(
      "Second tenant tenant-domain is not labelled a competitor",
      !otherDash.organicSearchEvidence.verifiedLocalMatches.rows.some((row) => row.host === "second-tenant.example") &&
        !otherDash.organicSearchEvidence.widerLandscape.rows.some((row) => row.host === "second-tenant.example"),
    );
  } finally {
    cleanup(created);
  }

  const afterEvidence = existingGeneratedEvidence();
  const afterHashes = Object.fromEntries(afterEvidence.map((f) => [f, hashFile(f)]));
  record(
    "21. Live artifacts remain unchanged during validation",
    JSON.stringify(beforeHashes) === JSON.stringify(afterHashes) && beforeEvidence.join("|") === afterEvidence.join("|"),
  );
  record(
    "22. No external provider calls occur in this validator",
    !classifierSrc.includes("https://api.dataforseo.com") &&
      !classifierSrc.includes("maps.googleapis.com") &&
      !dashboardSrc.includes("https://api.dataforseo.com"),
  );

  const failed = steps.filter((s) => !s.passed);
  console.log(
    failed.length
      ? `\nDATAFORSEO-ORGANIC-EVIDENCE-CLASSIFICATION-FIX-02: FAIL (${failed.length})`
      : "\nDATAFORSEO-ORGANIC-EVIDENCE-CLASSIFICATION-FIX-02: PASS",
  );
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
