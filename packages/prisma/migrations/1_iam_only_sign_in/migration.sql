-- Who sent each invitation. NULL for every invitation already standing: those
-- were sent under the old sign-in rules and admit nobody.
ALTER TABLE "OrganisationMemberInvite" ADD COLUMN "inviterId" INTEGER CONSTRAINT "OrganisationMemberInvite_inviterId_fkey" REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Who invited each member. NULL for every membership already standing, for the
-- same reason.
ALTER TABLE "OrganisationMember" ADD COLUMN "invitedById" INTEGER CONSTRAINT "OrganisationMember_invitedById_fkey" REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Every session and API token was issued under the old sign-in rules. People
-- sign in again through Hanzo IAM; integrations mint new tokens.
DELETE FROM "Session";
DELETE FROM "ApiToken";
