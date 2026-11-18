/**
 * Voz do aparelho na versão web/PWA (Web Speech API), com contornos para o Safari do iPhone:
 * - o primeiro `speak` precisa acontecer dentro de um toque: "destravamos" o mecanismo no primeiro toque na tela;
 * - `cancel()` seguido de `speak()` no mesmo instante faz o Safari descartar a fala nova: esperamos um instante;
 * - se não houver voz do sotaque pedido (ex.: inglês da Índia), usamos outra voz em inglês em vez de ficar mudo;
 * - pedimos ao iOS 17+ que trate o áudio como "reprodução" (`navigator.audioSession`), o que ajuda no modo silencioso.
 * Se a fala não começar, avisamos a interface (dica de som) para a pessoa saber o que verificar.
 */

type Listener = (problem: "no_start" | "unsupported") => void;
const listeners = new Set<Listener>();
export function onAudioProblem(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
const emit = (p: "no_start" | "unsupported") => listeners.forEach((l) => l(p));

const IS_WEB = typeof document !== "undefined" && typeof window !== "undefined" && typeof window.addEventListener === "function";
const synth = (): SpeechSynthesis | null => (IS_WEB && "speechSynthesis" in window ? window.speechSynthesis : null);

let voices: SpeechSynthesisVoice[] = [];
function loadVoices() {
  const s = synth();
  if (!s) return;
  voices = s.getVoices();
}
if (synth()) {
  loadVoices();
  synth()!.addEventListener?.("voiceschanged", loadVoices);
}

export function englishVoices(): SpeechSynthesisVoice[] {
  loadVoices();
  return voices.filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith("en"));
}

/** Melhor voz para o idioma/sotaque: exata (en-IN) → mesma língua no aparelho → qualquer da língua → nenhuma (padrão). */
export function pickVoice(locale: string): SpeechSynthesisVoice | null {
  loadVoices();
  const want = locale.toLowerCase();
  const norm = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace("_", "-");
  const lang = want.split("-")[0];
  const exact = voices.filter((v) => norm(v) === want);
  const same = voices.filter((v) => norm(v).startsWith(lang));
  const prefer = (list: SpeechSynthesisVoice[]) => list.find((v) => v.localService) ?? list[0] ?? null;
  return prefer(exact) ?? prefer(same.filter((v) => norm(v) === "en-us" || lang !== "en")) ?? prefer(same);
}

let unlocked = false;
/** Chamado no primeiro toque na tela: fala um texto vazio e mudo para liberar o áudio no iPhone. */
export function unlockWebSpeech() {
  const s = synth();
  if (!s || unlocked) return;
  unlocked = true;
  try {
    const nav = navigator as any;
    if (nav.audioSession) nav.audioSession.type = "playback";
  } catch {
    /* navegador sem audioSession */
  }
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    s.speak(u);
  } catch {
    /* sem suporte */
  }
}
if (IS_WEB) {
  const once = () => {
    unlockWebSpeech();
    window.removeEventListener("touchend", once, true);
    window.removeEventListener("click", once, true);
  };
  window.addEventListener("touchend", once, true);
  window.addEventListener("click", once, true);
}

let seq = 0;
export function webStop() {
  seq++;
  const s = synth();
  if (s && (s.speaking || s.pending)) s.cancel();
}

export function webSpeak(text: string, locale: string, rate: number, onDone: () => void) {
  const s = synth();
  if (!s) {
    emit("unsupported");
    onDone();
    return;
  }
  const my = ++seq;
  const busy = s.speaking || s.pending;
  if (busy) s.cancel();
  const go = () => {
    if (my !== seq) return; // outra fala foi pedida nesse meio-tempo
    const u = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(locale);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else {
      u.lang = locale;
    }
    u.rate = Math.max(0.5, Math.min(rate, 1.5));
    u.volume = 1;
    let started = false;
    u.onstart = () => { started = true; };
    u.onend = () => onDone();
    u.onerror = () => onDone();
    s.speak(u);
    // Safari às vezes "trava" em pausa
    if (s.paused) s.resume();
    setTimeout(() => {
      if (!started && my === seq && !s.speaking) emit("no_start");
    }, 2500);
  };
  // Safari no iPhone descarta a fala se ela vier logo depois de um cancel()
  if (busy) setTimeout(go, 120);
  else go();
}
