
INSERT INTO user_roles (id, role)
VALUES ('c1ea9a5a-ca0d-40b0-a2aa-4a819186be2d', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin';
