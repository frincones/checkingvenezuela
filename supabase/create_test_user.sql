-- =============================================
-- CHECK-IN VENEZUELA - CREAR USUARIO DE PRUEBA
-- =============================================
--
-- IMPORTANTE: Este script crea un usuario de prueba para desarrollo.
-- Ejecutar en el SQL Editor de Supabase Dashboard.
--
-- Credenciales del usuario de prueba:
-- Email: test@checkinvenezuela.com
-- Password: Test123456!
--
-- =============================================

-- Primero, insertar el usuario en auth.users usando la función de Supabase
-- NOTA: En producción, crear usuarios a través de la API de Auth o el Dashboard

-- Crear usuario usando la función auth.create_user (disponible en Supabase)
-- Si esta función no está disponible, usar el Dashboard de Supabase para crear el usuario

DO $$
DECLARE
    test_user_id UUID;
    test_user_email TEXT := 'test@checkinvenezuela.com';
BEGIN
    -- Verificar si el usuario ya existe
    SELECT id INTO test_user_id FROM auth.users WHERE email = test_user_email;

    IF test_user_id IS NULL THEN
        RAISE NOTICE 'El usuario de prueba no existe. Por favor, créalo desde el Dashboard de Supabase:';
        RAISE NOTICE '1. Ve a Authentication > Users';
        RAISE NOTICE '2. Click en "Add user"';
        RAISE NOTICE '3. Email: test@checkinvenezuela.com';
        RAISE NOTICE '4. Password: Test123456!';
        RAISE NOTICE '5. Marca "Auto Confirm User"';
    ELSE
        RAISE NOTICE 'Usuario de prueba encontrado con ID: %', test_user_id;

        -- Actualizar o crear el perfil
        INSERT INTO public.profiles (id, email, first_name, last_name, profile_image, email_verified_at)
        VALUES (
            test_user_id,
            test_user_email,
            'Usuario',
            'Prueba',
            'https://api.dicebear.com/7.x/avataaars/svg?seed=test',
            NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
            first_name = 'Usuario',
            last_name = 'Prueba',
            email_verified_at = NOW();

        RAISE NOTICE 'Perfil del usuario de prueba actualizado correctamente';
    END IF;
END $$;

-- =============================================
-- ALTERNATIVA: Crear usuario manualmente
-- =============================================
--
-- Si necesitas crear el usuario programáticamente,
-- puedes usar la API de Supabase Auth desde Node.js:
--
-- const { createClient } = require('@supabase/supabase-js');
--
-- const supabase = createClient(
--   process.env.NEXT_PUBLIC_SUPABASE_URL,
--   process.env.SUPABASE_SERVICE_ROLE_KEY
-- );
--
-- const { data, error } = await supabase.auth.admin.createUser({
--   email: 'test@checkinvenezuela.com',
--   password: 'Test123456!',
--   email_confirm: true,
--   user_metadata: {
--     first_name: 'Usuario',
--     last_name: 'Prueba'
--   }
-- });
--
-- =============================================

-- =============================================
-- CREAR USUARIO ASESOR DE PRUEBA
-- =============================================
--
-- Credenciales del asesor de prueba:
-- Email: asesor@checkinvenezuela.com
-- Password: Asesor123456!
--

DO $$
DECLARE
    advisor_user_id UUID;
    advisor_email TEXT := 'asesor@checkinvenezuela.com';
BEGIN
    -- Verificar si el asesor ya existe
    SELECT id INTO advisor_user_id FROM auth.users WHERE email = advisor_email;

    IF advisor_user_id IS NULL THEN
        RAISE NOTICE 'El usuario asesor no existe. Por favor, créalo desde el Dashboard de Supabase:';
        RAISE NOTICE '1. Ve a Authentication > Users';
        RAISE NOTICE '2. Click en "Add user"';
        RAISE NOTICE '3. Email: asesor@checkinvenezuela.com';
        RAISE NOTICE '4. Password: Asesor123456!';
        RAISE NOTICE '5. Marca "Auto Confirm User"';
    ELSE
        RAISE NOTICE 'Usuario asesor encontrado con ID: %', advisor_user_id;

        -- Actualizar o crear el perfil del asesor
        INSERT INTO public.profiles (id, email, first_name, last_name, profile_image, email_verified_at)
        VALUES (
            advisor_user_id,
            advisor_email,
            'Carlos',
            'Asesor',
            'https://api.dicebear.com/7.x/avataaars/svg?seed=advisor',
            NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
            first_name = 'Carlos',
            last_name = 'Asesor',
            email_verified_at = NOW();

        -- Crear registro de asesor
        INSERT INTO public.advisors (profile_id, employee_code, department, whatsapp_number, is_active, specializations)
        VALUES (
            advisor_user_id,
            'ADV001',
            'sales',
            '+584264034052',
            true,
            ARRAY['flights', 'hotels', 'packages']
        )
        ON CONFLICT (profile_id) DO UPDATE SET
            employee_code = 'ADV001',
            is_active = true;

        RAISE NOTICE 'Perfil y registro de asesor creados/actualizados correctamente';
    END IF;
END $$;

-- =============================================
-- MENSAJE FINAL
-- =============================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'INSTRUCCIONES PARA CREAR USUARIOS';
    RAISE NOTICE '=========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Ve al Dashboard de Supabase y crea estos usuarios:';
    RAISE NOTICE '';
    RAISE NOTICE '1. USUARIO DE PRUEBA:';
    RAISE NOTICE '   Email: test@checkinvenezuela.com';
    RAISE NOTICE '   Password: Test123456!';
    RAISE NOTICE '';
    RAISE NOTICE '2. USUARIO ASESOR:';
    RAISE NOTICE '   Email: asesor@checkinvenezuela.com';
    RAISE NOTICE '   Password: Asesor123456!';
    RAISE NOTICE '';
    RAISE NOTICE 'Después de crear los usuarios, ejecuta este script';
    RAISE NOTICE 'nuevamente para crear los perfiles automáticamente.';
    RAISE NOTICE '=========================================';
END $$;
