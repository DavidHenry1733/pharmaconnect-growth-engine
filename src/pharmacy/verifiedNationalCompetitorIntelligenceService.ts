import fs from "node:fs";

const ENRICHMENT =
  "data/national-growth-engine/pharmaconnect-competitor-evidence-enrichment-v1.json";

const KEYWORDS =
  "data/national-growth-engine/pharmaconnect-commercial-keyword-qualification-v1.json";

const OUTPUT =
  "data/national-growth-engine/pharmaconnect-verified-national-competitors.json";

function readJson(path:string){
  return JSON.parse(fs.readFileSync(path,"utf8"));
}

function domainKey(value:any){
  return String(value?.domain || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//,"")
    .replace(/^www\./,"")
    .split("/")[0];
}

function uniqueByDomain(items:any[]){
  const map=new Map<string,any>();

  for(const item of items){
    const key=domainKey(item);

    if(!key) continue;

    if(!map.has(key)){
      map.set(key,item);
    }else{
      map.set(key,{
        ...map.get(key),
        ...item,
      });
    }
  }

  return [...map.values()];
}

export function buildVerifiedNationalCompetitorIntelligence(){

  const enrichment=readJson(ENRICHMENT);
  const keyword=readJson(KEYWORDS);

  const ownSiteDirect=
    enrichment.directCompetitors || [];

  const ownSiteAdjacent=
    enrichment.adjacentCompetitors || [];

  const keywordDirect=
    keyword.directCompetitors || [];

  const keywordAdjacent=
    keyword.adjacentCompetitors || [];

  const direct=uniqueByDomain([
    ...ownSiteDirect.map((x:any)=>({
      ...x,
      domain:domainKey(x),
      evidenceBasis:"own_site",
      verified:true,
      classification:"direct_competitor",
      confidenceScore:
        x.confidenceScore ??
        x.score ??
        null,
      strongestKeywords:
        x.strongestKeywords || [],
    })),

    ...keywordDirect.map((x:any)=>({
      ...x,
      domain:domainKey(x),
      evidenceBasis:
        x.websiteCommercialEvidence ?
        "own_site_and_ranked_keywords" :
        "ranked_keywords",
      verified:true,
      classification:"direct_competitor",
    })),
  ]);

  const directDomains=
    new Set(direct.map(domainKey));

  const adjacent=uniqueByDomain([
    ...ownSiteAdjacent,
    ...keywordAdjacent,
  ])
    .filter((x:any)=>!directDomains.has(domainKey(x)))
    .map((x:any)=>({
      ...x,
      domain:domainKey(x),
      classification:"adjacent_competitor",
      verified:true,
      confidenceScore:
        x.confidenceScore ??
        x.score ??
        null,
    }));

  const rejected=
    (keyword.rejectedCandidates || []).map((x:any)=>({
      ...x,
      domain:domainKey(x),
      classification:"not_competitor",
    }));

  const insufficient=
    (keyword.insufficientEvidence || []).map((x:any)=>({
      ...x,
      domain:domainKey(x),
      classification:"insufficient_evidence",
    }));

  const totalRelevantSearchVolume=
    direct.reduce(
      (sum:number,x:any)=>
        sum + Number(x.relevantSearchVolume || 0),
      0
    );

  const totalRelevantKeywords=
    direct.reduce(
      (sum:number,x:any)=>
        sum + Number(x.relevantKeywords || 0),
      0
    );

  const totalHighCommercialKeywords=
    direct.reduce(
      (sum:number,x:any)=>
        sum + Number(x.highCommercialKeywords || 0),
      0
    );

  const output={
    version:1,

    generatedAt:new Date().toISOString(),

    tenant:"pharmaconnect",

    platformScope:"national",

    market:"UK Community Pharmacy Digital Growth",

    status:"complete",

    evidenceSources:[
      "Own-site commercial evidence",
      "DataForSEO Labs Google Ranked Keywords — United Kingdom",
    ],

    directCompetitorCount:direct.length,
    adjacentCompetitorCount:adjacent.length,
    rejectedCount:rejected.length,
    insufficientEvidenceCount:insufficient.length,

    totalRelevantKeywords,
    totalHighCommercialKeywords,
    totalRelevantSearchVolume,

    directCompetitors:direct,
    adjacentCompetitors:adjacent,
    rejectedCandidates:rejected,
    insufficientEvidence:insufficient,

    governance:{
      discoveryRun:false,
      localDiscoveryRun:false,
      dashboardPromotion:true,
      nc04Implemented:false,
    },
  };

  fs.writeFileSync(
    OUTPUT,
    JSON.stringify(output,null,2)+"\n"
  );

  return output;
}

export function readVerifiedNationalCompetitorIntelligence(){
  if(!fs.existsSync(OUTPUT)){
    return buildVerifiedNationalCompetitorIntelligence();
  }

  return readJson(OUTPUT);
}
