"use client";

import { useMemo, useState } from "react";
import {
  AGE_GROUPS,
  AGE_GROUP_LABELS,
  TERMS,
  TERM_LABELS,
  PRICES,
  JOINING_FEE_CENTS,
  formatEuro,
  quote,
  type AgeGroup,
  type Term,
  type PaymentMode,
} from "@/lib/pricing";
import { DISCIPLINES, EXPERIENCE_LEVELS } from "@/lib/validation";

type Status = "idle" | "submitting" | "error";

export default function SignupForm({ datenschutzUrl }: { datenschutzUrl: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [ageGroup, setAgeGroup] = useState<AgeGroup>("erwachsener");
  const [term, setTerm] = useState<Term>("12_monate");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("monatlich");

  const angebot = useMemo(
    () => quote(ageGroup, term, paymentMode),
    [ageGroup, term, paymentMode]
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg(null);
    setFieldErrors({});

    const fd = new FormData(e.currentTarget);
    const payload = {
      firstName: fd.get("firstName"),
      lastName: fd.get("lastName"),
      email: fd.get("email"),
      phone: fd.get("phone") || "",
      discipline: fd.get("discipline"),
      experienceLevel: fd.get("experienceLevel"),
      ageGroup,
      term,
      paymentMode,
      privacyAccepted: fd.get("privacyAccepted") === "on",
      website: fd.get("website") || "",
    };

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Etwas ist schiefgelaufen. Bitte versuch es erneut.");
        if (data.details) setFieldErrors(data.details);
        setStatus("error");
        return;
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setStatus("idle");
      }
    } catch {
      setErrorMsg("Verbindung fehlgeschlagen. Bitte versuch es erneut.");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* --- Persönliche Daten --- */}
      <fieldset style={{ border: 0, padding: 0, margin: "0 0 36px" }}>
        <legend style={legendStyle}>Deine Daten</legend>
        <div style={grid2}>
          <Field label="Vorname" name="firstName" required errors={fieldErrors.firstName} />
          <Field label="Nachname" name="lastName" required errors={fieldErrors.lastName} />
        </div>
        <div style={{ ...grid2, marginTop: 14 }}>
          <Field label="E-Mail" name="email" type="email" required errors={fieldErrors.email} />
          <Field label="Telefon (optional)" name="phone" type="tel" errors={fieldErrors.phone} />
        </div>
      </fieldset>

      {/* --- Training --- */}
      <fieldset style={{ border: 0, padding: 0, margin: "0 0 36px" }}>
        <legend style={legendStyle}>Dein Training</legend>
        <div style={grid2}>
          <SelectField
            label="Disziplin"
            name="discipline"
            options={DISCIPLINES}
            required
            errors={fieldErrors.discipline}
          />
          <SelectField
            label="Erfahrung"
            name="experienceLevel"
            options={EXPERIENCE_LEVELS}
            required
            errors={fieldErrors.experienceLevel}
          />
        </div>
      </fieldset>

      {/* --- Altersgruppe: die eigentliche Preisachse --- */}
      <fieldset style={{ border: 0, padding: 0, margin: "0 0 28px" }}>
        <legend style={legendStyle}>Altersgruppe</legend>
        <p style={hintStyle}>Der Beitrag richtet sich nach dem Alter.</p>
        <div style={grid3}>
          {AGE_GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              className="ifa-option"
              aria-pressed={ageGroup === g}
              onClick={() => setAgeGroup(g)}
            >
              <span className="name">{AGE_GROUP_LABELS[g]}</span>
              <span className="meta">
                ab {formatEuro(Math.min(PRICES[g]["6_monate"].monthlyCents, PRICES[g]["12_monate"].monthlyCents))} / Monat
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* --- Laufzeit --- */}
      <fieldset style={{ border: 0, padding: 0, margin: "0 0 28px" }}>
        <legend style={legendStyle}>Laufzeit</legend>
        <div style={grid2}>
          {TERMS.map((t) => (
            <button
              key={t}
              type="button"
              className="ifa-option"
              aria-pressed={term === t}
              onClick={() => setTerm(t)}
            >
              <span className="name">{TERM_LABELS[t]}</span>
              <span className="meta">
                {formatEuro(PRICES[ageGroup][t].monthlyCents)} / Monat
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* --- Zahlweise --- */}
      <fieldset style={{ border: 0, padding: 0, margin: "0 0 28px" }}>
        <legend style={legendStyle}>Zahlweise</legend>
        <div style={grid2}>
          <button
            type="button"
            className="ifa-option"
            aria-pressed={paymentMode === "monatlich"}
            onClick={() => setPaymentMode("monatlich")}
          >
            <span className="name">Monatlich</span>
            <span className="meta">
              {formatEuro(PRICES[ageGroup][term].monthlyCents)} / Monat
              {" + "}
              {formatEuro(JOINING_FEE_CENTS)} Aufnahmegebühr
            </span>
          </button>
          <button
            type="button"
            className="ifa-option"
            aria-pressed={paymentMode === "vorauszahlung"}
            onClick={() => setPaymentMode("vorauszahlung")}
          >
            <span className="name">Vorauszahlung</span>
            <span className="meta">
              <s style={{ color: "var(--text-3)" }}>
                {formatEuro(PRICES[ageGroup][term].prepayRegularCents)}
              </s>{" "}
              {formatEuro(PRICES[ageGroup][term].prepayCents)} — ohne Aufnahmegebühr
            </span>
          </button>
        </div>
      </fieldset>

      {/* --- Zusammenfassung: was jetzt tatsächlich abgebucht wird --- */}
      <div className="ifa-card" style={{ marginBottom: 28 }} aria-live="polite">
        <h2 style={{ fontSize: "1.15rem", margin: "0 0 10px" }}>Dein Tarif</h2>
        <p style={{ margin: "0 0 4px", color: "var(--text-2)" }}>
          {AGE_GROUP_LABELS[ageGroup]} · {TERM_LABELS[term]}
        </p>
        <p style={{ margin: 0, fontSize: "1.05rem" }}>{angebot.summary}</p>
        <p style={{ margin: "10px 0 0", color: "var(--text-3)", fontSize: ".88rem" }}>
          Heute fällig: <b style={{ color: "var(--text)" }}>{formatEuro(angebot.dueNowCents)}</b>
          {paymentMode === "monatlich" &&
            ` — danach ${formatEuro(angebot.recurringCents)} monatlich.`}
        </p>
      </div>

      {/* Honeypot — für Menschen unsichtbar, Bots füllen ihn aus. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {/* --- Einwilligung: ohne die geht rechtlich nichts --- */}
      <label
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          fontSize: ".9rem",
          color: "var(--text-2)",
          marginBottom: 24,
        }}
      >
        <input
          type="checkbox"
          name="privacyAccepted"
          required
          style={{ marginTop: 3, width: 17, height: 17, accentColor: "var(--red)", flex: "0 0 auto" }}
        />
        <span>
          Ich bin damit einverstanden, dass meine Daten zur Bearbeitung meiner Anmeldung
          und zur Kontaktaufnahme verarbeitet werden. Weitere Informationen in der{" "}
          <a href={datenschutzUrl} target="_blank" rel="noopener" style={{ color: "var(--red-hot)" }}>
            Datenschutzerklärung
          </a>
          . *
        </span>
      </label>
      {fieldErrors.privacyAccepted && (
        <p className="ifa-error" style={{ marginTop: -14, marginBottom: 18 }}>
          {fieldErrors.privacyAccepted[0]}
        </p>
      )}

      {errorMsg && (
        <p className="ifa-error" role="alert" style={{ marginBottom: 18 }}>
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        className="ifa-btn ifa-btn-red"
        disabled={status === "submitting"}
        style={{ width: "100%" }}
      >
        {status === "submitting" ? "Weiter zur Zahlung …" : "Weiter zur Zahlung"}
      </button>

      <p style={{ ...hintStyle, textAlign: "center", marginTop: 14 }}>
        Du wirst zur Zahlung an unseren Zahlungsanbieter Stripe weitergeleitet.
        Deine Zahlungsdaten erreichen uns nie.
      </p>
    </form>
  );
}

const legendStyle: React.CSSProperties = {
  fontFamily: "var(--font-disp)",
  fontWeight: 700,
  fontSize: "1.45rem",
  letterSpacing: ".02em",
  textTransform: "uppercase",
  padding: 0,
  marginBottom: 12,
};

const hintStyle: React.CSSProperties = {
  color: "var(--text-3)",
  fontSize: ".88rem",
  margin: "0 0 12px",
};

const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
};

