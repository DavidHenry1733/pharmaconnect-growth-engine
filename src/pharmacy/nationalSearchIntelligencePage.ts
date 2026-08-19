/**
 * NI-03C — Customer-facing National Search Intelligence page.
 * Read-only render. Collection is an explicit POST.
 */
import { buildGrowthEngineFramework } from "./growthEngineFrameworkService.ts";
import { growthEngineWorkflowCss, renderGrowthEngineNavBar } from "./growthEngineWorkflowNav.ts";
import { platformPlatformNavCss, renderPharmacyPlatformNavBar } from "./pharmacyPlatformNav.ts";
import { growthEnginePlatformCopy } from "./growthEnginePlatformCopy.ts";
import { isNationalGrowthPlatform } from "./growthPlatformResolverService.ts";
import {
  readNationalSearchIntelligence,
} from "./nationalSearchIntelligenceV1Service.ts";
import type {
  NationalCompetitorKeywordUniverse,
  NationalOrganicSearchCompetitor,
  NationalSearchIntelligenceSnapshot,
} from "./nationalSearchIntelligenceV1Model.ts";
import { PARTIAL_COLLECTION_CUSTOMER_MESSAGE } from "./nationalSearchIntelligenceV1Model.ts";
import { readCommercialCompetitorDiscovery, readFixtureCommercialDiscovery } from "./nationalCommercialCompetitorDiscoveryService.ts";
import { buildNationalBusinessIntelligenceView } from "./growthEngineNationalBusinessIntelligenceService.ts";
import type { NationalCompetitorDiscoveryCandidate, NationalCompetitorDiscoveryResult } from "./nationalCompetitorDiscoveryModel.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function fmt(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "—";
}

function money(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const amount = Number(value.toFixed(5)).toString();
  return `$${amount}`;
}

function costAmount(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return Number(value.toFixed(5)).toString();
}

