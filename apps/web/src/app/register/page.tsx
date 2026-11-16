"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
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
      toast.success("ثبت‌نام موفق");
      router.replace(next);
    } catch (error) {
      toast.error(apiErrorMessage(error, "ثبت‌نام ناموفق بود"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md space-y-4">
      <div>
        <h1 className="text-xl font-bold text-secondary">ثبت‌نام</h1>
        <p className="mt-1 text-sm text-text-muted">حساب جدید بسازید</p>
      </div>
      <form className="space-y-3" onSubmit={(event) => void onSubmit(event)}>
        <Input
          label="نام نمایشی"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          required
        />
        <Input
          label="شماره موبایل"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0912..."
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          required
        />
        <Input
          label="رمز عبور (حداقل ۸ کاراکتر)"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "در حال ثبت‌نام..." : "ثبت‌نام"}
        </Button>
      </form>
      <p className="text-center text-sm text-text-muted">
        قبلاً ثبت‌نام کرده‌اید؟{" "}
        <Link
          className="font-medium text-secondary underline"
          href={`/login?next=${encodeURIComponent(next)}`}
        >
          ورود
        </Link>
      </p>
    </Card>
  );
}
