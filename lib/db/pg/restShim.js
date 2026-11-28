/**
 * Adaptador que imita la interfaz de consulta del cliente de Supabase y la
 * traduce a SQL sobre una conexion directa a Postgres.
 *
 * POR QUE EXISTE
 * ==============
 * Supabase restringio el proyecto por egress el 2026-11-27: PostgREST responde
 * HTTP 402. La base, en cambio, acepta conexiones por el pooler con normalidad.
 *
 * El codigo de la aplicacion llama al cliente de Supabase en ~1.400 sitios
 * repartidos por 96 archivos. Reescribirlos a SQL seria inviable y arriesgado
 * para una medida que dura una semana. Este adaptador presenta la MISMA forma
 * (`.from().select().eq()...`) y traduce a SQL por debajo, de modo que esos 96
 * archivos no se tocan.
 *
 * ALCANCE
 * =======
 * Cubre lo que la aplicacion usa de verdad, contado sobre el codigo:
 *   .select .insert .update .upsert .delete
 *   .eq .neq .gt .gte .lt .lte .like .ilike .is .in .or .not .match .contains
 *   .order .limit .range .single .maybeSingle
 *   count: "exact" (con y sin head)
 *   joins anidados de PostgREST: "*, alias:tabla(col1, col2)"  -> 12 archivos
 *
 * NO cubre (y por eso el fallback es selectivo, no global):
 *   - Storage, Auth, Realtime: son servicios HTTP, no hay equivalente en SQL
 *   - .rpc(): 4 usos, se dejan al cliente normal
 *   - .textSearch, .overlaps: sin usos en el codigo
 *
 * SEGURIDAD
 * =========
 * Dos reglas que no se rompen:
 *   1. Los VALORES van siempre como parametros ($1, $2...). Nunca se interpolan.
 *   2. Los IDENTIFICADORES (tabla y columna) se validan contra una expresion
 *      estricta y se citan. No pueden venir de entrada de usuario sin pasar por
 *      ahi, y si no encajan, la consulta se rechaza antes de construirse.
 *
 * Este adaptador usa el rol `postgres`, que NO aplica RLS. Es equivalente al
 * `service_role` que ya usaba createAdminClient(), asi que no cambia el modelo
 * de permisos: las rutas siguen comprobando la sesion por su cuenta.
 *
 * TEMPORAL — se retira quitando PG_FALLBACK_ENABLED (ver REVERTIR.md).
 */

import { query } from "./client";

/** Identificador SQL valido: letras, numeros y guion bajo. Nada mas. */
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Cita un identificador tras validarlo. Lanza si no es valido. */
function ident(name) {
  const s = String(name).trim();
  if (!IDENT.test(s)) {
    throw new Error(`pg-shim: identificador no valido: ${JSON.stringify(name)}`);
  }
  return `"${s}"`;
}

/**
 * Parsea la cadena de `select()` de PostgREST.
 *
 * Soporta:
 *   "*"                                  -> todas las columnas
 *   "id, name"                           -> columnas sueltas
 *   "*, destination:destinations(id,name)" -> join anidado con alias
 *   "*, destinations:destinations(count)"  -> conteo de la relacion
 *
 * Devuelve { columns: string[], embeds: Array<{alias, table, cols, isCount}> }
 */
function parseSelect(sel) {
  const spec = (sel ?? "*").trim();
  const columns = [];
  const embeds = [];

  let depth = 0;
  let buf = "";
  const parts = [];
  for (const ch of spec) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(buf);
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) parts.push(buf);

  for (const raw of parts) {
    const piece = raw.trim();
    if (!piece) continue;

    const embedMatch = piece.match(/^(?:([A-Za-z_][\w]*)\s*:\s*)?([A-Za-z_][\w]*)\s*\((.*)\)$/s);
    if (embedMatch) {
      const [, aliasRaw, table, inner] = embedMatch;
      const innerTrim = inner.trim();
      const isCount = innerTrim === "count";
      embeds.push({
        alias: aliasRaw || table,
        table,
        isCount,
        cols: isCount
          ? []
          : innerTrim === "*"
            ? ["*"]
            : innerTrim.split(",").map((c) => c.trim()).filter(Boolean),
      });
      continue;
    }

    columns.push(piece === "*" ? "*" : piece);
  }

  return { columns: columns.length ? columns : ["*"], embeds };
}

/**
 * Traduce una cadena `.or()` de PostgREST a SQL.
 * Ejemplo: "subject.ilike.%x%,from_email.eq.a@b.com"
 */
