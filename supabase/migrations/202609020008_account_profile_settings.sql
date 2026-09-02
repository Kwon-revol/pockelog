create or replace function public.update_my_profile(
  new_display_name text,
  new_phone_normalized text
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_name text := btrim(new_display_name);
  affected integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if char_length(normalized_name) not between 1 and 30 then
    raise exception 'invalid display name' using errcode = '22023';
  end if;

  if new_phone_normalized !~ '^[0-9]+$' then
    raise exception 'invalid phone' using errcode = '22023';
  end if;

  update public.profiles
  set display_name = normalized_name
  where id = auth.uid();
  get diagnostics affected = row_count;

  if affected <> 1 then
    raise exception 'profile missing' using errcode = '42501';
  end if;

  update public.user_private_profiles
  set phone_normalized = new_phone_normalized
  where user_id = auth.uid();
  get diagnostics affected = row_count;

  if affected <> 1 then
    raise exception 'private profile missing' using errcode = '42501';
  end if;

  return 'updated';
end;
$$;

revoke all on function public.update_my_profile(text, text) from public, anon;
grant execute on function public.update_my_profile(text, text) to authenticated;
