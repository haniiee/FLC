"use client";

import Link from "next/link";
import { copy } from "../../lib/copy";
import { useAuth } from "../../providers/auth-provider";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Hero } from "../../components/ui/Hero";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const roleLabel =
    user?.platformRole === "admin"
      ? copy.profile.platformAdmin
      : user?.platformRole === "teacher"
        ? copy.profile.platformTeacher
        : copy.profile.platformMember;

  return (
    <div className="space-y-4">
      <Hero>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
          {copy.profile.title}
        </p>
        <h1 className="mt-2 text-2xl font-extrabold" dir="auto">
          {user?.displayName}
        </h1>
        <p className="mt-1 text-sm text-white/80" dir="ltr">
          {user?.phone}
        </p>
        <p className="mt-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
          {roleLabel}
        </p>
      </Hero>

      <Card className="space-y-3">
        <Link
          href="/change-password"
          className="block rounded-md px-1 py-2 text-sm font-semibold text-primary hover:bg-surface-muted"
        >
          {copy.profile.changePassword}
        </Link>
        <Button type="button" variant="danger" className="w-full" onClick={() => void logout()}>
          {copy.profile.signOut}
        </Button>
      </Card>
    </div>
  );
}
