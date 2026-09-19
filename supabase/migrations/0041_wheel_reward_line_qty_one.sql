-- A free Mystery Wheel product reward line is always exactly 1 unit: secure_order
-- previously priced the line at 0 but kept whatever quantity the client sent.
do $$
declare def text;
begin
  def := pg_get_functiondef('public._secure_order_base(uuid)'::regprocedure);
  if position('v_unit := 0;' || E'\n' || '    elsif' in def) = 0 then raise exception 'pattern not found'; end if;
  def := replace(def, 'v_unit := 0;' || E'\n' || '    elsif', 'v_unit := 0;' || E'\n' || '      v_qty := 1; -- a free wheel reward line is always exactly 1' || E'\n' || '    elsif');
  execute def;
end $$;
