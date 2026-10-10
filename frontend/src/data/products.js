export const photo = (id, w = 800) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=85&fm=webp`;
export const hero = photo('photo-1581009146145-b5ef050c2e1e', 1800);
export const products = [
  {
    id: 'essential-tee',
    type: 'T-Shirts',
    name: 'Essential Performance Tee',
    ar: 'تيشيرت الأداء الأساسي',
    price: 38,
    category: 'Gym wear',
    tag: 'BESTSELLER',
    image: photo('photo-1586790170083-2f9ceadc732d'),
    colors: ['Black', 'Stone', 'Olive'],
    sizes: ['S', 'M', 'L', 'XL'],
    description:
      'Your everyday training essential. A relaxed athletic fit with soft, breathable fabric and unrestricted movement.',
  },
  {
    id: 'core-jogger',
    type: 'Sweatpants',
    name: 'Core Tapered Sweatpants',
    ar: 'بنطال كور الرياضي',
    price: 68,
    category: 'Sweatpants',
    tag: 'BESTSELLER',
    image: photo('photo-1552902865-b72c031ac5ea'),
    colors: ['Black', 'Stone'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    description:
      'Built for the warm-up, the wind-down, and everything between. A clean tapered silhouette, adjustable waist, and practical side pockets.',
  },
  {
    id: 'training-tank',
    type: 'Tank Tops',
    name: 'Motion Training Tank',
    ar: 'تانك موشن للتدريب',
    price: 32,
    category: 'Gym wear',
    tag: 'NEW',
    image: photo('photo-1581009146145-b5ef050c2e1e'),
    colors: ['Black', 'Olive'],
    sizes: ['S', 'M', 'L', 'XL'],
    description:
      'A lightweight training tank with an easy fit. Cut for freedom through every rep, with a minimal finish that works beyond the gym.',
  },
  {
    id: 'heavyweight-hoodie',
    type: 'Hoodies',
    name: 'Heavyweight Club Hoodie',
    ar: 'هودي كلوب الثقيل',
    price: 85,
    category: 'Gym wear',
    tag: 'NEW',
    image: photo('photo-1556821840-3a63f95609a7'),
    colors: ['Stone', 'Black'],
    sizes: ['S', 'M', 'L', 'XL'],
    description:
      'A substantial layer for your everyday rotation. Soft brushed interior, a generous hood, and a structured, relaxed silhouette.',
  },
  {
    id: 'relaxed-sweatpants',
    type: 'Sweatpants',
    name: 'Rest Day Sweatpants',
    ar: 'بنطال يوم الراحة',
    price: 72,
    category: 'Sweatpants',
    tag: '',
    image: photo('photo-1473966968600-fa801b869a1a'),
    colors: ['Stone', 'Black', 'Olive'],
    sizes: ['M', 'L', 'XL'],
    description:
      'Made for slowing down. An easy straight-leg fit and soft-touch fabric bring considered comfort to your rest days.',
  },
  {
    id: 'training-short',
    type: 'Shorts',
    name: 'Pace Training Shorts',
    ar: 'شورت بيس للتدريب',
    price: 45,
    category: 'Gym wear',
    tag: '',
    image: photo('photo-1591195853828-11db59a44f6b'),
    colors: ['Black', 'Olive'],
    sizes: [],
    description:
      'A streamlined training short with a comfortable elastic waist and room to move. Currently out of stock.',
  },
];
export const colorValues = { Black: '#242624', Stone: '#c8c4b7', Olive: '#6d735c' };
