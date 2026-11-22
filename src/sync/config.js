/* Cloud sync connection. Both values are PUBLIC by design (they identify your Supabase project; the security comes from the
   database rules and the encryption). Fill them in from Supabase -> Connect (or Project Settings -> API Keys). The key may be the newer publishable key (sb_publishable_...) or the older anon key. Never put the service_role key here.
   While they are empty the app works exactly as before and the "Shared" switch explains that sync is not set up. */
export const SUPABASE_URL='https://pmivascievnpmrbzajaj.supabase.co';
export const SUPABASE_ANON_KEY='sb_publishable_CMVR-SOC85AHztlygXiYUg_JKfAM16V';
