# AuditOps Password Recovery Fix

## Included

- `/forgot-password` — requests a Supabase password recovery email.
- `/auth/reset-password` — consumes the recovery session and lets the user set a new password.
- `/login` — adds "Forgot password?" and shows a successful reset message.
- `middleware.ts` — allows the password recovery routes before authentication.

## Supabase Auth configuration

In Supabase Dashboard:

Authentication -> URL Configuration

Set the production Site URL to your AuditOps production URL.

Add this Redirect URL:

https://audito-safichoudhurys-projects.vercel.app/auth/reset-password

For local development, also add:

http://localhost:3000/auth/reset-password

If your production domain changes, update the production redirect URL accordingly.

## Important

The Supabase password recovery email must redirect to:

/auth/reset-password

The application uses:

supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/auth/reset-password`
})

The reset page consumes the access_token and refresh_token from the URL fragment and calls:

supabase.auth.updateUser({ password })

No password is stored by AuditOps.

## Testing

1. Deploy the changes.
2. Open `/forgot-password`.
3. Enter an existing AuditOps user email.
4. Open the newest Supabase recovery email.
5. Confirm it opens `/auth/reset-password#...`.
6. Set a new password.
7. Click Continue to sign in.
8. Sign in with the new password.

Do not reuse an old recovery link after testing. Recovery links are single-use/temporary.

## If using Supabase Dashboard "Send Password Recovery"

Make sure the project's Auth URL Configuration includes:

https://audito-safichoudhurys-projects.vercel.app/auth/reset-password

The application's `/login` page is not the password-reset destination.


## Build fix

The login page uses `useSearchParams()` and is therefore rendered through a
React `Suspense` boundary. This is required by Next.js 14 during production
static generation.


## Login build compatibility

The login page does not use `useSearchParams()`. It reads the small set of
login query parameters from `window.location.search` in the client component.
This avoids Next.js 14 static-generation Suspense requirements for `/login`.


## v4 build fix

Removed the stale `params` dependency from the `/login` effect after
`useSearchParams()` was removed. The login page now has no `params` variable
or `useSearchParams()` reference.
