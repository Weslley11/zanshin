/**
 * Conteúdo pedagógico usado no modo local (sem servidor).
 * Gerado a partir de backend/app/content por backend/scripts/export_content.py — não edite o JSON à mão.
 */
import raw from "../../content/content.json";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const CONTENT: any = raw;
export const CEFR_LEVELS: string[] = CONTENT.cefr.levels;
export const CEFR_ANCHORS: Record<string, number> = CONTENT.cefr.anchors;

export function scoreToCefr(score: number): string {
  let level = "A1";
  for (const lvl of CEFR_LEVELS) if (score >= CEFR_ANCHORS[lvl] - 7) level = lvl;
  return level;
}

export function publicLanguage(code: string) {
  const { tutor_notes: _omit, ...rest } = CONTENT.languages[code];
  return rest;
}
