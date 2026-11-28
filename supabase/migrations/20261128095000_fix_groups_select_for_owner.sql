-- Allow owners to SELECT a group immediately after INSERT (before membership exists).
DROP POLICY IF EXISTS groups_select ON public.groups;
CREATE POLICY groups_select ON public.groups
  FOR SELECT
  USING (is_group_member(id) OR owner_id = auth.uid() OR is_admin());
