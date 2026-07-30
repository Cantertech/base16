-- Change default value of auto_renew to false
ALTER TABLE public.school_subscriptions ALTER COLUMN auto_renew SET DEFAULT false;

-- Create update policy on school_subscriptions
DROP POLICY IF EXISTS "Users can update their school subscriptions" ON public.school_subscriptions;

CREATE POLICY "Users can update their school subscriptions" ON public.school_subscriptions
FOR UPDATE USING (
  school_id IN (
    SELECT school_id FROM public.profiles WHERE id = auth.uid()
  )
) WITH CHECK (
  school_id IN (
    SELECT school_id FROM public.profiles WHERE id = auth.uid()
  )
);