function buildOr(spec, push) {
  const clauses = [];
  let depth = 0;
  let buf = "";
  const parts = [];
  for (const ch of String(spec)) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(buf);
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) parts.push(buf);

  for (const part of parts) {
    const m = String(part).trim().match(/^([A-Za-z_][\w]*)\.([a-z]+)\.(.*)$/s);
    if (!m) continue;
    const [, col, op, val] = m;
    clauses.push(buildCondition(col, op, val, push));
  }

  return clauses.length ? `(${clauses.join(" OR ")})` : null;
}

/** Construye una condicion suelta. `push` registra el parametro y da su $n. */
function buildCondition(col, op, value, push) {
  const c = ident(col);
  switch (op) {
    case "eq":
      return `${c} = ${push(value)}`;
    case "neq":
      return `${c} <> ${push(value)}`;
    case "gt":
      return `${c} > ${push(value)}`;
    case "gte":
      return `${c} >= ${push(value)}`;
    case "lt":
      return `${c} < ${push(value)}`;
    case "lte":
      return `${c} <= ${push(value)}`;
    case "like":
      return `${c} LIKE ${push(value)}`;
    case "ilike":
      return `${c} ILIKE ${push(value)}`;
    case "is": {
      // PostgREST acepta is.null / is.true / is.false, y en la API JS llega el
      // valor real (null, true, false).
      const v = value === "null" ? null : value === "true" ? true : value === "false" ? false : value;
      if (v === null) return `${c} IS NULL`;
      return `${c} IS ${v ? "TRUE" : "FALSE"}`;
    }
    case "in": {
      const arr = Array.isArray(value)
        ? value
        : String(value).replace(/^\(|\)$/g, "").split(",").map((s) => s.trim());
      if (arr.length === 0) return "FALSE"; // IN () no es SQL valido
      return `${c} = ANY(${push(arr)})`;
    }
    case "cs":
    case "contains":
      return `${c} @> ${push(JSON.stringify(value))}::jsonb`;
    default:
      throw new Error(`pg-shim: operador no soportado: ${op}`);
  }
}

/**
 * Constructor de consultas. Devuelve un objeto encadenable que se resuelve como
 * promesa (tiene `then`), igual que el cliente de Supabase.
 */
class PgQueryBuilder {
  constructor(table) {
    this.table = table;
    this._op = "select";
    this._select = "*";
    this._conditions = [];
    this._params = [];
    this._order = [];
    this._limit = null;
    this._offset = null;
    this._single = false;
    this._maybeSingle = false;
    this._count = null;
    this._head = false;
    this._payload = null;
    this._onConflict = null;
    this._ignoreDuplicates = false;
    /** Fallo de validacion al encadenar; se emite al resolverse, no se lanza. */
    this._buildError = null;

    // La tabla se valida ya aqui para que un nombre invalido no llegue nunca a
    // formar parte de una cadena SQL.
    if (!IDENT.test(String(table).trim())) {
      this._buildError = {
        message: `pg-shim: nombre de tabla no valido: ${JSON.stringify(table)}`,
        code: "PG_SHIM_INVALID_QUERY",
      };
    }
  }

  /** Registra un valor como parametro y devuelve su marcador ($1, $2...). */
  _push(value) {
    this._params.push(value);
    return `$${this._params.length}`;
  }

  /**
   * Ejecuta un paso de construccion capturando el fallo.
   *
   * Los metodos de filtro validan identificadores y pueden lanzar. El cliente de
   * Supabase nunca lanza al encadenar: devuelve `{ data, error }` al resolverse.
   * Para no romper ese contrato (una ruta que espera `error` se encontraria con
   * una excepcion y devolveria 500), el fallo se guarda y se emite al final.
   */
  _guard(fn) {
    if (this._buildError) return this;
    try {
      fn();
    } catch (err) {
      this._buildError = {
        message: err?.message || String(err),
        code: "PG_SHIM_INVALID_QUERY",
      };
    }
    return this;
  }

  // --- Operaciones ---------------------------------------------------------

  select(sel = "*", opts = {}) {
    if (this._op === "select") this._select = sel;
    else this._returning = sel;
    if (opts.count) this._count = opts.count;
    if (opts.head) this._head = true;
    return this;
  }

  insert(payload) {
    this._op = "insert";
    this._payload = payload;
    return this;
  }

