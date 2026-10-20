# Dot-source in your terminal: . ./scripts/use-sharkset.ps1
# Uses SHARKSET in this terminal without changing another project's credential configuration.
$env:CLOUDSDK_CORE_PROJECT = 'sharkset-70de4'
$env:GOOGLE_CLOUD_PROJECT = 'sharkset-70de4'
$env:GCLOUD_PROJECT = 'sharkset-70de4'
Write-Output 'Projeto desta sessão: sharkset-70de4'
