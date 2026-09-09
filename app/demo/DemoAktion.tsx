"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DemoAktion({
  aktion,
  memberId,
  children,
  variante = "line",
  weiterNach,
  breit = false,
}: {
  aktion: string;
  memberId?: string;
  children: React.ReactNode;
  variante?: "red" | "line";
  weiterNach?: string;
  breit?: boolean;
}) {
  const [laeuft, setLaeuft] = useState(false);
  const router = useRouter();

  async function ausfuehren() {
    setLaeuft(true);
    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktion, memberId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Aktion fehlgeschlagen");
        setLaeuft(false);
        return;
      }
      if (weiterNach) router.push(weiterNach);
      else router.refresh();
    } catch {
      alert("Verbindung fehlgeschlagen");
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <button
      type="button"
      onClick={ausfuehren}
      disabled={laeuft}
      className={`ifa-btn ${variante === "red" ? "ifa-btn-red" : "ifa-btn-line"}`}
      style={breit ? { width: "100%" } : undefined}
    >
      {laeuft ? "…" : children}
    </button>
  );
}
