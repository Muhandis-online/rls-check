-- Muhandis RLS check: reads table descriptions only, never a row.
select json_build_object(
  'tool', 'muhandis-rls-check',
  'v', 1,
  'tables', coalesce((
    select json_agg(t order by t.name)
    from (
      select
        c.relname as name,
        case c.relkind when 'v' then 'view' when 'm' then 'view' else 'table' end as kind,
        c.relrowsecurity as rls,
        coalesce((
          select json_agg(a.attname order by a.attnum)
          from pg_attribute a
          where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
        ), '[]'::json) as columns,
        coalesce(c.reloptions::text like '%security_invoker=true%' or c.reloptions::text like '%security_invoker=on%', false) as invoker,
        coalesce((
          select json_agg(distinct g.grantee || ':' || g.privilege_type)
          from information_schema.role_table_grants g
          where g.table_schema = 'public' and g.table_name = c.relname and g.grantee in ('anon', 'authenticated', 'PUBLIC')
        ), '[]'::json) as grants,
        coalesce((
          select json_agg(json_build_object('cmd', p.cmd, 'roles', p.roles, 'using', p.qual, 'check', p.with_check, 'permissive', p.permissive))
          from pg_policies p
          where p.schemaname = 'public' and p.tablename = c.relname
        ), '[]'::json) as policies
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
    ) t
  ), '[]'::json)
) as result;
