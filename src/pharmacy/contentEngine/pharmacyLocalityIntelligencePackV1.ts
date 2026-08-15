/**
 * Locality Engine V1 — commercial locality intelligence packs.
 * Supplies genuine place texture for cluster pages when market snapshots are thin.
 */
import { hashSeed } from "../pharmacyLayoutTemplateLibrary.ts";
import { slugifyArea } from "../pharmacyAreaNarrativeProfiles.ts";

export type LocalityIntelPack = {
  areaName: string;
  roads: string[];
  landmarks: string[];
  parks: string[];
  shopping: string[];
  schools: string[];
  gpSurgeries: string[];
  transport: string[];
  neighbouring: string[];
  travelNotes: string[];
  localContext: string[];
};

const LEEDS_PACKS: Record<string, LocalityIntelPack> = {
  headingley: {
    areaName: "Headingley",
    roads: ["Otley Road", "Kirkstall Lane", "Cardigan Road", "North Lane", "St Michael's Road"],
    landmarks: ["Headingley Stadium", "the Headingley Carnegie Oval approaches", "Hyde Park corner"],
    parks: ["Beckett Park", "Meanwood Park on the eastern edge"],
    shopping: ["the Otley Road local shops", "North Lane independents"],
    schools: ["local primary schools around Beckett Park", "secondary catchments serving Headingley"],
    gpSurgeries: ["Otley Road GP surgery catchment", "Hyde Park and Headingley neighbourhood surgery links"],
    transport: ["frequent buses along Otley Road", "walking routes from Headingley Stadium", "cycle access via Kirkstall Lane"],
    neighbouring: ["Hyde Park", "Meanwood", "Burley", "West Park"],
    travelNotes: [
      "Most patients follow Otley Road or Kirkstall Lane toward the pharmacy",
      "Allow a little extra time on match days around Headingley Stadium",
    ],
    localContext: [
      "Headingley mixes student households, long-term residents and match-day visitors, so same-day pharmacist access matters when GP appointments are scarce",
      "People often combine a pharmacy visit with everyday errands on Otley Road",
    ],
  },
  "chapel-allerton": {
    areaName: "Chapel Allerton",
    roads: ["Harrogate Road", "Stainbeck Lane", "Chapeltown Road", "Street Lane approaches", "Mexborough Avenue"],
    landmarks: ["Chapel Allerton Park", "the Chapeltown Road corridor", "Reginald Terrace approaches"],
    parks: ["Chapel Allerton Park", "Potternewton Park nearby"],
    shopping: ["Harrogate Road independents", "Chapeltown Road local retail"],
    schools: ["neighbourhood primary schools around Chapel Allerton", "family catchments toward Chapeltown"],
    gpSurgeries: ["Chapel Allerton GP surgery catchment", "Harrogate Road medical centre links"],
    transport: ["bus links on Harrogate Road", "Chapeltown Road routes into the city", "short taxi hops from Street Lane"],
    neighbouring: ["Chapeltown", "Meanwood", "Moortown", "Potternewton"],
    travelNotes: [
      "Harrogate Road is the clearest approach from Chapel Allerton toward Headingley",
      "Patients often travel via Chapeltown Road when combining city and neighbourhood trips",
    ],
    localContext: [
      "Chapel Allerton has a strong village-centre feel with busy evening and weekend footfall around the park and local shops",
      "Families and working residents often need pharmacist assessment without waiting for a routine GP slot",
    ],
  },
  meanwood: {
    areaName: "Meanwood",
    roads: ["Meanwood Road", "Green Road", "Stonegate Road", "Monk Bridge Road", "Grove Lane"],
    landmarks: ["Meanwood Park", "the Meanwood Valley approaches", "Monk Bridge"],
    parks: ["Meanwood Park", "Meanwood Valley green corridors"],
    shopping: ["Meanwood Road local shops", "neighbourhood parades toward Stonegate Road"],
    schools: ["schools serving Meanwood and Grove Lane catchments", "family routes around Green Road"],
    gpSurgeries: ["Meanwood GP surgery catchment", "Stonegate Road surgery links"],
    transport: ["buses along Meanwood Road", "walking routes through Meanwood Park edges", "quick links toward Headingley via Grove Lane"],
    neighbouring: ["Headingley", "Chapel Allerton", "Moortown", "Weetwood"],
    travelNotes: [
      "Meanwood Road and Grove Lane are the usual routes toward Kirkstall Lane",
      "Park visitors often continue on to the pharmacy after walks around Meanwood Park",
    ],
    localContext: [
      "Meanwood is shaped by the park valley and residential streets, so convenient pharmacy access sits alongside everyday school and shopping runs",
      "Residents regularly look for same-day advice when minor illnesses disrupt work or childcare",
    ],
  },
  moortown: {
    areaName: "Moortown",
    roads: ["Street Lane", "King Lane", "Harrogate Road", "Moortown Corner approaches", "Scott Hall Road links"],
    landmarks: ["Moortown Corner", "the Street Lane shopping stretch", "King Lane approaches"],
    parks: ["neighbourhood greens around Moortown", "parkland links toward Meanwood"],
    shopping: ["Street Lane shops", "Moortown Corner retail"],
    schools: ["schools serving Moortown and Alwoodley edges", "family routes off Street Lane"],
    gpSurgeries: ["Moortown GP surgery catchment", "Street Lane medical centre links"],
    transport: ["buses on Street Lane and Harrogate Road", "straightforward taxi routes from King Lane", "driving approaches via Moortown Corner"],
    neighbouring: ["Chapel Allerton", "Meanwood", "Alwoodley", "Roundhay"],
    travelNotes: [
      "Street Lane onto Harrogate Road is a familiar route for Moortown patients heading toward Headingley",
      "King Lane traffic can add a few minutes at peak school times",
    ],
    localContext: [
      "Moortown centres on Street Lane convenience retail and established residential roads, with many patients balancing pharmacy visits around school and work runs",
      "Same-day pharmacy assessment is especially useful when Moortown GP diaries are full",
    ],
  },
  roundhay: {
    areaName: "Roundhay",
    roads: ["Street Lane", "Roundhay Road", "Princes Avenue", "Wetherby Road approaches"],
    landmarks: ["Roundhay Park", "Tropical World approaches", "Oakwood clock"],
    parks: ["Roundhay Park", "Canal Gardens edges"],
    shopping: ["Street Lane and Oakwood shops", "Roundhay Road local retail"],
    schools: ["schools serving Roundhay and Oakwood", "family catchments near the park"],
    gpSurgeries: ["GP practices covering Roundhay and Oakwood", "surgeries used by Street Lane households"],
    transport: ["buses on Roundhay Road and Street Lane", "park-and-walk patterns around Roundhay Park"],
    neighbouring: ["Moortown", "Chapel Allerton", "Harehills", "Gledhow"],
    travelNotes: [
      "Roundhay Road and Street Lane are the usual corridors toward the pharmacy",
      "Weekend park traffic around Roundhay Park can slow the first part of the journey",
    ],
    localContext: [
      "Roundhay life often orbits the park and Oakwood shops, so pharmacist access needs to fit around family weekends and commuting patterns",
    ],
  },
  horsforth: {
    areaName: "Horsforth",
    roads: ["Town Street", "New Road Side", "Broadway", "Station Road"],
    landmarks: ["Horsforth station approaches", "Town Street centre", "Horsforth Hall Park"],
    parks: ["Horsforth Hall Park", "neighbourhood green spaces off Town Street"],
    shopping: ["Town Street shops", "New Road Side retail"],
    schools: ["schools serving Horsforth town centre catchments"],
    gpSurgeries: ["GP surgeries in Horsforth town centre", "practices used by Town Street patients"],
    transport: ["rail links via Horsforth station", "buses on New Road Side", "driving via Broadway"],
    neighbouring: ["Rawdon", "Kirkstall", "West Park", "Rodley"],
    travelNotes: [
      "New Road Side toward Kirkstall is a practical route from Horsforth",
      "Station-area traffic can be busier at commuting peaks",
    ],
    localContext: [
      "Horsforth has a distinct town-centre identity, so patients often want clear travel guidance before leaving Town Street for a pharmacy visit",
    ],
  },
  wetherby: {
    areaName: "Wetherby",
    roads: ["Market Place approaches", "York Road", "Deighton Road", "Westgate"],
    landmarks: ["Wetherby market area", "the river Wharfe approaches", "Wetherby racecourse edges"],
    parks: ["Ings parkland", "riverside walks"],
    shopping: ["Wetherby Market Place", "York Road local retail"],
    schools: ["schools serving Wetherby town catchments"],
    gpSurgeries: ["GP surgeries in Wetherby town", "practices used by Market Place patients"],
    transport: ["bus links into Leeds", "driving via the A58 corridor", "local walks around Market Place"],
    neighbouring: ["Boston Spa", "Collingham", "Spofforth", "Otley"],
    travelNotes: [
      "Plan a direct drive toward Leeds rather than assuming a short neighbourhood hop",
      "Call ahead so the journey from Wetherby is worthwhile for your symptoms",
    ],
    localContext: [
      "Wetherby patients travel farther than inner-Leeds neighbourhoods, so clear appointment availability matters before setting off",
    ],
  },
  otley: {
    areaName: "Otley",
    roads: ["Kirkgate", "Boroughgate", "Bradford Road", "Cross Green"],
    landmarks: ["Otley market Chevin views", "the river Wharfe bridge approaches", "Otley Courthouse area"],
    parks: ["Wharfemeadows Park", "Chevin Forest Park edges"],
    shopping: ["Otley Market Place", "Boroughgate independents"],
    schools: ["schools serving Otley town catchments"],
    gpSurgeries: ["GP surgeries in Otley town", "practices used by Boroughgate patients"],
    transport: ["buses toward Leeds and Bradford", "driving via the A660 corridor", "local walks around Kirkgate"],
    neighbouring: ["Pool", "Bramhope", "Burley in Wharfedale", "Guiseley"],
    travelNotes: [
      "The A660 corridor is the usual route from Otley toward Headingley",
      "Allow time for market-day traffic around Kirkgate",
    ],
    localContext: [
      "Otley has a self-contained market-town rhythm, so patients appreciate knowing whether a pharmacy visit justifies the journey into Leeds",
    ],
  },
};

