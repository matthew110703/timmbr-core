import slugify from 'slugify';

export const generateSlug = (content: string) => {
  return slugify(content, {
    lower: true,
    strict: true,
    trim: true,
  });
};
