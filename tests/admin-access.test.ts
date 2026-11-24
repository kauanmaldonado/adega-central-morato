import { test } from "node:test";
import assert from "node:assert/strict";
import { decideHost, isAdminPath, isValidAdminHost, normalizeHost } from "../src/lib/admin-host";

const ADMIN = "admin.adega.com.br";
const SITE = "www.adega.com.br";
const prod = (host: string, pathname: string, adminHost: string | undefined = ADMIN) =>
  decideHost({ host, pathname, adminHost, isProduction: true });

// ---------------------------------------------------------------------------
// Endereço próprio do painel
// ---------------------------------------------------------------------------
test("isAdminPath reconhece apenas rotas do painel", () => {
  for (const p of ["/admin", "/admin/login", "/admin/produtos/1", "/api/admin/orders", "/api/auth/login", "/api/auth/logout"]) {
    assert.equal(isAdminPath(p), true, p);
  }
  for (const p of ["/", "/checkout", "/api/orders", "/api/catalog", "/administrador", "/api/authz", "/adminx"]) {
    assert.equal(isAdminPath(p), false, p);
  }
});

test("no endereço do cardápio, o painel não existe (404)", () => {
  assert.deepEqual(prod(SITE, "/admin"), { action: "not_found", api: false });
  assert.deepEqual(prod(SITE, "/admin/login"), { action: "not_found", api: false });
  assert.deepEqual(prod(SITE, "/api/admin/orders"), { action: "not_found", api: true });
  assert.deepEqual(prod(SITE, "/api/auth/login"), { action: "not_found", api: true });
  assert.deepEqual(prod(SITE, "/api/auth/logout"), { action: "not_found", api: true });
});

test("no endereço do cardápio, as páginas públicas funcionam", () => {
  for (const p of ["/", "/checkout", "/api/orders", "/api/catalog", "/api/health", "/logo-black.png"]) {
    assert.deepEqual(prod(SITE, p), { action: "next", adminHost: false }, p);
  }
});

test("no endereço do painel, a raiz leva ao painel e o resto do site não existe", () => {
  assert.deepEqual(prod(ADMIN, "/"), { action: "redirect", pathname: "/admin" });
  assert.deepEqual(prod(ADMIN, "/admin"), { action: "next", adminHost: true });
  assert.deepEqual(prod(ADMIN, "/admin/login"), { action: "next", adminHost: true });
  assert.deepEqual(prod(ADMIN, "/api/admin/products"), { action: "next", adminHost: true });
  assert.deepEqual(prod(ADMIN, "/api/auth/login"), { action: "next", adminHost: true });
  assert.deepEqual(prod(ADMIN, "/api/health"), { action: "next", adminHost: true });
  assert.deepEqual(prod(ADMIN, "/logo-black.png"), { action: "next", adminHost: true });
  assert.deepEqual(prod(ADMIN, "/checkout"), { action: "not_found", api: false });
  assert.deepEqual(prod(ADMIN, "/api/orders"), { action: "not_found", api: true });
  assert.deepEqual(prod(ADMIN, "/api/catalog"), { action: "not_found", api: true });
});

test("o host é comparado sem diferenciar maiúsculas e aceita ADMIN_HOST com https://", () => {
  assert.deepEqual(prod("Admin.Adega.com.br", "/admin"), { action: "next", adminHost: true });
  assert.deepEqual(prod(ADMIN, "/admin", "https://Admin.Adega.com.br/"), { action: "next", adminHost: true });
  assert.equal(normalizeHost("https://Admin.Site.com.br/painel"), "admin.site.com.br");
  assert.equal(normalizeHost("admin.localhost:3000"), "admin.localhost:3000");
});

test("um subdomínio parecido não é tratado como o painel", () => {
  assert.deepEqual(prod("admin.adega.com.br.evil.com", "/admin"), { action: "not_found", api: false });
  assert.deepEqual(prod("xadmin.adega.com.br", "/admin"), { action: "not_found", api: false });
});

test("sem ADMIN_HOST: painel desativado em produção, liberado em desenvolvimento", () => {
  assert.deepEqual(prod(SITE, "/admin", undefined), { action: "not_found", api: false });
  assert.deepEqual(prod(SITE, "/api/auth/login", ""), { action: "not_found", api: true });
  assert.deepEqual(prod(SITE, "/", undefined), { action: "next", adminHost: false });
  assert.deepEqual(decideHost({ host: "localhost:3000", pathname: "/admin", adminHost: undefined, isProduction: false }), {
    action: "next",
    adminHost: false,
  });
});

test("ADMIN_HOST com porta funciona em desenvolvimento (admin.localhost:3000)", () => {
  const d = decideHost({ host: "admin.localhost:3000", pathname: "/admin", adminHost: "admin.localhost:3000", isProduction: false });
  assert.deepEqual(d, { action: "next", adminHost: true });
  const site = decideHost({ host: "localhost:3000", pathname: "/admin", adminHost: "admin.localhost:3000", isProduction: false });
  assert.deepEqual(site, { action: "not_found", api: false });
});

test("isValidAdminHost aceita hosts e rejeita URLs e lixo", () => {
  assert.equal(isValidAdminHost("admin.adega.com.br"), true);
  assert.equal(isValidAdminHost("admin.localhost:3000"), true);
  assert.equal(isValidAdminHost("https://admin.adega.com.br"), false);
  assert.equal(isValidAdminHost("admin adega"), false);
  assert.equal(isValidAdminHost(""), false);
});