  upsert(payload, opts = {}) {
    this._op = "upsert";
    this._payload = payload;
    this._onConflict = opts.onConflict || null;
    this._ignoreDuplicates = Boolean(opts.ignoreDuplicates);
    return this;
  }

  update(payload) {
    this._op = "update";
    this._payload = payload;
    return this;
  }

  delete() {
    this._op = "delete";
    return this;
  }

  // --- Filtros -------------------------------------------------------------

  _cond(col, op, v) {
    return this._guard(() =>
      this._conditions.push(buildCondition(col, op, v, (x) => this._push(x))),
    );
  }

  eq(col, v) { return this._cond(col, "eq", v); }
  neq(col, v) { return this._cond(col, "neq", v); }
  gt(col, v) { return this._cond(col, "gt", v); }
  gte(col, v) { return this._cond(col, "gte", v); }
  lt(col, v) { return this._cond(col, "lt", v); }
  lte(col, v) { return this._cond(col, "lte", v); }
  like(col, v) { return this._cond(col, "like", v); }
  ilike(col, v) { return this._cond(col, "ilike", v); }
  is(col, v) { return this._cond(col, "is", v); }
  in(col, arr) { return this._cond(col, "in", arr); }
  contains(col, v) { return this._cond(col, "contains", v); }
  filter(col, op, v) { return this._cond(col, op, v); }

  or(spec) {
    return this._guard(() => {
      const clause = buildOr(spec, (x) => this._push(x));
      if (clause) this._conditions.push(clause);
    });
  }

  not(col, op, v) {
    return this._guard(() =>
      this._conditions.push(
        `NOT (${buildCondition(col, op, v, (x) => this._push(x))})`,
      ),
    );
  }

  match(obj) {
    return this._guard(() => {
      for (const [k, v] of Object.entries(obj || {})) {
        this._conditions.push(buildCondition(k, "eq", v, (x) => this._push(x)));
      }
    });
  }

  // --- Orden y paginacion --------------------------------------------------

  order(col, opts = {}) {
    return this._guard(() =>
      this._order.push(
        `${ident(col)} ${opts.ascending === false ? "DESC" : "ASC"}${
          opts.nullsFirst === true
            ? " NULLS FIRST"
            : opts.nullsFirst === false
              ? " NULLS LAST"
              : ""
        }`,
      ),
    );
  }

  limit(n) { this._limit = Number(n); return this; }

  range(from, to) {
    this._offset = Number(from);
    this._limit = Number(to) - Number(from) + 1;
    return this;
  }

  single() { this._single = true; return this; }
  maybeSingle() { this._maybeSingle = true; return this; }

  // --- Ejecucion -----------------------------------------------------------

  _where() {
    return this._conditions.length ? ` WHERE ${this._conditions.join(" AND ")}` : "";
  }

  /**
   * Resuelve los joins anidados con consultas adicionales.
   *
   * PostgREST los resuelve en una sola peticion; aqui se hace con una consulta
   * por relacion (patron N+1 acotado: una por embed, no una por fila). Para los
   * volumenes de esta aplicacion (decenas de filas) el coste es irrelevante, y
   * es mucho mas simple y seguro que generar LATERAL JOINs dinamicos.
   */
  async _resolveEmbeds(rows, embeds) {
    if (!rows.length || !embeds.length) return rows;

    for (const emb of embeds) {
      // Convencion de la base: la columna que apunta a `destinations` es
      // `destination_id`. Se prueba en singular y en plural.
      //
      // Tambien se prueba por el ALIAS, porque no todas las claves foraneas
      // llevan el nombre de su tabla: la que apunta a `destination_categories`
      // es `category_id`, no `destination_category_id`. En PostgREST el alias
      // es justo como el llamante nombra la relacion
      // (`category:destination_categories(...)` -> `category_id`), asi que
      // derivarlo del alias acierta sin tener que adivinar.
      const singular = emb.table.replace(/s$/, "");
      const aliasSingular = String(emb.alias || "").replace(/s$/, "");
      const candidates = [
        `${singular}_id`,
        `${emb.table}_id`,
        ...(aliasSingular ? [`${aliasSingular}_id`] : []),
      ];
      const fk = candidates.find((c) => Object.prototype.hasOwnProperty.call(rows[0], c));

      if (!fk) {
        // Sin clave foranea reconocible, se deja en null en vez de fallar: es
        // preferible una pagina con un dato menos que un error 500.
        for (const r of rows) r[emb.alias] = emb.isCount ? [{ count: 0 }] : null;
        continue;
      }

      const ids = [...new Set(rows.map((r) => r[fk]).filter((v) => v != null))];
      if (!ids.length) {
        for (const r of rows) r[emb.alias] = emb.isCount ? [{ count: 0 }] : null;
        continue;
      }

      if (emb.isCount) {
        const res = await query(
          `SELECT ${ident(fk)} AS k, COUNT(*)::int AS count FROM ${ident(emb.table)} WHERE ${ident(fk)} = ANY($1) GROUP BY 1`,
          [ids],
        );
        const map = new Map(res.rows.map((r) => [String(r.k), r.count]));
        for (const r of rows) r[emb.alias] = [{ count: map.get(String(r[fk])) || 0 }];
        continue;
      }

      const cols = emb.cols.includes("*")
        ? "*"
        : [...new Set(["id", ...emb.cols])].map(ident).join(", ");
      const res = await query(
        `SELECT ${cols} FROM ${ident(emb.table)} WHERE "id" = ANY($1)`,
        [ids],
      );
      const map = new Map(res.rows.map((r) => [String(r.id), r]));
      for (const r of rows) r[emb.alias] = map.get(String(r[fk])) || null;
    }

    return rows;
  }

