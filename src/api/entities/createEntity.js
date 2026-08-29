import { supabase } from '@/api/supabaseClient';

// Admin forms commonly default an optional date/number field to '' and send
// that unchanged when the field is left blank — Postgres accepts '' for text
// columns but rejects it for date/numeric/uuid ones ("invalid input syntax"),
// where Base44's schema-less writes tolerated it. Null is the correct "no
// value" for every column type, so blank-string values are normalized to
// null before every write.
function sanitize(payload) {
  const out = {};
  for (const [key, value] of Object.entries(payload)) {
    out[key] = value === '' ? null : value;
  }
  return out;
}

// Mirrors the base44.entities.X call shape (list/get/filter/create/update/delete/bulkUpdate)
// closely enough that call sites need only swap their import, not their logic.
export function createEntity(table) {
  function applySort(query, sort) {
    if (!sort) return query;
    const desc = sort.startsWith('-');
    const column = desc ? sort.slice(1) : sort;
    return query.order(column, { ascending: !desc });
  }

  return {
    async list(sort, limit, offset, fields) {
      let query = supabase.from(table).select(fields ? fields.join(',') : '*');
      query = applySort(query, sort);
      if (offset != null) {
        query = query.range(offset, offset + (limit ?? 100) - 1);
      } else if (limit != null) {
        query = query.limit(limit);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },

    async get(id) {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    },

    async filter(criteria = {}, sort, limit) {
      let query = supabase.from(table).select('*');
      for (const [key, value] of Object.entries(criteria)) {
        query = query.eq(key, value);
      }
      query = applySort(query, sort);
      if (limit != null) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },

    // returning:false skips the INSERT...RETURNING round-trip — needed for
    // tables a caller can insert into but not read back (e.g. a guest
    // creating an order: publicly insertable, but SELECT is owner/admin-only,
    // and Postgres RLS errors an INSERT...RETURNING whose new row fails the
    // SELECT policy rather than just omitting it). Pass an explicit `id` in
    // payload when using this so the caller still knows the created row's id.
    async create(payload, { returning = true } = {}) {
      const clean = sanitize(payload);
      if (!returning) {
        const { error } = await supabase.from(table).insert(clean);
        if (error) throw error;
        return clean;
      }
      const { data, error } = await supabase.from(table).insert(clean).select().single();
      if (error) throw error;
      return data;
    },

    async update(id, patch) {
      const { data, error } = await supabase.from(table).update(sanitize(patch)).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return true;
    },

    async bulkUpdate(updates) {
      return Promise.all(
        updates.map(({ id, ...patch }) =>
          supabase.from(table).update(sanitize(patch)).eq('id', id).then(({ error }) => {
            if (error) throw error;
          })
        )
      );
    },
  };
}
