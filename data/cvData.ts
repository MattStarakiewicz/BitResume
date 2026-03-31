import defaultTemplateJson from "./template.json";

export type ContactItem = {
  id?: string;
  kind: "email" | "phone" | "linkedin" | "website" | "location";
  label: string;
  value: string;
  href?: string;
};

export type ExperienceItem = {
  id?: string;
  role: string;
  company: string;
  location: string;
  period: string;
  bullets: string[];
  descriptionMd?: string;
};

export type EducationItem = {
  id?: string;
  school: string;
  degree: string;
  period: string;
  notes?: string;
};

export type ProjectItem = {
  id?: string;
  name: string;
  period: string;
  description: string;
  link?: string;
};

export type TrainingItem = {
  id?: string;
  title: string;
  provider: string;
  year: string;
};

export type SectionKey = "experience" | "education" | "projects" | "trainings" | "certifications";

export type CvData = {
  profile: {
    fullName: string;
    title: string;
    summary: string;
    location: string;
    email: string;
    phone: string;
    website: string;
    linkedin: string;
    photoUrl: string;
  };
  footer: {
    rodoClause: string;
  };
  contacts: ContactItem[];
  skills: string[];
  experience: ExperienceItem[];
  education: EducationItem[];
  projects: ProjectItem[];
  trainings: TrainingItem[];
  sectionOrder?: SectionKey[];
  languages: string[];
  certifications: string[];
};

export type Locale = "pl" | "en";
export type CvTemplate = Record<Locale, CvData>;

export const defaultCvTemplate = defaultTemplateJson as CvTemplate;
