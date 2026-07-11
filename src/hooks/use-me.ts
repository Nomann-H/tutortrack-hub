import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type AppRole = "super_admin" | "branch_admin" | "teacher" | "student" | "parent";

export interface Me {
  userId: string;
  email: string;
  profile: Tables<"profiles"> | null;
  roles: Tables<"user_roles">[];
  roleList: AppRole[];
  isSuperAdmin: boolean;
  isBranchAdmin: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
  isStudent: boolean;
  isParent: boolean;
  primaryRole: AppRole | null;
  teacherId: string | null;
  studentId: string | null;
  branchIds: string[];
}

const ROLE_ORDER: AppRole[] = ["super_admin", "branch_admin", "teacher", "student", "parent"];

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<Me | null> => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;

      const [profileRes, rolesRes, teacherRes, studentRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("*").eq("user_id", user.id),
        supabase.from("teachers").select("id").eq("user_id", user.id).maybeSingle(),
        supabase.from("students").select("id").eq("user_id", user.id).maybeSingle(),
      ]);

      const roles = rolesRes.data ?? [];
      const roleList = roles.map((r) => r.role as AppRole);
      const primaryRole = ROLE_ORDER.find((r) => roleList.includes(r)) ?? null;

      return {
        userId: user.id,
        email: user.email ?? "",
        profile: profileRes.data ?? null,
        roles,
        roleList,
        isSuperAdmin: roleList.includes("super_admin"),
        isBranchAdmin: roleList.includes("branch_admin"),
        isAdmin: roleList.includes("super_admin") || roleList.includes("branch_admin"),
        isTeacher: roleList.includes("teacher"),
        isStudent: roleList.includes("student"),
        isParent: roleList.includes("parent"),
        primaryRole,
        teacherId: teacherRes.data?.id ?? null,
        studentId: studentRes.data?.id ?? null,
        branchIds: roles.map((r) => r.branch_id).filter((b): b is string => !!b),
      };
    },
    staleTime: 60_000,
  });
}

export const roleLabel: Record<AppRole, string> = {
  super_admin: "Super Admin",
  branch_admin: "Branch Admin",
  teacher: "Teacher",
  student: "Student",
  parent: "Parent",
};
