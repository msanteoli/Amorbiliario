// M11 — O nonce do state do Google só pode ser usado uma vez: índice único parcial em audit_log
// (reason) para action = 'google_state_usado'. Regras de acesso não mudam.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('audit_log')
    col.addIndex('idx_audit_google_state_used', true, 'reason', "action = 'google_state_usado'")
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('audit_log')
    col.removeIndex('idx_audit_google_state_used')
    app.save(col)
  },
)
