-- =============================================
-- CHECKING VENEZUELA - SUPABASE DATABASE SCHEMA
-- Migration from MongoDB to PostgreSQL/Supabase
-- =============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ENUM TYPES
-- =============================================

-- User related enums
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled');
CREATE TYPE refund_status AS ENUM ('not_requested', 'requested', 'approved', 'denied', 'refunded');
CREATE TYPE booking_source AS ENUM ('web', 'mobile', 'api');
CREATE TYPE passenger_type AS ENUM ('adult', 'child', 'infant');
CREATE TYPE gender_type AS ENUM ('male', 'female');
CREATE TYPE seat_class AS ENUM ('economy', 'premium_economy', 'business', 'first');
CREATE TYPE seat_position AS ENUM ('window', 'aisle', 'middle', 'exit', 'any');
CREATE TYPE seat_location AS ENUM ('front', 'middle', 'back', 'any');
CREATE TYPE legroom_type AS ENUM ('extra', 'standard', 'none');
CREATE TYPE baggage_type AS ENUM ('carry-on', 'checked', 'none');
CREATE TYPE meal_preference AS ENUM ('vegan', 'halal', 'kosher', 'child', 'diabetic', 'vegetarian', 'gluten-free', 'standard');
CREATE TYPE flight_status AS ENUM ('scheduled', 'delayed', 'departed', 'arrived', 'cancelled');
CREATE TYPE hotel_status AS ENUM ('Opened', 'Closed');
CREATE TYPE cancellation_unit AS ENUM ('days', 'hours', 'minutes', 'seconds');
CREATE TYPE canceled_by_type AS ENUM ('user', 'admin', 'system');
CREATE TYPE payment_method_type AS ENUM ('card', 'cash');
CREATE TYPE fare_type AS ENUM ('Saver', 'Flex', 'Premium', 'Refundable');
CREATE TYPE flight_type AS ENUM ('Domestic', 'International');
CREATE TYPE fee_type AS ENUM ('perKg', 'perPiece', 'flat');
CREATE TYPE measurement_unit_weight AS ENUM ('kg', 'lb');
CREATE TYPE measurement_unit_dimension AS ENUM ('cm', 'in');
CREATE TYPE discount_type AS ENUM ('percentage', 'fixed');
CREATE TYPE promo_applicable_type AS ENUM ('flight', 'hotel', 'both');
CREATE TYPE reward_type AS ENUM ('earned', 'redeemed');
CREATE TYPE reward_source AS ENUM ('flightBooking', 'hotelBooking');
CREATE TYPE reservation_type AS ENUM ('temporary', 'permanent');

-- =============================================
-- USERS TABLE (extends Supabase auth.users)
-- =============================================

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    profile_image TEXT,
    cover_image TEXT,
    email_verified_at TIMESTAMPTZ,
    address TEXT,
    date_of_birth DATE,
    stripe_customer_id TEXT,
    reward_points_total INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User emails (multiple emails per user)
CREATE TABLE public.user_emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    email_verified_at TIMESTAMPTZ,
    is_primary BOOLEAN DEFAULT FALSE,
    in_verification BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User phone numbers
CREATE TABLE public.user_phones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    dial_code TEXT NOT NULL,
    verified_at TIMESTAMPTZ,
    is_primary BOOLEAN DEFAULT FALSE,
    in_verification BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reward points history
CREATE TABLE public.reward_points_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type reward_type NOT NULL,
    amount INTEGER NOT NULL,
    source reward_source,
    reference_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Anonymous users (for guest bookings)
CREATE TABLE public.anonymous_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id TEXT UNIQUE NOT NULL,
    data JSONB,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- AIRPORTS & AIRLINES
-- =============================================

