"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { Spinner } from "../components/ui/Spinner";
import { getApiClient } from "../lib/api";
import { apiErrorMessage, roleLabel } from "../lib/format";
import { useAuth } from "../providers/auth-provider";

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [inviteCode, setInviteCode] = useState("");

  const groupsQuery = useQuery({
    queryKey: ["groups"],
    queryFn: () => getApiClient().listGroups(),
  });

  const createGroup = useMutation({
    mutationFn: () => getApiClient().createGroup({ name: "کلاس جدید" }),
    onSuccess: async (group) => {
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success("کلاس ساخته شد");
      router.push(`/groups/${group.id}`);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  if (groupsQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const groups = groupsQuery.data?.groups ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-secondary">کلاس‌های من</h1>
        {user?.platformRole === "teacher" ? (
          <Button
            type="button"
            disabled={createGroup.isPending}
            onClick={() => createGroup.mutate()}
          >
            کلاس جدید
          </Button>
        ) : null}
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title="هنوز عضو هیچ کلاسی نیستید"
          description="با لینک یا کد دعوت عضو کلاس شو"
          action={
            <form
              className="flex w-full max-w-sm gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const code = inviteCode.trim();
                if (!code) {
                  return;
                }
                router.push(`/join/${encodeURIComponent(code)}`);
              }}
            >
              <Input
                placeholder="کد دعوت"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
              />
              <Button type="submit">برو</Button>
            </form>
          }
        />
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <Link key={group.id} href={`/groups/${group.id}`} className="block">
              <Card className="transition hover:border-secondary/40">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-text">{group.name}</h2>
                    <p className="mt-1 text-sm text-text-muted">
                      نقش شما: {roleLabel(group.myRole)} · <bdi dir="ltr">{group.memberCount}</bdi>{" "}
                      عضو
                    </p>
                  </div>
                  <span className="text-secondary">→</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
