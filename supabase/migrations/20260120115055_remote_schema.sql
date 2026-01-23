alter table "public"."employees" drop constraint "employees_position_fk";

alter table "public"."vehicles" drop constraint "vehicles_customer_id_fkey";

alter table "public"."employees" alter column "access_level" set default 'staff'::public.access_level_enum;

alter table "public"."employees" alter column "access_level" set data type public.access_level_enum using "access_level"::text::public.access_level_enum;

alter table "public"."positions" add column "access_level" public.access_level_enum not null default 'staff'::public.access_level_enum;

alter table "public"."positions" add column "base_salary" numeric(10,2);

alter table "public"."positions" add column "department" text not null default 'General'::text;

alter table "public"."employees" add constraint "employees_position_fk" FOREIGN KEY (position_id) REFERENCES public.positions(id) ON DELETE SET NULL not valid;

alter table "public"."employees" validate constraint "employees_position_fk";

alter table "public"."vehicles" add constraint "vehicles_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES public.customers(id) not valid;

alter table "public"."vehicles" validate constraint "vehicles_customer_id_fkey";


