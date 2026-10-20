const $ = (s, el = document) => el.querySelector(s);
const form = $('#form');
const arc = $('#arc'), needle = $('#needle'), thr = $('#thr');
const result = $('#result'), verdict = $('#verdict');
const ARC = 314.16;

const SAMPLES = {
  safe:  { person_age: 38, person_income: 95000, person_home_ownership: 'MORTGAGE', person_emp_length: 9,
           loan_intent: 'HOMEIMPROVEMENT', loan_grade: 'A', loan_amnt: 8000, loan_int_rate: 7.5,
           cb_person_default_on_file: 'N', cb_person_cred_hist_length: 14 },
  risky: { person_age: 22, person_income: 28000, person_home_ownership: 'RENT', person_emp_length: 1,
           loan_intent: 'DEBTCONSOLIDATION', loan_grade: 'E', loan_amnt: 15000, loan_int_rate: 17.8,
           cb_person_default_on_file: 'Y', cb_person_cred_hist_length: 2 },
};

/* ---------- grade chips ---------- */
const gradeBox = $('#grades');
['A','B','C','D','E','F','G'].forEach(g => {
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = g; b.dataset.v = g;
  b.setAttribute('role', 'radio');
  b.onclick = () => setGrade(g);
  gradeBox.appendChild(b);
});
function setGrade(g) {
  form.loan_grade.value = g;
  gradeBox.querySelectorAll('button').forEach(b => {
    const on = b.dataset.v === g;
    b.classList.toggle('on', on); b.setAttribute('aria-checked', on);
  });
}

/* ---------- default toggle ---------- */
const seg = $('#default-seg');
function setDefault(v) {
  form.cb_person_default_on_file.value = v;
  seg.classList.toggle('yes', v === 'Y');
  seg.querySelectorAll('button').forEach(b => {
    const on = b.dataset.v === v;
    b.classList.toggle('on', on); b.setAttribute('aria-checked', on);
  });
}
seg.querySelectorAll('button').forEach(b => b.onclick = () => setDefault(b.dataset.v));

/* ---------- auto loan % of income ---------- */
function updatePercent() {
  const inc = parseFloat(form.person_income.value), amt = parseFloat(form.loan_amnt.value);
  form.loan_percent_income.value = inc > 0 && amt >= 0 ? (amt / inc).toFixed(2) : '';
}
['person_income', 'loan_amnt'].forEach(n => form[n].addEventListener('input', updatePercent));

/* ---------- samples ---------- */
document.querySelectorAll('[data-sample]').forEach(btn => btn.onclick = () => {
  const s = SAMPLES[btn.dataset.sample];
  Object.entries(s).forEach(([k, v]) => { if (form[k]) form[k].value = v; });
  setGrade(s.loan_grade); setDefault(s.cb_person_default_on_file); updatePercent();
});

/* ---------- gauge helpers ---------- */
function setGauge(p, t) {
  arc.style.strokeDashoffset = ARC * (1 - p);
  needle.classList.remove('idle');
  needle.style.transform = `rotate(${p * 180}deg)`;
  if (t != null) thr.style.transform = `rotate(${t * 180}deg)`;
}
function countUp(el, to, ms = 1500) {
  const t0 = performance.now();
  (function tick(now) {
    const k = Math.min((now - t0) / ms, 1), e = 1 - Math.pow(1 - k, 3);
    el.textContent = (to * e).toFixed(1);
    if (k < 1) requestAnimationFrame(tick);
  })(t0);
}

/* ---------- submit ---------- */
function collect() {
  const d = {}, num = ['person_age','person_income','person_emp_length','loan_amnt','loan_int_rate','loan_percent_income','cb_person_cred_hist_length'];
  new FormData(form).forEach((v, k) => d[k] = num.includes(k) ? Number(v) : v);
  d.person_age = Math.round(d.person_age);
  d.cb_person_cred_hist_length = Math.round(d.cb_person_cred_hist_length);
  return d;
}
function showError(msg) {
  const e = $('#error'); e.hidden = false; e.textContent = msg;
  e.style.animation = 'none'; void e.offsetWidth; e.style.animation = '';
}

form.addEventListener('submit', async ev => {
  ev.preventDefault();
  $('#error').hidden = true;
  form.querySelectorAll('input').forEach(i => i.classList.remove('bad'));
  const bad = [...form.querySelectorAll('input[required]')].filter(i => !i.value || !i.checkValidity());
  if (bad.length) { bad.forEach(i => i.classList.add('bad')); return showError('Check the highlighted fields and try again.'); }

  const btn = $('#submit'); btn.classList.add('loading'); btn.disabled = true;
  try {
    const res = await fetch('/predict', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(collect()),
    });
    if (!res.ok) {
      let msg = `Server returned ${res.status}.`;
      if (res.status === 422) {
        const j = await res.json();
        msg = j.detail.map(d => `${d.loc.slice(-1)[0]}: ${d.msg}`).join(' · ');
      }
      throw new Error(msg);
    }
    render(await res.json());
  } catch (err) {
    showError(err.message.includes('Failed to fetch') ? 'Could not reach the API. Check that the server is running.' : err.message);
  } finally {
    btn.classList.remove('loading'); btn.disabled = false;
  }
});

function render(r) {
  const p = r.default_probability, high = r.default_prediction === 1;
  setGauge(p, r.threshold);
  countUp($('#pct'), p * 100);
  result.classList.remove('low', 'high'); result.classList.add(high ? 'high' : 'low');
  verdict.className = 'verdict ' + (high ? 'high' : 'low');
  verdict.textContent = r.result;
  $('#thr-val').textContent = (r.threshold * 100).toFixed(1) + '%';
  $('#raw-val').textContent = p.toFixed(4);
  $('#note').textContent = high
    ? 'The default probability is at or above the cut-off, so this application is flagged for review.'
    : 'The default probability is below the cut-off, so this application looks safe to proceed.';
  if (window.matchMedia('(max-width:900px)').matches) result.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ---------- init ---------- */
setGrade('B'); setDefault('N'); updatePercent();
needle.classList.add('idle');
