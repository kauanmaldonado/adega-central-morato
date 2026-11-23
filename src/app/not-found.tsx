import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#fff", padding: "64px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 className="h-section">Página não encontrada</h1>
      <p className="muted">O endereço pode estar errado ou a página foi removida.</p>
      <div>
        <Link className="btn btn-dark" href="/">Ir para o cardápio</Link>
      </div>
    </main>
  );
}
