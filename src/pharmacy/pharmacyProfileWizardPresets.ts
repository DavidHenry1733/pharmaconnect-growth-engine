/**
 * Business Profile Wizard V2 — preset options for checkboxes/dropdowns.
 */

export const PATIENT_GROUP_OPTIONS = [
  { id: "older-patients", label: "Older patients" },
  { id: "families", label: "Families" },
  { id: "students", label: "Students" },
  { id: "working-adults", label: "Working adults" },
  { id: "care-homes", label: "Care homes" },
  { id: "travellers", label: "Travellers" },
  { id: "hypertension", label: "Patients with high blood pressure" },
  { id: "diabetes", label: "Diabetes patients" },
  { id: "asthma-copd", label: "Asthma / COPD patients" },
  { id: "weight-management", label: "Weight management patients" },
  { id: "smoking-cessation", label: "Smoking cessation patients" },
  { id: "repeat-prescriptions", label: "Repeat prescription patients" },
  { id: "urgent-care", label: "Urgent care patients" },
] as const;

export const CONSULTATION_LENGTH_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "5", label: "About 5 minutes" },
  { value: "10", label: "About 10 minutes" },
  { value: "15", label: "About 15 minutes" },
  { value: "20", label: "About 20 minutes" },
  { value: "30", label: "About 30 minutes" },
  { value: "45", label: "About 45 minutes" },
] as const;

export const SERVICE_EQUIPMENT_OPTIONS = [
  "Blood pressure monitor",
  "Consultation room",
  "Private treatment area",
  "ABPM device",
  "Vaccination fridge",
  "Otoscope / ear care kit",
  "Weight scales",
  "Pulse oximeter",
] as const;

export const SERVICE_PREPARATION_OPTIONS = [
  "Bring medication list",
  "Avoid caffeine before check",
  "Wear loose clothing",
  "Rest 5 minutes before reading",
  "Continue usual medicines",
  "Book appointment in advance",
  "Walk-in welcome",
] as const;

export const SERVICE_AFTERCARE_OPTIONS = [
  "GP referral if needed",
  "Written result record",
  "Lifestyle advice",
  "Follow-up appointment offered",
  "Emergency signposting explained",
  "Repeat check reminder",
] as const;

export const SERVICE_REFERRAL_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "gp-referral", label: "GP referral when needed" },
  { value: "specialist-referral", label: "Specialist referral pathway" },
  { value: "self-care", label: "Self-care advice only" },
  { value: "emergency-signpost", label: "Emergency signposting" },
] as const;

export const SERVICE_RESULTS_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "immediate", label: "Results discussed immediately" },
  { value: "written-record", label: "Written record provided" },
  { value: "follow-up-call", label: "Follow-up call if needed" },
] as const;

export const TRUST_ACCREDITATION_PRESETS = [
  "GPhC registered pharmacy",
  "NHS services available",
  "Private consultation room",
  "Pharmacist-led advice",
  "Independent prescriber service",
  "Travel health clinic",
  "Healthy living pharmacy",
] as const;

export const CONTENT_TONE_OPTIONS = [
  { value: "professional", label: "Professional" },
  { value: "warm", label: "Warm and friendly" },
  { value: "clinical", label: "Clinical and clear" },
  { value: "plain-english", label: "Plain English" },
] as const;

export const BOOKING_METHOD_OPTIONS = [
  { value: "", label: "Not sure yet" },
  { value: "Call the pharmacy team", label: "Call the pharmacy" },
  { value: "Walk in", label: "Walk in" },
  { value: "Book online", label: "Book online" },
  { value: "NHS App / GP referral", label: "NHS App / GP referral" },
] as const;

/** Map preset id → profile targetPatientGroups label */
export function patientGroupLabelForId(id: string): string {
  return PATIENT_GROUP_OPTIONS.find((o) => o.id === id)?.label || id;
}

export function selectedPatientGroupIds(groups: string[]): string[] {
  const labels = new Set(groups.map((g) => g.toLowerCase()));
  return PATIENT_GROUP_OPTIONS.filter((o) =>
    labels.has(o.label.toLowerCase()) || labels.has(o.id),
  ).map((o) => o.id);
}
