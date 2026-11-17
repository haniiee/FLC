import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { AppText } from "../../../components/AppText";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { LoadingScreen } from "../../../components/Skeleton";
import { Screen } from "../../../components/Screen";
import { getApiClient } from "../../../lib/api";
import { parseJoinCodeFromUrl } from "../../../lib/deep-link";
import { copy } from "../../../lib/copy";
import { apiErrorMessage } from "../../../lib/format";
import { useAuth } from "../../../providers/auth-provider";
import { useTheme } from "../../../theme/theme";

export default function JoinByCodeScreen() {
  const { code: rawCode } = useLocalSearchParams<{ code: string }>();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { colors } = useTheme();
  const code = parseJoinCodeFromUrl(rawCode ?? "") ?? rawCode ?? "";
  const [loading, setLoading] = useState(false);
  const [inviteName, setInviteName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    void getApiClient()
      .getInvite(code)
      .then((invite) => setInviteName(invite.groupName))
      .catch(() => setInviteName(null));
  }, [code]);

  async function onJoin() {
    if (!code) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getApiClient().joinInvite(code);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/groups/${result.groupId}`);
    } catch (err) {
      setError(apiErrorMessage(err, copy.join.joinFailed));
      setLoading(false);
    }
  }

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return (
      <Screen>
        <View style={{ gap: 16, paddingTop: 12 }}>
          <AppText variant="display">{copy.join.title}</AppText>
          <AppText variant="body" color="textMuted">
            {inviteName ? `Sign in to join “${inviteName}”.` : copy.join.signInToJoin}
          </AppText>
          <Button title={copy.auth.logIn} size="lg" onPress={() => router.push("/login")} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: 16, paddingTop: 12 }}>
        <AppText variant="display">{copy.join.confirmTitle}</AppText>
        {error ? <ErrorBanner message={error} /> : null}
        <Card>
          <AppText variant="caption" color="textMuted">
            {copy.join.codeLabel}
          </AppText>
          <AppText
            variant="h1"
            style={{
              marginTop: 8,
              letterSpacing: 3,
              fontFamily: "PlusJakartaSans_800ExtraBold",
              color: colors.text,
            }}
          >
            {code}
          </AppText>
          {inviteName ? (
            <AppText variant="body" color="textMuted" style={{ marginTop: 10 }}>
              {inviteName}
            </AppText>
          ) : null}
        </Card>
        <Button
          title={loading ? copy.join.joining : copy.join.join}
          size="lg"
          loading={loading}
          disabled={loading}
          onPress={() => void onJoin()}
        />
        <Button
          title={copy.join.notNow}
          variant="ghost"
          disabled={loading}
          onPress={() => router.back()}
        />
      </View>
    </Screen>
  );
}
