param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$projectId = 'sharkset-70de4'

# Dry run by default. No deploy, billing, API enablement, key creation, or global Secret Accessor grant.
if ($Apply) {
  & "$PSScriptRoot\audit-livekit-cloud.ps1"
  if (-not $?) { throw 'Auditoria não concluída. Nenhuma alteração IAM será aplicada.' }
}
function Invoke-CheckedIamGcloud {
  param([string[]]$Arguments)
  # Windows PowerShell wraps Python stderr as NativeCommandError.
  # Check the native exit code rather than treating warnings as fatal errors.
  $ErrorActionPreference = 'Continue'
  $output = @(& gcloud @Arguments 2>&1)
  $commandExitCode = $LASTEXITCODE
  if ($commandExitCode -ne 0) {
    throw "Operacao IAM falhou (codigo $commandExitCode): $($output -join [Environment]::NewLine)"
  }
  # Never forward ErrorRecord objects: successful gcloud status messages also
  # arrive on stderr and would otherwise appear as red PowerShell exceptions.
  return @($output | ForEach-Object { $_.ToString() })
}
function Invoke-IamCommand {
  param([string[]]$Arguments)
  if (-not $Apply) { Write-Output ('gcloud ' + ($Arguments -join ' ')); return }
  Invoke-CheckedIamGcloud -Arguments $Arguments
}
foreach ($account in @('livekit-session','livekit-webhook','livekit-directory','livekit-gateway')) {
  if ($Apply) {
    $existingAccount = Invoke-CheckedIamGcloud -Arguments @('iam','service-accounts','list',"--project=$projectId","--filter=email=$account@$projectId.iam.gserviceaccount.com",'--format=value(email)')
    if ($existingAccount -contains "$account@$projectId.iam.gserviceaccount.com") { continue }
  }
  Invoke-IamCommand -Arguments @('iam','service-accounts','create',$account,"--project=$projectId","--display-name=$account")
}
$roles = @(
  @{ Id='livekitSessionRuntime'; Account='livekit-session'; Permissions='datastore.databases.get,datastore.entities.get,datastore.entities.list,datastore.entities.create,datastore.entities.update,firebaseauth.users.get' },
  @{ Id='livekitWebhookRuntime'; Account='livekit-webhook'; Permissions='datastore.databases.get,datastore.entities.get,datastore.entities.create,datastore.entities.update' },
  @{ Id='livekitDirectoryRuntime'; Account='livekit-directory'; Permissions='datastore.databases.get,datastore.entities.get,datastore.entities.list' }
)
foreach ($role in $roles) {
  $operation = 'create'
  if ($Apply) {
    $existingRole = Invoke-CheckedIamGcloud -Arguments @('iam','roles','list',"--project=$projectId","--filter=name=projects/$projectId/roles/$($role.Id)",'--format=value(name)')
    if ($existingRole -contains "projects/$projectId/roles/$($role.Id)") { $operation = 'update' }
  }
  Invoke-IamCommand -Arguments @('iam','roles',$operation,$role.Id,"--project=$projectId","--title=$($role.Id)","--permissions=$($role.Permissions)",'--stage=GA')
  Invoke-IamCommand -Arguments @('projects','add-iam-policy-binding',$projectId,"--member=serviceAccount:$($role.Account)@$projectId.iam.gserviceaccount.com","--role=projects/$projectId/roles/$($role.Id)",'--condition=None')
}
foreach ($secret in @('LIVEKIT_API_KEY','LIVEKIT_API_SECRET','LIVEKIT_URL')) {
  $accounts = if ($secret -eq 'LIVEKIT_URL') { @('livekit-session') } else { @('livekit-session','livekit-webhook') }
  foreach ($account in $accounts) {
    Invoke-IamCommand -Arguments @('secrets','add-iam-policy-binding',$secret,"--project=$projectId","--member=serviceAccount:$account@$projectId.iam.gserviceaccount.com",'--role=roles/secretmanager.secretAccessor')
  }
}
Write-Output 'O gateway recebe apenas invocação nas três funções, declarada em functions/src/index.ts. Ele não recebe permissões de secrets ou Firestore.'
if ($Apply) { Write-Output 'IAM LiveKit concluido: contas, papeis e permissoes dos secrets configurados. Nenhum deploy realizado.' }
