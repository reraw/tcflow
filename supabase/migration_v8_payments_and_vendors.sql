-- Migration V8: Partial payment tracking + normalized vendors
-- ================================================================
-- Run in Supabase SQL Editor. Idempotent — safe to re-run.
--
-- Sections:
--   1. deal_payments table + RLS
--   2. vendors table + RLS + updated_at trigger
--   3. agent_preferred_vendors table + RLS
--   4. vendor_id on contacts + agent_vendors
--   5. Backfill: payments from existing tc_paid deals
--   6. Backfill: vendors from agent_vendors + contacts (exact dedup,
--      no fuzzy merging)
--   7. Backfill: agent_preferred_vendors from agent_vendors
--   8. Backfill: link existing contacts.vendor_id + agent_vendors.vendor_id

-- ============================================================
-- 1. deal_payments
-- ============================================================
CREATE TABLE IF NOT EXISTS deal_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  paid_by text NOT NULL,
  paid_by_other text,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_payments_deal_id ON deal_payments(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_payments_payment_date ON deal_payments(payment_date DESC);

ALTER TABLE deal_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon full access deal_payments" ON deal_payments;
DROP POLICY IF EXISTS "auth full access deal_payments" ON deal_payments;
CREATE POLICY "anon full access deal_payments" ON deal_payments FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth full access deal_payments" ON deal_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 2. vendors
-- ============================================================
CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  vendor_type text,
  phone text,
  email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(lower(name));
CREATE INDEX IF NOT EXISTS idx_vendors_type ON vendors(vendor_type);

-- Auto-update updated_at on row modification.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendors_updated_at ON vendors;
CREATE TRIGGER trg_vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon full access vendors" ON vendors;
DROP POLICY IF EXISTS "auth full access vendors" ON vendors;
CREATE POLICY "anon full access vendors" ON vendors FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth full access vendors" ON vendors FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 3. agent_preferred_vendors (join table)
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_preferred_vendors (
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  vendor_type text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (agent_id, vendor_id, vendor_type)
);

CREATE INDEX IF NOT EXISTS idx_apv_agent ON agent_preferred_vendors(agent_id);
CREATE INDEX IF NOT EXISTS idx_apv_vendor ON agent_preferred_vendors(vendor_id);

ALTER TABLE agent_preferred_vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon full access agent_preferred_vendors" ON agent_preferred_vendors;
DROP POLICY IF EXISTS "auth full access agent_preferred_vendors" ON agent_preferred_vendors;
CREATE POLICY "anon full access agent_preferred_vendors" ON agent_preferred_vendors FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth full access agent_preferred_vendors" ON agent_preferred_vendors FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 4. vendor_id FK on contacts + agent_vendors
-- ============================================================
ALTER TABLE contacts       ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL;
ALTER TABLE agent_vendors  ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_vendor      ON contacts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_agent_vendors_vendor ON agent_vendors(vendor_id);

-- ============================================================
-- 5. Payment backfill from existing tc_paid deals
-- ============================================================
-- One payment row per paid deal. Uses close_date if present, otherwise
-- today. paid_by defaults to legacy tc_paid_by, or 'Agent' if unset.
-- Skipped if a payment row already exists for that deal (idempotent).
INSERT INTO deal_payments (deal_id, amount, paid_by, payment_date)
SELECT
  d.id,
  d.tc_fee,
  COALESCE(NULLIF(TRIM(d.tc_paid_by), ''), 'Agent'),
  COALESCE(d.close_date, CURRENT_DATE)
FROM deals d
WHERE d.tc_paid = true
  AND d.tc_fee IS NOT NULL
  AND d.tc_fee > 0
  AND NOT EXISTS (SELECT 1 FROM deal_payments p WHERE p.deal_id = d.id);

-- ============================================================
-- 6. Vendor backfill from agent_vendors + contacts
-- ============================================================
-- Combine candidates from both sources, pick one per lowercase name
-- (conservative exact-match dedup), create vendors for any not yet
-- present. Vendor type is inferred from source:
--   agent_vendors.vendor_type (already typed)
--   contacts.role: escrow → Escrow, lender → Lender
WITH candidates AS (
  SELECT
    TRIM(COALESCE(company, name)) AS vname,
    vendor_type,
    phone,
    email,
    notes
  FROM agent_vendors
  WHERE TRIM(COALESCE(company, name)) <> ''
  UNION ALL
  SELECT
    TRIM(COALESCE(company, name)) AS vname,
    CASE role
      WHEN 'escrow' THEN 'Escrow'
      WHEN 'lender' THEN 'Lender'
      ELSE 'Other'
    END,
    phone,
    email,
    NULL::text
  FROM contacts
  WHERE role IN ('escrow', 'lender')
    AND TRIM(COALESCE(company, name)) <> ''
),
deduped AS (
  SELECT DISTINCT ON (LOWER(vname))
    vname AS name,
    vendor_type,
    phone,
    email,
    notes
  FROM candidates
  ORDER BY LOWER(vname)
)
INSERT INTO vendors (name, vendor_type, phone, email, notes)
SELECT d.name, d.vendor_type, d.phone, d.email, d.notes
FROM deduped d
WHERE NOT EXISTS (
  SELECT 1 FROM vendors v WHERE LOWER(v.name) = LOWER(d.name)
);

-- ============================================================
-- 7. Link existing contacts.vendor_id + agent_vendors.vendor_id
-- ============================================================
UPDATE contacts c
SET vendor_id = v.id
FROM vendors v
WHERE c.vendor_id IS NULL
  AND c.role IN ('escrow', 'lender')
  AND TRIM(COALESCE(c.company, c.name)) <> ''
  AND LOWER(v.name) = LOWER(TRIM(COALESCE(c.company, c.name)));

UPDATE agent_vendors av
SET vendor_id = v.id
FROM vendors v
WHERE av.vendor_id IS NULL
  AND TRIM(COALESCE(av.company, av.name)) <> ''
  AND LOWER(v.name) = LOWER(TRIM(COALESCE(av.company, av.name)));

-- ============================================================
-- 8. Backfill agent_preferred_vendors from agent_vendors
-- ============================================================
INSERT INTO agent_preferred_vendors (agent_id, vendor_id, vendor_type)
SELECT
  av.agent_id,
  av.vendor_id,
  av.vendor_type
FROM agent_vendors av
WHERE av.vendor_id IS NOT NULL
  AND av.vendor_type IS NOT NULL
ON CONFLICT (agent_id, vendor_id, vendor_type) DO NOTHING;

-- ================================================================
-- Migration counts — run these SELECTs after the migration to report
-- backfill volumes:
--
--   SELECT COUNT(*) AS payment_rows_backfilled FROM deal_payments;
--   SELECT COUNT(*) AS vendors_total FROM vendors;
--   SELECT COUNT(*) AS agent_preferred_links FROM agent_preferred_vendors;
--   SELECT COUNT(*) FROM contacts WHERE vendor_id IS NOT NULL;
--   SELECT COUNT(*) FROM agent_vendors WHERE vendor_id IS NOT NULL;
-- ================================================================
