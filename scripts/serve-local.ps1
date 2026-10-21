param(
  [int]$Port = 4173
)

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "NammaStay is running at http://localhost:$Port/"

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $relativePath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($relativePath)) {
      $relativePath = 'index.html'
    }

    $filePath = [IO.Path]::GetFullPath((Join-Path $root $relativePath.Replace('/', '\')))
    if (-not $filePath.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -or
        -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
      $context.Response.StatusCode = 404
      $content = [Text.Encoding]::UTF8.GetBytes('Not found')
    } else {
      $types = @{
        '.html' = 'text/html; charset=utf-8'
        '.js'   = 'text/javascript; charset=utf-8'
        '.css'  = 'text/css; charset=utf-8'
        '.json' = 'application/json'
        '.png'  = 'image/png'
        '.jpg'  = 'image/jpeg'
        '.jpeg' = 'image/jpeg'
        '.webp' = 'image/webp'
        '.svg'  = 'image/svg+xml'
        '.ico'  = 'image/x-icon'
      }
      $extension = [IO.Path]::GetExtension($filePath).ToLowerInvariant()
      $context.Response.ContentType = if ($types.ContainsKey($extension)) {
        $types[$extension]
      } else {
        'application/octet-stream'
      }
      $content = [IO.File]::ReadAllBytes($filePath)
    }

    $context.Response.ContentLength64 = $content.Length
    $context.Response.OutputStream.Write($content, 0, $content.Length)
    $context.Response.OutputStream.Close()
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
