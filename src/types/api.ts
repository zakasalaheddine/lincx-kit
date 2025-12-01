import { z } from 'zod';

// Common patterns
const idPattern = /^[a-z0-9]{6}$/;

// User credentials
export const UserCredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type UserCredentials = z.infer<typeof UserCredentialsSchema>;

// Auth response
export const AuthDataSchema = z.object({
  authToken: z.string().min(1),
});

export const AuthResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: AuthDataSchema.optional(),
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// Template (subset aligned with swagger key properties listed in docs)
export const TemplateSchema = z.object({
  id: z.string().regex(idPattern),
  networkId: z.string().regex(idPattern),
  publisherId: z.string().regex(idPattern),
  creativeAssetGroupId: z.string().regex(idPattern),
  name: z.string().min(1),
  html: z.string().min(1),
  css: z.string().optional(),
  notes: z.record(z.string(), z.any()).optional(),
  version: z.number().int().optional(),
  archived: z.boolean().optional(),
  dateCreated: z.string().optional(),
  dateUpdated: z.string().optional(),
});
export type Template = z.infer<typeof TemplateSchema>;

// Zone (subset aligned with docs)
export const ZoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  siteId: z.string(),
  publisherId: z.string(),
  channelId: z.string(),
  networkId: z.string(),
  templateId: z.string().optional(),
  creativeAssetGroupId: z.string().optional(),
  type: z.string().optional(),
  adFeedCount: z.number().int().optional(),
});
export type Zone = z.infer<typeof ZoneSchema>;

// CreativeAssetGroup (subset aligned with docs)
export const CreativeAssetGroupSchema = z.object({
  id: z.string(),
  networkId: z.string().regex(idPattern),
  name: z.string().min(1),
  fields: z.object({
    properties: z.record(z.string(), z.any()),
    required: z.array(z.string()).optional(),
  }),
});
export type CreativeAssetGroup = z.infer<typeof CreativeAssetGroupSchema>;

// Network (placeholder basic type until full swagger mapping is needed)
export const NetworkSchema = z.object({
  id: z.string().regex(idPattern),
  name: z.string().min(1),
});
export type Network = z.infer<typeof NetworkSchema>;

// Response wrappers (common API patterns)
export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  errorCode: z.string().optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export const SingleTemplateResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ template: TemplateSchema }),
});
export type SingleTemplateResponse = z.infer<typeof SingleTemplateResponseSchema>;

export const GenericListResponseSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ success: z.literal(true), data: z.array(item) });

// Lookup API response (geo location)
export const LookupResponseSchema = z.object({
  ip: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  region: z.string().optional(),
  postal: z.string().optional(),
  regionName: z.string().optional(),
  countryName: z.string().optional(),
});
export type LookupResponse = z.infer<typeof LookupResponseSchema>;

// Ad type (simplified, based on what templates expect)
export const AdSchema = z.record(z.string(), z.any());
export type Ad = z.infer<typeof AdSchema>;

// Ads API response
export const AdsResponseSchema = z.object({
  ads: z.array(AdSchema),
  template: TemplateSchema.optional(),
  remoteFeedSetId: z.string().optional(),
  remoteFeedSetName: z.string().optional(),
  segmentId: z.string().optional(),
  segmentName: z.string().optional(),
  dataAttributesDefault: z.record(z.string(), z.any()).optional(),
});
export type AdsResponse = z.infer<typeof AdsResponseSchema>;


