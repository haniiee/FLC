"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "../../components/auth/AuthShell";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { copy } from "../../lib/copy";
import { getApiClient } from "../../lib/api";
import { apiErrorMessage } from "../../lib/format";
import { useAuth } from "../../providers/auth-provider";

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next") || "/home";
  const next = rawNext === "/" || rawNext === "/welcome" ? "/home" : rawNext;
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
    <AuthShell
      title={copy.auth.createAccountTitle}
      subtitle={copy.auth.registerSubtitle}
      footer={
        <>
          {copy.auth.alreadyHaveAccount}{" "}
          <Link
            className="font-semibold text-[#FDAD3E] underline-offset-2 hover:underline"
            href={`/login?next=${encodeURIComponent(next)}`}
          >
            {copy.auth.logInLink}
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
        <Input
          label={copy.auth.displayName}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          required
          dir="auto"
          className="rounded-xl border-primary/10 bg-[#F6F7FB] py-3 focus:border-secondary focus:ring-[#FDAD3E]/25"
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
          className="rounded-xl border-primary/10 bg-[#F6F7FB] py-3 focus:border-secondary focus:ring-[#FDAD3E]/25"
        />
        <Input
          label={copy.auth.passwordMinHint}
          type="password"
          autoComplete="new-password"
          minLength={8}
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
          {loading ? copy.auth.creatingAccount : copy.auth.createAccountCta}
        </Button>
      </form>
    </AuthShell>
  );
}
