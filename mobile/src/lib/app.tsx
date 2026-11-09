import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, auth, loadTokens, setUnauthorizedHandler } from "./api";
import { setServerVoice } from "./speech";
import { getItem, setItem } from "./storage";
import { ThemeModeContext, type ThemeMode } from "./theme";
import type { Capabilities, Me, Profile } from "./types";

type AppState = {
  ready: boolean;
  signedIn: boolean;
  me: Me | null;
  caps: Capabilities | null;
  language: string;
  profile: Profile | null;
  refreshMe: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (body: Record<string, unknown>) => Promise<void>;
  signOut: () => Promise<void>;
  serverVoicePref: boolean;
  setServerVoicePref: (v: boolean) => void;
};

const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp fora do AppProvider");
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [serverVoicePref, setServerVoicePrefState] = useState(true);

  const refreshMe = useCallback(async () => {
    const m = await api<Me>("/me");
    setMe(m);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setSignedIn(false);
      setMe(null);
    });
    (async () => {
      const saved = (await getItem("fluent.theme")) as ThemeMode | null;
      if (saved) setModeState(saved);
      api<Capabilities>("/system/capabilities", { auth: false }).then(setCaps).catch(() => setCaps(null));
      if (await loadTokens()) {
        try {
          await refreshMe();
          setSignedIn(true);
        } catch {
          setSignedIn(false);
        }
      }
      setReady(true);
    })();
  }, [refreshMe]);

  useEffect(() => {
    setServerVoice(!!caps?.tts.server_available && serverVoicePref);
  }, [caps, serverVoicePref]);

  const signIn = useCallback(async (email: string, password: string) => {
    await auth.login(email, password);
    await refreshMe();
    setSignedIn(true);
  }, [refreshMe]);

  const signUp = useCallback(async (body: Record<string, unknown>) => {
    await auth.register(body);
    await refreshMe();
    setSignedIn(true);
  }, [refreshMe]);

  const signOut = useCallback(async () => {
    await auth.logout();
    setMe(null);
    setSignedIn(false);
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    setItem("fluent.theme", m);
  }, []);

  const language = me?.active_language ?? "en";
  const profile = me?.profiles.find((p) => p.language === language) ?? null;

  const value = useMemo<AppState>(() => ({
    ready, signedIn, me, caps, language, profile, refreshMe, signIn, signUp, signOut,
    serverVoicePref, setServerVoicePref: setServerVoicePrefState,
  }), [ready, signedIn, me, caps, language, profile, refreshMe, signIn, signUp, signOut, serverVoicePref]);

  return (
    <ThemeModeContext.Provider value={{ mode, setMode }}>
      <AppContext.Provider value={value}>{children}</AppContext.Provider>
    </ThemeModeContext.Provider>
  );
}
