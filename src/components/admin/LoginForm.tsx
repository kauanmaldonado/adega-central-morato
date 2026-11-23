"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiClientError } from "./api";

type Step = "credentials" | "enroll" | "verify";

interface EnrollData {
  factorId: string;
  qrCode: string;
  secret: string;
}

/**
 * Login do painel em duas etapas:
 * 1. e-mail e senha;
 * 2. código de 6 dígitos do app autenticador (no primeiro acesso, antes
 *    cadastra o app lendo um QR code).
 */
export function LoginForm({
  initialStep,
  email: knownEmail,
  notAdmin,
}: {
  initialStep: Step;
  email: string | null;
  notAdmin: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialStep);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [enroll, setEnroll] = useState<EnrollData | null>(null);
  const [error, setError] = useState<string | null>(
    notAdmin ? "Esta conta não tem acesso ao painel. Entre com uma conta de administrador." : null,
  );
  const [loading, setLoading] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  // Evita gerar dois QR codes ao mesmo tempo (cada novo cadastro invalida o anterior)
  const enrollInFlight = useRef(false);

  const loadEnroll = useCallback(async () => {
    if (enrollInFlight.current) return;
    enrollInFlight.current = true;
    setError(null);
    setLoading(true);
    try {
      setEnroll(await api<EnrollData>("/api/auth/mfa/enroll", { method: "POST", body: {} }));
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        setStep("verify");
      } else {
        setError(err instanceof ApiClientError ? err.message : "Não foi possível gerar o QR code.");
      }
    } finally {
      enrollInFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (step === "enroll" && !enroll) void loadEnroll();
    if (step === "verify" || step === "enroll") codeRef.current?.focus();
  }, [step, enroll, loadEnroll]);

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api<{ next: "enroll" | "verify" }>("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setPassword("");
      setCode("");
      setStep(res.next);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api("/api/auth/mfa/verify", {
        method: "POST",
        body: step === "enroll" && enroll ? { code, factorId: enroll.factorId } : { code },
      });
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Não foi possível confirmar o código.");
      setCode("");
      setLoading(false);
      codeRef.current?.focus();
    }
  }

  async function useAnotherAccount() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
    setEnroll(null);
    setCode("");
    setError(null);
    setStep("credentials");
    setLoading(false);
  }

  const formStyle = { display: "flex", flexDirection: "column", gap: 14, width: "100%" } as const;
  const alert = error && (
    <p className="alert alert-error" role="alert">
      {error}
    </p>
  );

  if (step === "credentials") {
    return (
      <form onSubmit={submitCredentials} style={formStyle}>
        {alert}
        <label className="field">
          <span>E-mail</span>
          <input className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Senha</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button type="submit" className="btn btn-dark btn-block" style={{ height: 52 }} disabled={loading}>
          {loading ? "Entrando…" : "Continuar"}
        </button>
      </form>
    );
  }

  const codeInput = (
    <label className="field">
      <span>Código de 6 números</span>
      <input
        ref={codeRef}
        className="input"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        placeholder="000000"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        style={{ fontSize: 22, letterSpacing: "0.3em", textAlign: "center" }}
      />
    </label>
  );

  const anotherAccount = (
    <button type="button" className="btn btn-light btn-block" onClick={useAnotherAccount} disabled={loading}>
      Entrar com outra conta
    </button>
  );

  if (step === "verify") {
    return (
      <form onSubmit={submitCode} style={formStyle}>
        {alert}
        <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.5 }}>
          Abra o app autenticador no seu celular e digite o código da <strong>Adega Central Morato</strong>
          {knownEmail ? <> para {knownEmail}</> : null}.
        </p>
        {codeInput}
        <button type="submit" className="btn btn-dark btn-block" style={{ height: 52 }} disabled={loading || code.length !== 6}>
          {loading ? "Conferindo…" : "Entrar"}
        </button>
        {anotherAccount}
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.45 }}>
          Perdeu o acesso ao app? Peça para quem administra o sistema liberar um novo cadastro.
        </p>
      </form>
    );
  }

  // Primeiro acesso: cadastrar o app autenticador
  return (
    <form onSubmit={submitCode} style={formStyle}>
      {alert}
      <p style={{ margin: 0, fontWeight: 600 }}>Primeiro acesso: ative a verificação em duas etapas</p>
      <ol style={{ margin: 0, paddingLeft: 20, color: "var(--muted)", lineHeight: 1.55, fontSize: 14.5 }}>
        <li>
          Instale no celular um app autenticador, como <strong>Google Authenticator</strong>, <strong>Microsoft Authenticator</strong> ou{" "}
          <strong>Authy</strong>.
        </li>
        <li>No app, escolha adicionar conta e leia o QR code abaixo.</li>
        <li>Digite o código de 6 números que aparecer no app.</li>
      </ol>
      {enroll ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enroll.qrCode}
            alt="QR code para cadastrar o app autenticador"
            width={200}
            height={200}
            style={{ alignSelf: "center", background: "#fff", padding: 8, borderRadius: 12, border: "1px solid var(--line)" }}
          />
          <details style={{ fontSize: 13.5, color: "var(--muted)" }}>
            <summary style={{ cursor: "pointer" }}>Não consegue ler o QR code? Digite esta chave no app</summary>
            <code style={{ display: "block", marginTop: 8, wordBreak: "break-all", fontSize: 15, color: "var(--ink)", letterSpacing: "0.08em" }}>
              {enroll.secret.replace(/(.{4})/g, "$1 ").trim()}
            </code>
          </details>
        </>
      ) : (
        <p style={{ margin: 0, color: "var(--muted)" }}>{loading ? "Gerando QR code…" : ""}</p>
      )}
      {!enroll && !loading && error && (
        <button type="button" className="btn btn-light btn-block" onClick={() => void loadEnroll()}>
          Tentar novamente
        </button>
      )}
      {codeInput}
      <button type="submit" className="btn btn-dark btn-block" style={{ height: 52 }} disabled={loading || !enroll || code.length !== 6}>
        {loading && enroll ? "Conferindo…" : "Ativar e entrar"}
      </button>
      {anotherAccount}
    </form>
  );
}
