-- ===== ENUMS =====
CREATE TYPE public.app_role AS ENUM ('super_admin','branch_admin','teacher','student','parent');
CREATE TYPE public.leave_type AS ENUM ('sick','casual','emergency','half_day');
CREATE TYPE public.leave_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.attendance_status AS ENUM ('present','absent','late','half_day','leave');
CREATE TYPE public.lecture_status AS ENUM ('scheduled','rescheduled','cancelled','completed');

-- ===== HELPER: updated_at =====
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ===== PROFILES =====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT,
  whatsapp_number TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== USER ROLES =====
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  branch_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, branch_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ===== ROLE CHECK FUNCTIONS (security definer, avoid RLS recursion) =====
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin','branch_admin'))
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin','branch_admin','teacher'))
$$;

-- ===== BOOTSTRAP: first user becomes super admin; ensures profile exists =====
CREATE OR REPLACE FUNCTION public.ensure_profile(_full_name TEXT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _email TEXT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT email INTO _email FROM auth.users WHERE id = _uid;
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (_uid, COALESCE(_full_name, split_part(COALESCE(_email,''),'@',1)), COALESCE(_email,''))
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email,
    full_name = CASE WHEN public.profiles.full_name = '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END;
  -- First-ever user becomes Super Admin (serialized with advisory lock)
  PERFORM pg_advisory_xact_lock(714214);
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'super_admin')
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.ensure_profile(TEXT) TO authenticated;

-- ===== GUARD: cannot delete/demote the last super admin =====
CREATE OR REPLACE FUNCTION public.protect_last_super_admin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'DELETE' AND OLD.role = 'super_admin') OR (TG_OP = 'UPDATE' AND OLD.role = 'super_admin' AND NEW.role <> 'super_admin') THEN
    IF (SELECT COUNT(*) FROM public.user_roles WHERE role = 'super_admin') <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last Super Admin';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_last_super_admin BEFORE UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.protect_last_super_admin();

-- user_roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Super admins manage roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'super_admin') OR (public.has_role(auth.uid(),'branch_admin') AND role IN ('teacher','student','parent')));
CREATE POLICY "Super admins update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Super admins delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin'));

-- profiles policies
CREATE POLICY "View own profile or staff view all" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- ===== BRANCHES =====
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT,
  city TEXT,
  phone TEXT,
  email TEXT,
  manager_name TEXT,
  working_hours TEXT DEFAULT '8:00 AM - 8:00 PM',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view branches" ON public.branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins insert branches" ON public.branches FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Super admins update branches" ON public.branches FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Super admins delete branches" ON public.branches FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== TEACHERS =====
CREATE TABLE public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  whatsapp_number TEXT,
  photo_url TEXT,
  qualifications TEXT,
  subjects TEXT[] NOT NULL DEFAULT '{}',
  monthly_salary NUMERIC(12,2),
  joining_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teachers TO authenticated;
GRANT ALL ON public.teachers TO service_role;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view teachers" ON public.teachers FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "Admins insert teachers" ON public.teachers FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update teachers" ON public.teachers FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "Admins delete teachers" ON public.teachers FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE TRIGGER update_teachers_updated_at BEFORE UPDATE ON public.teachers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.teacher_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  UNIQUE (teacher_id, branch_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_branches TO authenticated;
GRANT ALL ON public.teacher_branches TO service_role;
ALTER TABLE public.teacher_branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view teacher branches" ON public.teacher_branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage teacher branches" ON public.teacher_branches FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ===== BATCHES =====
CREATE TABLE public.batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT,
  classroom TEXT,
  start_time TIME,
  end_time TIME,
  capacity INTEGER DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batches TO authenticated;
GRANT ALL ON public.batches TO service_role;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view batches" ON public.batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage batches" ON public.batches FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON public.batches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== STUDENTS =====
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  guardian_name TEXT,
  guardian_phone TEXT,
  guardian_whatsapp TEXT,
  address TEXT,
  admission_date DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff or self view students" ON public.students FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "Admins manage students" ON public.students FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.student_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  from_branch_id UUID,
  to_branch_id UUID,
  reason TEXT,
  transferred_by UUID,
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.student_transfers TO authenticated;
GRANT ALL ON public.student_transfers TO service_role;
ALTER TABLE public.student_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view transfers" ON public.student_transfers FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admins insert transfers" ON public.student_transfers FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

-- ===== LECTURES =====
CREATE TABLE public.lectures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  classroom TEXT,
  lecture_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  topic TEXT,
  status public.lecture_status NOT NULL DEFAULT 'scheduled',
  acknowledged_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lectures TO authenticated;
GRANT ALL ON public.lectures TO service_role;
ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view lectures" ON public.lectures FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage lectures" ON public.lectures FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Teachers update own lectures" ON public.lectures FOR UPDATE TO authenticated USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));
CREATE TRIGGER update_lectures_updated_at BEFORE UPDATE ON public.lectures FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_lectures_date ON public.lectures (lecture_date);
CREATE INDEX idx_lectures_teacher ON public.lectures (teacher_id, lecture_date);

-- ===== LEAVE REQUESTS =====
CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  leave_type public.leave_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  attachment_url TEXT,
  status public.leave_status NOT NULL DEFAULT 'pending',
  remarks TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own or admin view leaves" ON public.leave_requests FOR SELECT TO authenticated USING (public.is_admin(auth.uid()) OR teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));
CREATE POLICY "Teachers create own leaves" ON public.leave_requests FOR INSERT TO authenticated WITH CHECK (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));
CREATE POLICY "Admins review leaves" ON public.leave_requests FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- ===== ATTENDANCE =====
CREATE TABLE public.teacher_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status public.attendance_status NOT NULL,
  marked_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, attendance_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_attendance TO authenticated;
GRANT ALL ON public.teacher_attendance TO service_role;
ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own or admin view teacher attendance" ON public.teacher_attendance FOR SELECT TO authenticated USING (public.is_admin(auth.uid()) OR teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));
CREATE POLICY "Admins manage teacher attendance" ON public.teacher_attendance FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.student_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  attendance_date DATE NOT NULL,
  status public.attendance_status NOT NULL,
  marked_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, attendance_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_attendance TO authenticated;
GRANT ALL ON public.student_attendance TO service_role;
ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View student attendance" ON public.student_attendance FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));
CREATE POLICY "Staff manage student attendance" ON public.student_attendance FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ===== ANNOUNCEMENTS =====
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  audience TEXT NOT NULL DEFAULT 'all',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view announcements" ON public.announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins create announcements" ON public.announcements FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete announcements" ON public.announcements FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- ===== NOTIFICATIONS =====
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT NOT NULL DEFAULT 'general',
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Staff send notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "Update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX idx_notifications_user ON public.notifications (user_id, created_at DESC);
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ===== AUDIT LOGS =====
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Authenticated write audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());