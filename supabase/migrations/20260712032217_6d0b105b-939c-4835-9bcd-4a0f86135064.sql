
-- ============ PARENT LINKS ============
CREATE TABLE public.student_parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_parents TO authenticated;
GRANT ALL ON public.student_parents TO service_role;
ALTER TABLE public.student_parents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage parent links" ON public.student_parents FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Parents view own links" ON public.student_parents FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Students view own parent links" ON public.student_parents FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid()));

-- Helper: is _user a linked parent of _student
CREATE OR REPLACE FUNCTION public.is_parent_of(_user_id UUID, _student_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.student_parents WHERE user_id = _user_id AND student_id = _student_id)
$$;

-- Helper: does _user teach _batch (via lectures)
CREATE OR REPLACE FUNCTION public.teaches_batch(_user_id UUID, _batch_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lectures l
    JOIN public.teachers t ON t.id = l.teacher_id
    WHERE l.batch_id = _batch_id AND t.user_id = _user_id
  )
$$;

-- ============ SYLLABUS ============
CREATE TABLE public.syllabus_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  subject TEXT,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.syllabus_topics TO authenticated;
GRANT ALL ON public.syllabus_topics TO service_role;
ALTER TABLE public.syllabus_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage syllabus" ON public.syllabus_topics FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Teachers manage own batch syllabus" ON public.syllabus_topics FOR ALL
  USING (public.teaches_batch(auth.uid(), batch_id)) WITH CHECK (public.teaches_batch(auth.uid(), batch_id));
CREATE POLICY "Students view own batch syllabus" ON public.syllabus_topics FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.batch_id = syllabus_topics.batch_id AND s.user_id = auth.uid()));
CREATE POLICY "Parents view child batch syllabus" ON public.syllabus_topics FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.students s JOIN public.student_parents sp ON sp.student_id = s.id
    WHERE s.batch_id = syllabus_topics.batch_id AND sp.user_id = auth.uid()));
CREATE TRIGGER trg_syllabus_updated BEFORE UPDATE ON public.syllabus_topics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ TESTS ============
CREATE TABLE public.tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT,
  test_date DATE NOT NULL,
  max_marks NUMERIC NOT NULL DEFAULT 100,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tests TO authenticated;
GRANT ALL ON public.tests TO service_role;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage tests" ON public.tests FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Teachers manage own batch tests" ON public.tests FOR ALL
  USING (public.teaches_batch(auth.uid(), batch_id)) WITH CHECK (public.teaches_batch(auth.uid(), batch_id));
CREATE POLICY "Students view own batch tests" ON public.tests FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.batch_id = tests.batch_id AND s.user_id = auth.uid()));
CREATE POLICY "Parents view child batch tests" ON public.tests FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.students s JOIN public.student_parents sp ON sp.student_id = s.id
    WHERE s.batch_id = tests.batch_id AND sp.user_id = auth.uid()));
CREATE TRIGGER trg_tests_updated BEFORE UPDATE ON public.tests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ TEST MARKS ============
CREATE TABLE public.test_marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  marks_obtained NUMERIC,
  is_absent BOOLEAN NOT NULL DEFAULT false,
  remarks TEXT,
  entered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(test_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_marks TO authenticated;
GRANT ALL ON public.test_marks TO service_role;
ALTER TABLE public.test_marks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage marks" ON public.test_marks FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Teachers manage marks for own batch" ON public.test_marks FOR ALL
  USING (EXISTS (SELECT 1 FROM public.tests t WHERE t.id = test_id AND public.teaches_batch(auth.uid(), t.batch_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tests t WHERE t.id = test_id AND public.teaches_batch(auth.uid(), t.batch_id)));
CREATE POLICY "Students view own marks" ON public.test_marks FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid()));
CREATE POLICY "Parents view child marks" ON public.test_marks FOR SELECT
  USING (public.is_parent_of(auth.uid(), student_id));
CREATE TRIGGER trg_test_marks_updated BEFORE UPDATE ON public.test_marks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ HOMEWORK ============
CREATE TABLE public.homework (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  due_date DATE,
  attachment_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homework TO authenticated;
GRANT ALL ON public.homework TO service_role;
ALTER TABLE public.homework ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage homework" ON public.homework FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Teachers manage own batch homework" ON public.homework FOR ALL
  USING (public.teaches_batch(auth.uid(), batch_id)) WITH CHECK (public.teaches_batch(auth.uid(), batch_id));
CREATE POLICY "Students view own batch homework" ON public.homework FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.batch_id = homework.batch_id AND s.user_id = auth.uid()));
CREATE POLICY "Parents view child batch homework" ON public.homework FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.students s JOIN public.student_parents sp ON sp.student_id = s.id
    WHERE s.batch_id = homework.batch_id AND sp.user_id = auth.uid()));
CREATE TRIGGER trg_homework_updated BEFORE UPDATE ON public.homework
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ NOTES LIBRARY ============
CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  file_url TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage notes" ON public.notes FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Teachers manage own batch notes" ON public.notes FOR ALL
  USING (public.teaches_batch(auth.uid(), batch_id)) WITH CHECK (public.teaches_batch(auth.uid(), batch_id));
CREATE POLICY "Students view own batch notes" ON public.notes FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.batch_id = notes.batch_id AND s.user_id = auth.uid()));
CREATE POLICY "Parents view child batch notes" ON public.notes FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.students s JOIN public.student_parents sp ON sp.student_id = s.id
    WHERE s.batch_id = notes.batch_id AND sp.user_id = auth.uid()));
CREATE TRIGGER trg_notes_updated BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SALARY PAYMENTS ============
CREATE TABLE public.salary_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INT NOT NULL,
  base_salary NUMERIC NOT NULL DEFAULT 0,
  bonus NUMERIC NOT NULL DEFAULT 0,
  deductions NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL DEFAULT 0,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(teacher_id, month, year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_payments TO authenticated;
GRANT ALL ON public.salary_payments TO service_role;
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage salary" ON public.salary_payments FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Teachers view own salary" ON public.salary_payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_id AND t.user_id = auth.uid()));
CREATE TRIGGER trg_salary_updated BEFORE UPDATE ON public.salary_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ABSENCE NOTIFICATION TRIGGER ============
CREATE OR REPLACE FUNCTION public.notify_parents_on_absence()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _student_name TEXT;
  _parent RECORD;
BEGIN
  IF NEW.status <> 'absent' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'absent' THEN RETURN NEW; END IF;
  SELECT full_name INTO _student_name FROM public.students WHERE id = NEW.student_id;
  FOR _parent IN SELECT user_id FROM public.student_parents WHERE student_id = NEW.student_id LOOP
    INSERT INTO public.notifications (user_id, title, body, type, link)
    VALUES (_parent.user_id, 'Absence Alert',
      COALESCE(_student_name, 'Your child') || ' was marked absent on ' || to_char(NEW.attendance_date, 'DD Mon YYYY'),
      'absence', '/dashboard');
  END LOOP;
  -- Also notify the student if they have an account
  INSERT INTO public.notifications (user_id, title, body, type, link)
  SELECT s.user_id, 'Marked Absent',
    'You were marked absent on ' || to_char(NEW.attendance_date, 'DD Mon YYYY'), 'absence', '/dashboard'
  FROM public.students s WHERE s.id = NEW.student_id AND s.user_id IS NOT NULL;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_absence
  AFTER INSERT OR UPDATE ON public.student_attendance
  FOR EACH ROW EXECUTE FUNCTION public.notify_parents_on_absence();
