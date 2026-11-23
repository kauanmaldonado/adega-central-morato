import { test } from "node:test";
import assert from "node:assert/strict";
import { mapDbError } from "../src/server/db-errors";
import { RateLimiter, clientIp } from "../src/server/rate-limit";

test("erros de negócio do banco viram respostas HTTP em português", () => {
  assert.deepEqual(mapDbError({ code: "P0001", message: "order:store_closed" }).status, 409);
  assert.equal(mapDbError({ message: "order:item_unavailable" }).code, "item_unavailable");
  assert.equal(mapDbError({ message: "order:too_many_orders" }).status, 429);
  assert.equal(mapDbError({ message: "auth:forbidden" }).status, 403);
  assert.equal(mapDbError({ code: "23503", message: "fk" }).status, 409);
  assert.equal(mapDbError({ code: "23505", message: "dup" }).code, "duplicate");
  assert.equal(mapDbError({ code: "42501", message: "rls" }).status, 403);
});

test("erro desconhecido não vaza detalhes internos", () => {
  const m = mapDbError({ code: "XX000", message: 'relation "secret_table" does not exist' });
  assert.equal(m.status, 500);
  assert.doesNotMatch(m.message, /secret_table/);
});

test("limitador de requisições", () => {
  let now = 0;
  const rl = new RateLimiter(3, 1000, () => now);
  assert.equal(rl.check("ip"), true);
  assert.equal(rl.check("ip"), true);
  assert.equal(rl.check("ip"), true);
  assert.equal(rl.check("ip"), false);
  assert.equal(rl.check("outro"), true);
  now = 1001;
  assert.equal(rl.check("ip"), true);
});

test("IP do cliente atrás do proxy", () => {
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "1.1.1.1, 10.0.0.1" })), "1.1.1.1");
  assert.equal(clientIp(new Headers({ "x-real-ip": "2.2.2.2", "x-forwarded-for": "1.1.1.1" })), "2.2.2.2");
  assert.equal(clientIp(new Headers()), "unknown");
});
