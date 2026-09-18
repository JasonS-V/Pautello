# Migra los hex arbitrarios de las clases de Tailwind a los tokens del sistema
# de diseno (studio-*, pastel-*, rampa slate/amber/lime/violet/sky/blue de Tailwind).
$map = [ordered]@{
  # Superficies oscuras
  'dark:hover:bg-[#252a38]' = 'dark:hover:bg-studio-raised'
  'dark:hover:bg-[#282f42]' = 'dark:hover:bg-studio-raised'
  'dark:hover:bg-[#242938]' = 'dark:hover:bg-studio-raised'
  'dark:hover:bg-[#333a52]' = 'dark:hover:bg-studio-raised'
  'dark:hover:bg-[#a8df4b]' = 'dark:hover:bg-lime-400'
  'dark:hover:bg-[#b3a1fc]' = 'dark:hover:bg-violet-300'
  'dark:hover:bg-[#202536]' = 'dark:hover:bg-studio-hover'
  'dark:hover:bg-[#161822]' = 'dark:hover:bg-studio-elevated'
  'dark:hover:bg-[#1a1d28]' = 'dark:hover:bg-studio-elevated'
  'dark:hover:border-[#2c3244]' = 'dark:hover:border-studio-line'
  'dark:focus:bg-[#1c202c]' = 'dark:focus:bg-studio-elevated'
  'dark:bg-[#1a1e28]' = 'dark:bg-studio-elevated'
  'dark:bg-[#1a1d29]' = 'dark:bg-studio-elevated'
  'dark:bg-[#1a1e2b]' = 'dark:bg-studio-elevated'
  'dark:bg-[#1d212f]' = 'dark:bg-studio-elevated'
  'dark:bg-[#1f2432]' = 'dark:bg-studio-elevated'
  'dark:bg-[#1f2433]' = 'dark:bg-studio-elevated'
  'dark:bg-[#181b25]' = 'dark:bg-studio-elevated'
  'dark:bg-[#201d32]' = 'dark:bg-violet-950/50'
  'dark:bg-[#252b3d]' = 'dark:bg-studio-raised'
  'dark:bg-[#2c3246]' = 'dark:bg-studio-raised'
  'dark:bg-[#161a24]' = 'dark:bg-studio-card'
  'dark:bg-[#0c0d12]' = 'dark:bg-studio-bg'
  'dark:bg-[#0f1117]' = 'dark:bg-studio-bg'
  'dark:bg-[#0f111a]' = 'dark:bg-studio-bg'
  'dark:group-hover:bg-[#181c28]' = 'dark:group-hover:bg-studio-raised'
  # Claros
  'bg-[#f1f3f7]' = 'bg-slate-100'
  'bg-[#f8fafc]' = 'bg-slate-50'
  # Bordes
  'dark:border-[#202433]' = 'dark:border-studio-border'
  'dark:border-[#2c3244]' = 'dark:border-studio-line'
  'dark:border-[#262c3e]' = 'dark:border-studio-lineSoft'
  'dark:border-[#382f1d]' = 'dark:border-amber-900/60'
  'border-[#8b5cf6]' = 'border-violet-500'
  'ring-[#8b5cf6]' = 'ring-violet-500'
  # Acentos y texto
  'hover:bg-[#a3e635]' = 'hover:bg-lime-400'
  'hover:bg-[#b0eb4f]' = 'hover:bg-lime-400'
  'hover:bg-[#fcd34d]' = 'hover:bg-amber-300'
  'hover:text-[#d97706]' = 'hover:text-amber-600'
  'dark:text-[#8b5cf6]' = 'dark:text-violet-400'
  'dark:text-[#7dd3fc]' = 'dark:text-sky-300'
  'text-[#8b5cf6]' = 'text-violet-500'
  'dark:fill-[#1a1d28]' = 'dark:fill-studio-elevated'
  'bg-[#93c5fd]' = 'bg-blue-300'
}

$files = Get-ChildItem -Recurse -File src -Include *.ts,*.tsx
$total = 0
foreach ($file in $files) {
  $text = [System.IO.File]::ReadAllText($file.FullName)
  $original = $text
  $counts = @()
  foreach ($key in $map.Keys) {
    $before = $text
    $text = $text.Replace($key, $map[$key])
    if ($text -ne $before) { $counts += $key }
  }
  if ($text -ne $original) {
    [System.IO.File]::WriteAllText($file.FullName, $text, (New-Object System.Text.UTF8Encoding $false))
    $total += $counts.Count
    Write-Output "$($file.Name): $($counts.Count) reemplazos"
  }
}
Write-Output "TOTAL_REEMPLAZOS=$total"
