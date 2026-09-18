# Renombra el token heredado `studio-sidebar` al nombre canonico del sistema de
# diseno (`studio-surface`), definido en tailwind.config.js.
$files = Get-ChildItem -Recurse -File src -Include *.ts,*.tsx
$total = 0
foreach ($file in $files) {
  $text = [System.IO.File]::ReadAllText($file.FullName)
  $before = $text
  $text = $text.Replace('studio-sidebar', 'studio-surface')
  if ($text -ne $before) {
    [System.IO.File]::WriteAllText($file.FullName, $text, (New-Object System.Text.UTF8Encoding $false))
    $total++
    Write-Output "$($file.Name)"
  }
}
Write-Output "ARCHIVOS=$total"
