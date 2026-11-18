import { useRef } from "react";
import { LayoutChangeEvent, PanResponder, View } from "react-native";
import { useTheme } from "../theme/theme";

type SeekBarProps = {
  value: number;
  maximumValue: number;
  onSlidingComplete: (value: number) => void;
};

export function SeekBar({ value, maximumValue, onSlidingComplete }: SeekBarProps) {
  const { colors } = useTheme();
  const widthRef = useRef(1);
  const maxRef = useRef(maximumValue);
  maxRef.current = Math.max(maximumValue, 0.001);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const ratio = Math.min(1, Math.max(0, evt.nativeEvent.locationX / widthRef.current));
        onSlidingComplete(ratio * maxRef.current);
      },
      onPanResponderRelease: (evt) => {
        const ratio = Math.min(1, Math.max(0, evt.nativeEvent.locationX / widthRef.current));
        onSlidingComplete(ratio * maxRef.current);
      },
    }),
  ).current;

  const progress = Math.min(1, Math.max(0, value / maxRef.current));

  function onLayout(event: LayoutChangeEvent) {
    widthRef.current = Math.max(1, event.nativeEvent.layout.width);
  }

  return (
    <View
      onLayout={onLayout}
      {...pan.panHandlers}
      style={{ height: 28, justifyContent: "center" }}
      accessibilityRole="adjustable"
      accessibilityValue={{
        min: 0,
        max: Math.round(maxRef.current),
        now: Math.round(value),
      }}
    >
      <View
        style={{
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: 4,
            width: `${progress * 100}%`,
            backgroundColor: colors.primary,
          }}
        />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: `${progress * 100}%`,
          marginLeft: -7,
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: colors.primary,
        }}
      />
    </View>
  );
}
