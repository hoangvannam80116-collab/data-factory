create table workspaces (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id text not null references workspaces(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table shops (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  platform_type text not null,
  name text not null,
  expected_shop_name text not null default '',
  detected_shop_name text not null default '',
  auth_status text not null default 'unauthorized',
  url text not null default '',
  created_at timestamptz not null default now()
);

create table field_rules (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  shop_id text not null references shops(id) on delete cascade,
  field_name text not null,
  prompt text not null default '',
  page_path text not null default '',
  click_path text not null default '',
  screenshot_url text not null default '',
  marker_note text not null default '',
  recognized_path text not null default '',
  value text,
  confidence integer,
  status text not null default 'draft',
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table collection_runs (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  shop_id text not null references shops(id) on delete cascade,
  status text not null default 'waiting_for_codex',
  instruction text not null default '',
  expected_shop_name text not null default '',
  detected_shop_name text not null default '',
  evidence text not null default '',
  record_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table collection_run_rules (
  run_id text not null references collection_runs(id) on delete cascade,
  rule_id text not null references field_rules(id) on delete cascade,
  primary key (run_id, rule_id)
);

create table collection_records (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  shop_id text not null references shops(id) on delete cascade,
  run_id text references collection_runs(id) on delete set null,
  status text not null default 'success',
  source text not null default 'tabbit',
  evidence text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_shops_workspace on shops(workspace_id);
create index idx_field_rules_shop on field_rules(shop_id);
create index idx_collection_runs_shop_created on collection_runs(shop_id, created_at desc);
create index idx_collection_records_shop_created on collection_records(shop_id, created_at desc);
