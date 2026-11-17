import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { EmptyState, Loading, Screen } from "../../../components/ui";
import { getApiClient } from "../../../lib/api";
import { roleLabel } from "../../../lib/format";
import { colors } from "../../../theme/colors";

export default function GroupDetailScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();

  const groupQuery = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => getApiClient().getGroup(groupId),
    enabled: Boolean(groupId),
  });

  const sessionsQuery = useQuery({
    queryKey: ["sessions", groupId],
    queryFn: () => getApiClient().listSessions(groupId),
    enabled: Boolean(groupId),
  });

  if (groupQuery.isLoading || sessionsQuery.isLoading) {
    return <Loading />;
  }

  if (!groupQuery.data) {
    return <EmptyState title="کلاس پیدا نشد" />;
  }

  const group = groupQuery.data;
  const sessions = sessionsQuery.data?.sessions ?? [];

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <Stack.Screen options={{ title: group.name }} />
      <View style={styles.meta}>
        <Text style={styles.metaText}>نقش شما: {roleLabel(group.myRole)}</Text>
      </View>

      <Text style={styles.section}>جلسه‌ها</Text>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={sessions.length === 0 ? styles.emptyList : styles.list}
        refreshControl={
          <RefreshControl
            refreshing={sessionsQuery.isRefetching || groupQuery.isRefetching}
            onRefresh={() => {
              void groupQuery.refetch();
              void sessionsQuery.refetch();
            }}
            tintColor={colors.secondary}
          />
        }
        ListEmptyComponent={<EmptyState title="هنوز جلسه‌ای نیست" />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.displayName}</Text>
            <Text style={styles.cardMeta}>
              {item.topicCount} تاپیک · {item.fileCount} فایل
            </Text>
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 4,
  },
  metaText: {
    color: colors.textMuted,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: "700",
    color: colors.secondary,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
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
