DO $$
DECLARE
    r RECORD;
    i INT := 1;
BEGIN
    FOR r IN (SELECT id FROM profiles WHERE nickname = '탐험가' ORDER BY updated_at ASC) LOOP
        UPDATE profiles SET nickname = '탐험가' || i WHERE id = r.id;
        i := i + 1;
    END LOOP;
END $$;