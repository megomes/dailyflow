-- E9: ICS accounts (a published calendar link, e.g. Outlook without an Entra app). The link is
-- stored AES-GCM sealed in access_token; there is no refresh token.
alter table calendar_accounts drop constraint if exists calendar_accounts_provider_check;
alter table calendar_accounts add constraint calendar_accounts_provider_check check (provider in ('google', 'microsoft', 'ics'));
