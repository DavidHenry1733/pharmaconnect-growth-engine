/**
 * Service variant content definitions V1 — clinically safe, service-specific, area-agnostic.
 */
import type { ServiceVariantPack } from "./pharmacyServiceVariantLibrary.ts";

type SV = Omit<ServiceVariantPack, "version" | "generatedAt">;

function faqs(items: Array<{ question: string; answer: string }>) {
  return items;
}

function ctaSet(primary: string[], secondary: string[]) {
  return primary.map((p, i) => ({
    primary: p,
    secondary: secondary[i % secondary.length],
    phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
    bookingPrompt: "Book online or by phone once suitability is confirmed at assessment.",
  }));
}

export const SERVICE_VARIANT_DEFINITIONS: Record<string, SV> = {
  "blood-pressure-checks": {
    serviceId: "blood-pressure-checks",
    serviceName: "Blood Pressure Checks",
    intro: [
      { body: "Pharmacy blood pressure checks offer convenient screening between GP reviews — with clear advice on whether follow-up is needed." },
      { body: "Regular blood pressure monitoring helps identify raised readings early, when lifestyle changes or GP review may be most useful." },
      { body: "A pharmacy check measures your blood pressure, explains the result in plain language, and guides appropriate next steps." },
      { body: "Many people choose pharmacy screening because it fits around everyday commitments without waiting for a routine GP slot." },
      { body: "Blood pressure checks at a community pharmacy complement GP care — screening, advice and referral when clinically appropriate." },
    ],
    problem: [
      { heading: "Why Blood Pressure Matters", body: "High blood pressure often has no symptoms but can increase stroke, heart disease and kidney risk over time. Risk factors such as age over 40, family history, diabetes and lifestyle habits influence how often screening is useful.", bullets: ["Do I need to see a GP?", "Can lifestyle changes help?", "How often should I be checked?", "Is this free on the NHS?"] },
      { heading: "Understanding Hypertension Risk", body: "Hypertension frequently causes no obvious warning signs, which is why routine measurement matters. Cardiovascular risk rises when readings stay elevated — early detection supports timely GP follow-up.", bullets: ["Silent symptoms and hidden risk", "Stroke and heart disease links", "Kidney health monitoring", "When to seek urgent care"] },
      { heading: "When Screening Helps", body: "Screening is especially valuable for adults over 40, those with family history of hypertension, and people managing diabetes or high cardiovascular risk. One reading does not diagnose hypertension.", bullets: ["Age and family history", "Diabetes and smoking", "Salt intake and weight", "Home monitoring vs pharmacy checks"] },
      { heading: "Cardiovascular Health Basics", body: "Blood pressure reflects how hard the heart and vessels work. Sustained high readings warrant further assessment — pharmacy checks identify raised readings and guide proportionate follow-up.", bullets: ["Systolic and diastolic explained", "White-coat effect", "Repeat measurement importance", "GP vs pharmacy roles"] },
      { heading: "Why Regular Checks Matter", body: "Untreated hypertension increases long-term harm even without symptoms. Pharmacy screening supports the NHS Hypertension Case-Finding pathway where commissioned — with referral to GP when needed.", bullets: ["NHS screening pathways", "Lifestyle advice scope", "Ambulatory monitoring signposting", "Safety-netting guidance"] },
    ],
    benefits: [
      { heading: "Benefits Of Pharmacy Screening", body: "Community pharmacy checks offer accessible measurement, lifestyle advice and clear signposting without always needing a GP appointment first.", bullets: ["Convenient access", "Plain-language results", "GP referral when appropriate", "Same-day availability where offered"] },
      { heading: "What The Service Delivers", body: "You receive a professional measurement, discussion of risk factors, and guidance on whether repeat checks or GP review is advisable.", bullets: ["Structured assessment", "Lifestyle counselling", "Documentation for your records", "Follow-up interval advice"] },
      { heading: "Practical Advantages", body: "Pharmacy-led checks fit around work and family routines. Results are explained before you leave — with safety-netting if symptoms require urgent care.", bullets: ["Flexible appointment times", "No diagnosis on the spot", "Complements GP care", "Supports long-term monitoring"] },
      { heading: "Patient-Focused Support", body: "The service focuses on screening and education — helping you understand readings and when GP involvement is clinically appropriate.", bullets: ["Heart health awareness", "Reduced unnecessary A&E visits", "Appropriate escalation", "Evidence-based advice"] },
      { heading: "Accessible Heart Health Checks", body: "Screening in a community setting lowers barriers for people who delay GP contact. Pharmacists explain results and next steps clearly.", bullets: ["Over-40s screening", "Risk factor review", "Home reading comparison", "Referral pathways explained"] },
    ],
    eligibility: [
      { heading: "Who Should Have A Check", body: "Suitability is confirmed individually. Adults over 40, those with risk factors, or people due a routine review may benefit — but diagnosis requires GP assessment, not one pharmacy reading alone.", bullets: ["Age over 40", "Family history", "Diabetes", "Previous raised readings", "Lifestyle risk factors"] },
      { heading: "Who The Service Suits", body: "The check suits people seeking screening, monitoring between GP reviews, or advice after home readings. Emergency symptoms such as chest pain need urgent care, not a pharmacy check alone.", bullets: ["Routine screening", "Monitoring known risk", "Post-home-reading follow-up", "Not for acute emergencies"] },
      { heading: "Eligibility Overview", body: "Individual assessment confirms whether a pharmacy check is appropriate. Some NHS pathways have commissioning criteria — availability and eligibility are confirmed at booking.", bullets: ["NHS pathway criteria", "Private options where applicable", "Pregnancy and complex cases", "GP coordination when needed"] },
      { heading: "Before You Book", body: "Share relevant medical history and medicines at assessment. The pharmacist confirms scope — and signposts to GP or urgent care when symptoms fall outside pharmacy screening.", bullets: ["Medicines list", "Recent symptoms", "Previous BP readings", "Ongoing GP treatment"] },
      { heading: "Is This Right For Me", body: "If you are unsure whether pharmacy screening suits your situation, contact the pharmacy team. Complex or symptomatic cases may need GP review first.", bullets: ["Symptom assessment", "Scope of pharmacy care", "When GP is more appropriate", "Follow-up planning"] },
    ],
    howItWorks: [
      { heading: "How The Check Works", body: "The appointment covers measurement, lifestyle discussion and referral advice. Each step is explained — with GP signposting when results or symptoms require it.", bullets: ["Rest before measurement", "Arm cuff reading", "Result explanation", "Follow-up advice", "GP referral if indicated"] },
      { heading: "Your Appointment Steps", body: "You rest briefly, then receive a cuff measurement. The pharmacist discusses readings, risk factors and whether repeat checks or GP follow-up is advisable.", bullets: ["Avoid caffeine beforehand if possible", "Loose sleeves for arm access", "Two readings if needed", "Written guidance offered"] },
      { heading: "The Screening Process", body: "Screening follows a structured pathway: preparation, measurement, interpretation and safety-netting. Diagnosis and long-term treatment remain with your GP.", bullets: ["Structured consultation", "Lifestyle counselling", "Ambulatory monitoring signposting", "Safety-netting advice"] },
      { heading: "What Happens During The Check", body: "A pharmacist measures blood pressure, reviews context such as age and risk factors, and explains whether your reading suggests further action.", bullets: ["10–20 minute appointment typical", "Questions about health history", "Clear next steps", "No on-the-spot hypertension diagnosis"] },
      { heading: "Measurement And Follow-Up", body: "After measurement, you receive plain-language interpretation. Raised readings may prompt repeat checks, home monitoring advice, or GP referral under NHS pathways.", bullets: ["Result recording", "Home monitoring tips", "Repeat interval guidance", "When to return urgently"] },
    ],
    preparationGuide: [
      { heading: "Preparing For Your Check", body: "Preparation improves accuracy. Rest before measurement, wear loose sleeves, and bring previous home readings if you monitor.", bullets: ["Wear loose sleeves", "Avoid caffeine 30 minutes prior", "Rest 5 minutes before reading", "Bring medicines list"] },
      { heading: "Before Your Appointment", body: "Avoid strenuous exercise and heavy meals immediately beforehand. Note any symptoms, medicines and recent home readings to discuss.", bullets: ["Avoid exercise beforehand", "Note symptoms and duration", "Home monitor readings", "Questions to ask"] },
      { heading: "What To Bring", body: "Bring previous readings, a medicines list, and any GP correspondence about hypertension. This helps the pharmacist give proportionate advice.", bullets: ["Medicines including OTC", "Previous BP log", "GP letters if relevant", "Photo ID if required"] },
      { heading: "Getting Accurate Results", body: "Sit quietly for several minutes before measurement. Empty bladder if needed, and keep arm supported at heart level during the reading.", bullets: ["Sit quietly first", "Supported arm position", "Avoid talking during reading", "Repeat if borderline"] },
      { heading: "Appointment Preparation", body: "Allow time for discussion after measurement. If you smoke or drink caffeine, mention timing — both can temporarily affect readings.", bullets: ["Allow 15–20 minutes", "Mention caffeine and smoking", "Loose clothing", "Follow safety advice given"] },
    ],
    trustSafety: [
      { heading: "Safety And Professional Standards", body: "Pharmacy checks screen for raised readings — they do not diagnose or treat hypertension on the spot. Diagnosis and long-term management remain with your GP.", bullets: ["Pharmacist-led assessment", "GP referral when indicated", "Emergency symptoms need urgent care", "Individual suitability confirmed"], type: "safetyConsiderations" },
      { heading: "When To Seek GP Or Urgent Care", body: "Chest pain, severe headache, sudden vision changes or neurological symptoms require urgent medical attention — not a routine pharmacy check alone.", bullets: ["Chest pain", "Stroke symptoms", "Severe headache", "Pregnancy complications"], type: "safetyConsiderations" },
      { heading: "Professional Insight", body: "Pharmacist-led screening works best when patients understand limits of a single reading and follow advice on repeat measurement or GP review.", bullets: ["One reading limitations", "White-coat hypertension", "Home monitoring value", "Follow safety-netting"], type: "professionalInsight" },
      { heading: "Trust And Clinical Governance", body: "Regulated pharmacy teams follow clinical governance for NHS screening pathways where commissioned, with clear scope and referral criteria.", bullets: ["Regulated premises", "Clinical check protocols", "Documented advice", "Complements GP care"], type: "trust" },
    ],
    patientEducation: [
      { heading: "Understanding Your Reading", body: "Blood pressure is recorded as systolic over diastolic (mmHg). One raised check warrants follow-up — not immediate diagnosis.", bullets: ["Systolic vs diastolic", "Normal vs raised ranges", "Repeat measurement need", "ABPM when recommended"] },
      { heading: "Patient Education", body: "Educational guidance covers what happens during screening, NHS pathway eligibility, and when GP or urgent care is more appropriate.", bullets: ["NHS Hypertension Case-Finding", "Lifestyle modification advice", "Medicines not started in screening", "Home monitoring guidance"] },
      { heading: "Learning About Blood Pressure", body: "Understanding risk factors — salt, weight, activity, alcohol and smoking — helps you act on pharmacist lifestyle advice between reviews.", bullets: ["Modifiable risk factors", "Long-term monitoring", "Medication is GP-led", "Questions welcome at appointment"] },
      { heading: "What To Expect After Screening", body: "You may be advised to monitor at home, repeat the check, or see your GP. Written summary helps you track next steps.", bullets: ["Follow-up intervals", "Home monitor use", "GP appointment triggers", "Record keeping"] },
    ],
    mythVsFact: [
      { heading: "Myths Vs Facts", body: "Evidence-based pharmacy advice separates common misconceptions from accurate information:", bullets: ["Myth: A pharmacy diagnoses hypertension on the spot. Fact: Screening identifies raised readings — diagnosis and treatment remain with your GP.", "Myth: High blood pressure always causes symptoms. Fact: Hypertension is often silent — screening matters.", "Myth: One normal reading means no future checks needed. Fact: Risk factors determine how often you should be monitored."] },
      { heading: "Common Misconceptions", body: "Clear facts help you make informed decisions about screening and follow-up:", bullets: ["Myth: Pharmacy replaces your GP. Fact: Pharmacy services complement GP care.", "Myth: Every check is free for everyone. Fact: NHS eligibility varies by pathway and location.", "Myth: Home monitors replace professional checks. Fact: Both have roles — discuss readings with a clinician."] },
      { heading: "Facts About Pharmacy Screening", body: "Separating myths from facts supports safe use of community screening:", bullets: ["Myth: Caffeine does not affect readings. Fact: It can — rest before measurement.", "Myth: Only older adults need checks. Fact: Risk factors matter at any adult age.", "Myth: Treatment starts in pharmacy. Fact: GPs manage long-term hypertension treatment."] },
      { heading: "Hypertension Myths Clarified", body: "Accurate information improves heart health decisions:", bullets: ["Myth: Stress readings are always wrong. Fact: Repeat measurement and ABPM may be needed.", "Myth: All pharmacies offer identical NHS services. Fact: Commissioning varies.", "Myth: Lifestyle changes never help. Fact: They are often first-line alongside medical review."] },
    ],
    cta: ctaSet(
      ["Book A Check", "Arrange Screening", "Request Advice", "Check Availability", "Start Booking"],
      ["Speak To A Pharmacist", "Ask A Pharmacist", "Get Advice", "Phone The Team", "Book Appointment"],
    ),
    faqs: faqs([
      { question: "Do I need an appointment for a blood pressure check?", answer: "Booking ahead is recommended so adequate time is allowed for measurement and discussion — typically 10–20 minutes." },
      { question: "How long does a blood pressure appointment take?", answer: "Most consultations take 10–20 minutes including measurement, lifestyle advice and follow-up planning." },
      { question: "Can a pharmacy diagnose high blood pressure?", answer: "No — pharmacy checks screen for raised readings. Diagnosis and long-term treatment remain with your GP." },
      { question: "How often should I have my blood pressure checked?", answer: "Frequency depends on age, risk factors and previous readings. Over-40s and those with risk factors benefit from regular checks." },
      { question: "Is a pharmacy blood pressure check free?", answer: "NHS Hypertension Case-Finding may be free where commissioned. Private checks may incur a fee — confirm at booking." },
      { question: "What should I do before my check?", answer: "Rest for five minutes, wear loose sleeves, avoid caffeine for 30 minutes if possible, and bring any home readings." },
      { question: "What if my reading is high?", answer: "Raised readings may prompt repeat measurement, home monitoring advice, or GP referral — depending on context and NHS pathway criteria." },
      { question: "Can I walk in without booking?", answer: "Walk-in availability varies. Booking ensures dedicated time for accurate measurement and advice." },
      { question: "What do systolic and diastolic numbers mean?", answer: "Systolic is pressure when the heart beats; diastolic is when it rests — both are recorded in mmHg." },
      { question: "Should I bring my medicines list?", answer: "Yes — some medicines affect blood pressure. Sharing your list helps the pharmacist give accurate advice." },
      { question: "When should I see a GP instead?", answer: "Ongoing treatment, diagnosis, or symptoms such as chest pain require GP or urgent care — not screening alone." },
      { question: "What is ambulatory blood pressure monitoring?", answer: "ABPM records readings over 24 hours and may be recommended when clinic readings are borderline or inconsistent." },
      { question: "Can lifestyle changes lower blood pressure?", answer: "Weight management, salt reduction, activity and alcohol moderation can help — discuss a plan with your GP or pharmacist." },
      { question: "Are home monitors reliable?", answer: "Validated home monitors can be useful when used correctly. Bring readings to discuss with a pharmacist or GP." },
      { question: "What symptoms need urgent care?", answer: "Chest pain, stroke symptoms, severe headache or sudden vision changes need urgent medical attention." },
    ]),
  },

  "prescription-dispensing": {
    serviceId: "prescription-dispensing",
    serviceName: "Prescription Dispensing",
    intro: [
      { body: "Every prescription is clinically screened before supply — supporting safe medicines use with pharmacist oversight on every item." },
      { body: "Regulated dispensing includes accuracy checks, patient counselling at collection, and clear advice when medicines change." },
      { body: "Community pharmacy dispensing combines professional clinical checks with convenient collection or delivery options." },
      { body: "Pharmacists explain new medicines, check interactions, and support adherence — so you understand how to take treatment safely." },
      { body: "From EPS electronic prescriptions to handover counselling, dispensing follows structured safety steps on every supply." },
    ],
    problem: [
      { heading: "Why Dispensing Checks Matter", body: "Medicines errors can cause harm when prescriptions are rushed or poorly understood. Pharmacist clinical checks before supply reduce interaction and dosage risks.", bullets: ["Interaction screening", "Dosage verification", "Counselling at handover", "Safety-netting"] },
      { heading: "Safe Medicines Supply", body: "Every prescription passes accuracy and clinical screening. This governance supports safe ongoing use — especially when starting new treatment.", bullets: ["Clinical accuracy", "Patient identification", "Allergy review", "Supply documentation"] },
      { heading: "Understanding Dispensing", body: "Dispensing is more than labelling — it includes validation, preparation and counselling so patients know how to take medicines correctly.", bullets: ["Prescription validation", "Supply timelines", "Generic substitution rules", "When to contact GP"] },
      { heading: "Medicines Safety Basics", body: "Pharmacists identify potential issues before supply and explain changes at collection. Report new side effects to a pharmacist or GP promptly.", bullets: ["New medicine counselling", "Changed doses explained", "OTC interaction checks", "Missed dose advice"] },
      { heading: "Community Pharmacy Care", body: "Local dispensing supports continuity when GP appointments are delayed — with professional oversight on every supply.", bullets: ["Convenient collection", "EPS integration", "Repeat coordination", "Referral when needed"] },
    ],
    benefits: [
      { heading: "What You Can Expect", body: "Regulated dispensing includes clinical checks, counselling and clear supply timelines — with EPS electronic prescription support where nominated.", bullets: ["Pharmacist clinical check", "Handover counselling", "Supply status updates", "Plain-language guidance"] },
      { heading: "Benefits Of Pharmacy Dispensing", body: "Accessible supply with professional review on every prescription — reducing avoidable errors and improving adherence.", bullets: ["Interaction screening", "Convenient access", "Medicines questions answered", "GP liaison when needed"] },
      { heading: "Professional Supply Support", body: "Patients receive structured counselling on new medicines and changes — supporting safe use at home.", bullets: ["New starter counselling", "Dosette tray advice", "Delivery options", "Repeat integration"] },
      { heading: "Practical Dispensing Advantages", body: "Electronic prescriptions reduce paper delays. Pharmacists confirm items, check suitability and explain timing at collection.", bullets: ["EPS nomination support", "Waiting time transparency", "Stock queries handled", "Safety-netting provided"] },
      { heading: "Patient-Centred Supply", body: "Dispensing focuses on accuracy, clarity and follow-up — especially for complex or multiple medicines.", bullets: ["Multi-medicine review", "Adherence support", "Side effect guidance", "When to seek urgent care"] },
    ],
    eligibility: [
      { heading: "Who Can Use Dispensing Services", body: "Any patient with a valid prescription from a GP or qualified prescriber may use pharmacy dispensing — subject to clinical checks before supply.", bullets: ["Valid prescription required", "ID for controlled drugs", "EPS or paper format", "Private prescriptions accepted where offered"] },
      { heading: "Prescription Requirements", body: "Prescriptions must be legally valid and clinically appropriate. Pharmacists may contact the prescriber if queries arise before supply.", bullets: ["Legal prescription criteria", "Repeat vs acute supply", "Nomination for EPS", "Emergency supply limits"] },
      { heading: "Before Your First Collection", body: "Bring identification for controlled medicines, a medicines list including OTC products, and nomination details if using EPS.", bullets: ["Photo ID if required", "Allergy history", "Current medicines list", "GP surgery details"] },
      { heading: "Dispensing Suitability", body: "Individual clinical checks confirm safe supply. Some items need special ordering or GP clarification — the pharmacy team advises on timing.", bullets: ["Stock availability", "Special order medicines", "Clinical queries to GP", "Counselling scope"] },
      { heading: "Getting Started", body: "Nominate a pharmacy for EPS so prescriptions arrive electronically. Ask about delivery if collection is difficult.", bullets: ["EPS nomination", "Delivery services", "Carer collection rules", "Repeat setup"] },
    ],
    howItWorks: [
      { heading: "Our Dispensing Process", body: "Prescriptions are clinically screened, prepared and checked before handover — with counselling on new or changed medicines.", bullets: ["Prescription received", "Clinical accuracy check", "Preparation and labelling", "Counselling at collection"] },
      { heading: "How Supply Works", body: "From receipt to collection, each prescription follows governance steps. You are advised on timing, dosage and when to contact your GP.", bullets: ["Validation stage", "Assembly and check", "Ready notification", "Handover counselling"] },
      { heading: "The Dispensing Pathway", body: "Electronic prescriptions flow from GP to nominated pharmacy. Paper prescriptions are processed with the same clinical checks.", bullets: ["EPS electronic flow", "Paper prescription handling", "Waiting time factors", "Partial supply rules"] },
      { heading: "Step-By-Step Supply", body: "Pharmacists resolve queries with prescribers when needed. Patients receive clear instructions — not just a labelled pack.", bullets: ["Query resolution", "Safety checks", "Patient questions welcome", "Follow-up advice"] },
      { heading: "From Prescription To Collection", body: "Allow time for clinical checks on new prescriptions. Repeats may be faster once your record is established.", bullets: ["New vs repeat timing", "Stock ordering", "Notification when ready", "Delivery if offered"] },
    ],
    preparationGuide: [
      { heading: "What To Bring Or Prepare", body: "Bring nomination forms if switching pharmacy, ID for controlled drugs, and a full medicines list including OTC products.", bullets: ["EPS nomination form", "Photo ID if needed", "Medicines and OTC list", "GP surgery details"] },
      { heading: "Before Collection", body: "Check you understand dose changes. Allow time for counselling on new medicines — especially if taking multiple treatments.", bullets: ["Allow counselling time", "Ask about interactions", "Note storage instructions", "Confirm repeat dates"] },
      { heading: "First-Time Dispensing", body: "Set up EPS nomination with your GP surgery. Bring repeat slips and allergy information for accurate clinical checks.", bullets: ["Nomination setup", "Allergy declaration", "Previous pharmacy records", "Payment exemption if applicable"] },
      { heading: "Preparing For Handover", body: "Write down questions about new medicines. Declare OTC and herbal products — they can interact with prescribed treatment.", bullets: ["Question list ready", "Declare all medicines", "Understand timing", "Know when to call GP"] },
      { heading: "Collection Checklist", body: "Verify your name and medicines at handover. Ask about missed doses, storage and side effects to watch for.", bullets: ["Identity check", "Read the label", "Side effect advice", "Repeat reorder timing"] },
    ],
    trustSafety: [
      { heading: "Professional Medicines Expertise", body: "Pharmacists perform clinical checks before every supply — including interactions, dosages and suitability.", bullets: ["GPhC-regulated premises", "Clinical accuracy protocols", "Counselling standards", "Referral when needed"], type: "trust" },
      { heading: "Safety And When To Seek Advice", body: "Contact the pharmacy or GP for new side effects, missed critical doses, or uncertainty about whether a prescription was sent.", bullets: ["New side effects", "Missed critical doses", "Prescription not received", "Red-flag symptoms"], type: "safetyConsiderations" },
      { heading: "Clinical Governance", body: "Dispensing follows national standards with pharmacist accountability on every item supplied.", bullets: ["Double-check systems", "Controlled drug rules", "Patient confidentiality", "Safety-netting"], type: "professionalInsight" },
      { heading: "When To Contact Your GP", body: "Medicine changes, worsening symptoms or treatment failures need GP review — pharmacy supports but does not replace medical management.", bullets: ["Treatment not working", "Worsening condition", "New contraindications", "Complex polypharmacy"], type: "safetyConsiderations" },
    ],
    patientEducation: [
      { heading: "Understanding Dispensing", body: "Learn how clinical checks, EPS and counselling work — so you know what happens between prescription and collection.", bullets: ["Clinical check purpose", "EPS explained", "Generic medicines", "When GP authorisation needed"] },
      { heading: "Patient Education", body: "Educational guidance covers supply steps, repeat processes and when to escalate concerns.", bullets: ["Handover expectations", "Repeat ordering", "OTC interaction risks", "Storage and disposal"] },
      { heading: "Medicines Literacy", body: "Understanding labels, timing and food interactions improves adherence and reduces errors at home.", bullets: ["Reading the label", "Timing with food", "Missed dose rules", "Sharps and disposal"] },
      { heading: "Your Role In Safe Use", body: "Keep an updated medicines list, ask questions at collection, and report side effects promptly.", bullets: ["Accurate medicines list", "Ask at handover", "Report side effects", "Reorder before running out"] },
    ],
    patientOutcomes: [
      { heading: "Expected Dispensing Outcomes", body: "Patients receive accurate supply, clear counselling and documented advice — supporting safe medicines use at home.", bullets: ["Accurate supply", "Counselling at handover", "Interaction checks completed", "Clear next steps"] },
      { heading: "Safe Supply Results", body: "Structured dispensing reduces errors and improves understanding of new or changed medicines.", bullets: ["Fewer labelling errors", "Better adherence", "GP liaison when needed", "Documented advice"] },
      { heading: "Patient Benefits", body: "Community dispensing offers accessible professional review on every prescription without always needing a GP appointment for supply.", bullets: ["Convenient collection", "Professional oversight", "Questions answered", "Repeat coordination"] },
      { heading: "Medicines Continuity", body: "Reliable dispensing supports ongoing treatment — especially for long-term and multi-medicine regimens.", bullets: ["Timely supply", "Stock management", "Dosage clarity", "Safety-netting"] },
    ],
    mythVsFact: [
      { heading: "Myths Vs Facts", body: "Evidence-based dispensing advice clarifies common misconceptions:", bullets: ["Myth: Pharmacies only label boxes. Fact: Every prescription is clinically screened before supply.", "Myth: Generics are inferior. Fact: Generics contain the same active ingredient when clinically appropriate.", "Myth: Pharmacists can change GP prescriptions freely. Fact: Changes follow strict protocols with prescriber contact when needed."] },
      { heading: "Dispensing Misconceptions", body: "Accurate facts support safer medicines use:", bullets: ["Myth: EPS means instant supply. Fact: Clinical checks still take time.", "Myth: OTC products do not matter. Fact: Interactions must be declared.", "Myth: Skip counselling if busy. Fact: Counselling reduces errors on new medicines."] },
      { heading: "Medicines Supply Facts", body: "Separating myths from facts improves patient safety:", bullets: ["Myth: All pharmacies stock every item. Fact: Some medicines need ordering.", "Myth: Doubling up after a missed dose is fine. Fact: Ask a pharmacist — it can be harmful.", "Myth: Pharmacy replaces GP for changes. Fact: GPs authorise treatment changes."] },
      { heading: "Common Dispensing Myths", body: "Clear information helps you use pharmacy services effectively:", bullets: ["Myth: Private scripts are always instant. Fact: Clinical checks still apply.", "Myth: Repeats never expire. Fact: GP authorisation intervals apply.", "Myth: Children dose the same as adults. Fact: Weight and age-based dosing matters."] },
    ],
    cta: ctaSet(
      ["Collect Prescription", "Nominate Pharmacy", "Ask About Supply", "Check Readiness", "Speak To Pharmacy"],
      ["Ask A Pharmacist", "Get Advice", "Phone The Team", "Book Consultation", "Request Help"],
    ),
    faqs: faqs([
      { question: "How long does dispensing take?", answer: "New prescriptions need clinical checks — allow time on first supply. Repeats may be ready sooner once records are established." },
      { question: "What is EPS nomination?", answer: "Electronic Prescription Service sends prescriptions from your GP to a nominated pharmacy digitally, reducing paper delays." },
      { question: "Do pharmacists check every prescription?", answer: "Yes — clinical screening includes interactions, dosage and suitability before supply." },
      { question: "Can someone collect on my behalf?", answer: "Yes in most cases — controlled drugs may need ID and authorisation. Check with the pharmacy team." },
      { question: "What if my medicine is out of stock?", answer: "The pharmacy may order it or suggest alternatives after contacting your prescriber if clinically appropriate." },
      { question: "Do I need ID to collect medicines?", answer: "Photo ID is commonly required for controlled drugs and some NHS services — ask when you order." },
      { question: "Can I get a prescription delivered?", answer: "Many pharmacies offer delivery — availability and charges vary. Ask when nominating or ordering." },
      { question: "What should I ask at collection?", answer: "Ask how to take the medicine, side effects to watch for, interactions with OTC products, and when to contact your GP." },
      { question: "What if I miss a dose?", answer: "Do not double up without advice — contact the pharmacy or GP for guidance specific to your medicine." },
      { question: "Are generic medicines the same?", answer: "Generics contain the same active ingredient as brands when clinically appropriate — your pharmacist can explain any differences." },
      { question: "When should I contact my GP about medicines?", answer: "If treatment is not working, symptoms worsen, or you need dose changes — GPs authorise ongoing treatment." },
      { question: "Can the pharmacy help with repeat ordering?", answer: "Pharmacy teams advise on reorder timing and EPS — but GP surgeries authorise repeat prescriptions." },
      { question: "What is a clinical check?", answer: "A pharmacist reviews the prescription for safety, interactions and appropriate supply before preparation." },
      { question: "Can I switch pharmacy easily?", answer: "Yes — update EPS nomination with your GP surgery and inform both pharmacies to avoid duplicate supply." },
      { question: "What if I have side effects?", answer: "Contact the pharmacy or GP promptly — do not stop critical medicines without clinical advice." },
    ]),
  },

  // repeat-prescriptions, travel-vaccinations, travel-health-consultations continue...
};
