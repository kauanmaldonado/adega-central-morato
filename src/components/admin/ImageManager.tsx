"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { ProductImage } from "@/lib/types";
import { api, ApiClientError } from "./api";
import styles from "./admin.module.css";

const MAX = 5 * 1024 * 1024;

export function ImageManager({ productId, productName, images }: { productId: string; productName: string; images: ProductImage[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setMessage(null);
    setBusy(true);
    let sent = 0;
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX) throw new ApiClientError(`"${file.name}" tem mais de 5 MB.`, 413);
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
          throw new ApiClientError(`"${file.name}" não é JPG, PNG ou WebP.`, 415);
        const form = new FormData();
        form.append("file", file);
        form.append("alt", productName);
        await api(`/api/admin/products/${productId}/images`, { method: "POST", form });
        sent++;
      }
      setMessage({ ok: true, text: sent === 1 ? "Foto enviada." : `${sent} fotos enviadas.` });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof ApiClientError ? e.message : "Falha no envio." });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
      router.refresh();
    }
  }

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof ApiClientError ? e.message : "Não foi possível salvar." });
    } finally {
      setBusy(false);
    }
  }

  const makeMain = (img: ProductImage) =>
    act(async () => {
      // A foto principal é a de menor posição: reordena todas
      const ordered = [img, ...images.filter((i) => i.id !== img.id)];
      for (const [position, i] of ordered.entries()) {
        if (i.position !== position) await api(`/api/admin/images/${i.id}`, { method: "PATCH", body: { position } });
      }
    });

  return (
    <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12, alignSelf: "flex-start" }}>
      <h2 className={styles.subtitle}>Fotos</h2>
      <p className="hint" style={{ margin: 0 }}>JPG, PNG ou WebP até 5 MB. A primeira foto aparece no cardápio. Prefira imagens quadradas.</p>
      {message && <p className={`alert ${message.ok ? "alert-ok" : "alert-error"}`} role="status">{message.text}</p>}

      {images.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>Nenhuma foto. Sem foto, o cardápio mostra o rótulo do produto.</p>
      ) : (
        <ul className={styles.imageGrid}>
          {images.map((img, i) => (
            <li key={img.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.alt ?? ""} />
              <div className={styles.imageTools}>
                {i === 0 ? (
                  <span className="pill pill-dark">Principal</span>
                ) : (
                  <button type="button" className="btn btn-light btn-sm" disabled={busy} onClick={() => makeMain(img)}>Usar como principal</button>
                )}
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={busy}
                  onClick={() => act(() => api(`/api/admin/images/${img.id}`, { method: "DELETE" }))}
                  aria-label={`Excluir foto ${i + 1}`}
                >
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <label className="btn btn-dark" style={{ alignSelf: "flex-start" }} aria-disabled={busy}>
        {busy ? "Enviando…" : "Enviar fotos"}
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files)} />
      </label>
    </section>
  );
}
