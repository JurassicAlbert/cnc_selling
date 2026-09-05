-- `docs/REVIEW-DETAILED.md` SEC-02, the data half.
--
-- The one-time login code was in the email SUBJECT, and `mailer.ts`'s
-- unconfigured implementation logged the resolved subject — so every login
-- code reached the application log in plaintext. The code fix stops the
-- logging and drops the code from the hardcoded default subject, but a
-- DB-stored `EmailTemplate` row OVERRIDES that default, and the seeded row
-- contains `{{otp}}`. Without this, a deployment that has already seeded
-- would keep rendering the code into the subject.
--
-- A subject is what a phone shows on a locked screen and what every mail
-- client puts in a notification preview. Even with the logging fixed, a
-- credential does not belong there.
--
-- Guarded on the old value, deliberately: if an operator has already
-- customised this subject, that is a real editorial decision and this
-- migration must not silently overwrite it. The mailer no longer logs
-- rendered text either way, so such a row is no longer a leak — just a
-- subject the owner chose.

UPDATE "EmailTemplate"
SET "subjectPl" = 'Kod {{otpPurposePl}} — RYT',
    "updatedAt" = now()
WHERE "key" = 'verification-otp'
  AND "subjectPl" = 'Twój kod {{otpPurposePl}}: {{otp}}';