function formatCollectedAt(iso: string | null | undefined): string {
  if (!iso) return "Not collected";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function displayEvidenceSource(snapshot: NationalSearchIntelligenceSnapshot): string {
  if (snapshot.status === "not_collected") return snapshot.provenance.evidenceSource;
  if (snapshot.authority === "FIXTURE_ONLY" || snapshot.provenance.evidenceSource === "FIXTURE") return "FIXTURE";
  if (snapshot.authority === "RECOVERED_EVIDENCE" || snapshot.provenance.evidenceSource === "RECOVERED") return "RECOVERED";
  if (
    snapshot.provenance.evidenceSource === "DATAFORSEO_LIVE"
    || snapshot.provenance.evidenceSource === "DATAFORSEO_PERSISTED"
  ) {
    return "DATAFORSEO_LIVE";
  }
  return snapshot.provenance.evidenceSource;
}

function evidenceSourceLabel(snapshot: NationalSearchIntelligenceSnapshot): string {
  const code = displayEvidenceSource(snapshot);
  if (code === "DATAFORSEO_LIVE") return "DataForSEO Live";
  if (code === "DATAFORSEO_PERSISTED") return "DataForSEO Live";
  if (code === "FIXTURE") return "Fixture";
  if (code === "RECOVERED") return "Recovered";
  if (code === "FALLBACK") return "Fallback";
  return code;
}

function authorityCode(snapshot: NationalSearchIntelligenceSnapshot): string {
  return snapshot.authority || "";
}

function authorityLabel(snapshot: NationalSearchIntelligenceSnapshot): string {
  if (snapshot.status === "not_collected") return "Not collected";
  if (snapshot.status === "error") return "Collection error";
  if (snapshot.authority === "FIXTURE_ONLY") return "Fixture only";
  if (snapshot.authority === "RECOVERED_EVIDENCE") return "Recovered evidence";
  if (snapshot.authority === "PERSISTED_PROVEN") return "Persisted Proven";
  if (snapshot.authority === "LIVE_PROVEN") return "Persisted Proven";
  if (snapshot.authority === "INSUFFICIENT_EVIDENCE") return "Insufficient evidence";
  return snapshot.authority;
}

function statusLabel(snapshot: NationalSearchIntelligenceSnapshot): string {
  if (snapshot.status === "collected") return "Collected";
  if (snapshot.status === "partial") return "Partial — collected with incomplete search-engine results";
  if (snapshot.status === "empty") return "Collected — no ranking keywords or search competitors returned";
  if (snapshot.status === "error") return "Collection failed";
  if (snapshot.status === "collecting") return "Collecting";
  return "Intelligence not collected";
}

function keywordTable(
  rows: Array<{
    keyword: string;
    position: number | null;
    searchVolume: number | null;
    cpc: number | null;
    rankingUrl: string | null;
  }>,
  emptyMessage: string,
): string {
  if (!rows.length) {
    return `<tr><td colspan="5">${esc(emptyMessage)}</td></tr>`;
  }
  return rows.map((row) => `<tr>
<td>${esc(row.keyword)}</td>
<td>${fmt(row.position)}</td>
<td>${fmt(row.searchVolume)}</td>
<td>${row.cpc == null ? "—" : row.cpc.toFixed(2)}</td>
<td>${row.rankingUrl ? `<a href="${esc(row.rankingUrl)}" rel="noreferrer">${esc(row.rankingUrl)}</a>` : "—"}</td>
</tr>`).join("");
}

function competitorCard(row: NationalOrganicSearchCompetitor): string {
  const overlap = row.sharedKeywordCount != null
    ? `${row.sharedKeywordCount} shared ranking keywords`
    : "Shared keyword overlap recorded";
  const traffic = row.organicEtv != null ? `Estimated organic traffic ${row.organicEtv}` : "Traffic estimate not returned";
  const commercial = row.role === "commercial_competitor" && row.eligibleForKeywordExpansion;
  const adjacent = row.role === "adjacent_commercial_provider";
  const distinction = commercial
    ? "This business competes for your customers."
    : adjacent
      ? "This business sells to the same customers, but not overlapping services."
      : "This domain competes in search.";
  const analysed = row.analysed ? "YES" : "NO";
  const expansion = row.eligibleForKeywordExpansion ? "YES" : "NO";
  const gate = row.commercialGate;
  const reason = row.nonSelectionReason
    || (row.qualificationEvidence || row.whyIdentified || []).join(" ")
    || "Organic overlap is SERP evidence only.";
  return `<article class="ge-competitor" data-ni03b-competitor="${esc(row.domain)}" data-ni03c-competitor="${esc(row.domain)}" data-ni03c1-role="${esc(row.role)}" data-ni03c1-eligible="${row.eligibleForKeywordExpansion ? "true" : "false"}" data-ni03c2-expansion="${row.eligibleForKeywordExpansion ? "true" : "false"}">
<div class="ge-competitor-head">
<div>
<p class="ge-competitor-name">${esc(row.name)}</p>
<p class="ge-meta">${esc(row.domain)} · ${esc(row.role.replace(/_/g, " "))} · ${esc(row.classification.replace(/_/g, " "))} · ${esc(row.qualification)}</p>
</div>
<span class="ge-pill">${esc(commercial ? "commercial competitor" : (row.role || "search competitor").replace(/_/g, " "))}</span>
</div>
<p style="font-size:13px;color:#334155;margin:0 0 8px">${esc(distinction)}</p>
<p class="ge-meta">Classification: ${esc(row.classification.replace(/_/g, " "))} · Qualification: ${esc(row.qualification)} · Selected for paid expansion: ${esc(expansion)}</p>
<p class="ge-meta">${esc(overlap)} · ${esc(traffic)} · Organic overlap is SERP evidence only.</p>
<p class="ge-meta">TENANT SERVICES: ${esc((gate?.tenantServices || []).join(", ") || "—")}</p>
<p class="ge-meta">CANDIDATE SERVICES DETECTED: ${esc((gate?.candidateServicesDetected || []).join(", ") || "—")}</p>
<p class="ge-meta">OVERLAPPING SERVICES: ${esc((gate?.overlappingServices || gate?.matchedServices || []).join(", ") || "—")}</p>
<p class="ge-meta">NON-OVERLAPPING SERVICES: ${esc((gate?.nonOverlappingServices || []).join(", ") || "—")}</p>
<p class="ge-meta">SERVICE_OVERLAP=${gate?.serviceOverlap ? "true" : "false"}</p>
<p class="ge-meta">Qualification evidence: ${esc((row.qualificationEvidence || row.whyIdentified || []).join(" "))}</p>
<p class="ge-meta">Keyword expansion: ${esc(row.eligibleForKeywordExpansion ? "eligible" : "not eligible")} · Analysed: ${esc(analysed)}${row.nonSelectionReason ? ` · ${esc(row.nonSelectionReason)}` : ""}</p>
<p class="ge-meta">Reason: ${esc(reason)}</p>
<p class="ge-meta">Evidence status: ${esc(row.evidenceSource)} · Verified: no · Source: Labs competitors domain</p>
</article>`;
}

function commercialDiscoveryCard(row: NationalCompetitorDiscoveryCandidate): string {
  const qualified = row.qualification === "qualified" && row.role === "commercial_competitor";
  const role = (row.role || "insufficient_evidence").replace(/_/g, " ");
  return `<article class="ge-competitor" data-cp02-candidate="${esc(row.domain)}" data-cp02-role="${esc(row.role || "")}" data-cp02-qualified="${qualified ? "yes" : "no"}">
<div class="ge-competitor-head">
<div>
<p class="ge-competitor-name">${esc(row.name)}</p>
<p class="ge-meta">${esc(row.domain)} · ${esc(role)} · ${esc(row.qualification)}</p>
</div>
<span class="ge-pill">${esc(qualified ? "direct commercial competitor" : role)}</span>
</div>
<p class="ge-meta">Classification: ${esc(role)}</p>
<p class="ge-meta">Discovery source: ${esc(row.source)} · ${esc(row.discoveryEvidence || row.sourceQuery || "—")}</p>
<p class="ge-meta">Discovery provenance: ${esc(row.source)}</p>
<p class="ge-meta">Target customer relevance: ${esc(row.targetMarketRelevance ? "YES" : "NO")}</p>
<p class="ge-meta">Commercial provider: ${esc(row.commercialProvider ? "YES" : "NO")}</p>
<p class="ge-meta">Detected commercial services: ${esc((row.detectedServices || []).join(", ") || "—")}</p>
<p class="ge-meta">Material overlapping services: ${esc((row.overlappingServices || []).join(", ") || "—")}</p>
<p class="ge-meta">Market relevance: ${esc(row.marketRelevance ? "YES" : "NO")}</p>
<p class="ge-meta">Qualification: ${esc(qualified ? "PASS" : "FAIL")}</p>
<p class="ge-meta">Why: ${esc(row.qualificationReason || row.qualificationReasons.join(" ") || "Commercial gate assessed.")}</p>
<p class="ge-meta">Discovered is not the same as commercially qualified.</p>
</article>`;
}

function groupedCandidateSections(candidates: NationalCompetitorDiscoveryCandidate[]): string {
  const direct = candidates.filter((row) => row.role === "commercial_competitor" && row.qualification === "qualified");
  const adjacent = candidates.filter((row) => row.role === "adjacent_commercial_provider");
  const rejected = candidates.filter((row) => !direct.includes(row) && !adjacent.includes(row));
  const section = (title: string, rows: NationalCompetitorDiscoveryCandidate[], attr: string) =>
    `<div data-cp02-group="${esc(attr)}"><h3>${esc(title)}</h3>${rows.length ? rows.map(commercialDiscoveryCard).join("") : `<p class="ge-lead">None.</p>`}</div>`;
  return `${section("Direct commercial competitors", direct, "direct")}${section("Adjacent commercial providers", adjacent, "adjacent")}${section("Rejected / SERP-only candidates", rejected, "rejected")}`;
}

function renderDiscoveryResultPanel(
  slug: string,
  result: NationalCompetitorDiscoveryResult | null,
  evidenceKind: "REAL_DISCOVERY" | "FIXTURE_VALIDATION",
): string {
  const bi = buildNationalBusinessIntelligenceView(slug);
  const candidates = result?.candidates || [];
  const direct = result?.directCommercialCompetitors ?? candidates.filter((row) => row.role === "commercial_competitor" && row.qualification === "qualified").length;
  const adjacent = result?.adjacentCommercialProviders ?? candidates.filter((row) => row.role === "adjacent_commercial_provider").length;
  const rejected = Math.max(0, candidates.length - direct - adjacent);
  const status = result?.status || "draft";
  const businessName = result?.businessName || bi.identity.businessName.value || "";
  const targetCustomer = result?.targetCustomerMarket || bi.targetCustomer.value || "";
  const marketCountry = result?.marketCountry || bi.marketCountry.value || "";
  const marketScope = result?.marketScope || bi.marketScope.value || "";
  const serviceList = result?.commercialServices?.length
    ? result.commercialServices
    : bi.services.map((row) => row.serviceName);
  const services = serviceList.join(" | ") || "—";
  const limitations = (result?.evidenceLimitations || []).join(" ");
  const kind = result?.evidenceKind || evidenceKind;
  const cards = candidates.length
    ? groupedCandidateSections(candidates)
    : `<p class="ge-lead">No commercial competitor candidates have been discovered yet. Discovery uses Business Intelligence services and market, not the tenant's organic ranking footprint alone.</p>`;
  const fixtureWarning = kind === "FIXTURE_VALIDATION"
    ? `<p class="ge-lead" data-cp02-fixture-warning="yes">FIXTURE_VALIDATION only. These domains are not real persisted competitors.</p>`
    : `<p class="ge-lead" data-cp02-real-warning="yes">REAL_DISCOVERY. Organic overlap is discovery evidence only.</p>`;
  return `<div class="ge-panel" data-cp02-page="commercial-competitor-discovery" data-cp02-evidence-kind="${esc(kind)}" data-cp02-status="${esc(status)}" data-cp02-candidates="${candidates.length}" data-cp02-direct="${direct}" data-cp02-adjacent="${adjacent}" data-cp02-rejected="${rejected}" data-cp02-ranked-keywords="${result?.rankedKeywordRequests ?? 0}">
<h2>${kind === "REAL_DISCOVERY" ? "Commercial competitor discovery" : "Fixture validation (not real discovery)"}</h2>
${fixtureWarning}
<p class="ge-lead">Which real businesses compete for substantially the same customers by selling materially overlapping commercial services? Organic keyword overlap is discovery evidence only and cannot pass this gate.</p>
<div class="ge-grid-2" data-cp02-section="summary">
<div class="ge-card"><h3>DISCOVERY STATUS</h3><p data-cp02-discovery-status="${esc(status)}">${esc(status.toUpperCase())}</p></div>
<div class="ge-card"><h3>Evidence kind</h3><p data-cp02-kind="${esc(kind)}">${esc(kind)}</p></div>
<div class="ge-card"><h3>Business</h3><p data-cp02-business="${esc(businessName)}">${esc(businessName || "Not discovered yet")}</p></div>
<div class="ge-card"><h3>Target customer</h3><p data-cp02-target-customer="${esc(targetCustomer)}">${esc(targetCustomer || "—")}</p></div>
<div class="ge-card"><h3>Market</h3><p data-cp02-market="${esc(marketCountry)}">${esc([marketCountry, marketScope].filter(Boolean).join(" · ") || "—")}</p></div>
<div class="ge-card"><h3>Commercial services</h3><p data-cp02-services="${esc(services)}">${esc(services)}</p></div>
<div class="ge-card"><h3>Candidates discovered</h3><p style="font-size:28px;font-weight:900;margin:0" data-cp02-candidate-count="${candidates.length}">${candidates.length}</p></div>
<div class="ge-card"><h3>Direct commercial competitors</h3><p style="font-size:28px;font-weight:900;margin:0" data-cp02-direct-count="${direct}">${direct}</p></div>
<div class="ge-card"><h3>Adjacent commercial providers</h3><p style="font-size:28px;font-weight:900;margin:0" data-cp02-adjacent-count="${adjacent}">${adjacent}</p></div>
<div class="ge-card"><h3>Rejected / non-competitors</h3><p style="font-size:28px;font-weight:900;margin:0" data-cp02-rejected-count="${rejected}">${rejected}</p></div>
<div class="ge-card"><h3>Evidence limitations</h3><p data-cp02-limitations="${esc(limitations)}">${esc(limitations || "None recorded.")}</p></div>
<div class="ge-card"><h3>Ranked-keyword expansion</h3><p data-cp02-ranked-keyword-requests="${result?.rankedKeywordRequests ?? 0}">COMPETITOR_RANKED_KEYWORD_REQUESTS=${result?.rankedKeywordRequests ?? 0}</p></div>
</div>
${direct === 0 && status === "complete" ? `<p class="ge-lead" data-cp02-zero-direct>0 DIRECT COMMERCIAL COMPETITORS QUALIFIED. ${esc(limitations || "Current evidence did not prove all commercial conditions.")}</p>` : ""}
<div data-cp02-section="candidates">${cards}</div>
</div>`;
}

function renderCommercialCompetitorDiscoveryPanel(slug: string): string {
  const real = readCommercialCompetitorDiscovery(slug);
  const fixture = readFixtureCommercialDiscovery(slug);
  return `${renderDiscoveryResultPanel(slug, real, "REAL_DISCOVERY")}${fixture ? renderDiscoveryResultPanel(slug, fixture, "FIXTURE_VALIDATION") : ""}`;
}

function competitorKeywordSection(universe: NationalCompetitorKeywordUniverse): string {
  const rows = universe.keywords.slice(0, 100);
  const empty = universe.status === "error"
    ? universe.lastError || "Competitor keyword collection failed."
    : "No ranking keywords were returned for this competitor.";
  return `<details class="ni03c-competitor-keywords" data-ni03c-competitor-keywords="${esc(universe.domain)}" ${universe.status === "collected" ? "open" : ""}>
<summary><strong>${esc(universe.domain)}</strong> · ${universe.keywords.length} keywords · ${esc(universe.status)}</summary>
<div style="overflow:auto;margin-top:12px">
<table class="ni03b-table">
<thead><tr><th>Keyword</th><th>Position</th><th>Search volume</th><th>CPC</th><th>Ranking page</th></tr></thead>
<tbody>${keywordTable(rows, empty)}</tbody>
</table>
</div>
${universe.keywords.length > rows.length ? `<p class="ge-meta">Showing ${rows.length} of ${universe.keywords.length} collected keywords.</p>` : ""}
</details>`;
}

export function renderNationalSearchIntelligencePage(
  slug: string,
  nav: { prevUrl?: string; nextUrl?: string } = {},
): string {
  const copy = growthEnginePlatformCopy(slug);
  if (!isNationalGrowthPlatform(slug)) {
    const body = `<div class="ge-panel" data-ni03b-section="local-blocked">
<h2>National Search Intelligence</h2>
<p class="ge-lead">This customer is on the Local Pharmacy Growth Engine. Organic search competitor discovery for the national digital-growth market is not used here.</p>
<p><a class="ge-btn ge-btn-primary" href="/api/growth-engine/local-market?slug=${encodeURIComponent(slug)}">Open Your Local Market →</a></p>
</div>`;
    return page(slug, copy.marketStepTitle, copy.marketStepSubtitle, body, nav, "local");
  }

  const snapshot = readNationalSearchIntelligence(slug);
  const collected = snapshot.status === "collected" || snapshot.status === "empty" || snapshot.status === "partial";
  const keywords = snapshot.customerKeywords.slice(0, 100);
  const competitors = Array.isArray(snapshot.organicCompetitors) ? snapshot.organicCompetitors : [];
  const qualifiedCommercial = competitors.filter((row) => row.eligibleForKeywordExpansion).length;
  const paidExpansions = snapshot.competitorKeywordUniverses.length;
  const organicCount = competitors.length;
  const sparse = Boolean(snapshot.customerOrganicFootprint?.sparse);
  const sparseThreshold = snapshot.customerOrganicFootprint?.threshold || 10;
  const rankingKeywordCount = snapshot.customerOrganicFootprint?.keywordCount ?? snapshot.summary.rankingKeywordCount;
  const evidenceCode = displayEvidenceSource(snapshot);
  const evidenceVisible = evidenceSourceLabel(snapshot);
  const authorityVisible = authorityLabel(snapshot);
  const authorityMachine = authorityCode(snapshot);
  const costVisible = money(snapshot.costs.totalCost);
  const costMachine = costAmount(snapshot.costs.totalCost);
  const collectUrl = `/api/growth-engine/${encodeURIComponent(slug)}/search-intelligence/collect`;
  const strongestPages = snapshot.summary.strongestRankingPages || [];

  const cards = collected
    ? `<div class="ge-grid-3" data-ni03b-section="summary-cards" data-ni03c-section="visibility">
<div class="ge-card"><span class="ge-placeholder">Calculated</span><h3>Total ranking keywords</h3><p style="font-size:28px;font-weight:900;margin:0">${snapshot.summary.rankingKeywordCount}</p></div>
<div class="ge-card"><span class="ge-placeholder">Calculated</span><h3>Keywords Top 3</h3><p style="font-size:28px;font-weight:900;margin:0">${snapshot.summary.top3Count || 0}</p></div>
<div class="ge-card"><span class="ge-placeholder">Calculated</span><h3>Keywords Top 10</h3><p style="font-size:28px;font-weight:900;margin:0">${snapshot.summary.top10Count}</p></div>
<div class="ge-card"><span class="ge-placeholder">Calculated</span><h3>Keywords Top 20</h3><p style="font-size:28px;font-weight:900;margin:0">${snapshot.summary.top20Count}</p></div>
<div class="ge-card"><span class="ge-placeholder">Calculated</span><h3>Keywords Top 100</h3><p style="font-size:28px;font-weight:900;margin:0">${snapshot.summary.top100Count || 0}</p></div>
<div class="ge-card"><span class="ge-placeholder">Calculated</span><h3>Estimated search demand</h3><p style="font-size:28px;font-weight:900;margin:0">${fmt(snapshot.summary.availableSearchDemand)}</p></div>
</div>
<div class="ge-grid-3" style="margin-top:12px">
<div class="ge-card"><span class="ge-placeholder">Calculated</span><h3>Ranking pages</h3><p style="font-size:28px;font-weight:900;margin:0">${snapshot.summary.rankingPageCount}</p></div>
<div class="ge-card"><span class="ge-placeholder">Evidence</span><h3>Organic / SERP candidates</h3><p style="font-size:28px;font-weight:900;margin:0" data-ni03c2-organic-count="${organicCount}">${organicCount}</p><p class="ge-meta">Organic / SERP candidates: ${organicCount}. These are search-overlap domains, not ${organicCount} commercial competitors.</p></div>
<div class="ge-card"><span class="ge-placeholder">Evidence</span><h3>Latest collection</h3><p style="font-size:16px;font-weight:700;margin:0">${snapshot.status === "not_collected" ? "Not collected" : esc(formatCollectedAt(snapshot.capturedAt))}</p><p class="ge-meta">${esc(evidenceVisible)} · ${esc(authorityVisible)}</p></div>
</div>
<div class="ge-grid-3" style="margin-top:12px" data-ni03c1-section="competitor-distinction" data-ni03c2-section="commercial-summary">
<div class="ge-card"><span class="ge-placeholder">Evidence</span><h3>Qualified commercial competitors</h3><p style="font-size:28px;font-weight:900;margin:0" data-ni03c2-qualified-count="${qualifiedCommercial}">${qualifiedCommercial}</p><p class="ge-meta">Qualified commercial competitors: ${qualifiedCommercial}</p></div>
<div class="ge-card"><span class="ge-placeholder">Evidence</span><h3>Paid competitor expansions</h3><p style="font-size:28px;font-weight:900;margin:0" data-ni03c2-paid-expansions="${paidExpansions}">${paidExpansions}</p><p class="ge-meta">Paid competitor expansions: ${paidExpansions}</p></div>
<div class="ge-card"><span class="ge-placeholder">Evidence</span><h3>Customer organic footprint</h3><p style="font-size:28px;font-weight:900;margin:0" data-ni03c2-customer-keywords="${rankingKeywordCount}">${rankingKeywordCount}</p><p class="ge-meta">Ranking keywords: ${rankingKeywordCount}${sparse ? " · Sparse organic search footprint" : ""}</p></div>
</div>`
    : `<p class="ge-lead" data-ni03b-section="empty-metrics">No collection has been performed yet. Metrics will appear from persisted DataForSEO evidence only.</p>`;

  const pageRows = strongestPages.length
    ? strongestPages.map((row) => `<tr>
<td>${row.url ? `<a href="${esc(row.url)}" rel="noreferrer">${esc(row.url)}</a>` : "—"}</td>
<td>${fmt(row.keywordCount)}</td>
<td>${fmt(row.searchDemand)}</td>
<td>${fmt(row.bestPosition)}</td>
</tr>`).join("")
    : `<tr><td colspan="4">${snapshot.status === "not_collected" ? "Strongest ranking pages will appear after collection." : "No ranking page URLs were returned."}</td></tr>`;

  const keywordRows = keywordTable(
    keywords,
    snapshot.status === "not_collected" ? "No ranking keywords collected yet." : "No ranking keywords were returned.",
  );

  const competitorCards = competitors.length
    ? competitors.map(competitorCard).join("")
    : `<p class="ge-lead">${snapshot.status === "not_collected" ? "No organic search competitors collected yet." : "No organic search competitors were identified from the bounded collection."}</p>`;

  const competitorKeywordHtml = snapshot.competitorKeywordUniverses.length
    ? snapshot.competitorKeywordUniverses.map(competitorKeywordSection).join("")
    : `<p class="ge-lead" data-ni03c2-section="zero-paid-expansion">${snapshot.status === "not_collected" ? "Competitor keyword universes will appear after collection." : "Paid competitor expansions: 0. No commercially qualified competitors were selected for ranked-keyword expansion."}</p>`;

  const body = `${renderCommercialCompetitorDiscoveryPanel(slug)}
<div class="ge-panel" data-ni03b-section="search-intelligence">
<h2>Search Intelligence</h2>
<p class="ge-lead">What Google already knows about this national digital-growth business — organic rankings and search competitors, not nearby pharmacies.</p>
<div class="ge-grid-2" data-ni03b-section="collection-meta">
<div class="ge-card"><h3>Business</h3><p>${esc(snapshot.businessName)}</p></div>
<div class="ge-card"><h3>Domain</h3><p data-ni03b-domain="${esc(snapshot.subjectDomain)}">${esc(snapshot.subjectDomain || "Not configured")}</p></div>
<div class="ge-card"><h3>Market</h3><p data-ni03b-market="${esc(snapshot.primaryMarket)}">${esc(snapshot.primaryMarket)}</p></div>
<div class="ge-card"><h3>Status</h3><p data-ni03b-status="${esc(snapshot.status)}" data-ni03c2-page-status="${esc(snapshot.status)}">${esc(statusLabel(snapshot))}</p></div>
<div class="ge-card"><h3>Last collected</h3><p data-ni03b-captured="${esc(snapshot.capturedAt)}" data-ni03c2-last-collected="${esc(formatCollectedAt(snapshot.capturedAt))}">${snapshot.status === "not_collected" ? "Not collected" : esc(formatCollectedAt(snapshot.capturedAt))}</p></div>
<div class="ge-card" data-ni03b-section="provenance"><h3>Evidence source</h3><p data-ni03c2-evidence-source="${esc(evidenceCode)}">${esc(evidenceVisible)}</p><h3 style="margin-top:12px">Authority</h3><p data-ni03c2-authority="${esc(authorityMachine)}">${esc(authorityVisible)}</p></div>
<div class="ge-card" data-ni03b-section="cost"><h3>Collection cost</h3><p>Cost: <span data-ni03c2-total-cost="${esc(costMachine)}">${esc(costVisible)}</span></p><p class="ge-meta">Requests: <span data-ni03c2-requests="${snapshot.costs.requests}">${snapshot.costs.requests}</span> · Tasks: <span data-ni03c2-tasks="${snapshot.costs.tasks}">${snapshot.costs.tasks}</span></p></div>
</div>
${collected ? `<div class="ge-panel" style="margin:16px 0 0;padding:14px 16px;background:#fff" data-ni03c2-section="collection-state">
<p class="ge-meta">DATA COLLECTION = ${esc(statusLabel(snapshot))}</p>
<p class="ge-meta">CUSTOMER FOOTPRINT = ${esc(sparse ? "SPARSE" : "NORMAL")}</p>
<p class="ge-meta">ORGANIC / SERP CANDIDATES = ${organicCount}</p>
<p class="ge-meta">QUALIFIED COMMERCIAL COMPETITORS = ${qualifiedCommercial}</p>
<p class="ge-meta">PAID COMPETITOR EXPANSIONS = ${paidExpansions}</p>
</div>` : ""}
${snapshot.status === "partial" ? `<p class="ge-lead" style="color:#b45309" data-ni03b-section="partial">${esc(PARTIAL_COLLECTION_CUSTOMER_MESSAGE)}</p>` : snapshot.lastError && snapshot.status !== "partial" && snapshot.status !== "collected" ? `<p class="ge-lead" style="color:#b45309" data-ni03b-section="error">${esc(snapshot.lastError)}</p>` : ""}
<p style="margin-top:16px" data-ni03b-section="explicit-refresh">
<button class="ge-btn ge-btn-primary" type="button" id="ni03bCollect">${collected ? "Refresh Search Intelligence" : "Collect Search Intelligence"}</button>
<span id="ni03bCollectStatus" class="ge-meta" style="margin-left:10px"></span>
</p>
<p class="ge-lead">Collection is explicit. Opening this page does not call DataForSEO.</p>
</div>

<div class="ge-panel" data-ni03b-section="keywords" data-ni03c-section="customer-keywords">
<h2>Your organic search visibility</h2>
<p class="ge-lead">Keywords this domain currently ranks for in Google, from DataForSEO Labs ranked keywords. Null values are shown as dashes — they are not converted to zero.</p>
${cards}
<div style="overflow:auto;margin-top:16px" data-ni03c-section="strongest-pages">
<h3>Strongest ranking pages</h3>
<table class="ni03b-table">
<thead><tr><th>Page</th><th>Keywords</th><th>Search demand</th><th>Best position</th></tr></thead>
<tbody>${pageRows}</tbody>
</table>
</div>
<h3 style="margin-top:20px">Customer keywords</h3>
<p class="ge-meta">Ranking keywords: ${rankingKeywordCount}. Sorted by current position, then search volume. Showing ${keywords.length} of ${snapshot.customerKeywords.length} collected keywords.</p>
<div style="overflow:auto;margin-top:12px">
<table class="ni03b-table">
<thead><tr><th>Keyword</th><th>Position</th><th>Search volume</th><th>CPC</th><th>Ranking page</th></tr></thead>
<tbody>${keywordRows}</tbody>
</table>
</div>
</div>

<div class="ge-panel" data-ni03b-section="competitors" data-ni03c-section="organic-competitors">
<h2>Your organic competitors</h2>
<p class="ge-lead">These domains compete with you in Google search results. That is not the same as competing for your customers.</p>
<p class="ge-lead">Organic overlap is SERP evidence only. Only commercially qualified competitors are selected for paid keyword expansion.</p>
<p class="ge-lead">They are not selected based on physical proximity.</p>
${collected && sparse ? `<p class="ge-lead" data-ni03c1-section="sparse-footprint" data-ni03c2-section="sparse-warning">${esc(snapshot.businessName)} currently has a sparse organic search footprint. Competitor discovery from shared ranking evidence is limited because fewer than ${sparseThreshold} customer keywords currently rank.</p>
<p class="ge-meta">This is an evidence limitation, not a system error. Status remains Collected.</p>` : ""}
${collected && qualifiedCommercial === 0 ? `<p class="ge-lead" data-ni03c2-section="zero-commercial">No commercially qualified competitors were found from the current organic-overlap evidence. Weak or non-overlapping domains were intentionally excluded from paid competitor keyword expansion.</p>` : ""}
<div data-ni03c2-section="organic-candidate-list">${competitorCards}</div>
</div>

<div class="ge-panel" data-ni03c-section="competitor-keywords">
<h2>Competitor keywords</h2>
<p class="ge-lead">Ranking keyword universes collected only for commercially qualified competitors. Search-only competitors are retained above and are not expanded automatically. This screen does not score gaps or recommend content.</p>
${competitorKeywordHtml}
</div>

<div class="ge-panel" data-ni03b-section="next-stage">
<h2>What happens next</h2>
<p class="ge-lead">${esc(snapshot.nextStage.detail)}</p>
</div>
<script>
(function(){
  var btn = document.getElementById('ni03bCollect');
  var status = document.getElementById('ni03bCollectStatus');
  if (!btn) return;
  btn.addEventListener('click', async function(){
    btn.disabled = true;
    status.textContent = 'Collecting bounded search intelligence…';
    try {
      var collectUrl = ${JSON.stringify(collectUrl)};
      var token = new URLSearchParams(window.location.search).get('_t');
      if (token) collectUrl += (collectUrl.indexOf('?') >= 0 ? '&' : '?') + '_t=' + encodeURIComponent(token);
      var res = await fetch(collectUrl, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ force: ${collected ? "true" : "false"} })
      });
      var payload = await res.json();
      if (!res.ok || payload.ok === false) {
        status.textContent = payload.error || 'Collection failed';
        btn.disabled = false;
        return;
      }
      window.location.reload();
    } catch (err) {
      status.textContent = String(err);
      btn.disabled = false;
    }
  });
})();
</script>`;

  return page(slug, "Search Intelligence", "Organic rankings and search competitors for this national digital-growth business", body, nav, "national");
}

function page(
  slug: string,
  title: string,
  subtitle: string,
  body: string,
  nav: { prevUrl?: string; nextUrl?: string },
  platform: "national" | "local",
): string {
  const framework = buildGrowthEngineFramework(slug);
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)} · Growth Engine</title>
<style>
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f0f4f8;color:#0f172a;line-height:1.5}
${platformPlatformNavCss()}
${growthEngineWorkflowCss()}
.ni03b-table{width:100%;border-collapse:collapse;font-size:13px;background:#fff}
.ni03b-table th,.ni03b-table td{border-bottom:1px solid #e2e8f0;padding:8px 10px;text-align:left;vertical-align:top}
.ni03b-table th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748b}
.ni03b-table a{color:#1d4ed8;word-break:break-all}
.ni03c-competitor-keywords{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin:0 0 12px}
.ni03c-competitor-keywords summary{cursor:pointer}
</style>
</head>
<body data-slug="${esc(slug)}" data-growth-platform="${platform}" data-ni03b-page="search-intelligence">
<header style="background:linear-gradient(135deg,#005eb8,#003087);color:#fff;padding:16px 24px">
<h1 style="margin:0;font-size:20px">PharmaConnect Growth Engine</h1>
${renderPharmacyPlatformNavBar({ slug, activeId: "growth-engine" })}
</header>
<div class="ge-shell">
<div class="ge-header-band">
<h1>${esc(title)}</h1>
<p>${esc(subtitle)}</p>
</div>
${renderGrowthEngineNavBar(slug, framework, "local-market", { prevUrl: nav.prevUrl, nextUrl: nav.nextUrl, nextLabel: "Continue to Growth Plan →" })}
${body}
</div>
</body></html>`;
}
