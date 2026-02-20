-- Create table for processed webhooks to ensure idempotency
create table if not exists processed_webhooks (
  id uuid default gen_random_uuid() primary key,
  event_id text not null unique,
  event_type text not null,
  processed_at timestamptz default now() not null
);

-- Enable RLS (though this is a backend-only table, good practice)
alter table processed_webhooks enable row level security;

-- Create index for fast lookups
create index if not exists processed_webhooks_event_id_idx on processed_webhooks(event_id);
