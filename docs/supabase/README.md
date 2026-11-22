# Supabase set-up (do this when the app asks for it, not before)

1. Create a free account at supabase.com and a new project (region: Mumbai, if offered). Save the database password somewhere safe.
2. Dashboard -> SQL Editor -> New query -> paste all of `schema.sql` -> Run. Running it twice is harmless.
3. Dashboard -> Authentication -> Providers -> Email: keep it enabled, turn **Confirm email ON**. Leave phone/SMS off.
4. Dashboard -> **Connect** (top bar) shows the **Project URL** and the **publishable key** (starts with `sb_publishable_`). The same key is under Settings -> API Keys. Copy those two only. Never the `secret` or `service_role` key. The app accepts the older `anon` key too.
   Never share or paste the `service_role` key anywhere. It bypasses every security rule.
5. **Forgot password needs one email edit.** Dashboard -> Authentication -> Email Templates -> **Reset Password**. Replace the body with something like:
   `<h2>Reset your password</h2><p>Enter this code in the Expenses app:</p><p><b>{{ .Token }}</b></p><p>If you did not ask for this, ignore this email.</p>`
   The app signs the person in with that code (no web page involved) and then sets the new password. Under Authentication -> Providers -> Email you can set the code length (6 to 10 digits; the app accepts 6 to 10) and its expiry. A reset never touches the data keys: the password only signs in.
   Also edit **Confirm signup** the same way if you prefer a code over a link; by default it sends a link.
6. Authentication -> URL Configuration: the site URL and redirect list get filled in when the invite-link step is built.

What the server can and cannot see: it stores ciphertext, opaque item ids, change times, the member list (user ids and sign-in emails) and each
phone's public key. It cannot read amounts, notes, categories, house names or profile names.

To re-check the security rules locally: `npm i --no-save @electric-sql/pglite` then `npm run test:db`.

Tests that need the optional Postgres engine (`npm i --no-save @electric-sql/pglite` first):
- `npm run test:db`    the database's security rules, one check per rule
- `npm run test:sync`  several people and phones syncing end to end (create, invite, edit, delete, conflicts, offline, new phone, recovery key, removing a member)

Known limits (for the security review before any commercial launch):
- Adding a new phone for a family member asks the approver to compare a short code (fingerprint) with the owner of that phone. Without that check a
  compromised server could swap in its own key. Joining by invite link does not have this weakness, because the secret is only in the link.
- Any member can invite others and approve phones. Only the owner can remove members or delete the profile.
- A member who is removed keeps whatever they already copied to their phone; the replaced key only protects what is added from then on.
