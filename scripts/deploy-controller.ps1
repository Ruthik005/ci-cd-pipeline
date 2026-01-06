# Deployment Controller Script for CI/CD Pipeline
# Supports Blue-Green and Canary deployment strategies
# Usage: .\deploy-controller.ps1 -Action <action> [-Version <version>] [-Weight <weight>]

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("status", "blue-green-switch", "blue-green-deploy", "canary-deploy", "canary-set-weight", "canary-promote", "canary-rollback", "health-check", "setup-ingress")]
    [string]$Action,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("blue", "green", "stable", "canary")]
    [string]$Version = "",
    
    [Parameter(Mandatory=$false)]
    [ValidateRange(0, 100)]
    [int]$Weight = 10,
    
    [Parameter(Mandatory=$false)]
    [string]$Image = "ruthik005/ci-cd-app:latest",
    
    [Parameter(Mandatory=$false)]
    [string]$Namespace = "ci-cd-app"
)

# Colors for output
function Write-Success { param($Message) Write-Host "✅ $Message" -ForegroundColor Green }
function Write-Error { param($Message) Write-Host "❌ $Message" -ForegroundColor Red }
function Write-Warning { param($Message) Write-Host "⚠️  $Message" -ForegroundColor Yellow }
function Write-Info { param($Message) Write-Host "ℹ️  $Message" -ForegroundColor Cyan }

# Ensure namespace exists
function Ensure-Namespace {
    $exists = kubectl get namespace $Namespace 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Info "Creating namespace $Namespace..."
        kubectl create namespace $Namespace
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Namespace $Namespace created"
        } else {
            Write-Error "Failed to create namespace"
            exit 1
        }
    }
}

# Get current deployment status
function Get-DeploymentStatus {
    Write-Host "`n📊 Deployment Status" -ForegroundColor Magenta
    Write-Host "===================" -ForegroundColor Magenta
    
    # Check Blue-Green status
    Write-Host "`n🔵🟢 Blue-Green Deployments:" -ForegroundColor Cyan
    $blueReplicas = kubectl get deployment ci-cd-app-blue -n $Namespace -o jsonpath='{.spec.replicas}' 2>$null
    $greenReplicas = kubectl get deployment ci-cd-app-green -n $Namespace -o jsonpath='{.spec.replicas}' 2>$null
    
    if ($blueReplicas) {
        $blueReady = kubectl get deployment ci-cd-app-blue -n $Namespace -o jsonpath='{.status.readyReplicas}' 2>$null
        Write-Host "  Blue:  $blueReady/$blueReplicas ready" -ForegroundColor Blue
    }
    if ($greenReplicas) {
        $greenReady = kubectl get deployment ci-cd-app-green -n $Namespace -o jsonpath='{.status.readyReplicas}' 2>$null
        Write-Host "  Green: $greenReady/$greenReplicas ready" -ForegroundColor Green
    }
    
    # Check active version
    $activeVersion = kubectl get service ci-cd-app-bluegreen -n $Namespace -o jsonpath='{.spec.selector.version}' 2>$null
    if ($activeVersion) {
        Write-Host "  Active: $activeVersion" -ForegroundColor Yellow
    }
    
    # Check Canary status
    Write-Host "`n🐤 Canary Deployments:" -ForegroundColor Cyan
    $stableReplicas = kubectl get deployment ci-cd-app-stable -n $Namespace -o jsonpath='{.spec.replicas}' 2>$null
    $canaryReplicas = kubectl get deployment ci-cd-app-canary -n $Namespace -o jsonpath='{.spec.replicas}' 2>$null
    
    if ($stableReplicas) {
        $stableReady = kubectl get deployment ci-cd-app-stable -n $Namespace -o jsonpath='{.status.readyReplicas}' 2>$null
        Write-Host "  Stable: $stableReady/$stableReplicas ready" -ForegroundColor Green
    }
    if ($canaryReplicas) {
        $canaryReady = kubectl get deployment ci-cd-app-canary -n $Namespace -o jsonpath='{.status.readyReplicas}' 2>$null
        Write-Host "  Canary: $canaryReady/$canaryReplicas ready" -ForegroundColor Yellow
    }
    
    # Check canary weight from ingress
    $canaryWeight = kubectl get ingress ci-cd-app-canary -n $Namespace -o jsonpath='{.metadata.annotations.nginx\.ingress\.kubernetes\.io/canary-weight}' 2>$null
    if ($canaryWeight) {
        Write-Host "  Traffic Split: Stable $([int](100-$canaryWeight))% / Canary $canaryWeight%" -ForegroundColor Magenta
    }
    
    Write-Host "`n📦 All Pods:" -ForegroundColor Cyan
    kubectl get pods -n $Namespace -l app=ci-cd-app -o wide
}

