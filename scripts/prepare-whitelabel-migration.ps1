param(
  [string]$WhitelabelId = "legacy-default",
  [string]$WhitelabelName = "Clinic DFU"
)

$ErrorActionPreference = "Stop"

Write-Host "Preparacao de migracao para whitelabel" -ForegroundColor Cyan
Write-Host "WhitelabelId: $WhitelabelId"
Write-Host "WhitelabelName: $WhitelabelName"
Write-Host ""

$docs = @(
  "docs\WHITELABEL_MODEL.md",
  "docs\WHITELABEL_MIGRATION.md",
  "docs\WHITELABEL_SECURITY_MATRIX.md"
)

foreach ($doc in $docs) {
  if (-not (Test-Path $doc)) {
    throw "Documento obrigatorio nao encontrado: $doc"
  }
}

Write-Host "Documentos obrigatorios encontrados." -ForegroundColor Green
Write-Host ""
Write-Host "Checklist de execucao manual:"
Write-Host "1. Fazer backup/export do Firestore."
Write-Host "2. Criar whitelabels/$WhitelabelId."
Write-Host "3. Criar memberships em whitelabels/$WhitelabelId/members/{uid}."
Write-Host "4. Copiar colecoes globais para subcolecoes do whitelabel."
Write-Host "5. Validar matriz docs/WHITELABEL_SECURITY_MATRIX.md."
Write-Host "6. Migrar services na Sprint 4 antes de publicar regras bloqueando globais."
Write-Host ""
Write-Host "Este script nao altera dados. Ele apenas valida a presenca da documentacao de migracao." -ForegroundColor Yellow
