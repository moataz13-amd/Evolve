# رفع صور EVOLVE على Cloudinary

كل أزرار رفع الصور تستخدم نفس المسار: يتم تصغير الصورة في المتصفح، ثم إرسالها إلى وظيفة `cloudinary-media` على Supabase. تتحقق الوظيفة من جلسة المستخدم وصلاحياته، وتوقّع طلب Cloudinary على السيرفر. يُحفظ رابط الصورة في جدول `media` باستخدام صلاحيات المستخدم وRLS.

## المتغيرات

في `backend/.env` فقط:

```dotenv
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

انسخ بيانات حسابك من Cloudinary → Settings → API Keys. لا تضع API Secret في الفرونت أو متغير يبدأ بـVITE_.
عند النشر، أضف رابط موقعك الفعلي إلى `CLOUDINARY_ALLOWED_ORIGINS`، بدون `/` في النهاية. يمكن وضع أكثر من رابط مفصول بفاصلة.

في `frontend/.env`:

```dotenv
VITE_MEDIA_PROVIDER=cloudinary
VITE_CLOUDINARY_FUNCTION_NAME=cloudinary-media
```

متغيرا `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY` الموجودان ضروريان للجلسة والاتصال بوظيفة الباك. الصور القديمة على Supabase أو الروابط الخارجية تظل تعمل.

## تشغيل الربط على المشروع الحقيقي

بعد ملء Cloudinary credentials و`SUPABASE_PROJECT_REF` في `backend/.env`، نفّذ من جذر المشروع:

```sh
npx supabase login
npm run cloudinary:secrets
npm run cloudinary:deploy
```

أمر secrets يرسل متغيرات Cloudinary الأربعة فقط، وليس كلمة مرور الداتابيز أو service role key.
يمكن بدلًا منه إدخالها يدويًا من Supabase → Edge Functions → Secrets، ثم تنفيذ أمر deploy.
الوظيفة لا تحتاج service role key ولا SQL جديد. Supabase يوفر عنوان المشروع وanon key داخل بيئة الوظائف، وتُستخدم جلسة الأدمن للوصول للداتابيز.

أعد تشغيل الفرونت بعد تعديل `.env`:

```sh
npm run dev
```

بعد النشر، اختبر من Media أو صفحة إضافة منتج برفع صورة صغيرة. ستظهر في Cloudinary Media Library تحت `evolve/products` أو `evolve/homepage` أو الفئة المناسبة، ويظهر رابط `res.cloudinary.com` في سجل `media`.

## التطوير المحلي

بعد تشغيل Supabase المحلي وضبط الفرونت على عنوانه ومفتاحه، شغّل `npm run cloudinary:serve` في ترمينال منفصل.
يمكن العودة للرفع القديم على Supabase Storage بتغيير `VITE_MEDIA_PROVIDER=supabase` وإعادة تشغيل الفرونت، دون تغيير الصور المحفوظة.

## الصلاحيات والحذف

الأدمن وsuper_admin وeditor النشط يستطيعون رفع الصور. حذف الصور مقتصر على admin وsuper_admin، والوظيفة ترفض حذف صورة مستخدمة بفضل قيود الداتابيز. عند فشل حفظ سجل الصورة، يتم تنظيف الرفع الجديد من Cloudinary. إذا فشل تنظيف صورة محذوفة، تظهر رسالة لتحديد الإجراء المطلوب في Cloudinary Media Library.

مرجع التنفيذ: [Cloudinary signed uploads](https://cloudinary.com/documentation/authentication_signatures)، و[Supabase Edge Function authentication](https://supabase.com/docs/guides/functions/auth-legacy-jwt).
