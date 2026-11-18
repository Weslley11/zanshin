export type Capabilities = {
  llm: { provider: string; model: string; generative: boolean };
  stt: { provider: string | null; available: boolean };
  tts: { provider: string; server_available: boolean };
  pronunciation_assessment: { provider: string | null; available: boolean; fallback: string };
  realtime_streaming: boolean;
  notes_pt: string[];
};

export type Profile = {
  language: string;
  cefr_estimate: string | null;
  skill_scores: Record<string, number>;
  daily_minutes: number;
  goals: string[];
  focus_domains: string[];
  difficulties: string[];
  trip_date: string | null;
  preferred_accents: string[];
  new_cards_per_day: number;
  trip_destination: string | null;
};

export type Me = {
  id: string;
  email: string;
  display_name: string;
  active_language: string;
  consents: Record<string, boolean>;
  profiles: Profile[];
};

export type Activity = {
  id: string;
  type: string;
  title_pt: string;
  minutes: number;
  skills: string[];
  params: Record<string, any>;
  done: boolean;
};

export type PlanDay = {
  day: number;
  date: string;
  phase: number;
  focus: string;
  is_assessment_day: boolean;
  completed: boolean;
  minutes: number;
  activities: Activity[];
};

export type Correction = {
  original: string;
  corrected: string;
  explanation_pt: string;
  category: string;
  subtype: string;
  severity: "minor" | "may_confuse" | "blocks_understanding";
};

export type Turn = { role: "user" | "assistant"; text: string; corrections?: Correction[] };

export type Report = {
  summary_pt: string;
  strengths_pt: string[];
  main_errors: (Correction & { count: number })[];
  corrected_sentences: { original: string; corrected: string }[];
  natural_expressions: { learner_said: string; more_natural: string; note_pt: string }[];
  new_vocabulary: { term: string; meaning_pt: string; example: string }[];
  recommendations_pt: string[];
  exercises: { type: string; instruction_pt: string; prompt: string; answer: string }[];
  cefr_observation_pt: string;
  limitations_pt?: string;
  goals?: { id: string; pt: string; achieved: boolean }[];
  goals_note_pt?: string;
  metrics: Record<string, number | null>;
  added_to_review?: number;
  engine: string;
};

export type Card = {
  card_id: string;
  state: string;
  item: { term: string; kind: string; meaning_pt: string; example: string; pronunciation: string; source: string; cefr: string; definition?: string };
  prompt: { meaning_pt: string; cloze: string };
  intervals_days: Record<string, number>;
};
