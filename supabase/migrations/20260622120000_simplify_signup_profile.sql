-- Allow account creation with email + username only; complete profile later.
ALTER TABLE public.profiles
  ALTER COLUMN first_name DROP NOT NULL,
  ALTER COLUMN last_name DROP NOT NULL,
  ALTER COLUMN birthday DROP NOT NULL,
  ALTER COLUMN weight DROP NOT NULL,
  ALTER COLUMN height DROP NOT NULL;

CREATE OR REPLACE FUNCTION private.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_username text := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
BEGIN
  IF v_username IS NULL THEN
    v_username := 'user_' || left(replace(new.id::text, '-', ''), 8);
  END IF;

  INSERT INTO public.profiles (id, email, username, first_name, last_name, birthday, weight, height)
  VALUES (
    new.id,
    coalesce(new.email, ''),
    v_username,
    nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''),
    nullif(new.raw_user_meta_data ->> 'birthday', '')::date,
    nullif(new.raw_user_meta_data ->> 'weight', '')::numeric,
    nullif(new.raw_user_meta_data ->> 'height', '')::numeric
  );

  RETURN new;
END;
$function$;
