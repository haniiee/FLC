"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "../../components/auth/AuthShell";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { copy } from "../../lib/copy";
import { getApiClient } from "../../lib/api";
import { apiErrorMessage } from "../../lib/format";
import { useAuth } from "../../providers/auth-provider";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next") || "/home";
  const next = rawNext === "/" || rawNext === "/welcome" ? "/home" : rawNext;
  const { user, setSessionFromAuth, isAuthenticated, isLoading } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function destinationFor(role: string | undefined, mustChange: boolean | undefined) {
    if (mustChange) return "/change-password";
    if (role === "admin") return "/admin/groups";
    return next;
  }

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(destinationFor(user?.platformRole, user?.mustChangePassword));
    }
  }, [isAuthenticated, isLoading, next, router, user?.mustChangePassword, user?.platformRole]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const auth = await getApiClient().login({ phone, password });
      await setSessionFromAuth();
      toast.success(copy.auth.loginSuccess);
      router.replace(destinationFor(auth.user.platformRole, auth.user.mustChangePassword));
    } catch (error) {
      toast.error(apiErrorMessage(error, copy.auth.loginFailed));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={copy.auth.welcomeBack}
      subtitle={copy.auth.loginSubtitle}
      footer={
        <>
          {copy.auth.newHere}{" "}
          <Link
            className="font-semibold text-[#FDAD3E] underline-offset-2 hover:underline"
            href={`/register?next=${encodeURIComponent(next)}`}
          >
            {copy.auth.createAccountLink}
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
        <Input
          label={copy.auth.phone}
          inputMode="tel"
          autoComplete="tel"
          placeholder={copy.auth.phonePlaceholder}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          required
          dir="ltr"
          className="rounded-xl border-primary/10 bg-[#F6F7FB] py-3 focus:border-secondary focus:ring-[#FDAD3E]/25"
        />
        <Input
          label={copy.auth.password}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          className="rounded-xl border-primary/10 bg-[#F6F7FB] py-3 focus:border-secondary focus:ring-[#FDAD3E]/25"
        />
        <Button
          type="submit"
          className="mt-2 w-full rounded-full bg-[#FDAD3E] py-3.5 text-[#1A1205] shadow-[0_16px_40px_-20px_rgba(253,173,62,0.9)] hover:bg-[#FDAD3E] hover:brightness-105"
          disabled={loading}
        >
          {loading ? copy.auth.loggingIn : copy.auth.logIn}
        </Button>
      </form>
    </AuthShell>
  );
}
