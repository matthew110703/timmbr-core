import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePageDto } from './create-page.dto';

describe('CreatePageDto validation', () => {
  it('validates payload with sections', async () => {
    const payload = {
      slug: 'about-us',
      title: 'About Timmbr',
      description: 'Our craftsmanship and heritage story',
      isActive: true,
      sections: [
        {
          type: 'hero',
          title: 'About Us',
          bannerUrl: 'https://cdn.example.com/about.jpg',
        },
        {
          type: 'story',
          heading: 'Our Heritage',
          text: 'Handcrafted teak furniture built to last generations.',
        },
      ],
    };

    const dto = plainToInstance(CreatePageDto, payload);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects duplicate section types', async () => {
    const payload = {
      slug: 'about-us',
      title: 'About Timmbr',
      sections: [
        { type: 'hero', title: 'Hero 1' },
        { type: 'hero', title: 'Hero 2' },
      ],
    };

    const dto = plainToInstance(CreatePageDto, payload);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('sections');
  });

  it('rejects section without type or with empty type', async () => {
    const payload = {
      slug: 'about-us',
      title: 'About Timmbr',
      sections: [{ title: 'Missing Type' }],
    };

    const dto = plainToInstance(CreatePageDto, payload);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('sections');
  });
});
