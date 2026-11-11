/** Player Lottie nativo (iOS/Android) — animações no formato do After Effects (Bodymovin). */
import LottieView from "lottie-react-native";
import type { StyleProp, ViewStyle } from "react-native";

export type LottieProps = { source: object; loop?: boolean; autoPlay?: boolean; speed?: number; style?: StyleProp<ViewStyle>; onFinish?: () => void };

export default function Lottie({ source, loop = true, autoPlay = true, speed = 1, style, onFinish }: LottieProps) {
  return <LottieView source={source as any} loop={loop} autoPlay={autoPlay} speed={speed} style={style} onAnimationFinish={() => onFinish?.()} />;
}
