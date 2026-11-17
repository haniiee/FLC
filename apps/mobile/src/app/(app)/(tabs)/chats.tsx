import { MessagesSquare } from "lucide-react-native";
import { useRef } from "react";
import { ScrollView } from "react-native";
import { EmptyState } from "../../../components/EmptyState";
import { Screen } from "../../../components/Screen";
import { ScreenHeader } from "../../../components/ScreenHeader";
import { copy } from "../../../lib/copy";
import { useTabScrollToTop } from "../../../lib/use-tab-scroll-to-top";

export default function ChatsScreen() {
  const ref = useRef(null);
  useTabScrollToTop(ref);

  return (
    <Screen padded={false} edges={["top"]}>
      <ScreenHeader title={copy.chats.title} />
      <ScrollView ref={ref} contentContainerStyle={{ flexGrow: 1 }}>
        <EmptyState
          icon={MessagesSquare}
          title={copy.chats.emptyTitle}
          subtitle={copy.chats.emptySubtitle}
        />
      </ScrollView>
    </Screen>
  );
}
