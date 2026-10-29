<div dir="rtl">

# فحص RLS لقاعدة بيانات تطبيقك: مين يقدر يقرأ بيانات عملائك؟

استعلام واحد **للقراءة فقط** تشغّله في SQL Editor حق مشروعك على Supabase، وبعدها نشرح لك النتيجة **بالعربي، جدول جدول**:
- أي جدول يقدر أي زائر يقرأه أو يعدّل فيه بالمفتاح العام؛
- أي جدول يقرأ فيه كل مستخدم مسجّل بيانات غيره؛
- إيش المقفول، وإيش السليم.

- **ما يقرأ ولا سطر من بياناتك:** يقرأ وصف الجداول فقط، يعني حالة RLS والقواعد والصلاحيات وأسماء الأعمدة.
- **ما يحتاج أي مفتاح ولا كلمة سر،** وما يتصل بقاعدة بياناتك أبد: أنت تشغّل الاستعلام بنفسك.
- **نفس الفحص اللي في المتصفح** على [muhandis.online/tools/rls-check](https://muhandis.online/tools/rls-check)، وكل نتيجة تربطك بدرس يشرح الحل.

## الاستخدام

**1. في المتصفح (أسهل طريقة):** افتح [صفحة الفحص](https://muhandis.online/tools/rls-check)، وانسخ الاستعلام، وشغّله في Supabase، والصق النتيجة. كل شي يصير في متصفحك، وما ينرسل شي لأي مكان.

**2. من سطر الأوامر:**

</div>

```bash
npx muhandis-rls-check query > query.sql           # الاستعلام: شغّله في SQL Editor
npx muhandis-rls-check result.json                 # الصق خانة النتيجة في ملف، وهذا يشرحها
npx muhandis-rls-check result.json --json          # نفس الشرح بصيغة JSON
```

<div dir="rtl">

يرجع `1` لو فيه جدول مكشوف، فتقدر تحطه خطوة في CI.

**3. لمساعد الذكاء الاصطناعي (MCP):** أضفه لـ Claude أو Cursor أو أي أداة تدعم MCP. المساعد يشغّل الاستعلام عن طريق Supabase MCP الرسمي مثلًا، وهذا الخادم يشرح النتيجة. الخادم نفسه ما يحمل أي بيانات اتصال.

</div>

```json
{
  "mcpServers": {
    "muhandis-rls-check": { "command": "npx", "args": ["-y", "muhandis-rls-check", "mcp"] }
  }
}
```

<div dir="rtl">

الأدوات: `rls_check_query` يرجع الاستعلام، و`rls_check_explain` يشرح النتيجة.

## إيش يفحص

| النتيجة | معناها |
|---|---|
| **مكشوف** | RLS مطفي والزائر عنده صلاحية؛ أو قاعدة شرطها `true` على جدول فيه بيانات أشخاص؛ أو view بدون `security_invoker` يقدر الزائر يقرأه؛ أو قاعدة تعديل أو حذف مفتوحة للكل |
| **تأكد منه** | بيانات يقرأها الكل وما فيها أعمدة أشخاص، مثل قائمة منتجات؛ أو إضافة بدون تسجيل دخول، مثل نموذج تواصل |
| **مقفول** | RLS مفعّل بدون قواعد، أو ما فيه صلاحيات: التطبيق ما يوصل له |
| **سليم** | القواعد مربوطة بصاحب السطر عن طريق `auth.uid()` |

هذا فحص للقواعد الظاهرة، مو بديل عن التجربة: بعده جرّب بحسابين إن كل واحد يشوف بياناته فقط. وأداة Security Advisor اللي في لوحة Supabase تنبّه على أشياء قريبة؛ اللي نضيفه هنا هو الشرح بالعربي لصاحب المنتج، وربط كل نتيجة بطريقة حلها.

لقيت جدول مكشوف وتبي مهندس يصلّحه معك؟ [حل مشاكل تطبيقك](https://muhandis.online/services/fix).

</div>

---

## English

A **read-only** query you run in your own Supabase SQL Editor, and an analyser that explains the result table by table: which tables anyone with the public (anon) key can read or change, which any signed-in user can read across users, which are locked, and which are safe. Findings are written in **Arabic for non-technical founders**, with English labels (`exposed`, `check it`, `locked`, `safe`). Each finding links to an Arabic lesson on the fix.

- It reads table descriptions only (RLS state, policies, grants, column names), never a row of data.
- It holds no key and opens no connection. You run the query yourself, or an agent runs it through the official Supabase MCP.
- It is the same analyser as the browser tool at [muhandis.online/tools/rls-check](https://muhandis.online/tools/rls-check), copied byte for byte (`lib/rls-check.js`).

```bash
npx muhandis-rls-check query          # print the query
npx muhandis-rls-check result.json    # explain the result (exit code 1 if a table is exposed)
```

MCP server: `npx -y muhandis-rls-check mcp`. Tools: `rls_check_query` and `rls_check_explain`.

Supabase's own Security Advisor flags related issues (RLS disabled, security-definer views, permissive policies). This tool adds a founder-level explanation in Arabic, and a link to how to fix each finding.

Made by [Muhandis](https://muhandis.online), a software company for businesses in Saudi Arabia and the GCC. MIT licence.
