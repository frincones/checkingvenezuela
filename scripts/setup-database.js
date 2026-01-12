/**
 * Script to setup Supabase database schema
 * Run with: node scripts/setup-database.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// SQL statements to execute (split into manageable chunks)
const sqlStatements = [
  // ENUM TYPES
  `CREATE TYPE IF NOT EXISTS payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded')`,
  `CREATE TYPE IF NOT EXISTS booking_status AS ENUM ('pending', 'confirmed', 'cancelled')`,
  `CREATE TYPE IF NOT EXISTS refund_status AS ENUM ('not_requested', 'requested', 'approved', 'denied', 'refunded')`,
  `CREATE TYPE IF NOT EXISTS booking_source AS ENUM ('web', 'mobile', 'api')`,
  `CREATE TYPE IF NOT EXISTS passenger_type AS ENUM ('adult', 'child', 'infant')`,
  `CREATE TYPE IF NOT EXISTS gender_type AS ENUM ('male', 'female')`,
  `CREATE TYPE IF NOT EXISTS seat_class AS ENUM ('economy', 'premium_economy', 'business', 'first')`,
  `CREATE TYPE IF NOT EXISTS flight_status AS ENUM ('scheduled', 'delayed', 'departed', 'arrived', 'cancelled')`,
  `CREATE TYPE IF NOT EXISTS hotel_status AS ENUM ('Opened', 'Closed')`,
  `CREATE TYPE IF NOT EXISTS canceled_by_type AS ENUM ('user', 'admin', 'system')`,
  `CREATE TYPE IF NOT EXISTS payment_method_type AS ENUM ('card', 'cash')`,
  `CREATE TYPE IF NOT EXISTS discount_type AS ENUM ('percentage', 'fixed')`,
  `CREATE TYPE IF NOT EXISTS promo_applicable_type AS ENUM ('flight', 'hotel', 'both')`,
  `CREATE TYPE IF NOT EXISTS reward_type AS ENUM ('earned', 'redeemed')`,
  `CREATE TYPE IF NOT EXISTS reward_source AS ENUM ('flightBooking', 'hotelBooking')`,
  `CREATE TYPE IF NOT EXISTS reservation_type AS ENUM ('temporary', 'permanent')`,
];

async function runSQL(sql, description) {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) {
      console.log(`⚠️  ${description}: ${error.message}`);
      return false;
    }
    console.log(`✅ ${description}`);
    return true;
  } catch (err) {
    console.log(`⚠️  ${description}: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Setting up Supabase database...\n');
  console.log('Supabase URL:', supabaseUrl);
  console.log('');

  // Test connection
  const { data, error } = await supabase.from('profiles').select('count').limit(1);

  if (error && error.code === '42P01') {
    console.log('ℹ️  Tables do not exist yet. Please run the SQL schema manually.\n');
    console.log('📋 Steps to setup the database:');
    console.log('1. Go to: https://supabase.com/dashboard/project/stbbckupkuxasfthlsys/sql/new');
    console.log('2. Copy the contents of supabase/schema.sql');
    console.log('3. Paste and click "Run"');
    console.log('\nAlternatively, you can use the Supabase CLI or psql client.');
  } else if (error) {
    console.log('Connection error:', error.message);
  } else {
    console.log('✅ Database connection successful!');
    console.log('✅ Tables already exist.');
  }
}

main().catch(console.error);
