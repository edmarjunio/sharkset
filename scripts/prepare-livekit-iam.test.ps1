$ErrorActionPreference = 'Stop'
$source = Get-Content -LiteralPath "$PSScriptRoot\prepare-livekit-iam.ps1" -Raw -Encoding UTF8
# Replace only the cloud audit invocation; every CLI call below is a local fake.
$source = $source.Replace('& "$PSScriptRoot\audit-livekit-cloud.ps1"', '$true')
$scriptUnderTest = [scriptblock]::Create($source)

function global:gcloud {
  $arguments = @($args)
  $global:LASTEXITCODE = 0
  $global:iamTestCalls.Add(($arguments -join ' '))
  if ($arguments -contains 'describe') { throw 'Unexpected describe probe' }
  if ($global:iamTestMode -eq 'success-stderr' -and $arguments -contains 'create') {
    Write-Error 'Created resource (synthetic success on stderr)' -ErrorAction Continue
    $global:LASTEXITCODE = 0
  }
  if ($arguments -contains 'list') {
    if ($global:iamTestMode -eq 'denied') {
      $global:LASTEXITCODE = 1
      Write-Error 'PERMISSION_DENIED synthetic test' -ErrorAction Continue
      return
    }
    if ($global:iamTestMode -eq 'existing') {
      $filter = $arguments | Where-Object { $_ -like '--filter=*' }
      if ($filter -like '--filter=email=*') { return $filter.Substring('--filter=email='.Length) }
      return $filter.Substring('--filter=name='.Length)
    }
  }
}

try {
  foreach ($mode in @('missing','existing','success-stderr','denied')) {
    $global:iamTestMode = $mode
    $global:iamTestCalls = New-Object 'System.Collections.Generic.List[string]'
    $failed = $false
    $results = @()
    try { $results = @(& $scriptUnderTest -Apply) } catch { $failed = $true }
    if ($mode -eq 'denied') {
      if (-not $failed -or $global:iamTestCalls.Count -ne 1) { throw 'Permission failure did not stop before mutation' }
    } else {
      if ($failed) { throw "Unexpected failure: $mode" }
      if (@($results | Where-Object { $_ -is [System.Management.Automation.ErrorRecord] }).Count -gt 0) { throw 'Success output leaked ErrorRecord objects' }
      if (-not ($results -contains 'IAM LiveKit concluido: contas, papeis e permissoes dos secrets configurados. Nenhum deploy realizado.')) { throw 'Completion marker missing' }
      $accountCreates = @($global:iamTestCalls | Where-Object { $_ -like 'iam service-accounts create *' }).Count
      $roleCreates = @($global:iamTestCalls | Where-Object { $_ -like 'iam roles create *' }).Count
      $roleUpdates = @($global:iamTestCalls | Where-Object { $_ -like 'iam roles update *' }).Count
      if ($mode -eq 'missing' -and ($accountCreates -ne 4 -or $roleCreates -ne 3)) { throw 'Missing resources were not created' }
      if ($mode -eq 'existing' -and ($accountCreates -ne 0 -or $roleCreates -ne 0 -or $roleUpdates -ne 3)) { throw 'Existing resources were not reused' }
      if (@($global:iamTestCalls | Where-Object { $_ -like 'secrets add-iam-policy-binding *' }).Count -ne 5) { throw 'Unexpected secret bindings' }
    }
    Write-Output "PASS: $mode"
  }
} finally { Remove-Item Function:\gcloud }
