import { useState, useRef, useEffect } from "react";
import QRCodeLib from "qrcode";
import { jsPDF } from "jspdf";
import Icon from "@/components/ui/icon";

function QRMatrix({ value, size = 220 }: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    QRCodeLib.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: { dark: "#0D1621", light: "#ffffff" },
      errorCorrectionLevel: "M",
    });
  }, [value, size]);

  return <canvas ref={canvasRef} width={size} height={size} style={{ display: "block" }} />;
}

function formatPhone(val: string) {
  const d = val.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 1) return `+7`;
  if (d.length <= 4) return `+7 (${d.slice(1)}`;
  if (d.length <= 7) return `+7 (${d.slice(1, 4)}) ${d.slice(4)}`;
  if (d.length <= 9) return `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`;
}

function formatCard(val: string) {
  const d = val.replace(/\D/g, "").slice(0, 16);
  return d.replace(/(.{4})/g, "$1 ").trim();
}

function formatAmount(val: string) {
  const num = val.replace(/\D/g, "");
  return num ? Number(num).toLocaleString("ru-RU") : "";
}

export default function Index() {
  const [form, setForm] = useState({ phone: "", card: "", name: "", amount: "", comment: "" });
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const qrRef = useRef<HTMLDivElement>(null);

  const phoneRaw = form.phone.replace(/\D/g, "");
  const cardRaw = form.card.replace(/\s/g, "");

  const validate = () => {
    const e: Record<string, string> = {};
    if (phoneRaw.length !== 11) e.phone = "Введите полный номер телефона";
    if (cardRaw.length !== 16) e.card = "Номер карты должен содержать 16 цифр";
    if (form.name.trim().split(" ").length < 2) e.name = "Укажите имя и фамилию";
    return e;
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setGenerated(true);
  };

  // Формат ГОСТ Р 56042-2014 (ST00012) — стандарт ЦБ РФ для СБП-переводов физлицам
  // Поддерживается Сбербанком, СберKids и другими банками-участниками СБП
  const amountKopecks = form.amount ? String(Number(form.amount) * 100) : "";
  const qrPayload = [
    "ST00012",
    `Name=${form.name.trim()}`,
    `PersonalAcc=${cardRaw}`,
    `BankName=Сбербанк России`,
    `BIC=044525225`,
    `CorrespAcc=30101810400000000225`,
    `PayeeINN=7707083893`,
    `Phone=+7${phoneRaw.slice(1)}`,
    form.amount ? `Sum=${amountKopecks}` : "",
    form.comment ? `Purpose=${form.comment.trim()}` : "",
  ].filter(Boolean).join("|");

  const handleCopy = () => {
    navigator.clipboard.writeText(qrPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getCanvas = () => qrRef.current?.querySelector("canvas") ?? null;
  const baseName = `sbp-qr-${form.name.split(" ")[0] || "payment"}`;

  const handleDownloadPng = () => {
    const canvas = getCanvas();
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${baseName}.png`;
    a.click();
  };

  const handleDownloadWebp = () => {
    const canvas = getCanvas();
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/webp", 0.95);
    a.download = `${baseName}.webp`;
    a.click();
  };

  const handleDownloadPdf = () => {
    const canvas = getCanvas();
    if (!canvas) return;
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const qrSize = 80;
    const x = (pageW - qrSize) / 2;
    const y = 30;

    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("СБП — Платёжный QR-код", pageW / 2, 20, { align: "center" });

    pdf.addImage(imgData, "PNG", x, y, qrSize, qrSize);

    const infoY = y + qrSize + 12;
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(80, 80, 80);

    const lines = [
      ["Получатель:", form.name],
      ["Телефон:", form.phone],
      ["Карта:", form.card],
      ...(form.amount ? [["Сумма:", `${formatAmount(form.amount)} руб.`]] : []),
      ...(form.comment ? [["Назначение:", form.comment]] : []),
      ["Банк:", "Сбербанк России (БИК 044525225)"],
    ];

    lines.forEach(([label, value], i) => {
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(40, 40, 40);
      pdf.text(label, pageW / 2 - 40, infoY + i * 7, { align: "left" });
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(80, 80, 80);
      pdf.text(value, pageW / 2 - 5, infoY + i * 7, { align: "left" });
    });

    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text("Формат: ГОСТ Р 56042-2014 · Сформировано СБПPay", pageW / 2, 280, { align: "center" });

    pdf.save(`${baseName}.pdf`);
  };

  const handleReset = () => {
    setGenerated(false);
    setErrors({});
    setForm({ phone: "", card: "", name: "", amount: "", comment: "" });
  };

  return (
    <div className="min-h-screen bg-[#0D1621] font-sans">
      {/* Header */}
      <header className="border-b border-[rgba(201,168,76,0.15)] bg-[#0D1621]/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-gradient-to-br from-[#C9A84C] to-[#E8C76A] rounded flex items-center justify-center">
              <Icon name="Zap" size={14} className="text-[#0D1621]" />
            </div>
            <span className="font-semibold text-white text-sm tracking-wide">
              СБП<span className="text-[#C9A84C]">Pay</span>
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded bg-[rgba(201,168,76,0.08)] border border-[rgba(201,168,76,0.15)]">
            <Icon name="ShieldCheck" size={12} className="text-[#C9A84C]" />
            <span className="text-xs text-[rgba(180,190,210,0.7)]">Сбербанк СБП</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Title */}
        <div className="mb-10">
          <p className="text-xs text-[#C9A84C] tracking-widest uppercase font-mono mb-2">Генератор платёжных кодов</p>
          <h1 className="text-3xl font-light text-white tracking-tight">
            QR-код для оплаты через <span className="text-[#C9A84C] font-semibold">СБП</span>
          </h1>
          <p className="text-sm text-[rgba(180,190,210,0.6)] mt-2">
            Укажите данные получателя — сформируем QR-код для мгновенного перевода
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8 items-start">
          {/* Form */}
          <div className="lg:col-span-3">
            <div
              className="rounded-xl p-8"
              style={{
                background: "#182030",
                boxShadow: "0 0 0 1px rgba(201,168,76,0.12), 0 8px 40px rgba(0,0,0,0.45)",
              }}
            >
              <form onSubmit={handleGenerate} className="space-y-6">
                {/* ФИО */}
                <div>
                  <label className="block text-[10px] text-[rgba(180,190,210,0.55)] tracking-widest uppercase mb-2">
                    ФИО получателя *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => { setForm({ ...form, name: e.target.value }); setErrors({ ...errors, name: "" }); }}
                    placeholder="Иванов Иван Иванович"
                    className={`w-full rounded px-4 py-3 text-sm bg-[#0D1621] border transition-all outline-none text-white placeholder:text-[rgba(180,190,210,0.25)]
                      ${errors.name ? "border-red-500/60" : "border-[rgba(201,168,76,0.18)] focus:border-[rgba(201,168,76,0.55)]"}`}
                  />
                  {errors.name && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><Icon name="AlertCircle" size={11} />{errors.name}</p>}
                </div>

                {/* Телефон */}
                <div>
                  <label className="block text-[10px] text-[rgba(180,190,210,0.55)] tracking-widest uppercase mb-2">
                    Номер телефона (СБП) *
                  </label>
                  <div className="relative">
                    <Icon name="Phone" size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(201,168,76,0.45)]" />
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => { setForm({ ...form, phone: formatPhone(e.target.value) }); setErrors({ ...errors, phone: "" }); }}
                      placeholder="+7 (900) 000-00-00"
                      className={`w-full rounded pl-10 pr-4 py-3 text-sm font-mono bg-[#0D1621] border transition-all outline-none text-white placeholder:text-[rgba(180,190,210,0.25)]
                        ${errors.phone ? "border-red-500/60" : "border-[rgba(201,168,76,0.18)] focus:border-[rgba(201,168,76,0.55)]"}`}
                    />
                  </div>
                  {errors.phone && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><Icon name="AlertCircle" size={11} />{errors.phone}</p>}
                  <p className="text-xs text-[rgba(180,190,210,0.35)] mt-1">Телефон, привязанный к Сбербанку</p>
                </div>

                {/* Номер карты */}
                <div>
                  <label className="block text-[10px] text-[rgba(180,190,210,0.55)] tracking-widest uppercase mb-2">
                    Номер карты Сбербанка *
                  </label>
                  <div className="relative">
                    <Icon name="CreditCard" size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(201,168,76,0.45)]" />
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.card}
                      onChange={(e) => { setForm({ ...form, card: formatCard(e.target.value) }); setErrors({ ...errors, card: "" }); }}
                      placeholder="0000 0000 0000 0000"
                      className={`w-full rounded pl-10 pr-4 py-3 text-sm font-mono tracking-widest bg-[#0D1621] border transition-all outline-none text-white placeholder:text-[rgba(180,190,210,0.25)]
                        ${errors.card ? "border-red-500/60" : "border-[rgba(201,168,76,0.18)] focus:border-[rgba(201,168,76,0.55)]"}`}
                    />
                    {cardRaw.length === 16 && (
                      <Icon name="CheckCircle" size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-green-400" />
                    )}
                  </div>
                  {errors.card && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><Icon name="AlertCircle" size={11} />{errors.card}</p>}
                </div>

                {/* Сумма (необязательно) */}
                <div>
                  <label className="block text-[10px] text-[rgba(180,190,210,0.55)] tracking-widest uppercase mb-2">
                    Сумма <span className="normal-case tracking-normal">(необязательно)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(201,168,76,0.45)] text-sm font-mono">₽</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/\D/g, "") })}
                      placeholder="0"
                      className="w-full rounded pl-8 pr-4 py-3 text-sm font-mono bg-[#0D1621] border border-[rgba(201,168,76,0.18)] focus:border-[rgba(201,168,76,0.55)] transition-all outline-none text-white placeholder:text-[rgba(180,190,210,0.25)]"
                    />
                    {form.amount && (
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[#C9A84C]">
                        {formatAmount(form.amount)} ₽
                      </span>
                    )}
                  </div>
                </div>

                {/* Назначение платежа */}
                <div>
                  <label className="block text-[10px] text-[rgba(180,190,210,0.55)] tracking-widest uppercase mb-2">
                    Назначение платежа <span className="normal-case tracking-normal">(необязательно)</span>
                  </label>
                  <input
                    type="text"
                    value={form.comment}
                    onChange={(e) => setForm({ ...form, comment: e.target.value })}
                    placeholder="Перевод за услуги / подарок"
                    className="w-full rounded px-4 py-3 text-sm bg-[#0D1621] border border-[rgba(201,168,76,0.18)] focus:border-[rgba(201,168,76,0.55)] transition-all outline-none text-white placeholder:text-[rgba(180,190,210,0.25)]"
                  />
                </div>

                {/* Инфо о формате */}
                <div className="rounded-lg border border-[rgba(201,168,76,0.15)] bg-[rgba(201,168,76,0.05)] p-4">
                  <div className="flex gap-3">
                    <Icon name="Info" size={14} className="text-[#C9A84C] flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs text-[rgba(180,190,210,0.8)] font-medium">Как сканировать QR-код</p>
                      <p className="text-xs text-[rgba(180,190,210,0.5)] leading-relaxed">
                        Откройте <strong className="text-[rgba(180,190,210,0.75)]">Сбербанк Онлайн</strong> или <strong className="text-[rgba(180,190,210,0.75)]">СберKids</strong> → вкладка «Платежи» → иконка QR-кода → наведите камеру
                      </p>
                      <p className="text-xs text-[rgba(180,190,210,0.4)] mt-1">
                        Формат: ГОСТ Р 56042-2014 · БИК 044525225 · Сбербанк России
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    type="submit"
                    className="flex-1 py-3.5 rounded text-sm font-semibold tracking-widest uppercase transition-all flex items-center justify-center gap-2"
                    style={{
                      background: "linear-gradient(135deg, #C9A84C 0%, #E8C76A 100%)",
                      color: "#0D1621",
                    }}
                  >
                    <Icon name="QrCode" size={16} />
                    Сформировать QR
                  </button>
                  {generated && (
                    <button type="button" onClick={handleReset}
                      className="px-4 rounded border border-[rgba(201,168,76,0.2)] text-[rgba(180,190,210,0.5)] hover:text-white hover:border-[rgba(201,168,76,0.4)] transition-all">
                      <Icon name="RotateCcw" size={15} />
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Security strip */}
            <div className="mt-4 flex items-center gap-6 px-1">
              {[
                { icon: "Lock", text: "Данные не передаются" },
                { icon: "Shield", text: "Работает офлайн" },
                { icon: "Eye", text: "Без регистрации" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-1.5">
                  <Icon name={item.icon} fallback="Shield" size={12} className="text-[#C9A84C]" />
                  <span className="text-xs text-[rgba(180,190,210,0.45)]">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* QR panel */}
          <div className="lg:col-span-2">
            <div
              className="rounded-xl p-6 sticky top-20"
              style={{
                background: "#182030",
                boxShadow: "0 0 0 1px rgba(201,168,76,0.12), 0 8px 40px rgba(0,0,0,0.45)",
              }}
            >
              <p className="text-[10px] text-[rgba(180,190,210,0.45)] tracking-widest uppercase mb-5 flex items-center gap-2">
                <Icon name="QrCode" size={11} className="text-[#C9A84C]" />
                Платёжный QR-код
              </p>

              {generated ? (
                <div style={{ animation: "fadeSlideIn 0.4s ease forwards" }}>
                  <style>{`@keyframes fadeSlideIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>

                  {/* QR */}
                  <div ref={qrRef} className="bg-white rounded-xl p-4 mb-5 flex justify-center items-center">
                    <QRMatrix value={qrPayload} size={210} />
                  </div>

                  {/* Данные */}
                  <div className="space-y-2.5 mb-5">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0D1621]/60">
                      <Icon name="User" size={13} className="text-[#C9A84C] flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-[rgba(180,190,210,0.4)] uppercase tracking-wider">Получатель</p>
                        <p className="text-sm text-white font-medium truncate">{form.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0D1621]/60">
                      <Icon name="Phone" size={13} className="text-[#C9A84C] flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-[rgba(180,190,210,0.4)] uppercase tracking-wider">Телефон</p>
                        <p className="text-sm text-white font-mono">{form.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0D1621]/60">
                      <Icon name="CreditCard" size={13} className="text-[#C9A84C] flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-[rgba(180,190,210,0.4)] uppercase tracking-wider">Карта</p>
                        <p className="text-sm text-white font-mono">{form.card}</p>
                      </div>
                    </div>
                    {form.amount && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-[rgba(201,168,76,0.08)] border border-[rgba(201,168,76,0.2)]">
                        <span className="text-xs text-[rgba(180,190,210,0.6)]">Сумма к оплате</span>
                        <span className="text-lg font-semibold text-[#C9A84C]">{formatAmount(form.amount)} ₽</span>
                      </div>
                    )}
                    {form.comment && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0D1621]/60">
                        <Icon name="FileText" size={13} className="text-[#C9A84C] flex-shrink-0" />
                        <div>
                          <p className="text-[10px] text-[rgba(180,190,210,0.4)] uppercase tracking-wider">Назначение</p>
                          <p className="text-sm text-white">{form.comment}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 p-2.5 rounded border border-[rgba(201,168,76,0.15)]">
                      <Icon name="Building2" size={13} className="text-[#C9A84C]" />
                      <div>
                        <span className="text-xs text-white font-medium">Сбербанк России</span>
                        <span className="text-xs text-[rgba(180,190,210,0.4)] ml-2">БИК 044525225</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2">
                    <button onClick={handleCopy}
                      className={`w-full py-2.5 rounded text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 border
                        ${copied ? "border-green-500/40 bg-green-500/10 text-green-400" : "border-[rgba(201,168,76,0.2)] text-[rgba(180,190,210,0.6)] hover:text-white hover:border-[rgba(201,168,76,0.45)]"}`}>
                      <Icon name={copied ? "Check" : "Copy"} size={12} />
                      {copied ? "Скопировано" : "Копировать строку данных"}
                    </button>
                    <p className="text-[10px] text-[rgba(180,190,210,0.35)] uppercase tracking-widest text-center">Скачать QR-код</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "PNG", handler: handleDownloadPng, icon: "Image" },
                        { label: "WebP", handler: handleDownloadWebp, icon: "Image" },
                        { label: "PDF", handler: handleDownloadPdf, icon: "FileText" },
                      ].map(({ label, handler, icon }) => (
                        <button key={label} onClick={handler}
                          className="py-2.5 rounded text-xs font-semibold tracking-wider uppercase transition-all flex flex-col items-center justify-center gap-1"
                          style={{ background: "linear-gradient(135deg,#C9A84C,#E8C76A)", color: "#0D1621" }}>
                          <Icon name={icon} fallback="Download" size={14} />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-14 flex flex-col items-center text-center">
                  <div className="w-20 h-20 rounded-xl border-2 border-dashed border-[rgba(201,168,76,0.18)] flex items-center justify-center mb-4">
                    <Icon name="QrCode" size={34} className="text-[rgba(201,168,76,0.25)]" />
                  </div>
                  <p className="text-sm text-[rgba(180,190,210,0.4)] leading-relaxed">
                    Заполните данные<br />и нажмите «Сформировать QR»
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info block */}
        <div className="mt-12 rounded-xl border border-[rgba(201,168,76,0.1)] bg-[#182030]/50 p-6">
          <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
            <Icon name="Info" size={14} className="text-[#C9A84C]" />
            Как использовать QR-код
          </h3>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { step: "01", text: "Откройте приложение Сбербанк и выберите «Оплатить по QR»" },
              { step: "02", text: "Наведите камеру на сгенерированный QR-код" },
              { step: "03", text: "Подтвердите сумму и переведите деньги получателю" },
            ].map((s) => (
              <div key={s.step} className="flex gap-4 items-start">
                <span className="text-2xl font-mono font-bold text-[rgba(201,168,76,0.2)] leading-none flex-shrink-0">{s.step}</span>
                <p className="text-xs text-[rgba(180,190,210,0.5)] leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}