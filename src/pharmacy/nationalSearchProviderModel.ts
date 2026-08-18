/**
 * National Search Provider Contract V1
 *
 * Provider-independent web/SERP search contract for the
 * NATIONAL Growth Platform.
 *
 * This is NOT Google Places.
 * This is NOT locality/proximity competitor discovery.
 */

export interface NationalSearchRequest {
  query: string;
  marketCountry: string;
  languageCode?: string;
  depth?: number;
  locationCode?: number;
}

export interface NationalSearchEvidence {
  position: number;
  domain: string;
  url: string;
  title: string;
  description: string;
  source: string;
}

export interface NationalSearchResponse {
  provider: string;
  query: string;
  marketCountry: string;
  locationCode: number;
  capturedAt: string;
  cost: number | null;
  organicResultCount: number;
  results: NationalSearchEvidence[];
}

export interface NationalSearchProvider {
  id: string;
  search(request: NationalSearchRequest): Promise<NationalSearchResponse>;
}
