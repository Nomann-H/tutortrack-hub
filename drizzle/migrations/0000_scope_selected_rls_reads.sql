CREATE OR REPLACE FUNCTION public.current_user_is_parent_of_branch(_branch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.student_parents sp
    JOIN public.students s ON s.id = sp.student_id
    WHERE sp.user_id = auth.uid()
      AND s.branch_id = _branch_id
  )
$function$;

CREATE OR REPLACE FUNCTION public.current_user_is_parent_of_batch(_batch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.student_parents sp
    JOIN public.students s ON s.id = sp.student_id
    WHERE sp.user_id = auth.uid()
      AND s.batch_id = _batch_id
  )
$function$;

DROP POLICY IF EXISTS "Staff view teacher branches" ON public.teacher_branches;
CREATE POLICY "Staff view teacher branches" ON public.teacher_branches
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.teachers t
    WHERE t.id = teacher_branches.teacher_id
      AND t.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated view batches" ON public.batches;
CREATE POLICY "Authenticated view batches" ON public.batches
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.teaches_batch(auth.uid(), batches.id)
  OR EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.batch_id = batches.id
      AND s.user_id = auth.uid()
  )
  OR public.current_user_is_parent_of_batch(batches.id)
);

DROP POLICY IF EXISTS "Authenticated view branches" ON public.branches;
CREATE POLICY "Authenticated view branches" ON public.branches
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.branch_id = branches.id
  )
  OR EXISTS (
    SELECT 1 FROM public.teacher_branches tb
    JOIN public.teachers t ON t.id = tb.teacher_id
    WHERE tb.branch_id = branches.id
      AND t.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.branch_id = branches.id
      AND s.user_id = auth.uid()
  )
  OR public.current_user_is_parent_of_branch(branches.id)
);

DROP POLICY IF EXISTS "Authenticated view lectures" ON public.lectures;
CREATE POLICY "Authenticated view lectures" ON public.lectures
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.teachers t
    WHERE t.id = lectures.teacher_id
      AND t.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.batch_id = lectures.batch_id
      AND s.user_id = auth.uid()
  )
  OR public.current_user_is_parent_of_batch(lectures.batch_id)
);

DROP POLICY IF EXISTS "Authenticated view announcements" ON public.announcements;
CREATE POLICY "Authenticated view announcements" ON public.announcements
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR (
    (announcements.audience = 'all'
      OR (announcements.audience = 'teachers' AND public.has_role(auth.uid(), 'teacher'::public.app_role))
      OR (announcements.audience = 'students' AND public.has_role(auth.uid(), 'student'::public.app_role))
      OR (announcements.audience = 'parents' AND public.has_role(auth.uid(), 'parent'::public.app_role)))
    AND (
      announcements.branch_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.branch_id = announcements.branch_id
      )
      OR EXISTS (
        SELECT 1 FROM public.teacher_branches tb
        JOIN public.teachers t ON t.id = tb.teacher_id
        WHERE tb.branch_id = announcements.branch_id
          AND t.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.branch_id = announcements.branch_id
          AND s.user_id = auth.uid()
      )
      OR public.current_user_is_parent_of_branch(announcements.branch_id)
    )
  )
);
