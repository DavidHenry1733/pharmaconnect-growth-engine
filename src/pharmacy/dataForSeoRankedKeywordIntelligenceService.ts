export type DataForSeoRankedKeyword = {
  keyword:string;
  position:number | null;
  searchVolume:number | null;
  cpc:number | null;
  competition:number | null;
  url:string | null;
};

function credentials(){
  const login=
    process.env.DATAFORSEO_LOGIN ||
    process.env.DATAFORSEO_API_LOGIN;

  const password=
    process.env.DATAFORSEO_PASSWORD ||
    process.env.DATAFORSEO_API_PASSWORD;

  if(!login || !password){
    throw new Error("DataForSEO credentials unavailable");
  }

  return {login,password};
}

function normaliseDomain(domain:string){
  return String(domain || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//,"")
    .replace(/^www\./,"")
    .split("/")[0];
}

function num(value:any):number | null {
  const n=Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function getDomainRankedKeywords(input:{
  domain:string;
  locationName?:string;
  languageCode?:string;
  limit?:number;
}):Promise<DataForSeoRankedKeyword[]> {

  const {login,password}=credentials();

  const domain=normaliseDomain(input.domain);

  const body=[{
    target:domain,
    location_name:input.locationName || "United Kingdom",
    language_code:input.languageCode || "en",
    limit:Math.min(Math.max(input.limit || 1000,1),1000),
    order_by:[
      "keyword_data.keyword_info.search_volume,desc"
    ],
  }];

  const response=await fetch(
    "https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live",
    {
      method:"POST",
      headers:{
        "authorization":
          "Basic " +
          Buffer.from(`${login}:${password}`).toString("base64"),
        "content-type":"application/json",
      },
      body:JSON.stringify(body),
    }
  );

  const json:any=await response.json();

  if(!response.ok || json?.status_code !== 20000){
    throw new Error(
      `DataForSEO Ranked Keywords failed: HTTP ${response.status} / ` +
      `${json?.status_code || "unknown"} ${json?.status_message || ""}`
    );
  }

  const task=json?.tasks?.[0];

  if(task?.status_code !== 20000){
    throw new Error(
      `DataForSEO task failed: ${task?.status_code || "unknown"} ` +
      `${task?.status_message || ""}`
    );
  }

  const items=task?.result?.[0]?.items || [];

  return items.map((item:any)=>{
    const keywordData=item?.keyword_data || {};
    const keywordInfo=keywordData?.keyword_info || {};
    const ranked=item?.ranked_serp_element?.serp_item || {};

    return {
      keyword:String(
        keywordData?.keyword ||
        item?.keyword ||
        ""
      ).trim(),

      position:num(
        ranked?.rank_absolute ??
        ranked?.rank_group ??
        item?.rank_absolute
      ),

      searchVolume:num(keywordInfo?.search_volume),
      cpc:num(keywordInfo?.cpc),
      competition:num(keywordInfo?.competition),
      url:
        ranked?.url ||
        item?.url ||
        null,
    };
  }).filter((x:DataForSeoRankedKeyword)=>x.keyword);
}
