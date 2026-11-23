"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#fff", padding: "64px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 className="h-section">Algo deu errado</h1>
      <p className="muted">Não foi possível carregar esta página agora. Tente novamente em instantes.</p>
      <div>
        <button type="button" className="btn btn-dark" onClick={reset}>Tentar novamente</button>
      </div>
    </main>
  );
}