CREATE TABLE public.airports (
    id TEXT PRIMARY KEY, -- IATA code (e.g., 'JFK', 'LHR')
    iata_code TEXT,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT,
    country TEXT NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    timezone TEXT NOT NULL,
    facilities TEXT[],
    image TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.airlines (
    id TEXT PRIMARY KEY, -- IATA code (e.g., 'EK', 'FZ')
    iata_code TEXT,
    name TEXT NOT NULL,
    logo TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    contact_website TEXT,
    airline_policy JSONB, -- Complex nested policy structure
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.airplanes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model TEXT NOT NULL,
    manufacturer TEXT,
    capacity INTEGER,
    seat_configuration JSONB,
    amenities TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- FLIGHTS
-- =============================================

CREATE TABLE public.flight_itineraries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flight_code TEXT NOT NULL,
    date DATE NOT NULL,
    carrier_id TEXT REFERENCES public.airlines(id),
    departure_airport_id TEXT REFERENCES public.airports(id),
    arrival_airport_id TEXT REFERENCES public.airports(id),
    total_duration_minutes INTEGER,
    layovers JSONB, -- Array of {fromSegmentIndex, durationMinutes}
    baggage_allowance JSONB,
    status flight_status DEFAULT 'scheduled',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.flight_segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    itinerary_id UUID REFERENCES public.flight_itineraries(id) ON DELETE CASCADE,
    flight_number TEXT NOT NULL,
    date DATE,
    airline_id TEXT REFERENCES public.airlines(id),
    airplane_id UUID REFERENCES public.airplanes(id),
    from_airport_id TEXT REFERENCES public.airports(id),
    from_scheduled_departure TIMESTAMPTZ,
    from_terminal TEXT,
    from_gate TEXT,
    to_airport_id TEXT REFERENCES public.airports(id),
    to_scheduled_arrival TIMESTAMPTZ,
    to_terminal TEXT,
    to_gate TEXT,
    duration_minutes INTEGER,
    fare_details JSONB,
    baggage_allowance JSONB,
    status flight_status DEFAULT 'scheduled',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.flight_seats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    segment_id UUID REFERENCES public.flight_segments(id) ON DELETE CASCADE,
    seat_number TEXT NOT NULL,
    airplane_id UUID REFERENCES public.airplanes(id),
    class seat_class NOT NULL,
    reservation_pnr_code TEXT,
    reservation_passenger_id UUID,
    reservation_type reservation_type,
    reservation_expires_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PASSENGERS
-- =============================================

CREATE TABLE public.passengers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    middle_name TEXT,
    title TEXT,
    passenger_type passenger_type,
    email TEXT NOT NULL,
    phone_number TEXT,
    phone_dial_code TEXT,
    address_street TEXT,
    address_city TEXT,
    address_country TEXT,
    address_postal_code TEXT,
    passport_number TEXT,
    passport_expiry_date DATE,
    country TEXT,
    visa_number TEXT,
    visa_expiry DATE,
    visa_country TEXT,
    frequent_flyer_number TEXT,
    frequent_flyer_airline TEXT,
    preferences JSONB, -- Complex preferences structure
    date_of_birth DATE NOT NULL,
    gender gender_type,
    redress_number TEXT,
    known_traveler_number TEXT,
    seat_class seat_class NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- FLIGHT BOOKINGS & PAYMENTS
-- =============================================

CREATE TABLE public.flight_bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pnr_code TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES public.profiles(id),
    itinerary_id UUID REFERENCES public.flight_itineraries(id),
    fare_breakdown JSONB,
    total_fare DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    promo_code TEXT,
    payment_status payment_status DEFAULT 'pending',
    ticket_status booking_status DEFAULT 'pending',
    cancellation_reason TEXT,
    cancelable_until TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,
    canceled_by canceled_by_type,
    cancellation_fee DECIMAL(10, 2),
    refund_stripe_id TEXT,
    refund_status refund_status DEFAULT 'not_requested',
    refund_reason TEXT,
    refund_amount DECIMAL(10, 2),
    refund_requested_at TIMESTAMPTZ,
    refund_refunded_at TIMESTAMPTZ,
    refund_refundable_until TIMESTAMPTZ,
    refund_deadline TIMESTAMPTZ,
    refund_penalty_fee DECIMAL(10, 2),
    refund_is_manual BOOLEAN DEFAULT FALSE,
    earned_miles INTEGER DEFAULT 0,
    guaranteed_reservation_until TIMESTAMPTZ,
    user_timezone TEXT,
    source booking_source DEFAULT 'web',
    booked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table for booking segments
CREATE TABLE public.flight_booking_segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES public.flight_bookings(id) ON DELETE CASCADE,
    segment_id UUID NOT NULL REFERENCES public.flight_segments(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table for booking passengers
CREATE TABLE public.flight_booking_passengers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES public.flight_bookings(id) ON DELETE CASCADE,
    passenger_id UUID NOT NULL REFERENCES public.passengers(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Selected seats for bookings
CREATE TABLE public.flight_booking_seats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES public.flight_bookings(id) ON DELETE CASCADE,
    passenger_id UUID NOT NULL REFERENCES public.passengers(id),
    seat_id UUID NOT NULL REFERENCES public.flight_seats(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.flight_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES public.flight_bookings(id) ON DELETE SET NULL,
    transaction_id TEXT NOT NULL,
    stripe_payment_intent_id TEXT NOT NULL,
    stripe_charge_id TEXT NOT NULL,
    payment_method_id TEXT,
    payment_method_type TEXT,
    payment_method_brand TEXT,
    payment_method_last4 TEXT,
    amount DECIMAL(10, 2) NOT NULL,
    payment_date TIMESTAMPTZ,
    receipt_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add payment reference to bookings
ALTER TABLE public.flight_bookings ADD COLUMN payment_id UUID REFERENCES public.flight_payments(id);

-- =============================================
-- HOTELS
-- =============================================

CREATE TABLE public.hotels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT,
    parking_included BOOLEAN,
    last_renovation_date DATE,
    is_deleted BOOLEAN DEFAULT FALSE,
    query TEXT,
    address_street TEXT,
    address_city TEXT,
    address_state TEXT,
    address_postal_code TEXT,
    address_country TEXT,
    coordinates_lat DECIMAL(10, 7) NOT NULL,
    coordinates_lon DECIMAL(10, 7) NOT NULL,
    amenities TEXT[],
    features TEXT[],
    images TEXT[],
    status hotel_status DEFAULT 'Opened',
    total_rooms INTEGER NOT NULL,
    tags TEXT[],
    policies JSONB, -- Complex policies structure
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.hotel_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    room_type TEXT,
    features TEXT[],
    amenities TEXT[],
    images TEXT[],
    price_base DECIMAL(10, 2) NOT NULL,
    price_tax DECIMAL(10, 2),
    price_discount_amount DECIMAL(10, 2),
    price_discount_type discount_type,
    price_discount_valid_until TIMESTAMPTZ,
    price_service_fee DECIMAL(10, 2),
    price_currency TEXT DEFAULT 'USD',
    total_beds INTEGER DEFAULT 1,
    bed_options TEXT,
    sleeps_count INTEGER,
    smoking_allowed BOOLEAN,
    max_adults INTEGER,
    max_children INTEGER,
    extra_bed_allowed BOOLEAN,
    floor INTEGER,
    room_number TEXT,
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- HOTEL GUESTS
-- =============================================

CREATE TABLE public.hotel_guests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone_number TEXT,
    phone_dial_code TEXT,
    date_of_birth DATE,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- HOTEL BOOKINGS & PAYMENTS
-- =============================================

CREATE TABLE public.hotel_bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id),
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    fare_breakdown JSONB,
    total_price DECIMAL(10, 2),
    booking_status booking_status DEFAULT 'confirmed',
    payment_status payment_status DEFAULT 'pending',
    payment_method payment_method_type,
    refund_stripe_id TEXT,
    refund_status refund_status DEFAULT 'not_requested',
    refund_reason TEXT,
    refund_currency TEXT,
    refund_amount DECIMAL(10, 2),
    refund_requested_at TIMESTAMPTZ,
    refund_refunded_at TIMESTAMPTZ,
    refund_penalty_fee DECIMAL(10, 2),
    refund_is_manual BOOLEAN DEFAULT FALSE,
    source booking_source DEFAULT 'web',
    guaranteed_reservation_until TIMESTAMPTZ,
    booked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table for booking rooms
CREATE TABLE public.hotel_booking_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES public.hotel_bookings(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES public.hotel_rooms(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table for booking guests
CREATE TABLE public.hotel_booking_guests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES public.hotel_bookings(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES public.hotel_guests(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.hotel_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES public.hotel_bookings(id) ON DELETE SET NULL,
    transaction_id TEXT NOT NULL,
    stripe_payment_intent_id TEXT NOT NULL,
    stripe_charge_id TEXT NOT NULL,
    payment_method_id TEXT,
    payment_method_type TEXT,
    payment_method_brand TEXT,
    payment_method_last4 TEXT,
    amount DECIMAL(10, 2) NOT NULL,
    payment_date TIMESTAMPTZ,
    receipt_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add payment reference to bookings
ALTER TABLE public.hotel_bookings ADD COLUMN payment_id UUID REFERENCES public.hotel_payments(id);

-- =============================================
-- REVIEWS
-- =============================================

CREATE TABLE public.flight_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    booking_id UUID REFERENCES public.flight_bookings(id),
    airline_id TEXT REFERENCES public.airlines(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    title TEXT,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.hotel_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    booking_id UUID REFERENCES public.hotel_bookings(id),
    hotel_id UUID REFERENCES public.hotels(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    title TEXT,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.website_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    title TEXT,
    comment TEXT,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PROMO CODES
-- =============================================

CREATE TABLE public.promo_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    discount_type discount_type NOT NULL,
    value DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    max_discount DECIMAL(10, 2),
    applicable_to promo_applicable_type,
    applicable_airlines TEXT[],
    applicable_hotel_chains TEXT[],
    applicable_routes JSONB,
    applicable_destinations TEXT[],
    applicable_fare_classes TEXT[],
    applicable_room_types TEXT[],
    conditions JSONB, -- Complex conditions structure
    usage_limit INTEGER DEFAULT 1000,
    usage_count INTEGER DEFAULT 0,
    user_limit INTEGER DEFAULT 1,
    is_user_restricted BOOLEAN DEFAULT FALSE,
    allowed_users TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    created_by_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- SUBSCRIPTIONS (Newsletter)
-- =============================================

CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    subscribed_at TIMESTAMPTZ DEFAULT NOW(),
    unsubscribed_at TIMESTAMPTZ
);

-- =============================================
-- SEARCH HISTORY
-- =============================================

CREATE TABLE public.search_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('flight', 'hotel')),
    search_state JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- USER BOOKMARKS
-- =============================================

CREATE TABLE public.user_flight_bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    itinerary_id UUID NOT NULL REFERENCES public.flight_itineraries(id) ON DELETE CASCADE,
    search_state JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.user_hotel_bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- WEBSITE CONFIG & ANALYTICS
-- =============================================

CREATE TABLE public.website_config (
    id TEXT PRIMARY KEY DEFAULT 'config',
    site_name TEXT,
    site_description TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    social_links JSONB,
    features JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.analytics (
    id TEXT PRIMARY KEY DEFAULT 'analytics',
    total_users_signed_up INTEGER DEFAULT 0,
    total_accounts_deleted INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Profiles
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_stripe_customer ON public.profiles(stripe_customer_id);

-- Flights
CREATE INDEX idx_flight_itineraries_date ON public.flight_itineraries(date);
CREATE INDEX idx_flight_itineraries_departure ON public.flight_itineraries(departure_airport_id);
CREATE INDEX idx_flight_itineraries_arrival ON public.flight_itineraries(arrival_airport_id);
CREATE INDEX idx_flight_segments_itinerary ON public.flight_segments(itinerary_id);
CREATE INDEX idx_flight_seats_segment ON public.flight_seats(segment_id);
CREATE INDEX idx_flight_bookings_user ON public.flight_bookings(user_id);
CREATE INDEX idx_flight_bookings_pnr ON public.flight_bookings(pnr_code);

-- Hotels
CREATE INDEX idx_hotels_slug ON public.hotels(slug);
CREATE INDEX idx_hotels_city ON public.hotels(address_city);
CREATE INDEX idx_hotel_rooms_hotel ON public.hotel_rooms(hotel_id);
CREATE INDEX idx_hotel_bookings_user ON public.hotel_bookings(user_id);
CREATE INDEX idx_hotel_bookings_hotel ON public.hotel_bookings(hotel_id);
CREATE INDEX idx_hotel_bookings_dates ON public.hotel_bookings(check_in_date, check_out_date);

-- Search history
CREATE INDEX idx_search_history_user ON public.search_history(user_id);
CREATE INDEX idx_search_history_type ON public.search_history(type);

-- Promo codes
CREATE INDEX idx_promo_codes_code ON public.promo_codes(code);
CREATE INDEX idx_promo_codes_active ON public.promo_codes(is_active);

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_points_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_flight_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_hotel_bookmarks ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read/update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- User emails: Users can manage their own emails
CREATE POLICY "Users can view own emails" ON public.user_emails
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own emails" ON public.user_emails
    FOR ALL USING (auth.uid() = user_id);

-- User phones: Users can manage their own phones
CREATE POLICY "Users can view own phones" ON public.user_phones
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own phones" ON public.user_phones
    FOR ALL USING (auth.uid() = user_id);

-- Reward points: Users can view their own history
CREATE POLICY "Users can view own rewards" ON public.reward_points_history
    FOR SELECT USING (auth.uid() = user_id);

-- Flight bookings: Users can view their own bookings
CREATE POLICY "Users can view own flight bookings" ON public.flight_bookings
    FOR SELECT USING (auth.uid() = user_id);

-- Hotel bookings: Users can view their own bookings
CREATE POLICY "Users can view own hotel bookings" ON public.hotel_bookings
    FOR SELECT USING (auth.uid() = user_id);

-- Search history: Users can manage their own history
CREATE POLICY "Users can manage own search history" ON public.search_history
    FOR ALL USING (auth.uid() = user_id);

-- Bookmarks: Users can manage their own bookmarks
CREATE POLICY "Users can manage own flight bookmarks" ON public.user_flight_bookmarks
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own hotel bookmarks" ON public.user_hotel_bookmarks
    FOR ALL USING (auth.uid() = user_id);

-- Public read access for airports, airlines, hotels, etc.
ALTER TABLE public.airports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.airlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read airports" ON public.airports FOR SELECT USING (true);
CREATE POLICY "Public read airlines" ON public.airlines FOR SELECT USING (true);
CREATE POLICY "Public read hotels" ON public.hotels FOR SELECT USING (is_deleted = false);
CREATE POLICY "Public read hotel rooms" ON public.hotel_rooms FOR SELECT USING (true);
CREATE POLICY "Public read flight itineraries" ON public.flight_itineraries FOR SELECT USING (true);
CREATE POLICY "Public read flight segments" ON public.flight_segments FOR SELECT USING (true);
CREATE POLICY "Public read active promo codes" ON public.promo_codes FOR SELECT USING (is_active = true);

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hotels_updated_at BEFORE UPDATE ON public.hotels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hotel_rooms_updated_at BEFORE UPDATE ON public.hotel_rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_flight_itineraries_updated_at BEFORE UPDATE ON public.flight_itineraries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_flight_segments_updated_at BEFORE UPDATE ON public.flight_segments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_flight_bookings_updated_at BEFORE UPDATE ON public.flight_bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hotel_bookings_updated_at BEFORE UPDATE ON public.hotel_bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, first_name, last_name, profile_image)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/7.x/avataaars/svg?seed=' || NEW.id)
    );
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to increment analytics
CREATE OR REPLACE FUNCTION increment_user_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.analytics SET total_users_signed_up = total_users_signed_up + 1 WHERE id = 'analytics';
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Initialize analytics row
INSERT INTO public.analytics (id) VALUES ('analytics') ON CONFLICT (id) DO NOTHING;

-- =============================================
-- END OF SCHEMA
-- =============================================