# Blue-Green: Switch between blue and green
function Switch-BlueGreen {
    param([string]$TargetVersion)
    
    Write-Info "Switching traffic to $TargetVersion..."
    
    # Get current active version
    $currentVersion = kubectl get service ci-cd-app-bluegreen -n $Namespace -o jsonpath='{.spec.selector.version}' 2>$null
    
    if ($currentVersion -eq $TargetVersion) {
        Write-Warning "Already on $TargetVersion version"
        return
    }
    
    # Scale up target deployment
    Write-Info "Scaling up $TargetVersion deployment..."
    kubectl scale deployment ci-cd-app-$TargetVersion -n $Namespace --replicas=2
    
    # Wait for rollout
    Write-Info "Waiting for $TargetVersion deployment to be ready..."
    kubectl rollout status deployment/ci-cd-app-$TargetVersion -n $Namespace --timeout=120s
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Deployment failed to become ready"
        return
    }
    
    # Switch service selector
    Write-Info "Switching service to $TargetVersion..."
    kubectl patch service ci-cd-app-bluegreen -n $Namespace -p "{`"spec`":{`"selector`":{`"version`":`"$TargetVersion`"}}}"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Traffic switched to $TargetVersion!"
        
        # Scale down previous version
        $prevVersion = if ($TargetVersion -eq "blue") { "green" } else { "blue" }
        Write-Info "Scaling down $prevVersion deployment..."
        kubectl scale deployment ci-cd-app-$prevVersion -n $Namespace --replicas=0
        
        # Update ConfigMap
        $timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
        kubectl patch configmap deployment-status -n $Namespace -p "{`"data`":{`"active-version`":`"$TargetVersion`",`"last-switch-time`":`"$timestamp`"}}" 2>$null
        
        Write-Success "Blue-Green switch completed!"
    } else {
        Write-Error "Failed to switch traffic"
    }
}

# Blue-Green: Deploy new version
function Deploy-BlueGreen {
    param([string]$TargetVersion)
    
    Ensure-Namespace
    
    Write-Info "Deploying $Image to $TargetVersion..."
    
    # Update the deployment image
    kubectl set image deployment/ci-cd-app-$TargetVersion ci-cd-app=$Image -n $Namespace
    
    # Scale up if needed
    kubectl scale deployment ci-cd-app-$TargetVersion -n $Namespace --replicas=2
    
    # Wait for rollout
    Write-Info "Waiting for deployment to complete..."
    kubectl rollout status deployment/ci-cd-app-$TargetVersion -n $Namespace --timeout=120s
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Deployed $Image to $TargetVersion successfully!"
        Write-Info "Run: .\deploy-controller.ps1 -Action blue-green-switch -Version $TargetVersion to switch traffic"
    } else {
        Write-Error "Deployment failed"
    }
}

# Canary: Deploy new canary version
function Deploy-Canary {
    Ensure-Namespace
    
    Write-Info "Deploying canary version with $Image..."
    
    # Update canary deployment image
    kubectl set image deployment/ci-cd-app-canary ci-cd-app=$Image -n $Namespace
    
    # Scale up canary
    kubectl scale deployment ci-cd-app-canary -n $Namespace --replicas=1
    
    # Wait for rollout
    kubectl rollout status deployment/ci-cd-app-canary -n $Namespace --timeout=120s
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Canary deployed with $Image"
        # Set initial canary weight
        Set-CanaryWeight -NewWeight 10
    } else {
        Write-Error "Canary deployment failed"
    }
}

