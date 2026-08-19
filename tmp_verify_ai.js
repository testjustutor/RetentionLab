const { db } = require('C:\\xampp\\htdocs\\RetentionLab\\database\\db.js');
db.all("SELECT provider_key, label, icon, icon_bg, description, base_url, enabled, default_model, default_temperature, default_max_tokens, model_options, sort_order FROM ai_providers ORDER BY sort_order",
  (err, rows) => {
    if (err) { console.log('ERR:', err.message); process.exit(1); }
    console.log('ai_providers rows:', rows.length);
    rows.forEach(r => console.log(JSON.stringify({ key: r.provider_key, label: r.label, enabled: r.enabled, model: r.default_model, opts: JSON.parse(r.model_options).length, bg: r.icon_bg })));
    process.exit(0);
  }
);
