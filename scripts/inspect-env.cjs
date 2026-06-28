const fs = require('fs');
if (fs.existsSync('.env.vercel.production.new.pull')) {
  const content = fs.readFileSync('.env.vercel.production.new.pull', 'utf8');
  const lines = content.split('\n');
  let hasServiceKey = false;
  let hasUrl = false;
  for (const line of lines) {
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
      const val = line.split('=')[1].trim().replace(/['"]/g, '');
      console.log('SUPABASE_SERVICE_ROLE_KEY exists, length:', val.length);
      hasServiceKey = true;
    }
    if (line.startsWith('SUPABASE_URL=')) {
      const val = line.split('=')[1].trim().replace(/['"]/g, '');
      console.log('SUPABASE_URL:', val);
      hasUrl = true;
    }
  }
  if (!hasServiceKey) console.log('SUPABASE_SERVICE_ROLE_KEY NOT FOUND');
  if (!hasUrl) console.log('SUPABASE_URL NOT FOUND');
} else {
  console.log('File does not exist');
}
