import { z } from 'zod';

// Project-level config (root config.json)
export const NetworkTemplateEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

export const NetworkConfigSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  templates: z.array(NetworkTemplateEntrySchema).default([]),
});

export const ProjectConfigSchema = z.object({
  networks: z.record(z.string(), NetworkConfigSchema).default({}),
});
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

// Template-level config (template folder config.json)
export const MockDataConfigSchema = z.object({
  enabled: z.boolean().optional(),
  adsCount: z.number().int().optional().default(3),
  values: z.record(z.string(), z.any()).optional(),
  fieldsOptions: z.record(z.string(), z.array(z.any())).optional(),
});

export const TemplateConfigSchema = z.object({
  templateId: z.string().min(1),
  networkId: z.string().min(1),
  publisherId: z.string().min(1),
  creativeAssetGroupId: z.string().min(1),
  name: z.string().min(1),
  notes: z.record(z.string(), z.any()).optional().default({}),
  creativeAssetGroup: z
    .object({
      id: z.string().min(1),
      name: z.string().min(1),
      fields: z.object({
        properties: z.record(z.string(), z.any()),
        required: z.array(z.string()).optional().default([]),
      }),
    })
    .optional(),
  mockData: MockDataConfigSchema.optional(),
});
export type TemplateConfig = z.infer<typeof TemplateConfigSchema>;

// .auth.json schema
export const AuthTokenSchema = z.object({
  token: z.string().min(1),
  user: z.object({ email: z.string().email() }),
  createdAt: z.string(),
});
export type AuthToken = z.infer<typeof AuthTokenSchema>;


