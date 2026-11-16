"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Spinner } from "../../../components/ui/Spinner";
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
      toast.success(result.alreadyMember ? "قبلاً عضو این کلاس بودید" : "عضویت انجام شد");
      router.replace(`/groups/${result.groupId}`);
    },
    onError: (error) => toast.error(apiErrorMessage(error, "عضویت ناموفق بود")),
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
      <Card>
        <h1 className="text-lg font-bold text-danger">کد دعوت نامعتبر</h1>
        <p className="mt-2 text-sm text-text-muted">این لینک یا کد وجود ندارد یا منقضی شده است.</p>
      </Card>
    );
  }

  const invite = inviteQuery.data;

  return (
    <Card className="space-y-4">
      <div>
        <p className="text-sm text-text-muted">دعوت به کلاس</p>
        <h1 className="mt-1 text-xl font-bold text-secondary">{invite.groupName}</h1>
        <p className="mt-2 text-sm text-text">استاد: {invite.teacherName}</p>
        {!invite.valid ? (
          <p className="mt-3 rounded-md bg-primary-soft px-3 py-2 text-sm text-secondary">
            این دعوت‌نامه دیگر معتبر نیست.
          </p>
        ) : null}
      </div>

      {invite.valid ? (
        isAuthenticated ? (
          <Button
            className="w-full"
            disabled={joinMutation.isPending}
            onClick={() => joinMutation.mutate()}
          >
            {joinMutation.isPending ? "در حال عضویت..." : "عضویت در کلاس"}
          </Button>
        ) : (
          <Button
            className="w-full"
            onClick={() =>
              router.push(`/login?next=${encodeURIComponent(`/join/${encodeURIComponent(code)}`)}`)
            }
          >
            ورود و عضویت
          </Button>
        )
      ) : null}
    </Card>
  );
}
