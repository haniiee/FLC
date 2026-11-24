"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Hero } from "../../components/ui/Hero";
import { Input } from "../../components/ui/Input";
import { copy } from "../../lib/copy";
import { getApiClient } from "../../lib/api";
import { apiErrorMessage } from "../../lib/format";
import { useAuth } from "../../providers/auth-provider";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, refreshUser, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(copy.auth.passwordMismatch);
      return;
    }
    if (newPassword.length < 8) {
      toast.error(copy.auth.passwordTooShort);
      return;
    }

    setLoading(true);
    try {
      await getApiClient().changePassword({ currentPassword, newPassword });
      await refreshUser();
      toast.success(copy.auth.passwordUpdated);
      router.replace(user?.platformRole === "admin" ? "/admin/groups" : "/home");
    } catch (error) {
      toast.error(apiErrorMessage(error, copy.auth.changePasswordFailed));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Hero>
        <h1 className="text-2xl font-extrabold">{copy.auth.changePasswordTitle}</h1>
        <p className="mt-2 text-sm text-white/80">{copy.auth.changePasswordSubtitle}</p>
      </Hero>

      <Card className="space-y-4">
        <form className="space-y-3" onSubmit={(event) => void onSubmit(event)}>
          <Input
            label={copy.auth.currentPassword}
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
          <Input
            label={copy.auth.newPassword}
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            minLength={8}
          />
          <Input
            label={copy.auth.confirmNewPassword}
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            minLength={8}
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? copy.auth.updatingPassword : copy.auth.updatePassword}
          </Button>
        </form>

        <Button type="button" variant="ghost" className="w-full" onClick={() => void logout()}>
          {copy.auth.signOut}
        </Button>
      </Card>
    </div>
  );
}
