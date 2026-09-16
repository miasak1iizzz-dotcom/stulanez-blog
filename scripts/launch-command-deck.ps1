# Launch local "Command Deck" (AI collab board) - stulanez-deck:// handler
$ErrorActionPreference = "Continue"

$repo   = "E:\AI\Lowkey"
$port   = 4321
$url    = "http://localhost:4321/lab/agent-board/"
$logDir = Join-Path $repo ".ai-work"

function Test-Port([int]$p) {
	try {
		$c = New-Object Net.Sockets.TcpClient
		$c.Connect("127.0.0.1", $p)
		$c.Close()
		return $true
	} catch { return $false }
}

# 1) Make sure the board dev server is up on $port
$running = Test-Port $port
if (-not $running) {
	$out = Join-Path $logDir "dev-4321.launch.out.log"
	$err = Join-Path $logDir "dev-4321.launch.err.log"
	$cmd = "call pnpm dev --port $port --host 127.0.0.1"
	Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $cmd -WorkingDirectory $repo -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err
	$deadline = (Get-Date).AddSeconds(90)
	while ((Get-Date) -lt $deadline) {
		if (Test-Port $port) { break }
		Start-Sleep -Seconds 1
	}
}

# 2) Open the browser to the board
Start-Process $url
