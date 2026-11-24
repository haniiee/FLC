"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Hero } from "../../components/ui/Hero";
import { Input } from "../../components/ui/Input";
import { copy } from "../../lib/copy";
import { getApiClient } from "../../lib/api";
import { apiErrorMessage } from "../../lib/format";
import { useAuth } from "../../providers/auth-provider";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
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
    <div className="mx-auto max-w-md space-y-4">
      <Hero>
        <h1 className="text-2xl font-extrabold">{copy.auth.welcomeBack}</h1>
        <p className="mt-2 text-sm text-white/80">{copy.auth.loginSubtitle}</p>
      </Hero>
      <Card className="space-y-4">
        <form className="space-y-3" onSubmit={(event) => void onSubmit(event)}>
          <Input
            label={copy.auth.phone}
            inputMode="tel"
            autoComplete="tel"
            placeholder={copy.auth.phonePlaceholder}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
            dir="ltr"
          />
          <Input
            label={copy.auth.password}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? copy.auth.loggingIn : copy.auth.logIn}
          </Button>
        </form>
        <p className="text-center text-sm text-text-muted">
          {copy.auth.newHere}{" "}
          <Link
            className="font-medium text-primary underline"
            href={`/register?next=${encodeURIComponent(next)}`}
          >
            {copy.auth.createAccountLink}
          </Link>
        </p>
      </Card>
    </div>
  );
}
