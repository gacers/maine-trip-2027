-- Two-score ratings: "My Score" (each identified rater's own 0.5-5.0
-- star rating) and "Average Score" (the mean of everyone's). A rater is
-- identified by whatever already got them write access — an admin's
-- session (their Supabase Auth user id) or a contributor's invite/API
-- token (its api_keys row id) — see lib/auth.js's requireWriteAccess,
-- which now also returns a `raterKey` string for exactly this. Sharing
-- one invite link means sharing one "voter" — a known, accepted
-- trade-off of not building real per-person accounts for this.
create table entry_ratings (
  id uuid primary key default gen_random_uuid(),
  entry_id text not null references entries(id) on delete cascade,
  rater_key text not null,
  score numeric(3,1) not null check (score >= 0.5 and score <= 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entry_id, rater_key)
);
create index entry_ratings_entry_id_idx on entry_ratings (entry_id);

alter table entry_ratings enable row level security;
-- The average is public, same as every other entry field (photos,
-- description, ...) — only setting your own score requires access.
create policy entry_ratings_read on entry_ratings for select using (true);
-- No insert/update/delete policy: every write goes through the
-- ratings API route using the service-role client, only after
-- requireWriteAccess has already verified an admin session or a valid
-- owner/contributor token — same pattern entries writes already use
-- for the bearer-token path.

-- Only a still-deciding-among-options list (e.g. Possible Houses) gets
-- ratings — same per-section opt-in pattern as supports_pairing/
-- supports_ranking.
alter table sections add column if not exists supports_ratings boolean not null default false;
