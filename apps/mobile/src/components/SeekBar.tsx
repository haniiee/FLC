import { useRef, useState } from "react";
import { LayoutChangeEvent, PanResponder, View } from "react-native";
import { useTheme } from "../theme/theme";

type SeekBarProps = {
  value: number;
  maximumValue: number;
  onSlidingStart?: (value: number) => void;
  onValueChange?: (value: number) => void;
  onSlidingComplete: (value: number) => void;
};

export function SeekBar({
  value,
  maximumValue,
  onSlidingStart,
  onValueChange,
  onSlidingComplete,
}: SeekBarProps) {
  const { colors } = useTheme();
  const widthRef = useRef(1);
  const maxRef = useRef(maximumValue);
  maxRef.current = Math.max(maximumValue, 0.001);
  const callbacks = useRef({ onSlidingStart, onValueChange, onSlidingComplete });
  callbacks.current = { onSlidingStart, onValueChange, onSlidingComplete };
  const [dragging, setDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);

  function valueFromX(x: number) {
    const ratio = Math.min(1, Math.max(0, x / widthRef.current));
    return ratio * maxRef.current;
  }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        const next = valueFromX(event.nativeEvent.locationX);
        setDragging(true);
        setDragValue(next);
        callbacks.current.onSlidingStart?.(next);
        callbacks.current.onValueChange?.(next);
      },
      onPanResponderMove: (event) => {
        const next = valueFromX(event.nativeEvent.locationX);
        setDragValue(next);
        callbacks.current.onValueChange?.(next);
      },
      onPanResponderRelease: (event) => {
        const next = valueFromX(event.nativeEvent.locationX);
        setDragging(false);
        callbacks.current.onSlidingComplete(next);
      },
      onPanResponderTerminate: () => {
        setDragging(false);
      },
    }),
  ).current;

  const shown = dragging ? dragValue : value;
  const progress = Math.min(1, Math.max(0, shown / maxRef.current));
  const thumb = dragging ? 18 : 14;

  function onLayout(event: LayoutChangeEvent) {
    widthRef.current = Math.max(1, event.nativeEvent.layout.width);
  }

  return (
    <View
      onLayout={onLayout}
      {...pan.panHandlers}
      style={{ height: 44, justifyContent: "center" }}
      accessibilityRole="adjustable"
      accessibilityValue={{
        min: 0,
        max: Math.round(maxRef.current),
        now: Math.round(shown),
      }}
    >
      <View
        pointerEvents="none"
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
          marginLeft: -thumb / 2,
          width: thumb,
          height: thumb,
          borderRadius: thumb / 2,
          backgroundColor: colors.primary,
        }}
      />
    </View>
  );
}