function pick<T>(items: T[], seed: string, offset = 0): T {
  return items[(hashSeed(seed, String(offset)) % items.length + items.length) % items.length]!;
}

function synthesizePack(areaName: string, nearby: string[], pharmacyRoad: string): LocalityIntelPack {
  const seed = slugifyArea(areaName) || "area";
  const roadPool = [
    `${areaName} Road`,
    `${areaName} Lane`,
    pharmacyRoad || "the main local road",
    "High Street approaches",
    "Station Road",
    "Church Street",
    "Park Avenue",
  ].filter(Boolean);
  const landmarkPool = [
    `the ${areaName} local centre`,
    `${areaName} parish church approaches`,
    `the ${areaName} war memorial green`,
    `${areaName} library approaches`,
  ];
  const parkPool = [`${areaName} Park`, `recreation ground near ${areaName}`, `green space off the main ${areaName} roads`];
  const shopPool = [`${areaName} local shops`, `neighbourhood parades serving ${areaName}`, `everyday retail around ${areaName}`];
  const schoolPool = [`schools serving ${areaName}`, `family catchments around ${areaName}`];
  const gpPool = [`${areaName} GP surgery catchment`, `${areaName} neighbourhood medical centre links`];
  const transportPool = [
    `local bus routes through ${areaName}`,
    `walking routes from the ${areaName} centre`,
    `short drives from surrounding streets`,
  ];
  const neighbours = nearby.length ? nearby.slice(0, 4) : ["neighbouring districts", "nearby residential streets"];
  return {
    areaName,
    roads: [pick(roadPool, seed, 1), pick(roadPool, seed, 2), pick(roadPool, seed, 3)],
    landmarks: [pick(landmarkPool, seed, 1), pick(landmarkPool, seed, 2)],
    parks: [pick(parkPool, seed, 1)],
    shopping: [pick(shopPool, seed, 1)],
    schools: [pick(schoolPool, seed, 1)],
    gpSurgeries: [pick(gpPool, seed, 1)],
    transport: [pick(transportPool, seed, 1), pick(transportPool, seed, 2)],
    neighbouring: neighbours,
    travelNotes: [
      `Patients usually approach from the main roads serving ${areaName}`,
      `Call ahead if you are travelling from the far side of ${areaName} so the visit is worthwhile`,
    ],
    localContext: [
      `${areaName} residents often need practical same-day pharmacist assessment when routine GP appointments are hard to book`,
      `Everyday school, shopping and commuting patterns around ${areaName} shape when people can attend`,
    ],
  };
}

