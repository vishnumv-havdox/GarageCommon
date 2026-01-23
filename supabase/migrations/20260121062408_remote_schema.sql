drop view if exists "public"."employee_details";

alter table "public"."profiles" alter column "full_name" drop not null;

alter table "public"."profiles" alter column "id" drop default;

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    )
  );
  RETURN NEW;
END;
$function$
;

create or replace view "public"."employee_details" as  SELECT e.id,
    e.name,
    e.email,
    e.phone,
    e.salary,
    e.status,
    e.hire_date,
    p.name AS position_name,
    p.department,
    p.access_level AS position_access_level,
    e.created_at
   FROM (public.employees e
     LEFT JOIN public.positions p ON ((e.position_id = p.id)));



  create policy "read own customer record"
  on "public"."customers"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "admin access"
  on "public"."employees"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::text)))));



  create policy "admin full access employees"
  on "public"."employees"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::text)))));



  create policy "read own profile"
  on "public"."profiles"
  as permissive
  for select
  to public
using ((auth.uid() = id));



  create policy "read own role"
  on "public"."user_roles"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));


CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


