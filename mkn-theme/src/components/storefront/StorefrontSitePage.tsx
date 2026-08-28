"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  Award,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Quote,
  Star,
  Users,
} from "lucide-react";
import { defaultProcessSteps, type ToggleablePageId } from "@/lib/mken/pages";
import { useStorefront, type StorefrontServiceOption } from "@/components/storefront/StorefrontFrame";

function SectionTitle({ title, intro }: { title: string; intro?: string }) {
  return (
    <div className="text-center space-y-3 max-w-2xl mx-auto">
      <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-100">{title}</h2>
      {intro ? <p className="text-sm text-slate-400 leading-relaxed">{intro}</p> : null}
    </div>
  );
}

function ServiceCard({
  srv,
  accentColor,
  showPrice,
  detailsHref,
  onBook,
}: {
  srv: StorefrontServiceOption;
  accentColor: string;
  showPrice: boolean;
  detailsHref?: string;
  onBook: () => void;
}) {
  return (
    <div className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 rounded-3xl overflow-hidden transition-all flex flex-col justify-between group shadow-xl">
      <div>
        <div className="relative h-48 overflow-hidden">
          {srv.image ? (
            <img src={srv.image} alt={srv.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full bg-slate-800" />
          )}
          <div className="absolute top-3 right-3 bg-slate-950/80 px-3 py-1 rounded-full text-xs font-bold text-amber-300 border border-amber-500/30">
            {srv.badge}
          </div>
        </div>
        <div className="p-6 space-y-3 text-right">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-extrabold text-slate-100">{srv.name}</h3>
            {showPrice ? <span className="text-sm font-black text-amber-400">{srv.price}</span> : null}
          </div>
          {srv.description ? <p className="text-xs text-slate-400 leading-relaxed">{srv.description}</p> : null}
          <ul className="space-y-2 text-xs text-slate-300">
            {srv.features.slice(0, 5).map((feat) => (
              <li key={feat} className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="p-6 pt-0 flex flex-col gap-2">
        <button
          type="button"
          onClick={onBook}
          className="w-full py-3 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2"
          style={{ backgroundColor: accentColor }}
        >
          <CalendarCheck className="w-4 h-4" />
          احجز هذه الخدمة الآن
        </button>
        {detailsHref ? (
          <Link href={detailsHref as Route} className="w-full py-2 text-center text-xs font-bold text-slate-300 hover:text-white">
            التفاصيل
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function AboutBody() {
  const { storeInfo, pages, accentColor } = useStorefront();
  const story = pages.about.story || storeInfo.subtitle || storeInfo.tagline;
  return (
    <div className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14 text-right">
      <SectionTitle title={`من نحن — ${storeInfo.name}`} intro={story} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {pages.about.vision ? (
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-2">
            <h3 className="text-lg font-extrabold text-white">الرؤية</h3>
            <p className="text-sm text-slate-300 leading-relaxed">{pages.about.vision}</p>
          </div>
        ) : null}
        {pages.about.mission ? (
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-2">
            <h3 className="text-lg font-extrabold text-white">الرسالة</h3>
            <p className="text-sm text-slate-300 leading-relaxed">{pages.about.mission}</p>
          </div>
        ) : null}
      </div>
      {pages.about.values.length > 0 ? (
        <div className="space-y-6">
          <h3 className="text-xl font-extrabold text-white">قيمنا</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {pages.about.values.map((item) => (
              <div key={item.title} className="p-5 rounded-2xl border border-slate-800 bg-slate-900/70">
                <p className="text-sm font-extrabold text-amber-300">{item.title}</p>
                {item.text ? <p className="text-xs text-slate-400 mt-2 leading-relaxed">{item.text}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {pages.about.team.length > 0 ? (
        <div className="space-y-6">
          <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Users className="w-5 h-5" style={{ color: accentColor }} />
            فريق العمل
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {pages.about.team.map((person) => (
              <div key={person.name} className="p-4 rounded-2xl border border-slate-800 bg-slate-900/70 text-center">
                {person.image ? (
                  <img src={person.image} alt={person.name} className="w-20 h-20 object-cover rounded-full mx-auto mb-3" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-slate-800 mx-auto mb-3" />
                )}
                <p className="text-sm font-bold text-white">{person.name}</p>
                <p className="text-[11px] text-slate-400">{person.role}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {pages.about.credentials.length > 0 ? (
        <div className="space-y-6">
          <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            الاعتمادات والجوائز
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pages.about.credentials.map((item) => (
              <div key={item.title} className="p-5 rounded-2xl border border-slate-800 bg-slate-900/70">
                <p className="text-sm font-extrabold text-white">{item.title}</p>
                {item.text ? <p className="text-xs text-slate-400 mt-2">{item.text}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ServicesBody() {
  const { pages, appearance, currentServices, accentColor, openBooking, servicesNavLabel } = useStorefront();
  const heading = appearance?.interfaceCopy?.servicesHeading || servicesNavLabel;
  const intro = appearance?.interfaceCopy?.servicesIntro || "اختر الخدمة المناسبة واطّلع على التفاصيل والفوائد.";
  const steps = pages.services.processSteps.length ? pages.services.processSteps : defaultProcessSteps();
  return (
    <div className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      <SectionTitle title={heading} intro={intro} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {currentServices.map((srv) => (
          <ServiceCard
            key={srv.id}
            srv={srv}
            accentColor={accentColor}
            showPrice={pages.services.showPrices}
            onBook={() => openBooking(srv)}
          />
        ))}
      </div>
      <div className="space-y-6">
        <h3 className="text-xl font-extrabold text-white text-center">آلية العمل</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {steps.map((step, index) => (
            <div key={`${step.title}-${index}`} className="p-6 rounded-3xl border border-slate-800 bg-slate-900/80 text-right">
              <span className="text-amber-400 font-black text-lg">{index + 1}</span>
              <h4 className="text-sm font-extrabold text-white mt-2">{step.title}</h4>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">{step.text}</p>
            </div>
          ))}
        </div>
      </div>
      {appearance?.interfaceCopy?.servicesFooter ? (
        <p className="text-center text-sm text-slate-400 max-w-2xl mx-auto">{appearance.interfaceCopy.servicesFooter}</p>
      ) : null}
    </div>
  );
}

function WorkBody() {
  const { pages, storeInfo } = useStorefront();
  const empty = !pages.work.gallery.length && !pages.work.cases.length && !pages.work.testimonials.length;
  return (
    <div className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      <SectionTitle title={`أعمال ${storeInfo.name}`} intro="نماذج حقيقية وقصص نجاح من عملائنا." />
      {empty ? (
        <p className="text-center text-sm text-slate-400">سيتم عرض معرض الأعمال ودراسات الحالة هنا بعد إضافتها من لوحة المحتوى.</p>
      ) : null}
      {pages.work.gallery.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {pages.work.gallery.map((item) => (
            <figure key={item.image} className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-900">
              <img src={item.image} alt={item.caption || storeInfo.name} className="w-full h-44 object-cover" />
              {item.caption ? <figcaption className="p-3 text-xs text-slate-300">{item.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
      ) : null}
      {pages.work.cases.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pages.work.cases.map((item) => (
            <article key={item.title} className="p-6 rounded-3xl border border-slate-800 bg-slate-900/80 text-right space-y-2">
              <h3 className="text-lg font-extrabold text-white">{item.title}</h3>
              {item.challenge ? <p className="text-xs text-slate-400"><strong className="text-slate-200">التحدي: </strong>{item.challenge}</p> : null}
              {item.solution ? <p className="text-xs text-slate-400"><strong className="text-slate-200">الحل: </strong>{item.solution}</p> : null}
              {item.result ? <p className="text-xs text-emerald-300"><strong>النتيجة: </strong>{item.result}</p> : null}
            </article>
          ))}
        </div>
      ) : null}
      {pages.work.testimonials.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pages.work.testimonials.map((item) => (
            <blockquote key={`${item.name}-${item.text.slice(0, 12)}`} className="p-6 rounded-3xl border border-slate-800 bg-slate-900/80 text-right">
              <Quote className="w-5 h-5 text-amber-400 mb-2" />
              <p className="text-sm text-slate-200 leading-relaxed">{item.text}</p>
              <footer className="mt-3 text-xs text-slate-400 flex items-center gap-2">
                <span>{item.name}</span>
                {item.rating ? (
                  <span className="flex items-center gap-1 text-amber-300">
                    <Star className="w-3 h-3 fill-amber-400" />
                    {item.rating}
                  </span>
                ) : null}
              </footer>
            </blockquote>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ContactBody() {
  const { storeInfo, pages, contactExtras, accentColor } = useStorefront();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  const hours =
    pages.contact.hoursNote ||
    (contactExtras.hoursStart && contactExtras.hoursEnd
      ? `من ${contactExtras.hoursStart} إلى ${contactExtras.hoursEnd}`
      : "");

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const body = encodeURIComponent(
      `طلب تواصل مع ${storeInfo.name}:\n• الاسم: ${name}\n• الجوال: ${phone}\n• البريد: ${email}\n• الرسالة: ${message}`
    );
    window.open(`https://wa.me/${storeInfo.whatsapp}?text=${body}`, "_blank");
  };

  const map = pages.contact.mapEnabled ? contactExtras.map : null;

  return (
    <div className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 text-right">
      <SectionTitle title="اتصل بنا" intro="يسعدنا تواصلك عبر النموذج أو واتساب أو بيانات الاتصال المباشرة." />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {pages.contact.formEnabled ? (
          <form onSubmit={send} className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
            <h3 className="text-lg font-extrabold text-white">نموذج التواصل</h3>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="البريد الإلكتروني" className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm" />
            <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="رقم الهاتف" className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm" />
            <textarea required rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="الرسالة" className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm" />
            <button type="submit" className="w-full py-3 text-slate-950 font-extrabold rounded-xl" style={{ backgroundColor: accentColor }}>
              إرسال عبر واتساب
            </button>
          </form>
        ) : (
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 text-sm text-slate-400">
            النموذج غير مفعّل. استخدم أرقام التواصل أو واتساب.
          </div>
        )}
        <div className="space-y-4">
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3 text-sm text-slate-300">
            <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-amber-400" />{storeInfo.location}</p>
            {storeInfo.phone ? <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-emerald-400" /><span dir="ltr">{storeInfo.phone}</span></p> : null}
            {storeInfo.whatsapp ? (
              <a className="flex items-center gap-2 text-emerald-300" href={`https://wa.me/${storeInfo.whatsapp}`} target="_blank" rel="noreferrer">
                <MessageCircle className="w-4 h-4" /> محادثة فورية عبر واتساب
              </a>
            ) : null}
            {contactExtras.emails.map((row) => (
              <p key={row.id} className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-sky-400" />
                <a href={`mailto:${row.value}`}>{row.name}: {row.value}</a>
              </p>
            ))}
            {hours ? (
              <p className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                ساعات العمل: {hours}
              </p>
            ) : null}
            {contactExtras.social.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-2">
                {contactExtras.social.map((row) => (
                  <a key={row.id} href={row.url} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-full bg-slate-800 text-xs">
                    {row.name}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
          {map ? (
            <iframe
              title="موقع المنشأة"
              className="w-full h-64 rounded-3xl border border-slate-800"
              src={`https://maps.google.com/maps?q=${map.lat},${map.lng}&z=15&output=embed`}
              loading="lazy"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function StorefrontSitePage({ page }: { page: ToggleablePageId }) {
  if (page === "about") return <AboutBody />;
  if (page === "services") return <ServicesBody />;
  if (page === "work") return <WorkBody />;
  return <ContactBody />;
}

export { ServiceCard };
