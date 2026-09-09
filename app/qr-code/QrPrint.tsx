"use client";

import { QRCodeSVG } from "qrcode.react";

export default function QrPrint({ url }: { url: string }) {
  return (
    <>
      <div style={{ background: "#fff", padding: 24, borderRadius: 12, display: "inline-block" }}>
        <QRCodeSVG value={url} size={280} />
      </div>

      <p style={{ marginTop: 24, color: "var(--text-2)", maxWidth: "34ch", marginInline: "auto" }}>
        QR-Code scannen und in wenigen Minuten Mitglied werden.
      </p>
      <p style={{ marginTop: 8, color: "var(--text-3)", fontSize: ".85rem" }}>{url}</p>

      <button
        onClick={() => window.print()}
        className="ifa-btn ifa-btn-line no-print"
        style={{ marginTop: 28 }}
      >
        Zum Ausdrucken
      </button>
    </>
  );
}
