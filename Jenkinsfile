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
                                    echo "Starting application on live server..."
                                    cd /var/www/backend
                                    npm install --production || true
                                    pkill -f "node" || true
                                    nohup npm start > app.log 2>&1 &
                                    sleep 5
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
                sh '''
                    # Jenkins volume ko direct /zap/wrk par mount karein
                    docker run -u 0 --rm --net=host \
                      -v jenkins_home:/zap/wrk/:rw \
                      zaproxy/zap-stable zap-baseline.py \
                      -t http://129.121.102.233:3000 \
                      -r workspace/IT-Asset-integration/zap-report.html \
                      -I || true
                '''
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
