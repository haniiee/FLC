import { useNavigation } from "expo-router";
import { useEffect, type RefObject } from "react";

type Scrollable = {
  scrollToOffset?: (options: { offset: number; animated?: boolean }) => void;
  scrollTo?: (options: { y: number; animated?: boolean }) => void;
};

/** Scroll list to top when the active tab is pressed again. */
export function useTabScrollToTop(ref: RefObject<Scrollable | null | undefined>) {
  const navigation = useNavigation();

  useEffect(() => {
    const unsubscribe = navigation.addListener("tabPress" as never, () => {
      const nav = navigation as { isFocused?: () => boolean };
      if (typeof nav.isFocused === "function" && !nav.isFocused()) {
        return;
      }
      const node = ref.current;
      if (!node) return;
      if (typeof node.scrollToOffset === "function") {
        node.scrollToOffset({ offset: 0, animated: true });
        return;
      }
      if (typeof node.scrollTo === "function") {
        node.scrollTo({ y: 0, animated: true });
      }
    });
    return unsubscribe;
  }, [navigation, ref]);
}
