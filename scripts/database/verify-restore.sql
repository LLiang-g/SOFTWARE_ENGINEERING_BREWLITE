-- Read counts and validate catalogue state in the RESTORED database only.
BEGIN;
CREATE FUNCTION pg_temp.restore_inventory() RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r record; n bigint; rows jsonb := '[]'::jsonb;
BEGIN
  FOR r IN
    SELECT schemaname, tablename FROM pg_tables
    WHERE schemaname NOT IN ('pg_catalog','information_schema')
      AND schemaname NOT LIKE 'pg_toast%'
    ORDER BY schemaname, tablename
  LOOP
    EXECUTE format('SELECT count(*) FROM %I.%I',r.schemaname,r.tablename) INTO n;
    rows := rows || jsonb_build_array(jsonb_build_object('table',r.schemaname||'.'||r.tablename,'rows',n));
  END LOOP;
  RETURN jsonb_build_object('database',current_database(),'tables',rows,
    'unvalidatedConstraints',(SELECT count(*) FROM pg_constraint c JOIN pg_namespace ns ON ns.oid=c.connamespace
      WHERE ns.nspname NOT IN ('pg_catalog','information_schema') AND NOT c.convalidated));
END $$;
SELECT pg_temp.restore_inventory();
ROLLBACK;
