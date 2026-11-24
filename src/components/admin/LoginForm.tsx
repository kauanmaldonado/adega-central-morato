"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiClientError } from "./api";

/** Login do painel com e-mail e senha. */
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api("/api/auth/login", { method: "POST", body: { email, password } });
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Não foi possível entrar.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
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
        {loading ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
