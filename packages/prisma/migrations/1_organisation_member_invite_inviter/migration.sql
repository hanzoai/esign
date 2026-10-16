-- AlterTable
ALTER TABLE "OrganisationMemberInvite" ADD COLUMN "inviterId" INTEGER CONSTRAINT "OrganisationMemberInvite_inviterId_fkey" REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
