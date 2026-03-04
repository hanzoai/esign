import { prisma } from '@hanzo/sign-prisma';

import { ZSiteSettingsSchema } from './schema';

export const getSiteSettings = async () => {
  const settings = await prisma.siteSettings.findMany();

  return ZSiteSettingsSchema.parse(settings);
};
