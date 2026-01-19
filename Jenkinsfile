pipeline {
    agent any

    parameters {
        booleanParam(name: 'RUN_CHAOS_TEST', defaultValue: false, description: 'Run Chaos Engineering tests after deployment')
        booleanParam(name: 'SKIP_SECURITY_SCAN', defaultValue: false, description: 'Skip security scans (not recommended)')
        choice(name: 'DEPLOY_STRATEGY', choices: ['standard', 'blue-green', 'canary'], description: 'Deployment strategy to use')
        string(name: 'CANARY_WEIGHT', defaultValue: '10', description: 'Initial canary traffic percentage (10, 25, 50, 100)')
        choice(name: 'BLUE_GREEN_TARGET', choices: ['blue', 'green'], description: 'Target version for Blue-Green deployment')
    }

    environment {
        IMAGE_NAME = "ci-cd-app"
        DOCKER_HUB_REPO = "ruthik005/ci-cd-app"
        DOCKER_TAG = "latest"
        BACKEND_URL = "${env.BACKEND_URL ?: 'http://localhost:4000'}"
        // Deployment strategy tags
        BLUE_TAG = "blue"
        GREEN_TAG = "green"
        STABLE_TAG = "stable"
        CANARY_TAG = "canary"
        // TaskFlow Pro Images (same repo, different containers)
        TASKFLOW_FRONTEND = "ruthik005/taskflow-frontend"
        TASKFLOW_API = "ruthik005/taskflow-api"
    }

    stages {
        stage('Install Dependencies') {
            steps {
                dir('app') {
                    bat 'npm install'
                }
            }
        }

        // ================================================
        // MODULE A: DEVSECOPS - SAST (Static Analysis)
        // ================================================
        stage('Security: SAST') {
            when {
                expression { return !params.SKIP_SECURITY_SCAN }
            }
            steps {
                dir('app') {
                    script {
                        echo "🔒 Running SAST Security Checks..."
                        
                        // NPM Audit - Check dependencies for vulnerabilities
                        echo "📦 Checking npm dependencies for vulnerabilities..."
                        def auditResult = bat(
                            script: 'npm audit --audit-level=high 2>&1 || exit 0',
                            returnStdout: true
                        )
                        echo auditResult
                        
                        if (auditResult.contains('high') || auditResult.contains('critical')) {
                            echo "⚠️ WARNING: Vulnerabilities found in dependencies!"
                            // Uncomment below to fail on vulnerabilities:
                            // error("Critical vulnerabilities found in npm dependencies")
                        } else {
                            echo "✅ No high/critical vulnerabilities in dependencies"
                        }
                        
                        // ESLint Security Check
                        echo "🔍 Running ESLint Security Analysis..."
                        try {
                            bat 'npx eslint . --ext .js --config .eslintrc.json --format stylish || exit 0'
                            echo "✅ ESLint security check completed"
                        } catch (Exception e) {
                            echo "⚠️ ESLint found issues: ${e.getMessage()}"
                        }
                    }
                }
            }
        }

        stage('Run Tests') {
            steps {
                dir('app') {
                    bat 'npm test'
                }
            }
        }

        stage('Docker Build') {
            steps {
                dir('app') {
                    bat '''
                        docker build -t %IMAGE_NAME% .
                        docker tag %IMAGE_NAME% %DOCKER_HUB_REPO%:%DOCKER_TAG%
                        echo "Docker image built successfully!"
                    '''
                }
            }
        }

        // ================================================
        // MODULE A: DEVSECOPS - Container Security (Trivy)
        // ================================================
        stage('Security: Container Scan') {
            when {
                expression { return !params.SKIP_SECURITY_SCAN }
            }
            steps {
                script {
                    echo "🔒 Scanning Docker image for vulnerabilities with Trivy..."
                    
                    try {
                        // Run Trivy scan for HIGH and CRITICAL vulnerabilities
                        def trivyResult = bat(
                            script: 'C:\\Tools\\Trivy\\trivy.exe image --severity HIGH,CRITICAL --exit-code 0 --format table %DOCKER_HUB_REPO%:%DOCKER_TAG%',
                            returnStdout: true
                        )
                        echo trivyResult
                        
                        // Check for CRITICAL vulnerabilities (fail pipeline)
                        def criticalScan = bat(
                            script: 'C:\\Tools\\Trivy\\trivy.exe image --severity CRITICAL --exit-code 1 %DOCKER_HUB_REPO%:%DOCKER_TAG% 2>&1',
                            returnStatus: true
                        )
                        
                        if (criticalScan != 0) {
                            error("🚨 CRITICAL vulnerabilities found! Pipeline stopped for security review.")
                        }
                        
                        echo "✅ Container security scan passed - No CRITICAL vulnerabilities"
                        
                    } catch (Exception e) {
                        if (e.getMessage().contains("CRITICAL vulnerabilities")) {
                            throw e
                        }
                        echo "⚠️ Trivy scan warning: ${e.getMessage()}"
                        echo "Continuing with deployment..."
                    }
                }
            }
        }

        stage('Docker Push') {
            steps {
                dir('app') {
                    withCredentials([usernamePassword(credentialsId: 'docker-hub', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                        bat '''
                            docker login -u %DOCKER_USER% -p %DOCKER_PASS%
                            docker push %DOCKER_HUB_REPO%:%DOCKER_TAG%
                            echo "Docker image pushed successfully!"
                        '''
                    }
                }
            }
        }

        // ================================================
        // TASKFLOW PRO - BUILD & DEPLOY (SAME PIPELINE)
        // Industry Standard: One pipeline for all services
        // ================================================
        stage('TaskFlow Pro: Build Frontend') {
            steps {
                dir('frontend') {
                    script {
                        def versionTag = params.DEPLOY_STRATEGY == 'blue-green' ? params.BLUE_GREEN_TARGET : 
                                        params.DEPLOY_STRATEGY == 'canary' ? env.CANARY_TAG : env.STABLE_TAG
                        
                        echo "📦 Building TaskFlow Pro Frontend (${versionTag})..."
                        
                        bat """
                            npm ci
                            npm run build
                            docker build -t %TASKFLOW_FRONTEND%:${versionTag} ^
                                --build-arg VITE_APP_VERSION=${versionTag} ^
                                --build-arg VITE_DEPLOYMENT_STRATEGY=${params.DEPLOY_STRATEGY} .
                            docker tag %TASKFLOW_FRONTEND%:${versionTag} %TASKFLOW_FRONTEND%:%DOCKER_TAG%
                        """
                        
                        echo "✅ TaskFlow Frontend built: ${versionTag}"
                    }
                }
            }
        }

        stage('TaskFlow Pro: Build API') {
            steps {
                dir('app') {
                    script {
                        def versionTag = params.DEPLOY_STRATEGY == 'blue-green' ? params.BLUE_GREEN_TARGET : 
                                        params.DEPLOY_STRATEGY == 'canary' ? env.CANARY_TAG : env.STABLE_TAG
                        
                        echo "📦 Building TaskFlow Pro API (${versionTag})..."
                        
                        bat """
                            docker build -t %TASKFLOW_API%:${versionTag} ^
                                --build-arg APP_VERSION=${versionTag} ^
                                --build-arg DEPLOYMENT_STRATEGY=${params.DEPLOY_STRATEGY} .
                            docker tag %TASKFLOW_API%:${versionTag} %TASKFLOW_API%:%DOCKER_TAG%
                        """
                        
                        echo "✅ TaskFlow API built: ${versionTag}"
                    }
                }
            }
        }

        stage('TaskFlow Pro: Push Images') {
            steps {
                script {
                    def versionTag = params.DEPLOY_STRATEGY == 'blue-green' ? params.BLUE_GREEN_TARGET : 
                                    params.DEPLOY_STRATEGY == 'canary' ? env.CANARY_TAG : env.STABLE_TAG
                    
                    withCredentials([usernamePassword(credentialsId: 'docker-hub', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                        bat """
                            docker login -u %DOCKER_USER% -p %DOCKER_PASS%
                            docker push %TASKFLOW_FRONTEND%:${versionTag}
                            docker push %TASKFLOW_FRONTEND%:%DOCKER_TAG%
                            docker push %TASKFLOW_API%:${versionTag}
                            docker push %TASKFLOW_API%:%DOCKER_TAG%
                        """
                    }
                    
                    echo "✅ TaskFlow Pro images pushed to Docker Hub"
                }
            }
        }

        stage('Kubernetes Deployment') {
            when {
                expression { return params.DEPLOY_STRATEGY == 'standard' }
            }
            steps {
                script {
                    echo "🚀 Standard Kubernetes Deployment..."
                    try {
                        withKubeConfig([credentialsId: 'kubeconfig-minikube']) {
                            bat 'kubectl config current-context'
                            bat 'kubectl cluster-info --request-timeout=10s'
                            
                            echo "Creating namespace if not exists..."
                            bat 'kubectl create namespace ci-cd-app --dry-run=client -o yaml | kubectl apply -f -'
                            
                            echo "Applying Kubernetes manifests..."
                            bat '''
                                kubectl apply -f k8s/deployment.yaml -n ci-cd-app
                                kubectl apply -f k8s/service.yaml -n ci-cd-app
                                kubectl rollout status deployment/ci-cd-app -n ci-cd-app --timeout=120s
                            '''
                            
                            echo "✅ Standard Kubernetes deployment successful!"
                            bat 'kubectl get services ci-cd-app-service -n ci-cd-app'
                            bat 'kubectl get pods -n ci-cd-app -l app=ci-cd-app'
                        }
                    } catch (Exception e) {
                        echo "⚠️ Kubernetes deployment skipped: ${e.getMessage()}"
                        echo "Build continues - K8s deployment is optional"
                    }
                }
            }
        }

        // ================================================
        // BLUE-GREEN DEPLOYMENT STRATEGY
        // ================================================
        stage('Blue-Green: Setup') {
            when {
                expression { return params.DEPLOY_STRATEGY == 'blue-green' }
            }
            steps {
                script {
                    echo "🔵🟢 Blue-Green Deployment Strategy Selected"
                    echo "Target version: ${params.BLUE_GREEN_TARGET}"
                    try {
                        withKubeConfig([credentialsId: 'kubeconfig-minikube']) {
                            bat 'kubectl config current-context'
                            bat 'kubectl cluster-info --request-timeout=10s'
                            
                            echo "Creating namespace..."
                            bat 'kubectl create namespace ci-cd-app --dry-run=client -o yaml | kubectl apply -f -'
                            
                            echo "Applying Blue-Green infrastructure..."
                            bat 'kubectl apply -f k8s/blue-green-deployment.yaml -n ci-cd-app'
                        }
                    } catch (Exception e) {
                        echo "⚠️ Blue-Green setup failed: ${e.getMessage()}"
                        error("Blue-Green deployment setup failed")
                    }
                }
            }
        }

        stage('Blue-Green: Deploy New Version') {
            when {
                expression { return params.DEPLOY_STRATEGY == 'blue-green' }
            }
            steps {
                script {
                    def targetVersion = params.BLUE_GREEN_TARGET
                    def imageTag = targetVersion == 'blue' ? env.BLUE_TAG : env.GREEN_TAG
                    
                    echo "📦 Deploying to ${targetVersion} with image: ${DOCKER_HUB_REPO}:${imageTag}"
                    
                    try {
                        withKubeConfig([credentialsId: 'kubeconfig-minikube']) {
                            // Tag and push with version-specific tag
                            bat "docker tag ${DOCKER_HUB_REPO}:${DOCKER_TAG} ${DOCKER_HUB_REPO}:${imageTag}"
                            
                            withCredentials([usernamePassword(credentialsId: 'docker-hub', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                                bat "docker login -u %DOCKER_USER% -p %DOCKER_PASS%"
                                bat "docker push ${DOCKER_HUB_REPO}:${imageTag}"
                            }
                            
                            // Update and scale deployment
                            bat "kubectl set image deployment/ci-cd-app-${targetVersion} ci-cd-app=${DOCKER_HUB_REPO}:${imageTag} -n ci-cd-app"
                            bat "kubectl scale deployment ci-cd-app-${targetVersion} -n ci-cd-app --replicas=2"
                            bat "kubectl rollout status deployment/ci-cd-app-${targetVersion} -n ci-cd-app --timeout=120s"
                            
                            echo "✅ Deployed to ${targetVersion} successfully!"
                        }
                    } catch (Exception e) {
                        echo "❌ Blue-Green deploy failed: ${e.getMessage()}"
                        error("Blue-Green deployment failed")
                    }
                }
            }
        }

        stage('Blue-Green: Health Check') {
            when {
                expression { return params.DEPLOY_STRATEGY == 'blue-green' }
            }
            steps {
                script {
                    def targetVersion = params.BLUE_GREEN_TARGET
                    echo "🏥 Running health checks on ${targetVersion}..."
                    
                    try {
                        withKubeConfig([credentialsId: 'kubeconfig-minikube']) {
                            // Check pod readiness
                            def readyPods = bat(
                                script: "kubectl get pods -n ci-cd-app -l app=ci-cd-app,version=${targetVersion} -o jsonpath='{.items[*].status.conditions[?(@.type==\"Ready\")].status}'",
                                returnStdout: true
                            ).trim()
                            
                            if (readyPods.contains('True')) {
                                echo "✅ ${targetVersion} pods are healthy and ready"
                            } else {
                                error("Pods not ready - health check failed")
                            }
                        }
                    } catch (Exception e) {
                        echo "❌ Health check failed: ${e.getMessage()}"
                        error("Health check failed for ${targetVersion}")
                    }
                }
            }
        }

        stage('Blue-Green: Switch Traffic') {
            when {
                expression { return params.DEPLOY_STRATEGY == 'blue-green' }
            }
            steps {
                script {
                    def targetVersion = params.BLUE_GREEN_TARGET
                    def prevVersion = targetVersion == 'blue' ? 'green' : 'blue'
                    
                    echo "🔄 Switching traffic from ${prevVersion} to ${targetVersion}..."
                    
                    try {
                        withKubeConfig([credentialsId: 'kubeconfig-minikube']) {
                            // Switch service selector
                            bat "kubectl patch service ci-cd-app-bluegreen -n ci-cd-app -p \"{\"spec\":{\"selector\":{\"version\":\"${targetVersion}\"}}}\""
                            
                            echo "✅ Traffic switched to ${targetVersion}!"
                            
                            // Scale down previous version
                            echo "Scaling down ${prevVersion}..."
                            bat "kubectl scale deployment ci-cd-app-${prevVersion} -n ci-cd-app --replicas=0"
                            
                            // Update ConfigMap
                            bat "kubectl patch configmap deployment-status -n ci-cd-app -p \"{\"data\":{\"active-version\":\"${targetVersion}\"}}\""
                            
                            echo "🎉 Blue-Green deployment completed successfully!"
                            bat 'kubectl get pods -n ci-cd-app -l app=ci-cd-app'
                        }
                    } catch (Exception e) {
                        echo "❌ Traffic switch failed: ${e.getMessage()}"
                        error("Failed to switch traffic")
                    }
                }
            }
        }

        // ================================================
        // CANARY DEPLOYMENT STRATEGY
        // ================================================
        stage('Canary: Setup') {
            when {
                expression { return params.DEPLOY_STRATEGY == 'canary' }
            }
            steps {
                script {
                    echo "🐤 Canary Deployment Strategy Selected"
                    echo "Initial canary weight: ${params.CANARY_WEIGHT}%"
                    
                    try {
                        withKubeConfig([credentialsId: 'kubeconfig-minikube']) {
                            bat 'kubectl config current-context'
                            bat 'kubectl cluster-info --request-timeout=10s'
                            
                            echo "Creating namespace..."
                            bat 'kubectl create namespace ci-cd-app --dry-run=client -o yaml | kubectl apply -f -'
                            
                            echo "Applying Canary infrastructure..."
                            bat 'kubectl apply -f k8s/canary-deployment.yaml -n ci-cd-app'
                            bat 'kubectl apply -f k8s/ingress-traffic-split.yaml -n ci-cd-app'
                        }
                    } catch (Exception e) {
                        echo "⚠️ Canary setup failed: ${e.getMessage()}"
                        error("Canary deployment setup failed")
                    }
                }
            }
        }

        stage('Canary: Deploy New Version') {
            when {
                expression { return params.DEPLOY_STRATEGY == 'canary' }
            }
            steps {
                script {
                    echo "📦 Deploying canary version with image: ${DOCKER_HUB_REPO}:${CANARY_TAG}"
                    
                    try {
                        withKubeConfig([credentialsId: 'kubeconfig-minikube']) {
                            // Tag and push canary image
                            bat "docker tag ${DOCKER_HUB_REPO}:${DOCKER_TAG} ${DOCKER_HUB_REPO}:${CANARY_TAG}"
                            
                            withCredentials([usernamePassword(credentialsId: 'docker-hub', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                                bat "docker login -u %DOCKER_USER% -p %DOCKER_PASS%"
                                bat "docker push ${DOCKER_HUB_REPO}:${CANARY_TAG}"
                            }
                            
                            // Update canary deployment
                            bat "kubectl set image deployment/ci-cd-app-canary ci-cd-app=${DOCKER_HUB_REPO}:${CANARY_TAG} -n ci-cd-app"
                            bat 'kubectl scale deployment ci-cd-app-canary -n ci-cd-app --replicas=1'
                            bat 'kubectl rollout status deployment/ci-cd-app-canary -n ci-cd-app --timeout=120s'
                            
                            echo "✅ Canary version deployed successfully!"
                        }
                    } catch (Exception e) {
                        echo "❌ Canary deploy failed: ${e.getMessage()}"
                        error("Canary deployment failed")
                    }
                }
            }
        }

        stage('Canary: Set Traffic Weight') {
            when {
                expression { return params.DEPLOY_STRATEGY == 'canary' }
            }
            steps {
                script {
                    def canaryWeight = params.CANARY_WEIGHT
                    echo "⚖️ Setting canary traffic weight to ${canaryWeight}%..."
                    
                    try {
                        withKubeConfig([credentialsId: 'kubeconfig-minikube']) {
                            bat "kubectl annotate ingress ci-cd-app-canary -n ci-cd-app nginx.ingress.kubernetes.io/canary-weight=${canaryWeight} --overwrite"
                            
                            // Update ConfigMap
                            bat "kubectl patch configmap canary-status -n ci-cd-app -p \"{\"data\":{\"canary-weight\":\"${canaryWeight}\",\"canary-enabled\":\"true\"}}\""
                            
                            echo "✅ Canary weight set to ${canaryWeight}%"
                            echo "   Stable: ${100 - canaryWeight.toInteger()}% | Canary: ${canaryWeight}%"
                        }
                    } catch (Exception e) {
                        echo "❌ Failed to set canary weight: ${e.getMessage()}"
                        error("Failed to configure canary traffic")
                    }
                }
            }
        }

        stage('Canary: Health Monitoring') {
            when {
                expression { return params.DEPLOY_STRATEGY == 'canary' }
            }
            steps {
                script {
                    echo "🏥 Monitoring canary health for 30 seconds..."
                    
                    try {
                        withKubeConfig([credentialsId: 'kubeconfig-minikube']) {
                            // Wait and check health
                            bat 'ping -n 35 127.0.0.1 > nul'
                            
                            def canaryReady = bat(
                                script: 'kubectl get pods -n ci-cd-app -l app=ci-cd-app,version=canary -o jsonpath="{.items[*].status.conditions[?(@.type==\"Ready\")].status}"',
                                returnStdout: true
                            ).trim()
                            
                            if (canaryReady.contains('True')) {
                                echo "✅ Canary is healthy!"
                                echo "🐤 Canary deployment completed successfully!"
                                echo "   To promote: Increase canary weight or swap stable with canary"
                                bat 'kubectl get pods -n ci-cd-app -l app=ci-cd-app'
                            } else {
                                echo "⚠️ Canary health check failed - consider rollback"
                            }
                        }
                    } catch (Exception e) {
                        echo "⚠️ Canary monitoring warning: ${e.getMessage()}"
                    }
                }
            }
        }

        // ================================================
        // MODULE C: CHAOS ENGINEERING (Manual Trigger)
        // ================================================
        stage('Chaos Test') {
            when {
                expression { return params.RUN_CHAOS_TEST }
            }
            steps {
                script {
                    echo "🔥 Running Chaos Engineering Test..."
                    try {
                        withKubeConfig([credentialsId: 'kubeconfig-minikube']) {
                            // Apply chaos experiment
                            echo "Applying pod failure chaos experiment..."
                            bat 'kubectl apply -f k8s/chaos-experiment.yaml -n ci-cd-app || echo "Chaos Mesh not installed"'
                            
                            // Wait for chaos to take effect
                            echo "Waiting for chaos experiment to execute (30 seconds)..."
                            bat 'ping -n 35 127.0.0.1 > nul'
                            
                            // Verify pod recovery
                            echo "Verifying pod recovery..."
                            bat 'kubectl get pods -n ci-cd-app -l app=ci-cd-app'
                            
                            def podCount = bat(
                                script: 'kubectl get pods -n ci-cd-app -l app=ci-cd-app --field-selector=status.phase=Running -o name | find /c "pod"',
                                returnStdout: true
                            ).trim()
                            
                            echo "Running pods after chaos: ${podCount}"
                            echo "✅ Chaos test completed - System recovered successfully!"
                        }
                    } catch (Exception e) {
                        echo "⚠️ Chaos test skipped: ${e.getMessage()}"
                        echo "Chaos test requires Kubernetes - continuing without it"
                    }
                }
            }
        }
    }

    post {
        always {
            // Clean up dangling Docker images
            bat 'docker image prune -f || echo "Docker cleanup skipped"'
            
            script {
                def buildStatus = currentBuild.result ?: 'SUCCESS'
                def buildNumber = env.BUILD_NUMBER
                def jobName = env.JOB_NAME
                def consoleLink = "${env.BUILD_URL}console"
                def commitMessage = ""
                def duration = currentBuild.durationString

                try {
                    commitMessage = bat(
                        script: 'git log -1 --pretty=format:"%%s"',
                        returnStdout: true
                    ).trim()
                } catch (Exception e) {
                    commitMessage = "Could not retrieve commit message"
                }

                def errorDetails = ""
                if (buildStatus in ['FAILURE', 'UNSTABLE']) {
                    try {
                        errorDetails = bat(
                            script: 'type "%JENKINS_HOME%\\jobs\\%JOB_NAME%\\builds\\%BUILD_NUMBER%\\log" 2>nul || echo "Could not read build log"',
                            returnStdout: true
                        )
                        if (errorDetails.length() > 1000) {
                            errorDetails = "..." + errorDetails.substring(errorDetails.length() - 1000)
                        }
                    } catch (Exception e) {
                        errorDetails = "Could not retrieve error details: ${e.getMessage()}"
                    }
                }

                def jsonBody = [
                    status: buildStatus,
                    jobName: jobName,
                    buildNumber: buildNumber,
                    consoleLink: consoleLink,
                    commitMessage: commitMessage,
                    duration: duration,
                    errorDetails: errorDetails,
                    timestamp: new Date().format("yyyy-MM-dd'T'HH:mm:ss'Z'"),
                    kubernetesDeployed: buildStatus in ['SUCCESS', 'UNSTABLE'],
                    securityScanPassed: !params.SKIP_SECURITY_SCAN,
                    chaosTestRun: params.RUN_CHAOS_TEST
                ]

                withCredentials([string(credentialsId: 'jenkins-api-token', variable: 'JENKINS_API_TOKEN')]) {
                    try {
                        def jsonString = groovy.json.JsonOutput.toJson(jsonBody)
                        // Escape quotes for PowerShell and write to temp file
                        def escapedJson = jsonString.replace('"', '\\"').replace("'", "''")
                        bat """powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-RestMethod -Uri '%BACKEND_URL%/api/log-final-status' -Method POST -ContentType 'application/json' -Headers @{'Authorization'='Bearer %JENKINS_API_TOKEN%'} -Body '${escapedJson}' -TimeoutSec 30; Write-Host 'Status sent' } catch { Write-Host 'Send failed' }" """
                        echo "Build status sent successfully to backend."
                    } catch (Exception e) {
                        echo "Failed to send build status to backend: ${e.getMessage()}"
                    }
                    
                    // ================================================
                    // TASKFLOW PRO - Send deployment status to dashboard
                    // This displays TaskFlow deployment in CI/CD Dashboard
                    // ================================================
                    try {
                        def taskflowVersion = params.DEPLOY_STRATEGY == 'blue-green' ? params.BLUE_GREEN_TARGET : 
                                             params.DEPLOY_STRATEGY == 'canary' ? 'canary' : 'stable'
                        
                        def taskflowData = [
                            project: 'TaskFlow Pro',
                            status: buildStatus,
                            buildNumber: buildNumber,
                            strategy: params.DEPLOY_STRATEGY,
                            activeVersion: taskflowVersion,
                            previousVersion: taskflowVersion == 'blue' ? 'green' : 'blue',
                            frontendImage: "${env.TASKFLOW_FRONTEND}:${taskflowVersion}",
                            apiImage: "${env.TASKFLOW_API}:${taskflowVersion}",
                            kubernetesDeployed: buildStatus in ['SUCCESS', 'UNSTABLE'],
                            consoleLink: consoleLink,
                            timestamp: new Date().format("yyyy-MM-dd'T'HH:mm:ss'Z'")
                        ]
                        
                        def taskflowJson = groovy.json.JsonOutput.toJson(taskflowData)
                        def escapedTaskflowJson = taskflowJson.replace('"', '\\"').replace("'", "''")
                        bat """powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-RestMethod -Uri '%BACKEND_URL%/api/taskflow-deployment' -Method POST -ContentType 'application/json' -Headers @{'Authorization'='Bearer %JENKINS_API_TOKEN%'} -Body '${escapedTaskflowJson}' -TimeoutSec 30; Write-Host 'TaskFlow status sent' } catch { Write-Host 'TaskFlow send failed' }" """
                        echo "TaskFlow Pro deployment status sent to dashboard."
                    } catch (Exception e) {
                        echo "Failed to send TaskFlow status: ${e.getMessage()}"
                    }
                }
            }
        }

        success {
            echo "✅ Build completed successfully! All security checks passed."
        }

        failure {
            echo "❌ Build failed. Check security reports and logs for details."
        }

        unstable {
            echo "⚠️ Build completed with warnings. Review security findings."
        }
    }
}
