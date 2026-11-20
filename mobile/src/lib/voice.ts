import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { localeFor } from "./speech";

/**
 * Entrada de voz com degradação explícita:
 * 1) "server": grava (expo-audio) e envia ao backend (STT/avaliação no servidor);
 * 2) "browser": no navegador, usa o reconhecimento de fala do próprio navegador (Web Speech API);
 * 3) "none": apenas texto — a interface informa o motivo.
 */
export type VoiceMode = "server" | "browser" | "none";
export type VoiceResult =
  | { kind: "audio"; form: FormData; durationSec: number }
  | { kind: "transcript"; text: string; durationSec: number };

function browserRecognitionCtor(): any {
  if (Platform.OS !== "web") return null;
  const w = globalThis as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// se o navegador bloquear o reconhecimento (comum no app instalado no iPhone), escondemos o microfone na sessão
let browserBlocked = false;

export function detectVoiceMode(serverStt: boolean): VoiceMode {
  if (serverStt) return "server";
  return browserRecognitionCtor() && !browserBlocked ? "browser" : "none";
}

export function useVoiceInput(serverStt: boolean, language = "en") {
  const mode = detectVoiceMode(serverStt);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(0);
  const recog = useRef<any>(null);
  const transcript = useRef("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    recog.current?.abort?.();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (mode === "none") {
      setError("Reconhecimento de voz indisponível neste dispositivo/servidor. Use o teclado.");
      return false;
    }
    if (mode === "server") {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setError("Permita o acesso ao microfone nas configurações do aparelho.");
        return false;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } else {
      const Ctor = browserRecognitionCtor();
      const r = new Ctor();
      r.lang = localeFor(language);
      r.continuous = true;
      r.interimResults = false;
      transcript.current = "";
      r.onresult = (e: any) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) transcript.current += " " + e.results[i][0].transcript;
        }
      };
      r.onerror = (e: any) => {
        // não deixa o botão preso em "gravando": encerra e explica o que fazer
        if (timer.current) clearInterval(timer.current);
        setRecording(false);
        recog.current = null;
        if (e.error === "no-speech") {
          setError("Não captei a sua voz. Tente de novo, mais perto do microfone.");
        } else if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "audio-capture") {
          browserBlocked = true;
          setError("O iPhone bloqueou o reconhecimento de voz neste app. Toque no campo de texto e use o microfone do teclado para ditar em inglês.");
        } else {
          setError("Falha no reconhecimento de voz. Use o microfone do teclado ou digite.");
        }
      };
      recog.current = r;
      try {
        r.start();
      } catch {
        browserBlocked = true;
        setError("Reconhecimento de voz indisponível aqui. Use o microfone do teclado para ditar.");
        recog.current = null;
        return false;
      }
    }
    startedAt.current = Date.now();
    setElapsed(0);
    timer.current = setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 250);
    setRecording(true);
    return true;
  }, [mode, recorder, language]);

  const stop = useCallback(async (): Promise<VoiceResult | null> => {
    if (timer.current) clearInterval(timer.current);
    setRecording(false);
    const durationSec = (Date.now() - startedAt.current) / 1000;
    if (mode === "server") {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = recorder.uri;
      if (!uri) return null;
      const form = new FormData();
      if (Platform.OS === "web") {
        const blob = await (await fetch(uri)).blob();
        form.append("audio", blob, "speech.webm");
      } else {
        form.append("audio", { uri, name: "speech.m4a", type: "audio/mp4" } as any);
      }
      return { kind: "audio", form, durationSec };
    }
    if (mode === "browser" && recog.current) {
      const r = recog.current;
      await new Promise<void>((resolve) => {
        r.onend = () => resolve();
        try { r.stop(); } catch { resolve(); }
        setTimeout(resolve, 600);
      });
      recog.current = null;
      return { kind: "transcript", text: transcript.current.trim(), durationSec };
    }
    return null;
  }, [mode, recorder]);

  return { mode, recording, elapsed, error, start, stop };
}
