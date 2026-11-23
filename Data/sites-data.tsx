// Site data for each package
//
// Built from Data/template_site.ts so the two lists never drift apart.
// Each category = the default sites followed by its "(additional)" backups.
import {
  DEFAULT_SOCIAL_SITES,
  DEFAULT_WEB2_SITES,
  DEFAULT_ADDITIONAL_SITES,
  BACKUP_SOCIAL_SITES,
  BACKUP_WEB2_SITES,
  BACKUP_ADDITIONAL_SITES,
} from "./template_site";

const urls = (...lists: { url: string }[][]) =>
  lists.flat().map((s) => s.url);

const ALL_SITES = {
  socialSites: urls(DEFAULT_SOCIAL_SITES, BACKUP_SOCIAL_SITES),
  web2Sites: urls(DEFAULT_WEB2_SITES, BACKUP_WEB2_SITES),
  additionalSites: urls(DEFAULT_ADDITIONAL_SITES, BACKUP_ADDITIONAL_SITES),
};

// The current site list is the same for every package tier.
export const packageSites = {
  DFP90: ALL_SITES,
  DFP120: ALL_SITES,
  DFP180: ALL_SITES,
  DFP240: ALL_SITES,
  DFP270: ALL_SITES,
};
