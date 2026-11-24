"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Hero } from "../../../components/ui/Hero";
import { Spinner } from "../../../components/ui/Spinner";
import { copy } from "../../../lib/copy";
import { getApiClient } from "../../../lib/api";
import { apiErrorMessage } from "../../../lib/format";
import { useAuth } from "../../../providers/auth-provider";

export default function JoinPage() {
  const params = useParams<{ code: string }>();
  const code = decodeURIComponent(params.code);
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const inviteQuery = useQuery({
    queryKey: ["invite", code],
    queryFn: () => getApiClient().getInvite(code),
  });

  const joinMutation = useMutation({
    mutationFn: () => getApiClient().joinInvite(code),
    onSuccess: (result) => {
      toast.success(result.alreadyMember ? copy.join.alreadyMember : copy.join.joined);
      router.replace(`/groups/${result.groupId}`);
    },
    onError: (error) => toast.error(apiErrorMessage(error, copy.join.joinFailed)),
  });

  if (inviteQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (inviteQuery.isError || !inviteQuery.data) {
    return (
      <Card className="space-y-2">
        <h1 className="text-lg font-bold text-danger">{copy.join.invalidInviteTitle}</h1>
        <p className="text-sm text-text-muted">{copy.join.invalidInviteBody}</p>
      </Card>
    );
  }

  const invite = inviteQuery.data;

  return (
    <div className="space-y-4">
      <Hero>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
          {copy.join.invitedTo}
        </p>
        <h1 className="mt-2 text-2xl font-extrabold" dir="auto">
          {invite.groupName}
        </h1>
        <p className="mt-2 text-sm text-white/80" dir="auto">
          {copy.join.teacher(invite.teacherName)}
        </p>
      </Hero>

      <Card className="space-y-4">
        {!invite.valid ? (
          <p className="rounded-md bg-warning/15 px-3 py-2 text-sm text-text">
            {copy.join.noLongerValid}
          </p>
        ) : null}

        {invite.valid ? (
          isAuthenticated ? (
            <Button
              className="w-full"
              disabled={joinMutation.isPending}
              onClick={() => joinMutation.mutate()}
            >
              {joinMutation.isPending ? copy.join.joining : copy.join.joinClassCta}
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={() =>
                router.push(
                  `/login?next=${encodeURIComponent(`/join/${encodeURIComponent(code)}`)}`,
                )
              }
            >
              {copy.join.signInAndJoin}
            </Button>
          )
        ) : null}
      </Card>
    </div>
  );
}
