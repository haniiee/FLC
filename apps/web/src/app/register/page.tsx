"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const { setSessionFromAuth } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await getApiClient().register({ displayName, phone, password });
      await setSessionFromAuth();
      toast.success(copy.auth.registerSuccess);
      router.replace(next);
    } catch (error) {
      toast.error(apiErrorMessage(error, copy.auth.registerFailed));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Hero>
        <h1 className="text-2xl font-extrabold">{copy.auth.createAccountTitle}</h1>
        <p className="mt-2 text-sm text-white/80">{copy.auth.registerSubtitle}</p>
      </Hero>
      <Card className="space-y-4">
        <form className="space-y-3" onSubmit={(event) => void onSubmit(event)}>
          <Input
            label={copy.auth.displayName}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            dir="auto"
          />
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
            label={copy.auth.passwordMinHint}
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? copy.auth.creatingAccount : copy.auth.createAccountCta}
          </Button>
        </form>
        <p className="text-center text-sm text-text-muted">
          {copy.auth.alreadyHaveAccount}{" "}
          <Link
            className="font-medium text-primary underline"
            href={`/login?next=${encodeURIComponent(next)}`}
          >
            {copy.auth.logInLink}
          </Link>
        </p>
      </Card>
    </div>
  );
}
