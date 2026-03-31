import type {
  ContactItem,
  CvData,
  CvTemplate,
  EducationItem,
  ExperienceItem,
  ProjectItem,
  SectionKey,
  TrainingItem,
} from "../../data/cvData";

const SECTION_ORDER_DEFAULT: SectionKey[] = [
  "experience",
  "education",
  "projects",
  "trainings",
  "certifications",
];

const CONTACT_KINDS: ContactItem["kind"][] = ["email", "phone", "linkedin", "website", "location"];

function normalizeSectionOrder(order: unknown): SectionKey[] {
  if (!Array.isArray(order)) return [...SECTION_ORDER_DEFAULT];
  const valid = order.filter((item): item is SectionKey => SECTION_ORDER_DEFAULT.includes(item as SectionKey));
  return valid.filter((item, index) => valid.indexOf(item) === index);
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function emptyCvData(): CvData {
  return {
    profile: {
      fullName: "",
      title: "",
      summary: "",
      location: "",
      email: "",
      phone: "",
      website: "",
      linkedin: "",
      photoUrl: "./profile-placeholder.svg",
    },
    footer: { rodoClause: "" },
    contacts: [],
    skills: [],
    experience: [],
    education: [],
    projects: [],
    trainings: [],
    sectionOrder: [...SECTION_ORDER_DEFAULT],
    languages: [],
    certifications: [],
  };
}

function migrateContact(raw: unknown): ContactItem {
  const base: ContactItem = {
    kind: "email",
    label: "",
    value: "",
    href: "",
  };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const kind = o.kind;
  const k = CONTACT_KINDS.includes(kind as ContactItem["kind"]) ? (kind as ContactItem["kind"]) : "email";
  return {
    ...base,
    kind: k,
    label: asString(o.label),
    value: asString(o.value),
    href: typeof o.href === "string" ? o.href : undefined,
  };
}

function migrateExperience(raw: unknown): ExperienceItem {
  const base: ExperienceItem = {
    role: "",
    company: "",
    location: "",
    period: "",
    bullets: [],
    descriptionMd: "- ",
  };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const bullets = Array.isArray(o.bullets) ? o.bullets.filter((b): b is string => typeof b === "string") : [];
  const descriptionMd =
    typeof o.descriptionMd === "string"
      ? o.descriptionMd
      : bullets.length > 0
        ? bullets.map((b) => `- ${b}`).join("\n")
        : "- ";
  return {
    role: asString(o.role),
    company: asString(o.company),
    location: asString(o.location),
    period: asString(o.period),
    bullets,
    descriptionMd,
  };
}

function migrateEducation(raw: unknown): EducationItem {
  const base: EducationItem = { school: "", degree: "", period: "", notes: "" };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  return {
    school: asString(o.school),
    degree: asString(o.degree),
    period: asString(o.period),
    notes: typeof o.notes === "string" ? o.notes : undefined,
  };
}

function migrateProject(raw: unknown): ProjectItem {
  const base: ProjectItem = { name: "", period: "", description: "- ", link: "" };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  return {
    name: asString(o.name),
    period: asString(o.period),
    description: asString(o.description) || "- ",
    link: typeof o.link === "string" ? o.link : undefined,
  };
}

function migrateTraining(raw: unknown): TrainingItem {
  const base: TrainingItem = { title: "", provider: "", year: "" };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  return {
    title: asString(o.title),
    provider: asString(o.provider),
    year: asString(o.year),
  };
}

/**
 * Uzupełnia brakujące pola struktury CvData wartościami domyślnymi (puste stringi / puste tablice).
 * Bezpieczne dla starszych plików JSON bez np. footer.rodoClause, sectionOrder, languages.
 */
export function migrateCvData(raw: unknown): CvData {
  const out = emptyCvData();
  if (!raw || typeof raw !== "object") return out;
  const d = raw as Record<string, unknown>;

  if (d.profile && typeof d.profile === "object") {
    const p = d.profile as Record<string, unknown>;
    out.profile = {
      fullName: asString(p.fullName),
      title: asString(p.title),
      summary: asString(p.summary),
      location: asString(p.location),
      email: asString(p.email),
      phone: asString(p.phone),
      website: asString(p.website),
      linkedin: asString(p.linkedin),
      photoUrl: asString(p.photoUrl) || "./profile-placeholder.svg",
    };
  }

  if (d.footer && typeof d.footer === "object") {
    const f = d.footer as Record<string, unknown>;
    out.footer = { rodoClause: asString(f.rodoClause) };
  }

  if (Array.isArray(d.contacts)) {
    out.contacts = d.contacts.map(migrateContact);
  }
  if (Array.isArray(d.skills)) {
    out.skills = d.skills.map((s) => (typeof s === "string" ? s : ""));
  }
  if (Array.isArray(d.experience)) {
    out.experience = d.experience.map(migrateExperience);
  }
  if (Array.isArray(d.education)) {
    out.education = d.education.map(migrateEducation);
  }
  if (Array.isArray(d.projects)) {
    out.projects = d.projects.map(migrateProject);
  }
  if (Array.isArray(d.trainings)) {
    out.trainings = d.trainings.map(migrateTraining);
  }
  if (Array.isArray(d.languages)) {
    out.languages = d.languages.map((s) => (typeof s === "string" ? s : ""));
  }
  if (Array.isArray(d.certifications)) {
    out.certifications = d.certifications.map((s) => (typeof s === "string" ? s : ""));
  }

  out.sectionOrder = normalizeSectionOrder(d.sectionOrder);

  return out;
}

/**
 * Walidacja + migracja szablonu PL+EN. Wymaga obiektu z kluczem `pl` (obiekt).
 * Brak `en` → kopia zmigrowanego `pl` (żeby uniknąć pustego EN).
 */
export function migrateCvTemplate(parsed: unknown): CvTemplate | null {
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const plRaw = o.pl;
  if (!plRaw || typeof plRaw !== "object") return null;
  const pl = migrateCvData(plRaw);
  const enRaw = o.en && typeof o.en === "object" ? o.en : plRaw;
  const en = migrateCvData(enRaw);
  return { pl, en };
}
