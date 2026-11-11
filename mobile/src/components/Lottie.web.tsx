/** Player Lottie para web/PWA (lottie-web, renderização SVG) — mesmo JSON exportado do After Effects. */
import lottie, { type AnimationItem } from "lottie-web";
import { useEffect, useRef } from "react";
import { View } from "react-native";
import type { LottieProps } from "./Lottie";

export default function Lottie({ source, loop = true, autoPlay = true, speed = 1, style, onFinish }: LottieProps) {
  const ref = useRef<any>(null);
  useEffect(() => {
    const el = ref.current as unknown as HTMLElement | null;
    if (!el) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const anim: AnimationItem = lottie.loadAnimation({ container: el, renderer: "svg", loop: reduce ? false : loop, autoplay: autoPlay, animationData: source });
    anim.setSpeed(speed);
    if (reduce) anim.goToAndStop(anim.totalFrames - 1, true);
    const done = () => onFinish?.();
    anim.addEventListener("complete", done);
    return () => {
      anim.removeEventListener("complete", done);
      anim.destroy();
    };
  }, [source, loop, autoPlay, speed]);
  return <View ref={ref} style={style} pointerEvents="none" aria-hidden />;
}
