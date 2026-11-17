import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { EmptyState, Loading, Screen } from "../../components/ui";
import { getApiClient } from "../../lib/api";
import { roleLabel } from "../../lib/format";
import { useAuth } from "../../providers/auth-provider";
import { colors } from "../../theme/colors";

export default function GroupsScreen() {
  const { user, logout } = useAuth();
  const groupsQuery = useQuery({
    queryKey: ["groups"],
    queryFn: () => getApiClient().listGroups(),
  });

  if (groupsQuery.isLoading) {
    return <Loading />;
  }

  const groups = groupsQuery.data?.groups ?? [];

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>سلام {user?.displayName ?? ""}</Text>
          <Text style={styles.apiHint}>کلاس‌های شما</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Link href="/join" asChild>
          <Pressable style={styles.chip}>
            <Text style={styles.chipText}>پیوستن با کد دعوت</Text>
          </Pressable>
        </Link>
        <Pressable style={styles.chipGhost} onPress={() => void logout()}>
          <Text style={styles.chipGhostText}>خروج</Text>
        </Pressable>
      </View>

      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        contentContainerStyle={groups.length === 0 ? styles.emptyList : styles.list}
        refreshControl={
          <RefreshControl
            refreshing={groupsQuery.isRefetching}
            onRefresh={() => void groupsQuery.refetch()}
            tintColor={colors.secondary}
          />
        }
        ListEmptyComponent={
          <EmptyState title="هنوز کلاسی ندارید" subtitle="با کد دعوت به کلاس بپیوندید" />
        }
        renderItem={({ item }) => (
          <Link href={`/groups/${item.id}`} asChild>
            <Pressable style={styles.card}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardMeta}>
                نقش شما: {roleLabel(item.myRole)} · {item.memberCount} عضو
              </Text>
            </Pressable>
          </Link>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  hello: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.secondary,
  },
  apiHint: {
    color: colors.textMuted,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chip: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    color: colors.secondary,
    fontWeight: "600",
  },
  chipGhost: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipGhostText: {
    color: colors.danger,
    fontWeight: "600",
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 10,
  },
  emptyList: {
    flexGrow: 1,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  cardMeta: {
    marginTop: 6,
    fontSize: 13,
    color: colors.textMuted,
  },
});
