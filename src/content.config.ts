import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { compatSchema } from './lib/compat';

const compat = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/compat' }),
  schema: compatSchema,
});

export const collections = { compat };
