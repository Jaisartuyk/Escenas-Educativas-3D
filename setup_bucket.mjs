import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://dwilhgtgwykwutdianjd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3aWxoZ3Rnd3lrd3V0ZGlhbmpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYyMzI3MiwiZXhwIjoyMDkwMTk5MjcyfQ.3Rlblx2GHGrzoS3LoWWM1UcPSuGUCVfTMsiUsB0_aVI'
)

async function run() {
  console.log('Creating avatars bucket...')
  const { data, error } = await sb.storage.createBucket('avatars', {
    public: true,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
    fileSizeLimit: 1048576 * 2 // 2MB
  })
  if (error) {
    if (error.message.includes('already exists')) {
       console.log('Bucket already exists.')
    } else {
       console.error('Failed to create bucket:', error)
    }
  } else {
    console.log('Bucket created successfully:', data)
  }
}
run()