  async _run() {
    // Un identificador invalido detectado al encadenar se emite aqui, como
    // error normal, sin llegar a construir ni ejecutar SQL.
    if (this._buildError) {
      return { data: null, error: this._buildError, count: null };
    }

    const t = ident(this.table);

    // --- SELECT ---
    if (this._op === "select") {
      const { columns, embeds } = parseSelect(this._select);

      // count: "exact" sin head -> hacen falta las filas y el total.
      let total = null;
      if (this._count) {
        const res = await query(
          `SELECT COUNT(*)::int AS n FROM ${t}${this._where()}`,
          this._params,
        );
        total = res.rows[0]?.n ?? 0;
        // head: true -> solo el conteo, cero filas. Es justo el patron que
        // evita descargar datos para contar.
        if (this._head) return { data: null, error: null, count: total };
      }

      const colSql = columns.includes("*") ? "*" : columns.map(ident).join(", ");
      let sql = `SELECT ${colSql} FROM ${t}${this._where()}`;
      if (this._order.length) sql += ` ORDER BY ${this._order.join(", ")}`;
      if (this._limit != null) sql += ` LIMIT ${Number(this._limit)}`;
      if (this._offset != null) sql += ` OFFSET ${Number(this._offset)}`;

      const res = await query(sql, this._params);
      const rows = await this._resolveEmbeds(res.rows, embeds);

      if (this._single || this._maybeSingle) {
        if (rows.length === 0) {
          // .single() en Supabase da error si no hay fila; .maybeSingle() no.
          return this._single
            ? { data: null, error: { message: "No rows found", code: "PGRST116" }, count: total }
            : { data: null, error: null, count: total };
        }
        return { data: rows[0], error: null, count: total };
      }

      return { data: rows, error: null, count: total };
    }

    // --- INSERT / UPSERT ---
    if (this._op === "insert" || this._op === "upsert") {
      const list = Array.isArray(this._payload) ? this._payload : [this._payload];
      if (!list.length) return { data: [], error: null, count: 0 };

      const cols = [...new Set(list.flatMap((o) => Object.keys(o)))];
      const colSql = cols.map(ident).join(", ");

      const valueRows = list.map(
        (obj) => `(${cols.map((c) => this._push(normalize(obj[c]))).join(", ")})`,
      );

      let sql = `INSERT INTO ${t} (${colSql}) VALUES ${valueRows.join(", ")}`;

      if (this._op === "upsert") {
        const conflictCols = (this._onConflict || "id")
          .split(",")
          .map((s) => ident(s.trim()))
          .join(", ");
        sql += this._ignoreDuplicates
          ? ` ON CONFLICT (${conflictCols}) DO NOTHING`
          : ` ON CONFLICT (${conflictCols}) DO UPDATE SET ${cols
              .map((c) => `${ident(c)} = EXCLUDED.${ident(c)}`)
              .join(", ")}`;
      }

      sql += " RETURNING *";

      const res = await query(sql, this._params);
      const rows = res.rows;
      if (this._single || this._maybeSingle) {
        return { data: rows[0] ?? null, error: null, count: rows.length };
      }
      return { data: rows, error: null, count: rows.length };
    }

    // --- UPDATE ---
    if (this._op === "update") {
      const entries = Object.entries(this._payload || {});
      if (!entries.length) return { data: [], error: null, count: 0 };

      // El SET se construye antes del WHERE para que los parametros queden en
      // el orden en que Postgres los espera.
      const sets = [];
      const setParams = [];
      for (const [k, v] of entries) {
        setParams.push(normalize(v));
        sets.push(`${ident(k)} = $${setParams.length}`);
      }

      // Se reconstruyen las condiciones desplazando los marcadores.
      const offset = setParams.length;
      const shifted = this._conditions.map((c) =>
        c.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + offset}`),
      );
      const where = shifted.length ? ` WHERE ${shifted.join(" AND ")}` : "";

      const sql = `UPDATE ${t} SET ${sets.join(", ")}${where} RETURNING *`;
      const res = await query(sql, [...setParams, ...this._params]);
      const rows = res.rows;
      if (this._single || this._maybeSingle) {
        return { data: rows[0] ?? null, error: null, count: rows.length };
      }
      return { data: rows, error: null, count: rows.length };
    }

    // --- DELETE ---
    if (this._op === "delete") {
      const sql = `DELETE FROM ${t}${this._where()} RETURNING *`;
      const res = await query(sql, this._params);
      return { data: res.rows, error: null, count: res.rows.length };
    }

    throw new Error(`pg-shim: operacion no soportada: ${this._op}`);
  }

  /** Hace el builder esperable (`await`), igual que el cliente de Supabase. */
  then(onFulfilled, onRejected) {
    return this._run()
      .catch((err) => ({
        data: null,
        error: { message: err?.message || String(err), code: "PG_SHIM_ERROR" },
        count: null,
      }))
      .then(onFulfilled, onRejected);
  }
}

/** Serializa objetos a JSON: `pg` no sabe mandar un objeto plano a jsonb. */
function normalize(v) {
  if (v === undefined) return null;
  if (v !== null && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v)) {
    return JSON.stringify(v);
  }
  if (Array.isArray(v)) return JSON.stringify(v);
  return v;
}

/**
 * Cliente con la misma forma que el de Supabase, hablando SQL por debajo.
 * Solo expone `from()`: Storage, Auth y Realtime no tienen equivalente y deben
 * resolverse con el cliente real (o degradar, segun el caso).
 */
export function createPgShimClient() {
  /**
   * Storage no tiene equivalente en SQL: los ficheros viven en el servicio HTTP
   * de Supabase, que es justo lo que esta restringido.
   *
   * Se devuelve un objeto con la forma esperada que SIEMPRE falla de forma
   * controlada, con `{ data: null, error }`. Sin esto, el codigo que llama a
   * `.storage.from(...).upload(...)` daria un TypeError ("cannot read property
   * from of undefined") y tumbaria la peticion con un 500.
   *
   * El codigo que sube adjuntos ya trata el fallo: guarda `storage_path: null`
   * y un `ingest_error`, y el correo entra igual (lib/email/attachmentStorage.js
   * y app/api/webhook/email/route.js:150). Degradar asi es lo que permite que
   * un correo con adjunto se registre aunque el fichero no se pueda guardar.
   */
  const storageError = {
    message:
      "Supabase Storage no disponible: proyecto restringido por egress " +
      "(hasta 2026-12-04). El adaptador Postgres no cubre Storage.",
    code: "PG_SHIM_NO_STORAGE",
  };

  const storageBucket = {
    async upload() {
      return { data: null, error: storageError };
    },
    async download() {
      return { data: null, error: storageError };
    },
    async remove() {
      return { data: null, error: storageError };
    },
    async createSignedUrl() {
      return { data: null, error: storageError };
    },
    async list() {
      return { data: null, error: storageError };
    },
  };

  return {
    from(table) {
      return new PgQueryBuilder(table);
    },

    storage: {
      from() {
        return storageBucket;
      },
    },

    /**
     * `.rpc()` tampoco se traduce: cada funcion almacenada tendria que
     * replicarse a mano. Son 4 usos en el codigo y ninguno en una ruta critica
     * durante la restriccion. Falla de forma controlada, como Storage.
     */
    async rpc(name) {
      return {
        data: null,
        error: {
          message:
            `rpc("${name}") no esta disponible por el adaptador Postgres ` +
            `(restriccion de egress hasta 2026-12-04).`,
          code: "PG_SHIM_NO_RPC",
        },
      };
    },

    // Marcador para distinguirlo en depuracion.
    __isPgShim: true,
  };
}
