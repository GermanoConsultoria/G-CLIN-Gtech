
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS wants_to_anticipate boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS category text;

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own categories"
ON public.categories
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_appointments_user_scheduled
  ON public.appointments(user_id, scheduled_at);
