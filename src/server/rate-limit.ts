/**
 * Limitador de requisições em memória (janela deslizante simples).
 *
 * IMPORTANTE: na Vercel cada instância tem sua própria memória, então este
 * limite é uma primeira barreira, não uma garantia global. As garantias fortes
 * estão no banco (limite de pedidos por telefone) e no Supabase Auth (limite
 * de tentativas de login). Para limite global, use Vercel Firewall/WAF.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Retorna true se a requisição pode seguir. */
  check(key: string): boolean {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((ts) => t - ts < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(t);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.prune(t);
    return true;
  }

  private prune(t: number) {
    for (const [k, list] of this.hits) {
      if (list.every((ts) => t - ts >= this.windowMs)) this.hits.delete(k);
    }
  }
}

/** IP do cliente atrás do proxy da Vercel. */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