# Canary: Set traffic weight
function Set-CanaryWeight {
    param([int]$NewWeight)
    
    Write-Info "Setting canary traffic weight to $NewWeight%..."
    
    # Update ingress annotation
    kubectl annotate ingress ci-cd-app-canary -n $Namespace nginx.ingress.kubernetes.io/canary-weight="$NewWeight" --overwrite
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Canary weight set to $NewWeight%"
        Write-Host "  Stable: $([int](100-$NewWeight))% | Canary: $NewWeight%" -ForegroundColor Cyan
        
        # Update ConfigMap
        $stage = switch ($NewWeight) {
            10 { "1" }
            25 { "2" }
            50 { "3" }
            100 { "4" }
            default { "1" }
        }
        kubectl patch configmap canary-status -n $Namespace -p "{`"data`":{`"canary-weight`":`"$NewWeight`",`"canary-enabled`":`"true`",`"promotion-stage`":`"$stage`"}}" 2>$null
    } else {
        Write-Error "Failed to set canary weight"
    }
}

# Canary: Promote to next stage
function Promote-Canary {
    $currentWeight = kubectl get ingress ci-cd-app-canary -n $Namespace -o jsonpath='{.metadata.annotations.nginx\.ingress\.kubernetes\.io/canary-weight}' 2>$null
    
    if (-not $currentWeight) { $currentWeight = 0 }
    
    $nextWeight = switch ([int]$currentWeight) {
        0 { 10 }
        10 { 25 }
        25 { 50 }
        50 { 100 }
        100 { 
            Write-Warning "Canary already at 100%. Consider finalizing the deployment."
            return
        }
        default { 10 }
    }
    
    Write-Info "Promoting canary: $currentWeight% -> $nextWeight%"
    Set-CanaryWeight -NewWeight $nextWeight
    
    if ($nextWeight -eq 100) {
        Write-Success "🎉 Canary at 100%! Consider swapping stable with canary image."
    }
}

# Canary: Rollback to stable
function Rollback-Canary {
    Write-Warning "Rolling back canary deployment..."
    
    # Set canary weight to 0
    kubectl annotate ingress ci-cd-app-canary -n $Namespace nginx.ingress.kubernetes.io/canary-weight="0" --overwrite
    
    # Scale down canary
    kubectl scale deployment ci-cd-app-canary -n $Namespace --replicas=0
    
    # Update ConfigMap
    kubectl patch configmap canary-status -n $Namespace -p '{"data":{"canary-weight":"0","canary-enabled":"false","promotion-stage":"0"}}' 2>$null
    
    Write-Success "Canary rolled back. All traffic now goes to stable."
}

# Health check for deployments
function Check-Health {
    Write-Host "`n🏥 Health Check" -ForegroundColor Magenta
    Write-Host "===============" -ForegroundColor Magenta
    
    $pods = kubectl get pods -n $Namespace -l app=ci-cd-app -o jsonpath='{.items[*].metadata.name}' 2>$null
    
    if (-not $pods) {
        Write-Warning "No pods found in namespace $Namespace"
        return
    }
    
    foreach ($pod in $pods.Split(" ")) {
        if ($pod) {
            Write-Host "`nChecking $pod..." -ForegroundColor Cyan
            
            # Check pod status
            $status = kubectl get pod $pod -n $Namespace -o jsonpath='{.status.phase}'
            $ready = kubectl get pod $pod -n $Namespace -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}'
            
            if ($status -eq "Running" -and $ready -eq "True") {
                Write-Success "$pod is healthy (Running, Ready)"
                
                # Try to hit health endpoint
                $healthResult = kubectl exec $pod -n $Namespace -- curl -s http://localhost:3000/health 2>$null
                if ($healthResult) {
                    Write-Host "  Health endpoint: $healthResult" -ForegroundColor Gray
                }
            } else {
                Write-Error "$pod is unhealthy (Status: $status, Ready: $ready)"
            }
        }
    }
}

# Setup NGINX Ingress Controller
function Setup-Ingress {
    Write-Info "Setting up NGINX Ingress Controller..."
    
    # Check if ingress-nginx is already installed
    $ingressNs = kubectl get namespace ingress-nginx 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Warning "NGINX Ingress Controller namespace already exists"
        kubectl get pods -n ingress-nginx
    } else {
        Write-Info "Installing NGINX Ingress Controller..."
        kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml
        
        Write-Info "Waiting for Ingress Controller to be ready..."
        Start-Sleep -Seconds 30
        kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "NGINX Ingress Controller installed successfully!"
        } else {
            Write-Warning "Ingress Controller may still be starting. Check with: kubectl get pods -n ingress-nginx"
        }
    }
}

# Main execution
switch ($Action) {
    "status" { Get-DeploymentStatus }
    "blue-green-switch" { 
        if (-not $Version -or $Version -notin @("blue", "green")) {
            Write-Error "Version must be 'blue' or 'green' for blue-green-switch"
            exit 1
        }
        Switch-BlueGreen -TargetVersion $Version 
    }
    "blue-green-deploy" { 
        if (-not $Version -or $Version -notin @("blue", "green")) {
            Write-Error "Version must be 'blue' or 'green' for blue-green-deploy"
            exit 1
        }
        Deploy-BlueGreen -TargetVersion $Version 
    }
    "canary-deploy" { Deploy-Canary }
    "canary-set-weight" { Set-CanaryWeight -NewWeight $Weight }
    "canary-promote" { Promote-Canary }
    "canary-rollback" { Rollback-Canary }
    "health-check" { Check-Health }
    "setup-ingress" { Setup-Ingress }
}

Write-Host "`n"
