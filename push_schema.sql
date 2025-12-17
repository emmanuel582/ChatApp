
-- 1. Create table if not exists
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    subscription JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, subscription)
);

-- 2. DISABLE RLS temporarily to debug
ALTER TABLE public.push_subscriptions DISABLE ROW LEVEL SECURITY;

-- (Optional) If you want RLS enabled, ensure you have this:
-- ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "Public select" ON public.push_subscriptions;
-- CREATE POLICY "Public select" ON public.push_subscriptions FOR SELECT USING (true);
-- DROP POLICY IF EXISTS "Public insert" ON public.push_subscriptions;
-- CREATE POLICY "Public insert" ON public.push_subscriptions FOR INSERT WITH CHECK (true);
-- DROP POLICY IF EXISTS "Public delete" ON public.push_subscriptions;
-- CREATE POLICY "Public delete" ON public.push_subscriptions FOR DELETE USING (true);

-- 3. Grant permissions specifically to authenticated users
GRANT ALL ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
