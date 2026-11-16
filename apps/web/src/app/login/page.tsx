"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { getApiClient } from "../../lib/api";
import { apiErrorMessage } from "../../lib/format";
import { useAuth } from "../../providers/auth-provider";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const { setSessionFromAuth, isAuthenticated, isLoading } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(next);
    }
  }, [isAuthenticated, isLoading, next, router]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await getApiClient().login({ phone, password });
      await setSessionFromAuth();
      toast.success("ورود موفق");
      router.replace(next);
    } catch (error) {
      toast.error(apiErrorMessage(error, "ورود ناموفق بود"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md space-y-4">
      <div>
        <h1 className="text-xl font-bold text-secondary">ورود</h1>
        <p className="mt-1 text-sm text-text-muted">با شماره موبایل وارد شوید</p>
      </div>
      <form className="space-y-3" onSubmit={(event) => void onSubmit(event)}>
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
          label="رمز عبور"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "در حال ورود..." : "ورود"}
        </Button>
      </form>
      <p className="text-center text-sm text-text-muted">
        حساب ندارید؟{" "}
        <Link
          className="font-medium text-secondary underline"
          href={`/register?next=${encodeURIComponent(next)}`}
        >
          ثبت‌نام
        </Link>
      </p>
    </Card>
  );
}
