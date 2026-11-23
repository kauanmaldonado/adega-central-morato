"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { discountPercent, formatBRL } from "@/lib/money";
import type { Catalog, Product } from "@/lib/types";
import { whatsappLink } from "@/lib/whatsapp";
import { resolveCart, useCart } from "./cart";
import { ProductThumb } from "./ProductThumb";
import { Sheet } from "./Sheet";
import styles from "./store.module.css";

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const pad = (n: number) => String(n).padStart(2, "0");

function minPrice(p: Product) {
  return p.variants.reduce((min, v) => Math.min(min, v.price_cents), Number.POSITIVE_INFINITY);
}
function offerVariant(p: Product) {
  return p.variants.find((v) => v.compare_at_cents && v.compare_at_cents > v.price_cents) ?? null;
}

export function Storefront({ catalog }: { catalog: Catalog }) {
  const { settings } = catalog;
  const cart = useCart();
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [sheetProduct, setSheetProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const allProducts = useMemo(() => catalog.categories.flatMap((c) => c.products), [catalog]);
  const lines = useMemo(() => resolveCart(catalog, cart.entries), [catalog, cart.entries]);
  const cartCount = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + l.totalCents, 0);

  const q = norm(search.trim());
  const showHome = !q && activeCat === "all";
  const results = useMemo(() => {
    if (showHome) return [];
    return catalog.categories
      .filter((c) => activeCat === "all" || c.id === activeCat)
      .flatMap((c) =>
        c.products.filter((p) => !q || norm(`${p.name} ${p.description ?? ""} ${c.name}`).includes(q)),
      );
  }, [catalog, activeCat, q, showHome]);

  const offers = allProducts.filter((p) => offerVariant(p));
  const featured = allProducts.filter((p) => p.is_featured).slice(0, 5);
  const news = allProducts.filter((p) => p.is_new);

  function notify(text: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }

  function quickAdd(p: Product) {
    const only = p.variants.length === 1 ? p.variants[0] : undefined;
    if (only) {
      cart.add(only.id, 1);
      notify(`${p.name} no carrinho`);
    } else {
      setSheetProduct(p);
    }
  }

  function pickCategory(id: string) {
    setActiveCat(id);
    setSearch("");
    navRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const waContact = whatsappLink(settings.whatsapp_number, `Olá! Vim pelo cardápio digital da ${settings.store_name}.`);
  const empty = catalog.categories.length === 0;

  return (
    <div className={styles.shell}>
      <header className={styles.hero}>
        <div className={styles.heroTop}>
          <span className={styles.status}>
            <span className={settings.is_open ? styles.dotOpen : styles.dotClosed} aria-hidden="true" />
            {settings.is_open ? "Aberto agora · pedidos pelo WhatsApp" : "Fechado no momento"}
          </span>
          <button type="button" className={styles.heroCart} onClick={() => setCartOpen(true)} aria-label={`Carrinho, ${cartCount} itens`}>
            <Icon name="bag" />
            {cartCount > 0 && <span className={styles.heroCartCount}>{cartCount}</span>}
          </button>
        </div>
        <h1 className={styles.logoWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-white.png" alt={settings.store_name} className={styles.logo} width={340} height={154} />
        </h1>
        <p className={styles.tagline}>
          Bebidas geladas, gelo e conveniência,
          <br />
          do balcão até a sua porta.
        </p>
        <label className={styles.search}>
          <span className="sr-only">Buscar no cardápio</span>
          <Icon name="search" size={19} />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setActiveCat("all");
            }}
            placeholder="Buscar refrigerante, gelo, energético…"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} aria-label="Limpar busca" className={styles.searchClear}>
              <Icon name="x" size={14} stroke={2.4} />
            </button>
          )}
        </label>
      </header>

      {!empty && (
        <nav ref={navRef} className={styles.chips} aria-label="Categorias">
          {[{ id: "all", name: "Tudo" }, ...catalog.categories].map((c) => (
            <button
              key={c.id}
              type="button"
              className={activeCat === c.id ? styles.chipOn : styles.chip}
              aria-pressed={activeCat === c.id}
              onClick={() => pickCategory(c.id)}
            >
              {c.name}
            </button>
          ))}
        </nav>
      )}

      <main className={styles.main}>
        {empty && (
          <section className={styles.emptyState}>
            <h2 className="h-section">Cardápio em preparação</h2>
            <p className="muted">Ainda não há produtos publicados. Volte em breve.</p>
          </section>
        )}

        {!empty && showHome && (
          <>
            {offers.length > 0 && (
              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <h2 className="h-section">
                    Ofertas <em>da semana</em>
                  </h2>
                </div>
                <div className={styles.rail}>
                  {offers.map((p, i) => {
                    const v = offerVariant(p)!;
                    return (
                      <article key={p.id} className={styles.offerCard}>
                        <button type="button" className={styles.cardHit} onClick={() => setSheetProduct(p)} aria-label={`Ver ${p.name}`} />
                        <div className={styles.offerMedia}>
                          <ProductThumb product={p} sizes="196px" badgeSize={40} priority={i < 2} />
                          <span className={styles.pct}>−{discountPercent(v.price_cents, v.compare_at_cents)}%</span>
                          <AddButton onClick={() => quickAdd(p)} label={`Adicionar ${p.name}`} />
                        </div>
                        <span className={styles.cardName}>{p.name}</span>
                        <span className={styles.priceRow}>
                          <strong>{formatBRL(v.price_cents)}</strong>
                          <s className="muted">{formatBRL(v.compare_at_cents!)}</s>
                        </span>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            <section className={styles.sectionPad}>
              <h2 className="h-section">Categorias</h2>
              <div className={styles.tiles}>
                {catalog.categories.map((c, i) => (
                  <button key={c.id} type="button" className={i % 3 === 0 ? styles.tileDark : styles.tile} onClick={() => pickCategory(c.id)}>
                    <span className={styles.tileNum}>— {pad(i + 1)}</span>
                    <span className={styles.tileName}>{c.name}</span>
                    <span className={styles.tileCount}>
                      {c.products.length} {c.products.length === 1 ? "produto" : "produtos"}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {featured.length > 0 && (
              <section className={styles.sectionPad}>
                <h2 className="h-section">
                  Mais <em>pedidos</em>
                </h2>
                <ol className={styles.rankList}>
                  {featured.map((p, i) => (
                    <li key={p.id} className={styles.rankItem}>
                      <span className={styles.rank} aria-hidden="true">{pad(i + 1)}</span>
                      <button type="button" className={styles.rankBody} onClick={() => setSheetProduct(p)}>
                        <span className={styles.rankThumb}><ProductThumb product={p} sizes="56px" badgeSize={15} /></span>
                        <span className={styles.rankText}>
                          <span className={styles.cardName}>{p.name}</span>
                          <span className="muted">
                            {p.variants.length > 1 ? "a partir de " : ""}
                            {formatBRL(minPrice(p))}
                          </span>
                        </span>
                      </button>
                      <AddButton onClick={() => quickAdd(p)} label={`Adicionar ${p.name}`} outline />
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {news.length > 0 && (
              <section className={styles.newsBox}>
                <span className="kicker">— Chegou na adega —</span>
                <h2 className="h-section">Novidades</h2>
                <div className={styles.rail}>
                  {news.map((p) => (
                    <button key={p.id} type="button" className={styles.newsCard} onClick={() => setSheetProduct(p)}>
                      <span className={styles.newsMedia}><ProductThumb product={p} sizes="150px" badgeSize={28} /></span>
                      <span className={styles.cardName}>{p.name}</span>
                      <span className="muted">{formatBRL(minPrice(p))}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className={styles.sectionPad}>
              <h2 className="h-section" style={{ fontSize: 40 }}>
                Cardápio <em>completo</em>
              </h2>
              {catalog.categories.map((c, i) => (
                <div key={c.id} className={styles.group}>
                  <h3 className={styles.groupHead}>
                    <span className="muted">— {pad(i + 1)}</span> {c.name}
                  </h3>
                  {c.products.map((p) => (
                    <MenuRow key={p.id} product={p} onOpen={() => setSheetProduct(p)} onAdd={() => quickAdd(p)} />
                  ))}
                </div>
              ))}
            </section>
          </>
        )}

        {!empty && !showHome && (
          <section className={styles.sectionPad}>
            <span className="kicker">— {q ? "Busca" : "Categoria"}</span>
            <h2 className="h-section">
              {q
                ? `${results.length} ${results.length === 1 ? "resultado" : "resultados"} para “${search.trim()}”`
                : catalog.categories.find((c) => c.id === activeCat)?.name}
            </h2>
            {results.map((p) => (
              <MenuRow key={p.id} product={p} onOpen={() => setSheetProduct(p)} onAdd={() => quickAdd(p)} />
            ))}
            {results.length === 0 && (
              <div className={styles.noResults}>
                <p className="muted">Nenhum produto encontrado.</p>
                <button type="button" className="btn btn-light" onClick={() => pickCategory("all")}>
                  Ver cardápio completo
                </button>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className={styles.footer}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-black.png" alt={settings.store_name} width={150} height={68} className={styles.footerLogo} />
        {settings.address && <p>{settings.address}</p>}
        {settings.opening_hours && <p>{settings.opening_hours}</p>}
        {settings.delivery_info && <p>{settings.delivery_info}</p>}
        <div className={styles.footerActions}>
          {waContact && (
            <a className="btn btn-dark" href={waContact} target="_blank" rel="noopener noreferrer">
              <Icon name="chat" size={18} /> Falar no WhatsApp
            </a>
          )}
        </div>
      </footer>

      {cartCount > 0 && !cartOpen && !sheetProduct && (
        <div className={styles.cartBar}>
          <button type="button" onClick={() => setCartOpen(true)}>
            <span className={styles.cartBarCount}>{cartCount}</span>
            <span>Ver carrinho</span>
            <strong>{formatBRL(subtotal)}</strong>
          </button>
        </div>
      )}

      <ProductSheet
        product={sheetProduct}
        onClose={() => setSheetProduct(null)}
        onAdd={(variantId, qty, label) => {
          cart.add(variantId, qty);
          setSheetProduct(null);
          notify(`${qty > 1 ? `${qty}× ` : ""}${label} no carrinho`);
        }}
      />

      <Sheet open={cartOpen} onClose={() => setCartOpen(false)} title="Seu carrinho" subtitle={cartCount ? `${cartCount} ${cartCount === 1 ? "item" : "itens"}` : "Vazio"}>
        {lines.length === 0 ? (
          <div className={styles.cartEmpty}>
            <p className="serif" style={{ fontSize: 26, fontStyle: "italic", margin: 0 }}>Nada por aqui ainda.</p>
            <p className="muted">Escolha suas bebidas e o gelo no cardápio.</p>
            <button type="button" className="btn btn-light" onClick={() => setCartOpen(false)}>Voltar ao cardápio</button>
          </div>
        ) : (
          <>
            <ul className={styles.cartList}>
              {lines.map((l) => (
                <li key={l.variant.id} className={styles.cartLine}>
                  <span className={styles.cartThumb}><ProductThumb product={l.product} sizes="64px" badgeSize={16} /></span>
                  <div className={styles.cartInfo}>
                    <div className={styles.cartTop}>
                      <span>
                        <span className={styles.cardName}>{l.product.name}</span>
                        <span className={`muted ${styles.small}`}>{l.variant.label} · {formatBRL(l.variant.price_cents)}</span>
                      </span>
                      <strong>{formatBRL(l.totalCents)}</strong>
                    </div>
                    <div className={styles.cartControls}>
                      <Stepper value={l.qty} min={0} onChange={(n) => cart.setQty(l.variant.id, n)} label={l.product.name} />
                      <button type="button" className={styles.linkBtn} onClick={() => cart.setQty(l.variant.id, 0)}>
                        <Icon name="trash" size={15} /> Remover
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className={styles.cartFoot}>
              <div className={styles.sumRow}><span>Subtotal</span><span>{formatBRL(subtotal)}</span></div>
              <div className={styles.sumRow}><span>Entrega</span><span>A combinar</span></div>
              {settings.min_order_cents != null && subtotal < settings.min_order_cents && (
                <p className="alert alert-info">Pedido mínimo: {formatBRL(settings.min_order_cents)}.</p>
              )}
              {!settings.is_open && <p className="alert alert-info">A loja está fechada no momento.</p>}
              <Link
                href="/checkout"
                className="btn btn-dark btn-block"
                style={{ height: 56 }}
                aria-disabled={!settings.is_open}
                onClick={(e) => !settings.is_open && e.preventDefault()}
              >
                Finalizar pedido
              </Link>
            </div>
          </>
        )}
      </Sheet>

      <div className={toast ? styles.toastOn : styles.toast} role="status" aria-live="polite">
        <Icon name="check" size={15} stroke={2.6} /> {toast}
      </div>
    </div>
  );
}

function AddButton({ onClick, label, outline = false }: { onClick: () => void; label: string; outline?: boolean }) {
  return (
    <button
      type="button"
      className={outline ? styles.addOutline : styles.add}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <Icon name="plus" size={18} stroke={2.2} />
    </button>
  );
}

function MenuRow({ product: p, onOpen, onAdd }: { product: Product; onOpen: () => void; onAdd: () => void }) {
  const offer = offerVariant(p);
  return (
    <div className={styles.row}>
      <button type="button" className={styles.rowBody} onClick={onOpen}>
        <span className={styles.rowName}>{p.name}</span>
        {p.description && <span className={styles.rowDesc}>{p.description}</span>}
        <span className={styles.rowPrice}>
          {p.variants.length > 1 && !offer && <span className="muted">a partir de</span>}
          {formatBRL(offer ? offer.price_cents : minPrice(p))}
          {offer && <s className="muted">{formatBRL(offer.compare_at_cents!)}</s>}
        </span>
      </button>
      <div className={styles.rowMedia}>
        <ProductThumb product={p} sizes="96px" />
        <AddButton onClick={onAdd} label={`Adicionar ${p.name}`} />
      </div>
    </div>
  );
}

export function Stepper({ value, onChange, label, min = 1 }: { value: number; onChange: (n: number) => void; label: string; min?: number }) {
  return (
    <div className={styles.stepper}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label={`Diminuir ${label}`} disabled={value <= min}>
        <Icon name="minus" size={15} stroke={2.4} />
      </button>
      <span aria-live="polite">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(99, value + 1))} aria-label={`Aumentar ${label}`} disabled={value >= 99}>
        <Icon name="plus" size={15} stroke={2.4} />
      </button>
    </div>
  );
}

function ProductSheet({
  product,
  onClose,
  onAdd,
}: {
  product: Product | null;
  onClose: () => void;
  onAdd: (variantId: string, qty: number, label: string) => void;
}) {
  const [variantId, setVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!product) return;
    const cheapest = [...product.variants].sort((a, b) => a.price_cents - b.price_cents)[0];
    setVariantId(cheapest?.id ?? null);
    setQty(1);
  }, [product]);

  const variant = product?.variants.find((v) => v.id === variantId) ?? product?.variants[0];

  return (
    <Sheet open={!!product} onClose={onClose} title={product?.name ?? ""} hideHeader>
      {product && variant && (
        <div className={styles.sheetBody}>
          <div className={styles.sheetMedia}>
            <ProductThumb product={product} sizes="(max-width: 480px) 100vw, 440px" badgeSize={64} />
            <button type="button" className={`icon-btn ${styles.sheetClose}`} onClick={onClose} aria-label="Fechar">
              <Icon name="x" size={18} stroke={2.2} />
            </button>
          </div>
          <h2 className="serif" style={{ fontSize: 34, lineHeight: 1.05, margin: 0 }}>{product.name}</h2>
          {product.description && <p className={styles.sheetDesc}>{product.description}</p>}

          {product.variants.length > 1 && (
            <fieldset className={styles.variants}>
              <legend className="label">Escolha uma opção</legend>
              {product.variants.map((v) => (
                <label key={v.id} className={v.id === variant.id ? styles.variantOn : styles.variant}>
                  <input type="radio" name="variant" checked={v.id === variant.id} onChange={() => setVariantId(v.id)} />
                  <span className={styles.variantLabel}>{v.label}</span>
                  {v.compare_at_cents && <s className="muted">{formatBRL(v.compare_at_cents)}</s>}
                  <strong>{formatBRL(v.price_cents)}</strong>
                </label>
              ))}
            </fieldset>
          )}

          <div className={styles.sheetActions}>
            <Stepper value={qty} onChange={(n) => setQty(Math.max(1, n))} label="quantidade" />
            <button
              type="button"
              className={`btn btn-dark ${styles.sheetAdd}`}
              onClick={() => onAdd(variant.id, qty, product.variants.length > 1 ? `${product.name} · ${variant.label}` : product.name)}
            >
              <span>Adicionar</span>
              <span>{formatBRL(variant.price_cents * qty)}</span>
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
