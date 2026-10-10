export function getFaqs(isArabic) {
  return [
    [
      isArabic ? 'هل أقدر أشتري فعليًا؟' : 'Can I place a real order?',
      isArabic
        ? 'المتجر تجريبي. تقدر تجرب السلة وإتمام الطلب، لكن مفيش دفع أو شحن فعلي.'
        : 'This is a demo. You can explore the cart and checkout, but payments and deliveries are not processed.',
    ],
    [
      isArabic ? 'هل السلة بتتحفظ؟' : 'Will my bag be saved?',
      isArabic
        ? 'أيوه، السلة والمفضلة والملف والطلبات التجريبية محفوظة محليًا في المتصفح.'
        : 'Yes. Your bag, wishlist, profile, and demo orders are saved locally in this browser.',
    ],
    [
      isArabic ? 'أختار المقاس إزاي؟' : 'How do I choose a size?',
      isArabic
        ? 'استخدم دليل المقاسات التجريبي داخل صفحة المنتج.'
        : 'Use the sample size guide on each product page.',
    ],
    [
      isArabic ? 'هل الصور والألوان نهائية؟' : 'Are the photos and colors final?',
      isArabic
        ? 'الصور والبيانات للتوضيح، وليست كتالوجًا تجاريًا نهائيًا.'
        : 'Photos and product data are illustrative rather than a final commercial catalog.',
    ],
  ];
}
