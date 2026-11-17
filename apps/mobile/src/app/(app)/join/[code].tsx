import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Text } from "react-native";
import { Button, Loading, Screen, Title } from "../../../components/ui";
import { parseJoinCodeFromUrl } from "../../../lib/deep-link";
import { getApiClient } from "../../../lib/api";
import { apiErrorMessage } from "../../../lib/format";
import { useAuth } from "../../../providers/auth-provider";
import { colors } from "../../../theme/colors";

export default function JoinByCodeScreen() {
  const { code: rawCode } = useLocalSearchParams<{ code: string }>();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const code = parseJoinCodeFromUrl(rawCode ?? "") ?? rawCode ?? "";
  const [loading, setLoading] = useState(false);
  const [inviteName, setInviteName] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!code) return;
    void getApiClient()
      .getInvite(code)
      .then((invite) => setInviteName(invite.groupName))
      .catch(() => setInviteName(null));
  }, [code]);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !code || started.current) return;
    started.current = true;
    void (async () => {
      setLoading(true);
      try {
        const result = await getApiClient().joinInvite(code);
        router.replace(`/groups/${result.groupId}`);
      } catch (error) {
        Alert.alert("پیوستن ناموفق", apiErrorMessage(error, "دعوت‌نامه معتبر نیست"));
        setLoading(false);
      }
    })();
  }, [authLoading, code, isAuthenticated]);

  if (authLoading || loading) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return (
      <Screen>
        <Title>پیوستن به کلاس</Title>
        <Text style={styles.subtitle}>
          {inviteName ? `برای پیوستن به «${inviteName}» وارد شوید` : "برای پیوستن وارد شوید"}
        </Text>
        <Button title="ورود" onPress={() => router.push("/login")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>پیوستن</Title>
      <Text style={styles.subtitle}>کد: {code}</Text>
      <Button
        title="تلاش دوباره"
        onPress={() => {
          started.current = false;
          setLoading(false);
          // retrigger effect
          router.replace(`/join/${code}`);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    color: colors.textMuted,
    marginVertical: 12,
  },
});
