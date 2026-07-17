import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { compatSchema } from './lib/compat';

const compat = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/compat' }),
  schema: compatSchema,
});

const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string().optional(),
  }),
});

export const collections = { compat, news };