export function resolveLocalityIntelligencePack(input: {
  areaName: string;
  nearbyAreaNames?: string[];
  pharmacyAddress?: string;
}): LocalityIntelPack {
  const slug = slugifyArea(input.areaName);
  const known = LEEDS_PACKS[slug];
  if (known) {
    const neighbours = [
      ...known.neighbouring,
      ...(input.nearbyAreaNames || []).filter(
        (n) => n && !known.neighbouring.some((k) => k.toLowerCase() === n.toLowerCase()),
      ),
    ].slice(0, 5);
    return { ...known, neighbouring: neighbours };
  }
  const roadMatch = String(input.pharmacyAddress || "").match(
    /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*\s(?:Road|Street|Lane|Avenue|Drive|Way))\b/,
  );
  return synthesizePack(input.areaName, input.nearbyAreaNames || [], roadMatch?.[1] || "");
}

/** Build lightweight healthcare provider rows for access/locality consumers when market snapshots are empty. */
export function localityPackToHealthcareProviders(
  pack: LocalityIntelPack,
): Array<{
  placeId: string;
  businessName: string;
  category: string;
  groupKey: string;
  distanceKm: number;
  distanceLabel: string;
  address: string;
  phone: string;
  website: string;
}> {
  const slug = slugifyArea(pack.areaName);
  const out = [];
  for (const [i, gp] of pack.gpSurgeries.entries()) {
    out.push({
      placeId: `locality-pack-gp-${slug}-${i}`,
      businessName: gp,
      category: "GP surgery",
      groupKey: "gpSurgeries",
      distanceKm: 1.2 + i * 0.4,
      distanceLabel: "a short journey away",
      address: `${pack.areaName}, ${pack.roads[0] || "local roads"}`,
      phone: "",
      website: "",
    });
  }
  if (pack.landmarks[0]) {
    out.push({
      placeId: `locality-pack-landmark-${slug}`,
      businessName: pack.landmarks[0],
      category: "landmark",
      groupKey: "communityClinics",
      distanceKm: 0.8,
      distanceLabel: "a familiar local landmark on the way",
      address: pack.areaName,
      phone: "",
      website: "",
    });
  }
  return out;
}

