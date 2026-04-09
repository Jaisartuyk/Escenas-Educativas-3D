import { createClient } from '@supabase/supabase-js'
const sb = createClient('https://dwilhgtgwykwutdianjd.supabase.co', 'sb_publishable_31udCA_K_ctsfWp8_xfpJQ_aS4RZ0xt')

async function run() {
  const { data, error } = await sb.from('profiles').select('*').limit(1)
  console.log(Object.keys(data?.[0] || {}))
}
run()
