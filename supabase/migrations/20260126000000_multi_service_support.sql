-- Migration: 20260126000000_multi_service_support.sql
-- Description: Add support for multiple services per work order, with granular tasks and employee assignments

-- 1. Table: work_order_services
-- Tracks individual service sections within a main work order (e.g., "Mechanical", "Electrical")
create table if not exists public.work_order_services (
    id uuid not null default gen_random_uuid(),
    work_order_id uuid not null references public.work_orders(id) on delete cascade,
    service_type text not null,
    display_order integer default 0,
    estimated_duration interval,
    estimated_cost numeric(10,2) default 0,
    actual_cost numeric(10,2) default 0,
    status text not null default 'Pending',
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    
    constraint work_order_services_pkey primary key (id),
    constraint work_order_services_status_check check (status in ('Pending', 'In Progress', 'Completed', 'Cancelled'))
);

-- Trigger for updated_at
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger update_work_order_services_updated_at
    before update on public.work_order_services
    for each row execute function public.update_updated_at_column();

-- RLS
alter table public.work_order_services enable row level security;
create policy "Staff+ can read work_order_services" on public.work_order_services for select using (auth.uid() in (select user_id from user_roles where role in ('admin', 'staff')));
create policy "Staff+ can insert work_order_services" on public.work_order_services for insert with check (auth.uid() in (select user_id from user_roles where role in ('admin', 'staff')));
create policy "Staff+ can update work_order_services" on public.work_order_services for update using (auth.uid() in (select user_id from user_roles where role in ('admin', 'staff')));
create policy "Admins can delete work_order_services" on public.work_order_services for delete using (auth.uid() in (select user_id from user_roles where role = 'admin'));


-- 2. Table: work_order_service_tasks
-- Tracks specific line items/tasks within a service (e.g., "Replace Oil Filter" under "Mechanical")
create table if not exists public.work_order_service_tasks (
    id uuid not null default gen_random_uuid(),
    service_id uuid not null references public.work_order_services(id) on delete cascade,
    task_name text not null,
    task_description text,
    is_predefined boolean default false,
    predefined_task_id text, -- ID from config if applicable
    estimated_effort numeric(10,2),
    effort_unit text default 'hours', -- 'hours', 'minutes', 'units'
    status text not null default 'Pending',
    priority text default 'Medium',
    sequence_order integer default 0,
    notes text,
    completed_at timestamptz,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),

    constraint work_order_service_tasks_pkey primary key (id),
    constraint work_order_service_tasks_status_check check (status in ('Pending', 'In Progress', 'Completed', 'Cancelled', 'Skipped'))
);

-- Trigger for updated_at
create trigger update_work_order_service_tasks_updated_at
    before update on public.work_order_service_tasks
    for each row execute function public.update_updated_at_column();

-- RLS
alter table public.work_order_service_tasks enable row level security;
create policy "Staff+ can read service_tasks" on public.work_order_service_tasks for select using (auth.uid() in (select user_id from user_roles where role in ('admin', 'staff')));
create policy "Staff+ can insert service_tasks" on public.work_order_service_tasks for insert with check (auth.uid() in (select user_id from user_roles where role in ('admin', 'staff')));
create policy "Staff+ can update service_tasks" on public.work_order_service_tasks for update using (auth.uid() in (select user_id from user_roles where role in ('admin', 'staff')));
create policy "Admins can delete service_tasks" on public.work_order_service_tasks for delete using (auth.uid() in (select user_id from user_roles where role = 'admin'));


-- 3. Table: work_order_service_employees
-- Link table for assigning employees to specific service sections
create table if not exists public.work_order_service_employees (
    id uuid not null default gen_random_uuid(),
    service_id uuid not null references public.work_order_services(id) on delete cascade,
    employee_id uuid not null references public.employees(id) on delete cascade,
    role text, -- e.g. "Lead", "Assistant"
    status text default 'Assigned',
    assigned_at timestamptz default now(),
    accepted_at timestamptz,
    completed_at timestamptz,
    notes text,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),

    constraint work_order_service_employees_pkey primary key (id)
);

-- Trigger for updated_at
create trigger update_work_order_service_employees_updated_at
    before update on public.work_order_service_employees
    for each row execute function public.update_updated_at_column();

-- RLS
alter table public.work_order_service_employees enable row level security;
create policy "Staff+ can read service_employees" on public.work_order_service_employees for select using (auth.uid() in (select user_id from user_roles where role in ('admin', 'staff')));
create policy "Staff+ can manage service_employees" on public.work_order_service_employees for all using (auth.uid() in (select user_id from user_roles where role in ('admin', 'staff')));


-- 4. Table: work_order_service_notes
-- Specific notes for a service section
create table if not exists public.work_order_service_notes (
    id uuid not null default gen_random_uuid(),
    service_id uuid not null references public.work_order_services(id) on delete cascade,
    note_type text, -- 'General', 'Issue', 'Resolution'
    note_content text not null,
    is_internal boolean default false,
    created_by uuid references auth.users(id),
    created_at timestamptz default now(),
    updated_at timestamptz default now(),

    constraint work_order_service_notes_pkey primary key (id)
);

-- Trigger for updated_at
create trigger update_work_order_service_notes_updated_at
    before update on public.work_order_service_notes
    for each row execute function public.update_updated_at_column();

-- RLS
alter table public.work_order_service_notes enable row level security;
create policy "Staff+ can read service_notes" on public.work_order_service_notes for select using (auth.uid() in (select user_id from user_roles where role in ('admin', 'staff')));
create policy "Staff+ can insert service_notes" on public.work_order_service_notes for insert with check (auth.uid() in (select user_id from user_roles where role in ('admin', 'staff')));
create policy "Staff+ can update service_notes" on public.work_order_service_notes for update using (auth.uid() in (select user_id from user_roles where role in ('admin', 'staff')));

-- 5. Table: custom_work_items
-- Saved custom tasks for reuse
create table if not exists public.custom_work_items (
    id uuid not null default gen_random_uuid(),
    service_type text not null,
    task_name text not null,
    task_description text,
    estimated_effort numeric(10,2),
    effort_unit text default 'hours',
    is_active boolean default true,
    usage_count integer default 0,
    created_by uuid references auth.users(id),
    created_at timestamptz default now(),
    updated_at timestamptz default now(),

    constraint custom_work_items_pkey primary key (id)
);

-- Trigger for updated_at
create trigger update_custom_work_items_updated_at
    before update on public.custom_work_items
    for each row execute function public.update_updated_at_column();

-- RLS
alter table public.custom_work_items enable row level security;
create policy "Staff+ can read custom_work_items" on public.custom_work_items for select using (auth.uid() in (select user_id from user_roles where role in ('admin', 'staff')));
create policy "Staff+ can manage custom_work_items" on public.custom_work_items for all using (auth.uid() in (select user_id from user_roles where role in ('admin', 'staff')));
