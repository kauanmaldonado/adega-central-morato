/**
 * Variáveis de ambiente validadas.
 *
 * Apenas variáveis PÚBLICAS são usadas pelo app em execução. A chave anon
 * (ou "publishable") do Supabase é pública por design: o que protege os dados
 * são as políticas RLS do banco. A chave service_role/secret NUNCA é usada
 * pelo app — só pelo script local scripts/create-admin.mjs.
 */
import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string({ required_error: "NEXT_PUBLIC_SUPABASE_URL não definida" })
    .url("NEXT_PUBLIC_SUPABASE_URL inválida")
    .transform((v) => v.replace(/\/+$/, "")),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string({ required_error: "NEXT_PUBLIC_SUPABASE_ANON_KEY não definida" })
    .min(20, "NEXT_PUBLIC_SUPABASE_ANON_KEY inválida"),
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url("NEXT_PUBLIC_SITE_URL inválida")
    .transform((v) => v.replace(/\/+$/, ""))
    .optional(),
});

export type PublicEnv = z.infer<typeof schema>;

/** Impede que uma chave secreta seja configurada por engano como pública. */
export function assertNotSecretKey(key: string): void {
  if (key.startsWith("sb_secret_")) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY contém uma chave SECRETA. Use a chave anon/publishable.");
  }
  const parts = key.split(".");
  if (parts.length === 3 && parts[1]) {
    try {
      // atob funciona tanto no Node quanto no runtime Edge (middleware)
      const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
      const payload = JSON.parse(atob(b64)) as { role?: string };
      if (payload.role === "service_role") {
        throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY contém a chave service_role. Use a chave anon/publishable.");
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("service_role")) throw e;
    }
  }
}

let cached: PublicEnv | null = null;

export function env(): PublicEnv {
  if (cached) return cached;
  // Referências literais: o Next.js só embute NEXT_PUBLIC_* escritas assim.
  const parsed = schema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  });
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `• ${i.message}`).join("\n");
    throw new Error(`Configuração inválida. Confira o .env.local (veja docs/VARIAVEIS-DE-AMBIENTE.md):\n${msg}`);
  }
  assertNotSecretKey(parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  cached = parsed.data;
  return cached;
}

/** URL pública de um arquivo do bucket de imagens. */
export function publicImageUrl(storagePath: string): string {
  return `${env().NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${storagePath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}
