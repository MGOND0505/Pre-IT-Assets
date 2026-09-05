pipeline {
    agent any

    stages {
        stage('Gitleaks Secret Scan') {
            steps {
                sh '''
                    gitleaks detect --source=. --no-git --verbose --exit-code 0
                '''
            }
        }

        stage('SonarQube Analysis') {
            steps {
                script {
                    def scannerHome = tool 'SonarScanner'
                    withSonarQubeEnv('SonarQube-Server') {
                        withCredentials([string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN')]) {
                            sh "${scannerHome}/bin/sonar-scanner -Dsonar.token=${SONAR_TOKEN}"
                        }
                    }
                }
            }
        }

        stage('Trivy Security Scan') {
            steps {
                sh '''
                    trivy fs --exit-code 0 --severity HIGH,CRITICAL --format template --template "@/var/jenkins_home/html.tpl" -o trivy-report.html .
                '''
                publishHTML([
                    allowMissing: false,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: '.',
                    reportFiles: 'trivy-report.html',
                    reportName: 'Trivy Security Report'
                ])
            }
        }

        stage('Deploy to Live Server') {
            steps {
                sshPublisher(publishers: [
                    sshPublisherDesc(
                        configName: 'Live-Server',
                        transfers: [
                            sshTransfer(
                                cleanRemote: false,
                                excludes: '**/.git/**, **/.scannerwork/**, **/node_modules/**',
                                execCommand: '''
                                    echo "Deploying update via PM2..."
                                    cd /var/www/backend
                                    npm install
                                    npm run build
                                    pm2 restart it-asset-backend || pm2 start dist/server.js --name "it-asset-backend"
                                    pm2 save

                                    echo "Ensuring cache/log cleanup cron job exists..."
                                    if [ -f "ops/cleanup-cache.sh" ]; then
                                        chmod +x ops/cleanup-cache.sh
                                        if command -v crontab >/dev/null 2>&1; then
                                            CRON_LINE="0 3 */2 * * /var/www/backend/ops/cleanup-cache.sh >> /var/www/backend/ops/cleanup.log 2>&1"
                                            (crontab -l 2>/dev/null | grep -v "ops/cleanup-cache.sh" ; echo "$CRON_LINE") | crontab -
                                        else
                                            echo "crontab utility not found, skipping cron schedule."
                                        fi
                                    fi
                                ''',
                                execTimeout: 120000,
                                flatten: false,
                                makeEmptyDirs: false,
                                remoteDirectory: '',
                                removePrefix: '',
                                sourceFiles: 'backend/**, package*.json'
                            )
                        ],
                        usePromotionTimestamp: false,
                        useWorkspaceInPromotion: false,
                        verbose: true
                    )
                ])
            }
        }

        stage('OWASP ZAP DAST Scan') {
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'SUCCESS') {
                    sh '''
                        docker run -u 0 --rm --net=host \
                          -v jenkins_home:/zap/wrk/:rw \
                          zaproxy/zap-stable zap-baseline.py \
                          -t http://129.121.102.233:3000 \
                          -r workspace/IT-Asset-integration/zap-report.html \
                          -I
                    '''
                }
                publishHTML([
                    allowMissing: true,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: '.',
                    reportFiles: 'zap-report.html',
                    reportName: 'OWASP ZAP DAST Report'
                ])
            }
        }
    }
}