import { supabase } from '@/api/supabaseClient';

// Adapts Supabase Realtime's postgres_changes payload shape to the
// {type:'create'|'update'|'delete', data, id} shape Base44's
// entity.subscribe() callback used, so call sites need minimal changes.
// RLS applies to realtime the same as to reads, so only rows the connected
// user can already SELECT (their own orders, or all of them if admin) are
// ever delivered.
//
// Channel name must be unique per subscription, not a fixed string: more
// than one component can subscribe at once (e.g. the always-mounted
// NewOrderNotifier + the OrdersManagement page, both on /orders-admin), and
// calling supabase.channel() twice with the same topic returns the same
// channel object — adding a second .on() to one already past .subscribe()
// throws ("cannot add postgres_changes callbacks... after subscribe()") and,
// uncaught, blanks the whole page.
let seq = 0;
export function subscribeOrders(callback) {
  const channel = supabase
    .channel(`orders-changes-${Date.now()}-${seq++}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
      if (payload.eventType === 'INSERT') callback({ type: 'create', data: payload.new });
      else if (payload.eventType === 'UPDATE') callback({ type: 'update', data: payload.new });
      else if (payload.eventType === 'DELETE') callback({ type: 'delete', id: payload.old?.id });
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
