create table public.guestbooks (
  id uuid primary key default gen_random_uuid(),
  image_path text not null check (char_length(image_path) between 1 and 2048),
  created_at timestamptz not null default now()
);
create index guestbooks_created_idx on public.guestbooks (created_at desc, id);
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  guestbook_id uuid not null references public.guestbooks(id) on delete cascade,
  nickname text not null check (char_length(btrim(nickname)) between 1 and 20),
  content text not null check (char_length(btrim(content)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index comments_guestbook_idx on public.comments (guestbook_id, created_at, id);
alter table public.guestbooks enable row level security;
alter table public.comments enable row level security;
grant select, insert on public.guestbooks, public.comments to anon;
create policy "Public guestbook read" on public.guestbooks for select to anon using (true);
create policy "Public guestbook insert" on public.guestbooks for insert to anon with check (
  image_path like '%/storage/v1/object/public/guestbook-images/' || id::text || '.png'
);
create policy "Public comment read" on public.comments for select to anon using (true);
create policy "Public comment insert" on public.comments for insert to anon with check (true);
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guestbook-images', 'guestbook-images', true, 5242880, array['image/png'])
on conflict (id) do nothing;
create policy "Public image upload" on storage.objects for insert to anon with check (
  bucket_id = 'guestbook-images' and name ~ '^[0-9a-f-]{36}\.png$'
);
create policy "Public image read" on storage.objects for select to anon using (bucket_id = 'guestbook-images');
alter publication supabase_realtime add table public.guestbooks, public.comments;
