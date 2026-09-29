import { useState } from "react";
import { ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, Building2, CalendarDays, Check, ChevronRight, CircleHelp, Clock3, Package2, RotateCcw, Wheat } from "lucide-react";

const overviewHref = "/__mockup/preview/supplier-allocation-activity/SupplierActivity";

const dayRecords = [
  {
    date: "2025-05-14",
    products: [
      { name: "Family Loaf", allocated: 42, sold: 28, returned: 5, outstanding: 9, price: "₦850", cleared: false, returnStatus: "5 received" },
      { name: "Milk Bread", allocated: 18, sold: 12, returned: 2, outstanding: 4, price: "₦1,100", cleared: false, returnStatus: "2 received" },
      { name: "Coconut Bread", allocated: 12, sold: 7, returned: 1, outstanding: 4, price: "₦1,300", cleared: false, returnStatus: "1 received" },
    ],
  },
  {
    date: "2025-05-13",
    products: [
      { name: "Family Loaf", allocated: 36, sold: 32, returned: 4, outstanding: 0, price: "₦850", cleared: true, returnStatus: "4 received" },
      { name: "Milk Bread", allocated: 18, sold: 16, returned: 2, outstanding: 0, price: "₦1,100", cleared: true, returnStatus: "2 received" },
      { name: "Coconut Bread", allocated: 12, sold: 10, returned: 2, outstanding: 0, price: "₦1,300", cleared: true, returnStatus: "2 received" },
    ],
  },
  {
    date: "2025-05-12",
    products: [
      { name: "Family Loaf", allocated: 30, sold: 26, returned: 4, outstanding: 0, price: "₦850", cleared: true, returnStatus: "4 received" },
      { name: "Milk Bread", allocated: 12, sold: 10, returned: 2, outstanding: 0, price: "₦1,100", cleared: true, returnStatus: "2 received" },
      { name: "Coconut Bread", allocated: 12, sold: 10, returned: 2, outstanding: 0, price: "₦1,300", cleared: true, returnStatus: "2 received" },
    ],
  },
];

function dateLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function dayOnly(date: string) {
  return date;
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap');
  .ara-day-shell, .ara-day-shell * { box-sizing:border-box; }
  .ara-day-shell { min-height:100dvh; padding:27px 34px 42px; background:#f4f2e9; color:#273a31; font-family:'DM Sans',sans-serif; }
  .ara-day-frame { max-width:1190px; margin:0 auto; }
  .ara-day-topline { display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #d9ddd1; padding-bottom:18px; }
  .ara-day-brand { display:flex; align-items:center; gap:10px; color:#294c3d; }
  .ara-day-brandmark { display:grid; place-items:center; width:31px; height:31px; color:#f8f4e8; background:#294c3d; border-radius:10px 10px 10px 3px; }
  .ara-day-brandname { font-size:11px; letter-spacing:.11em; line-height:1.25; font-weight:700; }
  .ara-day-brandname small { display:block; color:#7c8a7d; font-size:9px; letter-spacing:.16em; font-weight:500; margin-top:2px; }
  .ara-day-topmeta { display:flex; align-items:center; gap:8px; color:#69786b; font-size:11px; }
  .ara-day-dot { width:7px; height:7px; border-radius:50%; background:#6c9b6b; box-shadow:0 0 0 3px #e2eadb; }
  .ara-day-crumb { display:flex; align-items:center; gap:8px; padding:20px 0 18px; color:#8b958a; font-size:11px; }
  .ara-day-crumb a { text-decoration:none; color:#708072; }
  .ara-day-crumb a:hover { color:#294c3d; }
  .ara-back { display:inline-flex; align-items:center; gap:7px; border:0; padding:0; color:#617264; background:none; font:600 11px 'DM Sans',sans-serif; text-decoration:none; cursor:pointer; }
  .ara-back:hover { color:#294c3d; }
  .ara-day-heading { display:flex; justify-content:space-between; align-items:flex-end; gap:20px; margin-bottom:22px; }
  .ara-day-kicker { display:flex; align-items:center; gap:8px; color:#9a7550; font-size:10px; font-weight:700; letter-spacing:.15em; text-transform:uppercase; }
  .ara-day-title { margin:8px 0 6px; color:#25392f; font:600 clamp(29px,4vw,40px)/1.08 'Fraunces',Georgia,serif; letter-spacing:-.035em; }
  .ara-day-subtitle { margin:0; color:#778176; font-size:12px; }
  .ara-date-controls { display:flex; align-items:center; gap:8px; padding:5px; border:1px solid #e1e1d7; border-radius:10px; background:#fbfaf6; }
  .ara-date-arrow { display:grid; place-items:center; width:30px; height:30px; border:1px solid transparent; border-radius:7px; background:transparent; color:#627365; cursor:pointer; transition:background .15s ease; }
  .ara-date-arrow:hover:not(:disabled) { background:#e9eee5; }
  .ara-date-arrow:disabled { color:#c5c8bd; cursor:default; }
  .ara-date-current { min-width:136px; text-align:center; }
  .ara-date-current span { display:block; color:#3c5142; font-size:11px; font-weight:700; }
  .ara-date-current small { display:block; margin-top:3px; color:#92998d; font-size:9px; }
  .ara-day-profile { display:flex; align-items:center; gap:11px; padding:15px 17px; border:1px solid #e1e0d6; border-radius:12px; background:#fbfaf6; margin-bottom:18px; }
  .ara-day-avatar { display:grid; place-items:center; flex:0 0 auto; width:40px; height:40px; color:#365541; background:#dce6d8; border-radius:14px 14px 14px 5px; font:600 17px 'Fraunces',serif; }
  .ara-day-person { flex:1; min-width:0; }
  .ara-day-person strong { display:block; color:#2e4437; font-size:12px; }
  .ara-day-person span { display:flex; align-items:center; gap:5px; margin-top:4px; color:#818a7f; font-size:10px; }
  .ara-day-cleared { display:flex; align-items:center; gap:6px; padding:7px 10px; border:1px solid #e6d4b7; border-radius:20px; color:#946938; background:#fbf3e6; font-size:10px; font-weight:700; white-space:nowrap; }
  .ara-day-cleared.done { color:#537452; border-color:#d6e2d3; background:#edf4eb; }
  .ara-day-stats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; margin-bottom:19px; }
  .ara-day-stat { padding:14px 15px; min-height:89px; border:1px solid #e2e0d5; border-radius:10px; background:#fbfaf6; }
  .ara-day-stat-head { display:flex; justify-content:space-between; align-items:center; color:#778176; font-size:10px; }
  .ara-day-stat-number { margin-top:10px; color:#2d4135; font:600 27px/1 'Fraunces',serif; letter-spacing:-.03em; }
  .ara-day-stat-number small { margin-left:5px; color:#879085; font:500 10px 'DM Sans',sans-serif; letter-spacing:0; }
  .ara-day-stat.alloc { border-left:3px solid #577460; }
  .ara-day-stat.sales { border-left:3px solid #c58853; }
  .ara-day-stat.returns { border-left:3px solid #829588; }
  .ara-day-stat.open { border-left:3px solid #d39a52; }
  .ara-breakdown-head { display:flex; justify-content:space-between; align-items:flex-end; gap:16px; margin:0 0 11px; }
  .ara-breakdown-head h2 { margin:0; color:#304338; font-size:14px; font-weight:700; }
  .ara-breakdown-head p { margin:4px 0 0; color:#858e83; font-size:10px; }
  .ara-unit-note { color:#8b9488; font-size:9px; white-space:nowrap; }
  .ara-products { overflow:hidden; border:1px solid #e0dfd5; border-radius:12px; background:#fbfaf6; }
  .ara-products-head, .ara-product-row { display:grid; grid-template-columns:minmax(165px,1.4fr) repeat(4,minmax(82px,.73fr)) minmax(110px,1fr) minmax(120px,.95fr); align-items:center; column-gap:11px; }
  .ara-products-head { min-height:38px; padding:0 16px; color:#92988d; border-bottom:1px solid #e8e6dc; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.09em; }
  .ara-products-head span:not(:first-child) { text-align:right; }
  .ara-product-row { min-height:76px; padding:10px 16px; border-bottom:1px solid #eeece4; }
  .ara-product-row:last-child { border-bottom:0; }
  .ara-product-name { display:flex; align-items:center; gap:10px; min-width:0; }
  .ara-product-icon { display:grid; place-items:center; flex:0 0 auto; width:31px; height:31px; border-radius:10px; color:#6b7c67; background:#edf0e7; }
  .ara-product-name strong { display:block; color:#34483b; font-size:11px; font-weight:700; }
  .ara-product-name small { display:block; margin-top:4px; color:#93998e; font-size:9px; }
  .ara-product-value { text-align:right; color:#425247; font-size:11px; font-weight:600; }
  .ara-product-value.muted { color:#9b7046; }
  .ara-product-value.return { color:#68826d; }
  .ara-product-value.open { color:#a97539; }
  .ara-product-value small { display:block; margin-top:4px; color:#9ba095; font-size:9px; font-weight:400; }
  .ara-return-tag { display:inline-flex; align-items:center; justify-content:flex-end; gap:5px; color:#628067; font-size:9px; font-weight:600; white-space:nowrap; }
  .ara-allocation-state { justify-self:end; display:inline-flex; align-items:center; gap:5px; padding:6px 8px; border:1px solid #e6d4b7; color:#946938; background:#fbf3e6; border-radius:20px; font-size:9px; font-weight:700; white-space:nowrap; }
  .ara-allocation-state.done { border-color:#d6e2d3; color:#537452; background:#edf4eb; }
  .ara-reconcile { display:grid; grid-template-columns:1fr auto; align-items:center; gap:15px; margin-top:13px; padding:13px 15px; border:1px solid #dedfd4; border-radius:10px; background:#eef0e8; }
  .ara-reconcile-copy { display:flex; align-items:flex-start; gap:9px; color:#69756a; font-size:10px; line-height:1.5; }
  .ara-reconcile-copy strong { color:#415a46; }
  .ara-reconcile-total { display:flex; align-items:center; gap:9px; color:#667366; font-size:9px; white-space:nowrap; }
  .ara-reconcile-total strong { color:#31483a; font-size:11px; }
  .ara-legend { display:flex; flex-wrap:wrap; gap:15px; margin-top:13px; color:#8a9287; font-size:9px; }
  .ara-legend span { display:inline-flex; align-items:center; gap:6px; }
  .ara-legend i { width:7px; height:7px; display:block; border-radius:50%; background:#577460; }
  .ara-legend .sale-dot { background:#c58853; }
  .ara-legend .return-dot { background:#829588; }
  .ara-legend .open-dot { background:#d39a52; }
  .ara-day-footer { display:flex; align-items:center; justify-content:space-between; margin-top:19px; color:#a0a398; font-size:9px; }
  .ara-day-footer b { color:#7a887b; font-weight:600; }
  @media(max-width:800px) {
    .ara-day-shell { padding:18px 15px 30px; }
    .ara-day-topline { padding-bottom:14px; }
    .ara-day-topmeta { font-size:10px; }
    .ara-day-crumb { padding:16px 0; }
    .ara-day-heading { align-items:flex-start; flex-direction:column; margin-bottom:17px; }
    .ara-date-controls { align-self:stretch; justify-content:space-between; }
    .ara-date-current { flex:1; }
    .ara-day-stats { grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
    .ara-day-stat { min-height:80px; padding:12px; }
    .ara-day-stat-number { font-size:24px; }
    .ara-products-head { display:none; }
    .ara-product-row { position:relative; grid-template-columns:minmax(0,1fr) auto auto; gap:8px 11px; padding:12px; min-height:unset; }
    .ara-product-name { grid-column:1 / -1; }
    .ara-product-value { text-align:left; min-width:58px; }
    .ara-product-value:before { display:block; margin-bottom:5px; color:#999f94; font-size:8px; font-weight:500; }
    .ara-product-value.allocated:before { content:'ALLOCATED'; }
    .ara-product-value.muted:before { content:'SUPPLIER SALE'; }
    .ara-product-value.return:before { content:'RETURNED'; }
    .ara-product-value.open:before { content:'WITH SELLER'; }
    .ara-product-value:nth-of-type(5) { display:none; }
    .ara-return-tag { display:none; }
    .ara-allocation-state { grid-column:1 / -1; justify-self:start; }
    .ara-reconcile { grid-template-columns:1fr; }
    .ara-reconcile-total { justify-content:flex-end; }
    .ara-day-footer { align-items:flex-start; flex-direction:column; gap:8px; }
  }
`;

export function SupplierDateActivity() {
  const [selectedDate, setSelectedDate] = useState(() => {
    const queryDate = new URLSearchParams(window.location.search).get("date");
    return dayRecords.some(day => day.date === queryDate) ? queryDate as string : dayRecords[0].date;
  });
  const selectedIndex = dayRecords.findIndex(day => day.date === selectedDate);
  const selected = dayRecords[selectedIndex];
  const totals = selected.products.reduce(
    (sum, product) => ({
      allocated: sum.allocated + product.allocated,
      sold: sum.sold + product.sold,
      returned: sum.returned + product.returned,
      outstanding: sum.outstanding + product.outstanding,
    }),
    { allocated: 0, sold: 0, returned: 0, outstanding: 0 },
  );
  const isCleared = selected.products.every(product => product.cleared);

  return (
    <div className="ara-day-shell">
      <style>{styles}</style>
      <main className="ara-day-frame">
        <header className="ara-day-topline">
          <div className="ara-day-brand">
            <span className="ara-day-brandmark"><Wheat size={16} strokeWidth={1.8} /></span>
            <span className="ara-day-brandname">ARA BAKERY<small>CLOUD OPERATIONS</small></span>
          </div>
          <div className="ara-day-topmeta"><span className="ara-day-dot" /> Ikeja · Field sales</div>
        </header>
        <nav className="ara-day-crumb" aria-label="Breadcrumb">
          <a href={overviewHref}><ArrowLeft size={13} /> Back to supplier</a><ChevronRight size={13} /><span>Amina Yusuf</span><ChevronRight size={13} /><strong>Daily movement</strong>
        </nav>

        <section className="ara-day-heading">
          <div>
            <div className="ara-day-kicker"><CalendarDays size={13} /> Business date movement</div>
            <h1 className="ara-day-title">One day, fully accounted.</h1>
            <p className="ara-day-subtitle">Daily bread issue and return ledger for this field seller.</p>
          </div>
          <div className="ara-date-controls" aria-label="Choose business date">
            <button className="ara-date-arrow" type="button" aria-label="Previous business date" disabled={selectedIndex >= dayRecords.length - 1} onClick={() => setSelectedDate(dayRecords[Math.min(selectedIndex + 1, dayRecords.length - 1)].date)}><ArrowLeft size={15} /></button>
            <div className="ara-date-current"><span>{dateLabel(selected.date)}</span><small>{dayOnly(selected.date)} · Africa/Lagos</small></div>
            <button className="ara-date-arrow" type="button" aria-label="Next business date" disabled={selectedIndex <= 0} onClick={() => setSelectedDate(dayRecords[Math.max(selectedIndex - 1, 0)].date)}><ArrowRight size={15} /></button>
          </div>
        </section>

        <section className="ara-day-profile">
          <div className="ara-day-avatar">AY</div>
          <div className="ara-day-person"><strong>Amina Yusuf</strong><span><Building2 size={11} /> Ikeja Branch <span>·</span> Field seller</span></div>
          <span className={`ara-day-cleared ${isCleared ? "done" : ""}`}>{isCleared ? <Check size={12} /> : <Clock3 size={12} />}{isCleared ? "Allocation cleared" : "Allocation open"}</span>
        </section>

        <section className="ara-day-stats" aria-label="Daily totals">
          <article className="ara-day-stat alloc"><div className="ara-day-stat-head"><span>Allocation</span><Package2 size={14} /></div><div className="ara-day-stat-number">{totals.allocated}<small>loaves issued</small></div></article>
          <article className="ara-day-stat sales"><div className="ara-day-stat-head"><span>Supplier sale</span><ArrowUpRight size={14} /></div><div className="ara-day-stat-number">{totals.sold}<small>reported sold</small></div></article>
          <article className="ara-day-stat returns"><div className="ara-day-stat-head"><span>Returns received</span><RotateCcw size={14} /></div><div className="ara-day-stat-number">{totals.returned}<small>back at branch</small></div></article>
          <article className="ara-day-stat open"><div className="ara-day-stat-head"><span>Still with seller</span><Clock3 size={14} /></div><div className="ara-day-stat-number">{totals.outstanding}<small>not yet accounted</small></div></article>
        </section>

        <section>
          <div className="ara-breakdown-head">
            <div><h2>Bread movement</h2><p>Counts are tracked independently; return receipt and allocation state are not the same thing.</p></div>
            <span className="ara-unit-note">QUANTITIES IN LOAVES</span>
          </div>
          <div className="ara-products">
            <div className="ara-products-head"><span>Bread type</span><span>Allocated</span><span>Supplier sale</span><span>Returned</span><span>With seller</span><span>Return receipt</span><span>Allocation state</span></div>
            {selected.products.map(product => (
              <article className="ara-product-row" key={product.name}>
                <div className="ara-product-name"><span className="ara-product-icon"><Wheat size={15} /></span><span><strong>{product.name}</strong><small>{product.price} list price / loaf</small></span></div>
                <div className="ara-product-value allocated">{product.allocated}<small>issued</small></div>
                <div className="ara-product-value muted">{product.sold}<small>reported sold</small></div>
                <div className="ara-product-value return">{product.returned}<small>received</small></div>
                <div className="ara-product-value open">{product.outstanding}<small>{product.outstanding ? "still out" : "none"}</small></div>
                <div className="ara-return-tag"><ArrowDownLeft size={12} /> {product.returnStatus}</div>
                <span className={`ara-allocation-state ${product.cleared ? "done" : ""}`}>{product.cleared ? <Check size={11} /> : <Clock3 size={11} />}{product.cleared ? "Cleared" : "Open"}</span>
              </article>
            ))}
          </div>
          <div className="ara-reconcile">
            <div className="ara-reconcile-copy"><CircleHelp size={15} /><span><strong>Clearance is not a sales figure.</strong> “Cleared” means the allocation has been reconciled. It may include bread returned unsold; check supplier sale and returns separately.</span></div>
            <div className="ara-reconcile-total"><span>Issued = sold + returned + still with seller</span><strong>{totals.allocated} = {totals.sold} + {totals.returned} + {totals.outstanding}</strong></div>
          </div>
          <div className="ara-legend" aria-label="Movement legend">
            <span><i /> Allocation issued</span><span><i className="sale-dot" /> Supplier sale reported</span><span><i className="return-dot" /> Return received</span><span><i className="open-dot" /> Open balance</span>
          </div>
        </section>
        <footer className="ara-day-footer">
          <span><b>Ara Bakery Cloud</b> · Supplier ledger</span>
          <span>BUSINESS DATE ONLY · AFRICA/LAGOS (UTC+01:00)</span>
        </footer>
      </main>
    </div>
  );
}