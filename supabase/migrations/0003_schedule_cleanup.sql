-- Run the usage counter cleanup every night inside the database, so it works the same on Vercel and Docker.
-- pg_cron is a Postgres extension that Supabase provides. Scheduling a job with the same name again replaces it.

create extension if not exists pg_cron;

select cron.schedule('cleanup-usage-counters', '17 3 * * *', 'select public.cleanup_free_usage()');
