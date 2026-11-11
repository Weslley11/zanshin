import type { Activity } from "./types";

export const ACTIVITY_ICONS: Record<string, string> = {
  vocab_review: "🗂️", listening: "🎧", shadowing: "🔁", quick_response: "⚡", sentence_building: "🧩",
  think_in_english: "💭", conversation: "💬", scenario: "🎭", error_review: "🩹", assessment: "📊",
};

/** Ícone (Ionicons) e gradiente de cada tipo de atividade. */
export const ACTIVITY_STYLE: Record<string, { icon: string; gradient: string }> = {
  vocab_review: { icon: "albums", gradient: "vocab" }, listening: { icon: "headset", gradient: "listening" },
  shadowing: { icon: "repeat", gradient: "shadowing" }, quick_response: { icon: "flash", gradient: "unlock" },
  sentence_building: { icon: "extension-puzzle", gradient: "unlock" }, think_in_english: { icon: "bulb", gradient: "unlock" },
  conversation: { icon: "chatbubbles", gradient: "tutor" }, scenario: { icon: "airplane", gradient: "scenarios" },
  error_review: { icon: "construct", gradient: "errors" }, assessment: { icon: "ribbon", gradient: "assessment" },
};

/** Rota do app para cada tipo de atividade do plano (com parâmetros para marcar como concluída). */
export function activityHref(a: Activity, day: number): { pathname: string; params: Record<string, string> } {
  const base = { planDay: String(day), planActivity: a.id };
  switch (a.type) {
    case "vocab_review":
      return { pathname: "/(tabs)/vocab", params: base };
    case "listening":
      return a.params.listening_id
        ? { pathname: "/listening/[id]", params: { ...base, id: a.params.listening_id } }
        : { pathname: "/listening", params: base };
    case "shadowing":
      return { pathname: "/shadowing", params: base };
    case "quick_response":
      return { pathname: "/drills/quick", params: base };
    case "sentence_building":
      return { pathname: "/drills/build", params: base };
    case "think_in_english":
      return { pathname: "/drills/think", params: base };
    case "error_review":
      return { pathname: "/errors", params: base };
    case "assessment":
      return { pathname: "/assessment", params: { ...base, kind: a.params.kind ?? "checkpoint" } };
    case "scenario":
      return { pathname: "/tutor/new", params: { ...base, mode: "scenario", scenario: a.params.scenario_id ?? "" } };
    case "conversation":
    default:
      return {
        pathname: "/tutor/new",
        params: { ...base, mode: a.params.mode === "no_native" ? "no_native" : "challenge", minutes: String(a.params.challenge_minutes ?? 5) },
      };
  }
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}
