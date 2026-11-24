"use client";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Hero } from "../../components/ui/Hero";
import { copy } from "../../lib/copy";

export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col justify-center space-y-4">
      <Hero className="text-center">
        <h1 className="text-2xl font-extrabold">{copy.offline.title}</h1>
        <p className="mt-2 text-sm text-white/80">{copy.offline.body}</p>
      </Hero>
      <Card>
        <Button type="button" className="w-full" onClick={() => window.location.reload()}>
          {copy.offline.retry}
        </Button>
      </Card>
    </div>
  );
}
