# Setting up email (Mailjet)

The site sends email for three things:

- **Confirming the email address** of new members (they click a link before signing in);
- **"Forgot my password"** (a link to choose a new one, valid one hour);
- **Notifications** that each member chooses in *Paramètres → Notifications par courriel*
  (all off by default).

Any SMTP provider works. These steps are for Mailjet; check its free limits on its site,
they change over time.

## 1. Mailjet account

1. Create a free account on <https://www.mailjet.com>.
2. **Verify the sender:** *Account settings → Senders & domains*. Add the address the site
   will send from (e.g. `no-reply@your-domain.com`) and confirm it.
   For better delivery (not in spam), also add your **domain** and the SPF and DKIM DNS
   records Mailjet shows you.
3. **API keys:** *Account settings → API Key Management*. You get an **API key** and a
   **secret key**: they are the SMTP user name and password.

## 2. The `.env` file

```
SMTP_HOST="in-v3.mailjet.com"
SMTP_PORT="587"
SMTP_USER="your-mailjet-api-key"
SMTP_PASS="your-mailjet-secret-key"
MAIL_FROM="Rendezvous Ludique <no-reply@your-domain.com>"
APP_URL="http://localhost:3000"
```

- `MAIL_FROM` must use the sender verified at step 2.
- `APP_URL` is the site's public address, used in the links of emails. In production:
  `https://your-domain.com` (in `.env.production`).
- Port `587` uses STARTTLS; `465` (TLS) also works.

Restart the server, then in *Console → Paramètres du site → Envoi de courriels*, click
**"M'envoyer un courriel de test"**.

## 3. Options (Console → Paramètres du site)

- **Email confirmation** of new members: on by default (only once email is set up).
- **Minimum age** to sign up: 18 (age of majority in Québec); it can't be set lower.
  The date of birth is only checked at sign-up, never stored.

## Without email

Leave `SMTP_HOST` empty: sign-up works without confirmation, "forgot my password" tells the
member to ask an admin, and notifications stay off.
