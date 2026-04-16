import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Load env file manually
const envPath = path.resolve(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const envs = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) envs[match[1]] = match[2].replace(/["']/g, '').trim()
})

const supaUrl = envs['NEXT_PUBLIC_SUPABASE_URL']
const supaKey = envs['SUPABASE_SERVICE_ROLE_KEY']


const supabase = createClient(supaUrl, supaKey)

async function run() {
  const instId = '52572a7d-ba27-477b-8020-20d882cc30bb'
  
  const { data: inst, error } = await supabase
    .from('institutions')
    .select('settings')
    .eq('id', instId)
    .single()
    
  if (error || !inst) {
    console.error("Error fetching institution:", error)
    process.exit(1)
  }
  
  const settings = inst.settings || {}
  
  console.log("Current keys:", Object.keys(settings))
  
  // They only want to keep 'escuela_matutina' and 'colegio_vespertina'.
  // We need to delete 'horarios_colegio_matutina' and 'horarios_escuela_vespertina'.
  
  delete settings['horarios_colegio_matutina']
  delete settings['horarios_escuela_vespertina']
  
  // also occasionally there's the legacy 'horarios' key which might be confusing. 
  // Let's delete it if it exists just to be clean, unless they specifically need it.
  delete settings['horarios']
  
  console.log("New keys:", Object.keys(settings))
  
  const { error: updateError } = await supabase
    .from('institutions')
    .update({ settings })
    .eq('id', instId)
    
  if (updateError) {
    console.error("Error updating institution:", updateError)
    process.exit(1)
  }
  
  console.log("SUCCESS!")
}

run()
