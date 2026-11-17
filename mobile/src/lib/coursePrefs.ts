import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const KEY = "fluent.course.dailyGoal";
export const DEFAULT_GOAL = 30;

/** Meta diária de XP da Trilha (preferência do aparelho). */
export function useDailyGoal(): [number, (g: number) => void] {
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v && Number(v) > 0) setGoal(Number(v)); }).catch(() => {});
  }, []);
  const update = useCallback((g: number) => {
    setGoal(g);
    AsyncStorage.setItem(KEY, String(g)).catch(() => {});
  }, []);
  return [goal, update];
}
