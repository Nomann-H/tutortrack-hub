# TutorTrack — Multi-Branch Tuition Management ERP

A full ERP like this is built in phases. This plan delivers a solid, working core first, then layers on the advanced modules. Everything runs on Lovable Cloud (database, auth, storage, server logic) with a responsive web app that works great on mobile browsers.

## Platform notes (important)

- **Web app instead of Next.js/Flutter**: Lovable builds on TanStack Start (React) — same capabilities as Next.js. It will be fully responsive so teachers/students/parents can use it on phones. Native Flutter apps and Firebase push notifications aren't supported here; instead you get an **in-app notification center** (real-time) and **WhatsApp pre-filled message links** as the notification channels. WhatsApp Business API can be wired in later with your API credentials.
- **AI features** (chatbot, insights, timetable suggestions) use Lovable AI — no external API keys needed.
- Online fee payments (Stripe), Zoom/Calendar integrations, QR/face attendance, and white-label SaaS are later phases.

## Phase 1 — Foundation (this build)

**Auth & Roles**

- Email/password + Google sign-in, password reset
- First signup automatically becomes Super Admin; all later signups default to no role until assigned
- Roles: Super Admin, Branch Admin, Teacher, Student, Parent (secure roles table, server-verified)
- Protection: only Super Admins can promote others; last Super Admin cannot be removed

**Super Admin portal**

- Institute-wide dashboard (branches, students, teachers, attendance stats with charts)
- Branch management (create/edit/deactivate, code, address, contact, working hours)
- User & role management (assign Branch Admins, promote/demote)
- Announcements broadcast

**Branch Admin portal**

- Branch dashboard
- Teacher management (profile, photo, qualifications, subjects, salary info, multi-branch assignment)
- Student management (profile, guardian details, documents, batch assignment, transfer with history)
- Batch management (subjects, teachers, students, timings, capacity, classroom)

**Timetable & Lectures**

- Weekly timetable builder with conflict detection (teacher/classroom/batch)
- Assign/edit/reschedule/cancel lectures
- Calendar views (day/week/month)
- Teacher gets in-app notification + WhatsApp link on assignment/changes

**Teacher portal**

- My schedule, acknowledge daily schedule
- Mark student attendance (present/absent/late) per batch
- Apply for leave (sick/casual/emergency/half-day, with attachment)
- Update syllabus progress

**Student & Parent portals**

- View timetable, attendance %, announcements, notifications
- Parent sees linked child's data

**Core infrastructure**

- Notification center (in-app, real-time)
- Leave approval workflow with notifications
- Branch data isolation via row-level security
- Audit log of key actions

## Phase 2 — Academics

- Syllabus module (subjects → units → chapters → topics, progress %, delay tracking)
- Sunday tests (marks entry, auto rank/percentage/average, performance graphs)
- Homework (create, due dates, file uploads, student submissions)
- Notes library (files + links, organized by subject/chapter/batch, batch-scoped access)

## Phase 3 — Finance & Reports

- Fee management (structures, collection, receipts, outstanding dues, reminders)
- Salary management (monthly salary, bonuses, deductions, slips, history)
- Report center with PDF/Excel/CSV export
- Branch comparison analytics

## Phase 4 — Advanced

- AI chatbot, AI timetable suggestions, AI performance insights
- Scheduled 8 PM next-day schedule digests
- WhatsApp Business API integration (your credentials)
- Online payments (Stripe), QR attendance, calendar/Zoom integrations
- Multi-institute / white-label SaaS

## Technical details

- Backend: Lovable Cloud (PostgreSQL + Auth + Storage + server functions), RLS on every table scoped by branch and role
- Roles in a separate `user_roles` table with a security-definer check function (prevents privilege escalation)
- First-user-becomes-Super-Admin via a database trigger on signup
- Charts: Recharts; drag-and-drop timetable grid with server-side conflict checks
- Design: clean, professional education-ERP look with sidebar navigation, fully responsive in dark green and cream colour combo 

Approve the plan and I'll build Phase 1.