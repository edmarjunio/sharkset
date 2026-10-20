$ErrorActionPreference = 'Stop'
$projectId = 'sharkset-70de4'
$env:CLOUDSDK_CORE_PROJECT = $projectId

function Invoke-CheckedGcloud {
  param([string[]]$Arguments)
  $output = & gcloud @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Consulta de metadados falhou: gcloud $($Arguments[0]) $($Arguments[1]). Confira o erro acima. Nenhum valor de secret foi solicitado." }
  return $output
}

$activeProject = Invoke-CheckedGcloud -Arguments @('config', 'get-value', 'project')
Write-Output "Projeto ativo no CLI: $activeProject"
if ($activeProject -ne $projectId) { Write-Warning "CLI aponta para outro projeto. Todas as consultas seguintes usam explicitamente $projectId; a configuração global não será alterada." }
$metadata = (Invoke-CheckedGcloud -Arguments @('projects', 'describe', $projectId, '--format=json(projectId,projectNumber,lifecycleState)')) | ConvertFrom-Json
if ($metadata.projectId -ne $projectId -or $metadata.lifecycleState -ne 'ACTIVE') { throw 'O projeto esperado não foi confirmado.' }
Write-Output "Projeto confirmado: $($metadata.projectId)"
$billing = Invoke-CheckedGcloud -Arguments @('billing', 'projects', 'describe', $projectId, '--format=value(billingEnabled)')
Write-Output "Faturamento vinculado: $billing (consulta somente leitura)"
$records = (Invoke-CheckedGcloud -Arguments @('secrets', 'list', "--project=$projectId", '--format=json(name)')) | ConvertFrom-Json
$secretIds = @($records | Where-Object { $_ -and $_.name } | ForEach-Object { ($_.name -split '/')[-1] })
Write-Output "Secrets globais cadastrados (somente nomes): $($secretIds.Count)"
foreach ($secretId in $secretIds) { Write-Output "  $secretId" }
$problems = @()
foreach ($secretName in @('LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'LIVEKIT_URL')) {
  if (-not ($secretIds -ccontains $secretName)) {
    Write-Warning "$secretName não encontrado com esse nome exato nos secrets globais de $projectId."
    $problems += "$secretName ausente"
    continue
  }
  $versions = @(Invoke-CheckedGcloud -Arguments @('secrets', 'versions', 'list', $secretName, "--project=$projectId", '--filter=state=ENABLED', '--format=value(name)'))
  if ($versions.Count -eq 0 -or -not ($versions -join '').Trim()) {
    Write-Warning "$secretName existe, mas não possui versão habilitada."
    $problems += "$secretName sem versão habilitada"
  } else { Write-Output "$secretName existe e possui versão habilitada." }
}
if ($problems.Count -gt 0) {
  Write-Output 'Confira o nome exato, o projeto selecionado no Console e se o cadastro está na aba Secrets regionais.'
  throw "Auditoria incompleta: $($problems -join '; '). Nenhum secret foi criado, alterado ou lido."
}
Write-Output 'Auditoria concluída: os três secrets globais existem e possuem versões habilitadas.'
# Deliberately no secrets versions access, exports, tokens, key files or secret payload reads.
