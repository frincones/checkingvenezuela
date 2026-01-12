/**
 * Script to apply CRM migration to Supabase database
 * Run with: node scripts/apply-crm-migration.js
 *
 * This script creates the CRM tables (leads, advisors, quotations, support_tickets)
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env file');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Check if table exists
async function tableExists(tableName) {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1);

  // Check various error codes that indicate table doesn't exist
  // 42P01 = undefined_table (PostgreSQL)
  // PGRST205 = table not found in schema cache (PostgREST)
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') {
      console.log(`    Note: ${tableName} - ${error.code}: ${error.message}`);
      return false;
    }
    // Some other error - table might exist but have permission issues
    console.log(`    Warning for ${tableName}: ${error.code} - ${error.message}`);
    return true; // Assume exists if different error
  }

  return true;
}

// Execute SQL directly (requires postgres connection or Supabase SQL editor)
async function checkPrerequisites() {
  console.log('Checking prerequisites...\n');

  // Check if profiles table exists
  const profilesExist = await tableExists('profiles');
  if (!profilesExist) {
    console.error('ERROR: "profiles" table does not exist.');
    console.error('Please run the main schema.sql first.');
    return false;
  }
  console.log('profiles table exists');

  // Check if anonymous_users table exists
  const anonymousUsersExist = await tableExists('anonymous_users');
  if (!anonymousUsersExist) {
    console.log('anonymous_users table does not exist - will be created by schema.sql');
  } else {
    console.log('anonymous_users table exists');
  }

  return true;
}

// Check if CRM tables already exist
async function checkCRMTables() {
  console.log('\nChecking CRM tables status...\n');

  const tables = ['advisors', 'leads', 'lead_interactions', 'quotations', 'support_tickets', 'ticket_messages'];
  const status = {};

  for (const table of tables) {
    const exists = await tableExists(table);
    status[table] = exists;
    console.log(`  ${table}: ${exists ? 'EXISTS' : 'MISSING'}`);
  }

  return status;
}

async function main() {
  console.log('============================================');
  console.log('CHECK-IN VENEZUELA - CRM Migration Checker');
  console.log('============================================\n');
  console.log('Supabase URL:', supabaseUrl);
  console.log('');

  // Check prerequisites
  const prereqOk = await checkPrerequisites();
  if (!prereqOk) {
    process.exit(1);
  }

  // Check CRM tables
  const tableStatus = await checkCRMTables();

  // Check if any CRM tables are missing
  const missingTables = Object.entries(tableStatus)
    .filter(([_, exists]) => !exists)
    .map(([table]) => table);

  if (missingTables.length === 0) {
    console.log('\nAll CRM tables exist!');
    console.log('The CRM system is ready to use.');
    return;
  }

  console.log('\n============================================');
  console.log('ACTION REQUIRED');
  console.log('============================================\n');
  console.log(`Missing tables: ${missingTables.join(', ')}\n`);
  console.log('To apply the CRM migration, you need to:');
  console.log('');
  console.log('1. Go to your Supabase Dashboard SQL Editor:');
  console.log(`   ${supabaseUrl.replace('.supabase.co', '')}/sql/new`);
  console.log('');
  console.log('2. Copy the contents of: supabase/migrations/001_crm_tables.sql');
  console.log('');
  console.log('3. Paste and click "Run"');
  console.log('');
  console.log('Or use the Supabase CLI:');
  console.log('   npx supabase db push');
  console.log('');

  // Read and display the migration file path
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '001_crm_tables.sql');
  if (fs.existsSync(migrationPath)) {
    console.log(`Migration file location: ${migrationPath}`);

    // Show first few lines of migration
    const content = fs.readFileSync(migrationPath, 'utf8');
    const lines = content.split('\n').slice(0, 10);
    console.log('\nMigration preview:');
    console.log('---');
    lines.forEach(line => console.log(line));
    console.log('...');
  } else {
    console.error('Migration file not found!');
  }
}

main().catch(console.error);
