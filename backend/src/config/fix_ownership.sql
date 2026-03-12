-- Transfer ownership of all functions to zenwair_user
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT p.oid::regprocedure AS funcname
             FROM pg_proc p
             JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public'
    LOOP
        EXECUTE 'ALTER FUNCTION ' || r.funcname || ' OWNER TO zenwair_user';
    END LOOP;
END
$$;

-- Transfer ownership of all tables
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' OWNER TO zenwair_user';
    END LOOP;
END
$$;

-- Transfer ownership of all sequences
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public'
    LOOP
        EXECUTE 'ALTER SEQUENCE public.' || quote_ident(r.sequencename) || ' OWNER TO zenwair_user';
    END LOOP;
END
$$;

GRANT ALL ON SCHEMA public TO zenwair_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO zenwair_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO zenwair_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO zenwair_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO zenwair_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO zenwair_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO zenwair_user;
