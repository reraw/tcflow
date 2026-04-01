-- TCFlow Database Migration
-- Run this in the Supabase SQL Editor

-- ============================================================
-- DEALS
-- ============================================================
create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  address text not null,
  city text,
  type text check (type in ('buyer', 'seller')) not null default 'buyer',
  status text check (status in ('active', 'listing', 'closed', 'cancelled')) not null default 'active',
  price numeric(12,2),
  acceptance_date date,
  close_date date,
  possession_date date,
  inspection_date date,
  disclosures_sent date,
  other_tc text,
  commission_buyer numeric(5,3),
  commission_seller numeric(5,3),
  concessions numeric(12,2),
  tc_fee numeric(10,2),
  tc_paid boolean default false,
  tc_paid_by text,
  notes text,
  created_at timestamptz default now()
);

-- ============================================================
-- CONTINGENCIES
-- ============================================================
create table if not exists contingencies (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals(id) on delete cascade not null,
  loan date,
  appraisal date,
  inspection date,
  disclosures date,
  hoa date,
  insurability date,
  prelim date
);

-- ============================================================
-- CONTACTS
-- ============================================================
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals(id) on delete cascade not null,
  role text check (role in ('listing_agent', 'buyer_agent', 'lender', 'escrow')) not null,
  name text,
  phone text,
  email text,
  company text,
  officer text
);

-- ============================================================
-- EXTRA CONTACTS
-- ============================================================
create table if not exists extra_contacts (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals(id) on delete cascade not null,
  role_label text,
  name text,
  phone text,
  email text
);

-- ============================================================
-- DEAL HISTORY
-- ============================================================
create table if not exists deal_history (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals(id) on delete cascade not null,
  entry_date date default current_date,
  text text not null,
  created_at timestamptz default now()
);

-- ============================================================
-- AGENTS
-- ============================================================
create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brokerage text,
  phone text,
  email text,
  tc_fee numeric(10,2),
  notes text,
  created_at timestamptz default now()
);

-- ============================================================
-- AGENT VENDORS
-- ============================================================
create table if not exists agent_vendors (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references agents(id) on delete cascade not null,
  vendor_type text,
  name text,
  contact text
);

-- ============================================================
-- AGENT LOGINS
-- ============================================================
create table if not exists agent_logins (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references agents(id) on delete cascade not null,
  system_name text,
  username text,
  note text
);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_deals_status on deals(status);
create index if not exists idx_deals_close_date on deals(close_date);
create index if not exists idx_contingencies_deal on contingencies(deal_id);
create index if not exists idx_contacts_deal on contacts(deal_id);
create index if not exists idx_extra_contacts_deal on extra_contacts(deal_id);
create index if not exists idx_deal_history_deal on deal_history(deal_id);
create index if not exists idx_agent_vendors_agent on agent_vendors(agent_id);
create index if not exists idx_agent_logins_agent on agent_logins(agent_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
alter table deals enable row level security;
alter table contingencies enable row level security;
alter table contacts enable row level security;
alter table extra_contacts enable row level security;
alter table deal_history enable row level security;
alter table agents enable row level security;
alter table agent_vendors enable row level security;
alter table agent_logins enable row level security;

-- Policies: authenticated users have full access
-- Deals
create policy "Authenticated users can view deals"
  on deals for select to authenticated using (true);
create policy "Authenticated users can insert deals"
  on deals for insert to authenticated with check (true);
create policy "Authenticated users can update deals"
  on deals for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete deals"
  on deals for delete to authenticated using (true);

-- Contingencies
create policy "Authenticated users can view contingencies"
  on contingencies for select to authenticated using (true);
create policy "Authenticated users can insert contingencies"
  on contingencies for insert to authenticated with check (true);
create policy "Authenticated users can update contingencies"
  on contingencies for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete contingencies"
  on contingencies for delete to authenticated using (true);

-- Contacts
create policy "Authenticated users can view contacts"
  on contacts for select to authenticated using (true);
create policy "Authenticated users can insert contacts"
  on contacts for insert to authenticated with check (true);
create policy "Authenticated users can update contacts"
  on contacts for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete contacts"
  on contacts for delete to authenticated using (true);

-- Extra Contacts
create policy "Authenticated users can view extra_contacts"
  on extra_contacts for select to authenticated using (true);
create policy "Authenticated users can insert extra_contacts"
  on extra_contacts for insert to authenticated with check (true);
create policy "Authenticated users can update extra_contacts"
  on extra_contacts for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete extra_contacts"
  on extra_contacts for delete to authenticated using (true);

-- Deal History
create policy "Authenticated users can view deal_history"
  on deal_history for select to authenticated using (true);
create policy "Authenticated users can insert deal_history"
  on deal_history for insert to authenticated with check (true);
create policy "Authenticated users can update deal_history"
  on deal_history for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete deal_history"
  on deal_history for delete to authenticated using (true);

-- Agents
create policy "Authenticated users can view agents"
  on agents for select to authenticated using (true);
create policy "Authenticated users can insert agents"
  on agents for insert to authenticated with check (true);
create policy "Authenticated users can update agents"
  on agents for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete agents"
  on agents for delete to authenticated using (true);

-- Agent Vendors
create policy "Authenticated users can view agent_vendors"
  on agent_vendors for select to authenticated using (true);
create policy "Authenticated users can insert agent_vendors"
  on agent_vendors for insert to authenticated with check (true);
create policy "Authenticated users can update agent_vendors"
  on agent_vendors for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete agent_vendors"
  on agent_vendors for delete to authenticated using (true);

-- Agent Logins
create policy "Authenticated users can view agent_logins"
  on agent_logins for select to authenticated using (true);
create policy "Authenticated users can insert agent_logins"
  on agent_logins for insert to authenticated with check (true);
create policy "Authenticated users can update agent_logins"
  on agent_logins for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete agent_logins"
  on agent_logins for delete to authenticated using (true);
