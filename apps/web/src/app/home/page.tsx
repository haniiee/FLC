"use client";

import type { GroupSummary, GroupRole } from "@app/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Hero } from "../../components/ui/Hero";
import { Input } from "../../components/ui/Input";
import { Spinner } from "../../components/ui/Spinner";
import { copy } from "../../lib/copy";
import { getApiClient } from "../../lib/api";
import { apiErrorMessage, firstName, roleLabel } from "../../lib/format";
import { useAuth } from "../../providers/auth-provider";

function roleChipClass(role: GroupRole): string {
  switch (role) {
    case "teacher":
      return "bg-accent/25 text-accent-on";
    case "assistant":
      return "bg-primary-soft text-primary";
    default:
      return "bg-surface-muted text-text-muted";
  }
}

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [inviteCode, setInviteCode] = useState("");
  const [showJoinForm, setShowJoinForm] = useState(false);
  const isTeacher = user?.platformRole === "teacher";

  const groupsQuery = useQuery({
    queryKey: ["groups"],
    queryFn: () => getApiClient().listGroups(),
  });

  const createGroup = useMutation({
    mutationFn: () => getApiClient().createGroup({ name: copy.classes.defaultClassName }),
    onSuccess: async (group) => {
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success(copy.classes.created);
      router.push(`/groups/${group.id}`);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  function submitInviteCode(event: React.FormEvent) {
    event.preventDefault();
    const code = inviteCode.trim();
    if (!code) {
      toast.error(copy.join.invalidCode);
      return;
    }
    router.push(`/join/${encodeURIComponent(code)}`);
  }

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
      <Hero>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
          {copy.classes.yourClasses}
        </p>
        <h1 className="mt-2 text-2xl font-extrabold" dir="auto">
          {copy.classes.hi(firstName(user?.displayName ?? "there"))}
        </h1>

        {isTeacher ? (
          <div className="mt-4 space-y-3">
            <div>
              <p className="text-3xl font-extrabold">{groups.length}</p>
              <p className="text-sm text-white/80">{copy.classes.teachCount(groups.length)}</p>
            </div>
            <Button
              type="button"
              variant="accent"
              disabled={createGroup.isPending}
              onClick={() => createGroup.mutate()}
            >
              {copy.classes.newClass}
            </Button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-lg font-semibold">{copy.classes.invitePrompt}</p>
            {showJoinForm ? (
              <form className="flex flex-col gap-2 sm:flex-row" onSubmit={submitInviteCode}>
                <Input
                  className="flex-1"
                  placeholder={copy.join.codePlaceholder}
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value)}
                  aria-label={copy.classes.inviteCode}
                  dir="ltr"
                />
                <Button type="submit" variant="accent">
                  {copy.classes.go}
                </Button>
              </form>
            ) : (
              <Button type="button" variant="accent" onClick={() => setShowJoinForm(true)}>
                {copy.classes.joinClass}
              </Button>
            )}
          </div>
        )}
      </Hero>

      {groups.length === 0 ? (
        <EmptyState
          title={copy.classes.emptyTitle}
          description={copy.classes.emptySubtitle}
          action={
            <form className="flex w-full max-w-sm gap-2" onSubmit={submitInviteCode}>
              <Input
                placeholder={copy.join.codePlaceholder}
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                aria-label={copy.classes.inviteCode}
                dir="ltr"
              />
              <Button type="submit">{copy.classes.go}</Button>
            </form>
          }
        />
      ) : (
        <div className="space-y-3">
          {groups.map((group: GroupSummary) => (
            <Link key={group.id} href={`/groups/${group.id}`} className="block">
              <Card className="transition hover:border-primary/30 hover:shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <h2 className="font-semibold text-text" dir="auto">
                      {group.name}
                    </h2>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleChipClass(group.myRole)}`}
                    >
                      {roleLabel(group.myRole)}
                    </span>
                  </div>
                  <span className="shrink-0 text-primary" aria-hidden>
                    →
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
