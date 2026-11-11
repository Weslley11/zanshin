import type { IconName } from "../components/ui";
import type { GradientName } from "./theme";

export type Module = {
  id: string; title: string; subtitle: string; icon: IconName; gradient: GradientName;
  href: string | { pathname: string; params?: Record<string, string> }; serverOnly?: boolean; enOnly?: boolean;
};

/** Módulos do app (cada um com identidade visual própria). */
export const MODULES: Module[] = [
  { id: "tutor", title: "Conversa com o tutor", subtitle: "Fale sem medo: correções só no final", icon: "chatbubbles", gradient: "tutor", href: { pathname: "/tutor/new", params: { mode: "natural" } } },
  { id: "unlock", title: "Destravar a Fala", subtitle: "Respostas rápidas sem traduzir", icon: "flash", gradient: "unlock", href: "/unlock" },
  { id: "listening", title: "Listening", subtitle: "Sotaques e velocidades reais", icon: "headset", gradient: "listening", href: "/listening", enOnly: true },
  { id: "vocab", title: "Vocabulário", subtitle: "Revisão espaçada (FSRS)", icon: "albums", gradient: "vocab", href: "/(tabs)/vocab" },
  { id: "scenarios", title: "Simulações", subtitle: "Aeroporto, hotel, reuniões", icon: "airplane", gradient: "scenarios", href: "/scenarios", enOnly: true },
  { id: "shadowing", title: "Shadowing", subtitle: "Imite o ritmo e a entonação", icon: "repeat", gradient: "shadowing", href: "/shadowing" },
  { id: "india", title: "Inglês da Índia", subtitle: "Sotaque, expressões, lakh/crore", icon: "earth", gradient: "india", href: "/india", enOnly: true },
  { id: "plan", title: "Jornada 90 dias", subtitle: "Fases, metas e avaliações", icon: "map", gradient: "plan", href: "/plan" },
  { id: "assessment", title: "Avaliação", subtitle: "Seu nível por competência", icon: "ribbon", gradient: "assessment", href: { pathname: "/assessment", params: { kind: "checkpoint" } }, enOnly: true },
  { id: "errors", title: "Seus erros", subtitle: "Revisão do que você mais erra", icon: "construct", gradient: "errors", href: "/errors" },
  { id: "documents", title: "Documentos", subtitle: "Exercícios do seu material", icon: "document-text", gradient: "documents", href: "/documents", serverOnly: true, enOnly: true },
];

export const moduleById = (id: string) => MODULES.find((m) => m.id === id)!;
