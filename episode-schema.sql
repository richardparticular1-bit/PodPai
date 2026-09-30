create table public.podpai_episodes (
 id text primary key check (id ~ '^[0-9]{13}_[a-f0-9-]{36}$'),
 title text not null check (char_length(title) between 1 and 120)
);
create table public.podpai_episode_parts (
 path text primary key,
 episode_id text not null references public.podpai_episodes(id),
 duration_seconds double precision check(duration_seconds >= 0 and duration_seconds <= 86400)
);
create index podpai_episode_parts_episode_idx on public.podpai_episode_parts(episode_id);
alter table public.podpai_episodes enable row level security;
alter table public.podpai_episode_parts enable row level security;
revoke all on public.podpai_episodes,public.podpai_episode_parts from public,anon,authenticated;
grant select,insert,update on public.podpai_episodes,public.podpai_episode_parts to service_role;
