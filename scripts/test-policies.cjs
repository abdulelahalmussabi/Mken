const fs = require('fs');
const { createClient } = require('../node_modules/@supabase/supabase-js');

const fileData = JSON.parse(fs.readFileSync('data/tenants/almahrosa.json'));
const client = createClient(fileData.supabase.url, fileData.supabase.key);

async function run() {
  console.log('Querying policies...');
  const testData = {
    ...fileData,
    updatedAt: new Date().toISOString()
  };
  
  console.log('Testing anonymous update on client row...');
  const res = await client
    .from('mken_saas_clients')
    .update({
      config_data: testData,
      updated_at: new Date().toISOString()
    })
    .eq('tenant_slug', 'almahrosa')
    .select();
    
  console.log('Update result:', JSON.stringify(res, null, 2));
}

run().catch(console.error);