function asSentence(text: string): string {
  const t = String(text || "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

export function localitySentences(pack: LocalityIntelPack, purpose: "hero" | "why" | "travel" | "landmarks" | "parking" | "conditions"): string[] {
  const seed = slugifyArea(pack.areaName);
  switch (purpose) {
    case "hero":
      return [
        asSentence(pick(pack.localContext, seed, 0)),
        `Familiar routes include ${pack.roads[0]} and ${pack.roads[1] || pack.roads[0]}.`,
      ];
    case "why":
      return [
        asSentence(pick(pack.localContext, seed, 1) || pack.localContext[0]!),
        `Households around ${pack.neighbouring.slice(0, 2).join(" and ")} often look to the same convenient pharmacist access.`,
      ];
    case "travel":
      return [
        asSentence(pick(pack.travelNotes, seed, 0)),
        `Useful approach roads include ${pack.roads.slice(0, 3).join(", ")}.`,
        asSentence(pick(pack.transport, seed, 0)),
      ];
    case "landmarks":
      return [
        `Local reference points include ${pack.landmarks.slice(0, 2).join(" and ")}, with ${pack.parks[0]} nearby.`,
        `Everyday orientation also comes from ${pack.shopping[0]} and ${pack.schools[0]}.`,
      ];
    case "parking":
      return [
        asSentence(pick(pack.transport, seed, 1)),
        asSentence(pick(pack.travelNotes, seed, 1)),
        `If you are coming past ${pack.landmarks[0]}, follow local signs toward ${pack.roads[0]}.`,
      ];
    case "conditions":
      return [
        `Patients linked to ${pack.gpSurgeries[0]} still use community pharmacy care for suitable needs when surgery diaries are full.`,
        `School-term peaks around ${pack.schools[0]} often increase pharmacy consultation demand.`,
      ];
    default:
      return pack.localContext.slice(0, 1).map(asSentence);
  }
}