const grid3: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 14,
};

function Field({
  label,
  name,
  type = "text",
  required = false,
  errors,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  errors?: string[];
}) {
  const id = `f-${name}`;
  return (
    <div className="ifa-field">
      <label htmlFor={id}>
        {label} {required && "*"}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        aria-invalid={errors ? true : undefined}
        aria-describedby={errors ? `${id}-err` : undefined}
        autoComplete={
          name === "firstName"
            ? "given-name"
            : name === "lastName"
              ? "family-name"
              : name === "email"
                ? "email"
                : name === "phone"
                  ? "tel"
                  : undefined
        }
      />
      {errors && (
        <p className="ifa-error" id={`${id}-err`}>
          {errors[0]}
        </p>
      )}
    </div>
  );
}

function SelectField({
  label,
  name,
  options,
  required = false,
  errors,
}: {
  label: string;
  name: string;
  options: readonly string[];
  required?: boolean;
  errors?: string[];
}) {
  const id = `f-${name}`;
  return (
    <div className="ifa-field">
      <label htmlFor={id}>
        {label} {required && "*"}
      </label>
      <select
        id={id}
        name={name}
        required={required}
        defaultValue=""
        aria-invalid={errors ? true : undefined}
        aria-describedby={errors ? `${id}-err` : undefined}
      >
        <option value="" disabled>
          Bitte wählen
        </option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {errors && (
        <p className="ifa-error" id={`${id}-err`}>
          {errors[0]}
        </p>
      )}
    </div>
  );
}
