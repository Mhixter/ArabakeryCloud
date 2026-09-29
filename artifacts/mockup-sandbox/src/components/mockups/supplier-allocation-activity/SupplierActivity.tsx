import { Building2, CalendarDays, Check, ChevronRight, Clock3, Package2, Wheat } from "lucide-react";

const detailHref = "/__mockup/preview/supplier-allocation-activity/SupplierDateActivity";

const activity = [
  {
    date: "2025-05-14",
    state: "Open allocation",
    allocated: 72,
    sold: 47,
    returned: 8,
    outstanding: 17,
    products: [
      { name: "Family Loaf", allocated: 42, sold: 28, returned: 5, open: true },
      { name: "Milk Bread", allocated: 18, sold: 12, returned: 2, open: true },
      { name: "Coconut Bread", allocated: 12, sold: 7, returned: 1, open: true },
    ],
  },
  {
    date: "2025-05-13",
    state: "Cleared",
    allocated: 66,
    sold: 58,
    returned: 8,
    outstanding: 0,
    products: [
      { name: "Family Loaf", allocated: 36, sold: 32, returned: 4, open: false },
      { name: "Milk Bread", allocated: 18, sold: 16, returned: 2, open: false },
      { name: "Coconut Bread", allocated: 12, sold: 10, returned: 2, open: false },
    ],
  },
  {
    date: "2025-05-12",
    state: "Cleared",
    allocated: 54,
    sold: 46,
    returned: 8,
    outstanding: 0,
    products: [
      { name: "Family Loaf", allocated: 30, sold: 26, returned: 4, open: false },
      { name: "Milk Bread", allocated: 12, sold: 10, returned: 2, open: false },
      { name: "Coconut Bread", allocated: 12, sold: 10, returned: 2, open: false },
    ],
  },
];

function dateLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function shortDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap');
  .ara-shell, .ara-shell * { box-sizing: border-box; }
  .ara-shell { min-height: 100dvh; color: #273a31; background: #f4f2e9; font-family: 'DM Sans', sans-serif; padding: 27px 34px 42px; }
  .ara-frame { max-width: 1190px; margin: 0 auto; }
  .ara-topline { display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #d9ddd1; padding: 0 0 18px; }
  .ara-brand { display:flex; align-items:center; gap:10px; color:#294c3d; }
  .ara-brandmark { display:flex; align-items:center; justify-content:center; width:31px; height:31px; border-radius:10px 10px 10px 3px; background:#294c3d; color:#f8f4e8; }
  .ara-brand-name { font-size:11px; letter-spacing:.11em; line-height:1.25; font-weight:700; }
  .ara-brand-name span { display:block; font-size:9px; letter-spacing:.16em; font-weight:500; color:#7c8a7d; margin-top:2px; }
  .ara-top-meta { display:flex; align-items:center; gap:9px; color:#66766a; font-size:11px; }
  .ara-live-dot { width:7px; height:7px; background:#6c9b6b; border-radius:50%; box-shadow:0 0 0 3px #e2eadb; }
  .ara-crumb { display:flex; align-items:center; gap:9px; color:#8a9488; font-size:11px; padding:22px 0 19px; }
  .ara-crumb strong { color:#536357; font-weight:600; }
  .ara-hero { display:flex; justify-content:space-between; align-items:flex-end; gap:22px; margin-bottom:24px; }
  .ara-kicker { display:flex; align-items:center; gap:8px; text-transform:uppercase; letter-spacing:.15em; color:#9a7550; font-size:10px; font-weight:700; }
  .ara-title { margin:8px 0 7px; font-family:'Fraunces', Georgia, serif; font-size:clamp(31px, 4vw, 43px); font-weight:600; letter-spacing:-.035em; line-height:1.05; color:#25392f; }
  .ara-subtitle { margin:0; color:#778176; font-size:13px; line-height:1.55; }
  .ara-date-note { display:flex; align-items:center; gap:8px; padding:9px 12px; color:#5d705f; background:#e9eee5; border:1px solid #d9e2d5; border-radius:9px; font-size:11px; white-space:nowrap; }
  .ara-profile { display:flex; align-items:center; gap:14px; min-width:255px; }
  .ara-avatar { width:48px; height:48px; display:grid; place-items:center; flex:0 0 auto; border-radius:16px 16px 16px 5px; background:#dce6d8; color:#365541; font-family:'Fraunces',serif; font-size:20px; }
  .ara-supplier-name { margin:0 0 5px; font-size:16px; font-weight:700; letter-spacing:-.02em; }
  .ara-location { display:flex; align-items:center; gap:5px; font-size:11px; color:#778176; }
  .ara-active { margin-left:auto; padding:6px 9px; color:#41714f; border:1px solid #cfe0ce; background:#edf4eb; border-radius:20px; font-size:10px; font-weight:700; white-space:nowrap; }
  .ara-metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin:0 0 25px; }
  .ara-metric { position:relative; min-height:108px; overflow:hidden; border:1px solid #e2e0d5; border-radius:12px; background:#fbfaf5; padding:16px 17px 14px; }
  .ara-metric:after { content:''; position:absolute; width:80px; height:80px; right:-29px; top:-29px; border:1px solid #e9e7dd; border-radius:50%; }
  .ara-metric-label { color:#778176; font-size:11px; font-weight:500; }
  .ara-metric-row { display:flex; align-items:baseline; gap:7px; margin-top:8px; }
  .ara-metric-value { color:#2c4035; font-family:'Fraunces',serif; font-size:30px; line-height:1; letter-spacing:-.03em; }
  .ara-metric-unit { color:#849084; font-size:11px; }
  .ara-metric-foot { margin-top:8px; color:#8b948a; font-size:10px; }
  .ara-metric.issued { border-top:3px solid #577460; }
  .ara-metric.sale { border-top:3px solid #c58853; }
  .ara-metric.return { border-top:3px solid #829588; }
  .ara-metric.open { border-top:3px solid #d39a52; }
  .ara-section-head { display:flex; justify-content:space-between; align-items:flex-end; margin:0 0 12px; gap:16px; }
  .ara-section-head h2 { margin:0; font-size:15px; font-weight:700; letter-spacing:-.02em; }
  .ara-section-head p { margin:4px 0 0; color:#858e83; font-size:11px; }
  .ara-history-count { padding:5px 9px; border:1px solid #e1e2d8; border-radius:20px; color:#68766b; font-size:10px; white-space:nowrap; }
  .ara-history { overflow:hidden; border:1px solid #e0dfd5; border-radius:13px; background:#fbfaf6; }
  .ara-history-labels, .ara-history-row { display:grid; grid-template-columns:minmax(145px,1.5fr) repeat(4,minmax(80px,.75fr)) 125px 30px; align-items:center; column-gap:12px; }
  .ara-history-labels { min-height:38px; padding:0 18px; border-bottom:1px solid #e8e6dc; color:#93998e; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.105em; }
  .ara-history-labels span:not(:first-child) { text-align:right; }
  .ara-history-row { min-height:83px; padding:10px 18px; text-decoration:none; color:inherit; border-bottom:1px solid #eeece4; transition:background .18s ease; }
  .ara-history-row:last-child { border-bottom:0; }
  .ara-history-row:hover { background:#f4f5ed; }
  .ara-day { display:flex; align-items:center; gap:11px; min-width:0; }
  .ara-dayicon { display:grid; place-items:center; flex:0 0 auto; width:34px; height:34px; border-radius:11px; background:#f2e8d9; color:#9a724a; }
  .ara-daydate { font-size:12px; font-weight:700; }
  .ara-daymeta { margin-top:4px; color:#92988d; font-size:10px; }
  .ara-cell { text-align:right; color:#3a4b3f; font-size:12px; font-weight:600; }
  .ara-cell small { display:block; margin-top:4px; color:#92998e; font-size:9px; font-weight:400; }
  .ara-cell.sold { color:#9c6438; }
  .ara-cell.returned { color:#66806a; }
  .ara-state { justify-self:end; display:inline-flex; align-items:center; gap:5px; padding:6px 8px; border:1px solid #e6d4b7; background:#fbf3e6; color:#946938; border-radius:20px; font-size:9px; font-weight:700; white-space:nowrap; }
  .ara-state.cleared { border-color:#d6e2d3; background:#edf4eb; color:#537452; }
  .ara-chevron { color:#9da397; }
  .ara-note { display:flex; align-items:flex-start; gap:10px; margin-top:13px; padding:12px 14px; border-radius:9px; background:#e9eee5; color:#637261; font-size:10px; line-height:1.5; }
  .ara-note strong { color:#405b45; }
  .ara-foot { display:flex; align-items:center; justify-content:space-between; color:#a0a398; font-size:9px; margin-top:19px; }
  .ara-foot-code { font-variant-numeric:tabular-nums; letter-spacing:.05em; }
  @media(max-width:760px) {
    .ara-shell { padding:18px 15px 30px; }
    .ara-topline { padding-bottom:14px; }
    .ara-top-meta { font-size:10px; }
    .ara-crumb { padding:17px 0 16px; }
    .ara-hero { align-items:flex-start; flex-direction:column; margin-bottom:18px; }
    .ara-profile { width:100%; min-width:0; }
    .ara-date-note { white-space:normal; }
    .ara-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; margin-bottom:21px; }
    .ara-metric { min-height:97px; padding:13px; }
    .ara-metric-value { font-size:26px; }
    .ara-history-labels { display:none; }
    .ara-history-row { grid-template-columns:minmax(0,1fr) repeat(2, minmax(55px,.55fr)) 25px; gap:8px; min-height:82px; padding:11px 12px; }
    .ara-history-row .ara-cell:nth-child(4), .ara-history-row .ara-cell:nth-child(5), .ara-history-row .ara-state { display:none; }
    .ara-daydate { font-size:11px; }
    .ara-cell { font-size:11px; }
    .ara-foot { align-items:flex-start; gap:9px; flex-direction:column; }
  }
`;

export function SupplierActivity() {
  const totals = activity.reduce(
    (sum, day) => ({
      allocated: sum.allocated + day.allocated,
      sold: sum.sold + day.sold,
      returned: sum.returned + day.returned,
      outstanding: sum.outstanding + day.outstanding,
    }),
    { allocated: 0, sold: 0, returned: 0, outstanding: 0 },
  );

  return (
    <div className="ara-shell">
      <style>{styles}</style>
      <main className="ara-frame">
        <header className="ara-topline">
          <div className="ara-brand">
            <span className="ara-brandmark"><Wheat size={16} strokeWidth={1.8} /></span>
            <span className="ara-brand-name">ARA BAKERY<span>CLOUD OPERATIONS</span></span>
          </div>
          <div className="ara-top-meta"><span className="ara-live-dot" /> Ikeja · Field sales</div>
        </header>

        <nav className="ara-crumb" aria-label="Breadcrumb">
          <span>Operations</span><ChevronRight size={13} /><span>Field sellers</span><ChevronRight size={13} /><strong>Supplier activity</strong>
        </nav>

        <section className="ara-hero">
          <div>
            <div className="ara-kicker"><Package2 size={13} /> Supplier overview</div>
            <h1 className="ara-title">Bread on the move.</h1>
            <p className="ara-subtitle">Issued stock, reported sales and returns — all in one place.</p>
          </div>
          <div className="ara-date-note"><CalendarDays size={14} /> Business dates · Africa/Lagos</div>
        </section>

        <section className="ara-profile" aria-label="Supplier">
          <div className="ara-avatar">AY</div>
          <div>
            <h2 className="ara-supplier-name">Amina Yusuf</h2>
            <div className="ara-location"><Building2 size={12} /> Ikeja Branch <span>·</span> Field seller</div>
          </div>
          <span className="ara-active">Active supplier</span>
        </section>

        <section className="ara-metrics" aria-label="Recent movement totals">
          <article className="ara-metric issued">
            <div className="ara-metric-label">Allocated</div>
            <div className="ara-metric-row"><strong className="ara-metric-value">{totals.allocated}</strong><span className="ara-metric-unit">loaves</span></div>
            <div className="ara-metric-foot">Bread issued to seller · 3 days</div>
          </article>
          <article className="ara-metric sale">
            <div className="ara-metric-label">Supplier sale</div>
            <div className="ara-metric-row"><strong className="ara-metric-value">{totals.sold}</strong><span className="ara-metric-unit">reported sold</span></div>
            <div className="ara-metric-foot">Recorded against issued stock</div>
          </article>
          <article className="ara-metric return">
            <div className="ara-metric-label">Returns received</div>
            <div className="ara-metric-row"><strong className="ara-metric-value">{totals.returned}</strong><span className="ara-metric-unit">loaves</span></div>
            <div className="ara-metric-foot">Physically returned to branch</div>
          </article>
          <article className="ara-metric open">
            <div className="ara-metric-label">Open allocation</div>
            <div className="ara-metric-row"><strong className="ara-metric-value">{totals.outstanding}</strong><span className="ara-metric-unit">still with seller</span></div>
            <div className="ara-metric-foot">Not yet accounted for · latest day</div>
          </article>
        </section>

        <section>
          <div className="ara-section-head">
            <div><h2>Daily movement</h2><p>Choose a business date to see each bread type and its return status.</p></div>
            <span className="ara-history-count">3 business dates</span>
          </div>
          <div className="ara-history">
            <div className="ara-history-labels">
              <span>Business date</span><span>Allocated</span><span>Supplier sale</span><span>Returned</span><span>With seller</span><span>Allocation</span><span />
            </div>
            {activity.map(day => (
              <a key={day.date} href={`${detailHref}?date=${day.date}`} className="ara-history-row" aria-label={`Open movement for ${dateLabel(day.date)}`}>
                <div className="ara-day">
                  <span className="ara-dayicon"><CalendarDays size={15} /></span>
                  <span><span className="ara-daydate">{dateLabel(day.date)}</span><span className="ara-daymeta">{day.products.length} bread types</span></span>
                </div>
                <div className="ara-cell">{day.allocated}<small>loaves issued</small></div>
                <div className="ara-cell sold">{day.sold}<small>reported sold</small></div>
                <div className="ara-cell returned">{day.returned}<small>received</small></div>
                <div className="ara-cell">{day.outstanding}<small>{day.outstanding ? "unaccounted" : "none"}</small></div>
                <span className={`ara-state ${day.state === "Cleared" ? "cleared" : ""}`}>
                  {day.state === "Cleared" ? <Check size={11} /> : <Clock3 size={11} />}{day.state}
                </span>
                <ChevronRight className="ara-chevron" size={16} />
              </a>
            ))}
          </div>
          <div className="ara-note">
            <Check size={14} />
            <span><strong>Cleared means accounted for, not sold out.</strong> A cleared allocation can include bread returned to the branch; sales and returns are shown separately.</span>
          </div>
        </section>
        <footer className="ara-foot">
          <span>Ara Bakery Cloud <span>·</span> Supplier ledger</span>
          <span className="ara-foot-code">BUSINESS CLOCK · AFRICA/LAGOS (UTC+01:00)</span>
        </footer>
      </main>
    </div>
  );
}