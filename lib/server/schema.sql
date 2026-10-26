CREATE TABLE IF NOT EXISTS agi_workspaces (
 id text PRIMARY KEY,
 name text NOT NULL,
 data jsonb NOT NULL,
 revision integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agi_members (
 user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
 workspace_id text NOT NULL REFERENCES agi_workspaces(id) ON DELETE CASCADE,
 role text NOT NULL CHECK (role IN ('owner','editor','viewer'))
);
CREATE INDEX IF NOT EXISTS agi_members_workspace ON agi_members(workspace_id);
CREATE TABLE IF NOT EXISTS agi_events (
 id text PRIMARY KEY,
 workspace_id text NOT NULL REFERENCES agi_workspaces(id),
 user_id text NOT NULL REFERENCES "user"(id),
 action text NOT NULL,
 detail jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agi_events_workspace ON agi_events(workspace_id, created_at DESC);
CREATE TABLE IF NOT EXISTS agi_invitations (
 token_hash text PRIMARY KEY,
 workspace_id text NOT NULL REFERENCES agi_workspaces(id),
 email text NOT NULL,
 role text NOT NULL CHECK (role IN ('editor','viewer')),
 expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days'
);

ALTER TABLE agi_members ADD COLUMN IF NOT EXISTS grants jsonb NOT NULL DEFAULT '{}';
ALTER TABLE agi_members ADD COLUMN IF NOT EXISTS branch_ids text[] NOT NULL DEFAULT '{}';
ALTER TABLE agi_invitations ADD COLUMN IF NOT EXISTS grants jsonb NOT NULL DEFAULT '{}';
ALTER TABLE agi_invitations ADD COLUMN IF NOT EXISTS branch_ids text[] NOT NULL DEFAULT '{}';
CREATE UNIQUE INDEX IF NOT EXISTS agi_one_owner ON agi_members(workspace_id) WHERE role='owner';
CREATE TABLE IF NOT EXISTS agi_branches (
 workspace_id text NOT NULL REFERENCES agi_workspaces(id),
 id text NOT NULL,
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),
 PRIMARY KEY(workspace_id,id),
 UNIQUE(workspace_id,name)
);
ALTER TABLE agi_workspaces ADD COLUMN IF NOT EXISTS settings jsonb;
ALTER TABLE agi_workspaces ADD COLUMN IF NOT EXISTS storage_version integer NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS agi_records (
 workspace_id text NOT NULL REFERENCES agi_workspaces(id),
 collection text NOT NULL,
 id text NOT NULL,
 branch_id text,
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object' AND data->>'id'=id AND length(data->>'name')>0),
 name text GENERATED ALWAYS AS (data->>'name') STORED,
 status text GENERATED ALWAYS AS (data->>'status') STORED,
 search_text text GENERATED ALWAYS AS (lower(coalesce(data->>'name','')||' '||coalesce(data->>'code','')||' '||coalesce(data->>'email','')||' '||coalesce(data->>'sku','')||' '||coalesce(data->>'serial',''))) STORED,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,collection,id),
 FOREIGN KEY(workspace_id,branch_id) REFERENCES agi_branches(workspace_id,id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX IF NOT EXISTS agi_records_listing ON agi_records(workspace_id,collection,lower(name),id);
CREATE INDEX IF NOT EXISTS agi_records_branch ON agi_records(workspace_id,collection,branch_id);
CREATE INDEX IF NOT EXISTS agi_records_org ON agi_records(workspace_id,collection,(data->>'organizationId'));
CREATE INDEX IF NOT EXISTS agi_records_invoice ON agi_records(workspace_id,collection,(data->>'invoiceId'));
CREATE INDEX IF NOT EXISTS agi_records_quote ON agi_records(workspace_id,collection,(data->>'quotationId'));
CREATE INDEX IF NOT EXISTS agi_records_order ON agi_records(workspace_id,collection,(data->>'orderId'));
CREATE INDEX IF NOT EXISTS agi_records_po ON agi_records(workspace_id,collection,(data->>'purchaseOrderId'));
CREATE UNIQUE INDEX IF NOT EXISTS agi_document_number ON agi_records(workspace_id,collection,lower(name)) WHERE collection IN ('quotations','invoices','orders','purchaseOrders','payments','deliveries','goodsReceipts');
CREATE UNIQUE INDEX IF NOT EXISTS agi_product_sku ON agi_records(workspace_id,lower(data->>'sku')) WHERE collection='products' AND coalesce(data->>'sku','')<>'';
CREATE UNIQUE INDEX IF NOT EXISTS agi_customer_code ON agi_records(workspace_id,lower(data->>'code')) WHERE collection='organizations' AND coalesce(data->>'code','')<>'';
CREATE UNIQUE INDEX IF NOT EXISTS agi_one_order_per_quote ON agi_records(workspace_id,(data->>'quotationId')) WHERE collection='orders' AND coalesce(data->>'quotationId','')<>'';
CREATE UNIQUE INDEX IF NOT EXISTS agi_one_invoice_per_order ON agi_records(workspace_id,(data->>'orderId')) WHERE collection='invoices' AND coalesce(data->>'orderId','')<>'';
CREATE UNIQUE INDEX IF NOT EXISTS agi_stock_location ON agi_records(workspace_id,(data->>'productId'),(data->>'warehouseId')) WHERE collection='stock';
CREATE TABLE IF NOT EXISTS agi_record_links (
 workspace_id text NOT NULL,
 source_collection text NOT NULL,
 source_id text NOT NULL,
 field text NOT NULL,
 target_collection text NOT NULL,
 target_id text NOT NULL,
 PRIMARY KEY(workspace_id,source_collection,source_id,field,target_collection,target_id),
 FOREIGN KEY(workspace_id,source_collection,source_id) REFERENCES agi_records(workspace_id,collection,id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(workspace_id,target_collection,target_id) REFERENCES agi_records(workspace_id,collection,id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX IF NOT EXISTS agi_record_links_target ON agi_record_links(workspace_id,target_collection,target_id);
CREATE TABLE IF NOT EXISTS agi_document_lines (
 workspace_id text NOT NULL,
 collection text NOT NULL CHECK(collection IN ('quotations','orders','purchaseOrders','invoices')),
 record_id text NOT NULL,
 position integer NOT NULL CHECK(position>=0),
 product_collection text NOT NULL DEFAULT 'products' CHECK(product_collection='products'),
 product_id text NOT NULL,
 description text NOT NULL,
 quantity integer NOT NULL CHECK(quantity>0),
 unit_price numeric(20,6) NOT NULL CHECK(unit_price>=0),
 discount numeric(9,6) NOT NULL CHECK(discount BETWEEN 0 AND 100),
 tax numeric(9,6) NOT NULL CHECK(tax BETWEEN 0 AND 100),
 PRIMARY KEY(workspace_id,collection,record_id,position),
 FOREIGN KEY(workspace_id,collection,record_id) REFERENCES agi_records(workspace_id,collection,id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(workspace_id,product_collection,product_id) REFERENCES agi_records(workspace_id,collection,id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE IF NOT EXISTS agi_sequences (
 workspace_id text NOT NULL REFERENCES agi_workspaces(id),
 collection text NOT NULL,
 value bigint NOT NULL CHECK(value>=0),
 PRIMARY KEY(workspace_id,collection)
);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='agi_nonnegative_stock') THEN
  ALTER TABLE agi_records ADD CONSTRAINT agi_nonnegative_stock CHECK(collection<>'stock' OR ((data->>'quantity')::numeric>=0 AND (data->>'reserved')::numeric>=0 AND (data->>'reserved')::numeric<=(data->>'quantity')::numeric));
 END IF;
END $$;
DO $$ DECLARE target text; BEGIN
 FOREACH target IN ARRAY ARRAY['agi_records','agi_record_links','agi_document_lines','agi_sequences'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',target);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',target);
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE tablename=target AND policyname='agi_workspace_isolation') THEN
   EXECUTE format('CREATE POLICY agi_workspace_isolation ON %I USING(workspace_id=current_setting(''agi.workspace_id'',true)) WITH CHECK(workspace_id=current_setting(''agi.workspace_id'',true))',target);
  END IF;
 END LOOP;
END $$;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS agi_record_search ON agi_records USING gin(search_text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS agi_records_recent ON agi_records(workspace_id,collection,updated_at DESC,id);

CREATE UNIQUE INDEX IF NOT EXISTS agi_members_user_workspace ON agi_members(user_id,workspace_id);
CREATE TABLE IF NOT EXISTS agi_connections (
  workspace_id text NOT NULL,
  user_id text NOT NULL,
  provider text NOT NULL CHECK(provider='microsoft'),
  account_label text NOT NULL,
  credentials text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,user_id,provider),
  FOREIGN KEY(user_id,workspace_id) REFERENCES agi_members(user_id,workspace_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS agi_connection_states (
  state_hash text PRIMARY KEY,
  workspace_id text NOT NULL,
  user_id text NOT NULL,
  verifier text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes',
  FOREIGN KEY(user_id,workspace_id) REFERENCES agi_members(user_id,workspace_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS agi_connection_states_expiry ON agi_connection_states(expires_at);
ALTER TABLE agi_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE agi_connections FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_scope ON agi_connections;
CREATE POLICY workspace_scope ON agi_connections USING(workspace_id=current_setting('agi.workspace_id',true)) WITH CHECK(workspace_id=current_setting('agi.workspace_id',true));
ALTER TABLE agi_connection_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE agi_connection_states FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_scope ON agi_connection_states;
CREATE POLICY workspace_scope ON agi_connection_states USING(workspace_id=current_setting('agi.workspace_id',true)) WITH CHECK(workspace_id=current_setting('agi.workspace_id',true));
CREATE INDEX IF NOT EXISTS agi_sales_pipeline ON agi_records(workspace_id,(coalesce(data->>'pipelineId','default')),status) WHERE collection='opportunities';
CREATE INDEX IF NOT EXISTS agi_sales_close_date ON agi_records(workspace_id,(data->>'closeDate')) WHERE collection='opportunities';
CREATE INDEX IF NOT EXISTS agi_task_assignee ON agi_records(workspace_id,(data->>'assigneeId'),status) WHERE collection='tasks';

-- Authentication changes must invalidate old sessions and pending challenges atomically.
CREATE OR REPLACE FUNCTION agi_invalidate_account_access() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE account_user text;
BEGIN
  IF TG_TABLE_NAME='account' THEN
    IF NEW.password IS NOT DISTINCT FROM OLD.password THEN RETURN NEW; END IF;
    account_user := NEW."userId";
  ELSE
    IF NEW."twoFactorEnabled" IS NOT DISTINCT FROM OLD."twoFactorEnabled" THEN RETURN NEW; END IF;
    account_user := NEW.id;
  END IF;
  DELETE FROM "session" WHERE "userId"=account_user;
  WITH revoked AS (
    DELETE FROM verification WHERE value=account_user
      AND (identifier LIKE '2fa-%' OR identifier LIKE 'trust-device-%' OR identifier LIKE 'reset-password:%')
    RETURNING identifier
  ) DELETE FROM verification WHERE identifier IN (SELECT '2fa-attempts-'||identifier FROM revoked WHERE identifier LIKE '2fa-%');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS agi_password_access_revocation ON account;
CREATE TRIGGER agi_password_access_revocation AFTER UPDATE OF password ON account FOR EACH ROW EXECUTE FUNCTION agi_invalidate_account_access();
DROP TRIGGER IF EXISTS agi_mfa_access_revocation ON "user";
CREATE TRIGGER agi_mfa_access_revocation AFTER UPDATE OF "twoFactorEnabled" ON "user" FOR EACH ROW EXECUTE FUNCTION agi_invalidate_account_access();
