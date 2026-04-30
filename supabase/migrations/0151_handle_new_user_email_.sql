
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nickname, avatar_url)
  VALUES (
    new.id,
    new.email,
    split_part(new.email, '@', 1),
    'https://i.pravatar.cc/150?u=' || new.id
  );
  RETURN new;
END;
$$;
